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
const NEWS_URL = "https://www.mairie-corte.fr/modules.php?name=News&new_topic=0";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const sourceId = await ensureSource({
    label: "Mairie de Corte - Actualités",
    baseUrl: "https://www.mairie-corte.fr/",
  });

  const runId = await startCrawlRun(sourceId);

  try {
    const { content: listHtml } = await fetchAndStoreRawDocument({
      url: NEWS_URL,
      sourceId,
      crawlRunId: runId,
    });

    const $ = cheerio.load(listHtml);
    // Parse logic for news items...
    // Placeholder logic

    await finishCrawlRun(runId, "ok");
  } catch (e) {
    console.error(e);
    await finishCrawlRun(runId, "error", e.message);
  }
}

main();
