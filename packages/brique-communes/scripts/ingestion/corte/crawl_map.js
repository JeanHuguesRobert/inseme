import * as cheerio from "cheerio";
import { createClient } from "@supabase/supabase-js";
import { loadConfig, getConfig } from "../../../../cop-host/src/scripts/config";
import {
  fetchAndStoreRawDocument,
  ensureSource,
  startCrawlRun,
  finishCrawlRun,
} from "./lib/crawler.js";

await loadConfig();

const SUPABASE_URL = getConfig("supabase_url");
const SUPABASE_SERVICE_ROLE_KEY = getConfig("supabase_service_role_key");
// Placeholder URL, user provided a specific one or we parse it from the iframe
const MAP_XML_URL = "https://www.mairie-corte.fr/xml/xml_carto.php";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const sourceId = await ensureSource({
    label: "Mairie de Corte - Carte Interactive",
    baseUrl: "https://www.mairie-corte.fr/",
  });

  const runId = await startCrawlRun(sourceId);

  try {
    const { content: xmlData, rawDocId } = await fetchAndStoreRawDocument({
      url: MAP_XML_URL,
      sourceId,
      crawlRunId: runId,
    });

    if (!xmlData) throw new Error("No XML data");

    const $ = cheerio.load(xmlData, { xmlMode: true });

    const points = [];
    $("point").each((_, el) => {
      const $el = $(el);
      points.push({
        source_poi_id: $el.attr("id"),
        name: $el.find("titre").text(), // or 'lieu' depending on schema
        lat: parseFloat($el.find("lat").text()),
        lng: parseFloat($el.find("lng").text()),
        category: $el.find("rubrique").text(),
        description: $el.find("texte").text(),

        // We'll create the record object
        record: {
          source_id: sourceId,
          source_poi_id: $el.attr("id"),
          raw_document_id: rawDocId,
          name: $el.find("titre").text() || "Sans titre",
          category: $el.find("rubrique").text(), // map to standard category if needed
          description: $el.find("texte").text(),
          latitude: parseFloat($el.find("lat").text()),
          longitude: parseFloat($el.find("lng").text()),
          // geom is generated always
        },
      });
    });

    console.log(`Found ${points.length} POIs.`);

    for (const p of points) {
      if (!p.record.latitude || !p.record.longitude) continue;

      const { error } = await supabase
        .from("municipal_poi")
        .upsert(p.record, { onConflict: "source_id, source_poi_id" }); // requires unique constraint on (source_id, source_poi_id) which we should add if missing

      if (error) console.error(`Error POI ${p.name}:`, error.message);
    }

    await finishCrawlRun(runId, "ok");
  } catch (e) {
    console.error(e);
    await finishCrawlRun(runId, "error", e.message);
  }
}

main();
