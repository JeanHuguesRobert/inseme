import * as cheerio from "cheerio";
import { createClient } from "@supabase/supabase-js";
import { loadConfig, getConfig } from "../../../../cop-host/src/scripts/config";
import {
  fetchAndStoreRawDocument,
  ensureSource,
  startCrawlRun,
  finishCrawlRun,
} from "./lib/crawler.js";

// Load config
await loadConfig();

const SUPABASE_URL = getConfig("supabase_url");
const SUPABASE_SERVICE_ROLE_KEY = getConfig("supabase_service_role_key");
const AGENDA_URL =
  getConfig("MAIRIE_AGENDA_URL") ||
  "https://www.mairie-corte.fr/modules.php?name=Calendrier&op=listemanifs";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function parseDetail(html) {
  const $ = cheerio.load(html);
  // Example selectors based on typical PhP-Nuke or similar CMS structures often found in mairies
  // We need to adapt this to the specific HTML structure of Mairie Corte
  // Since I can't browse, I'll use generic heuristics and placeholders.

  // Title: usually in a specific header
  const title = $("h1, h2, .titre").first().text().trim();

  // Content
  const contentHtml = $(".contenu, .corpsevt, #contenu").html() || "";
  const contentText = $(".contenu, .corpsevt, #contenu").text().trim();

  // Dates: "Du Samedi 06 décembre 2025 à 10h00 au Dimanche 07 décembre 2025 à 17h00"
  // Need regex to parse this string often found in the body or specific div
  let startDate = null;
  let endDate = null;

  // Basic date extraction logic (placeholder)
  const dateRegex = /(\d{1,2})\s+([a-zéû]+)\s+(\d{4})/i;
  // TODO: Refine regex based on actual page content

  return { title, contentHtml, contentText, startDate, endDate };
}

async function main() {
  const sourceId = await ensureSource({
    label: "Mairie de Corte - Agenda",
    baseUrl: "https://www.mairie-corte.fr/",
  });

  const runId = await startCrawlRun(sourceId);
  console.log(`Started crawl run ${runId}`);

  try {
    // 1. Fetch List
    // We assume the list page contains links to details
    const { content: listHtml } = await fetchAndStoreRawDocument({
      url: AGENDA_URL,
      sourceId,
      crawlRunId: runId,
    });

    const $ = cheerio.load(listHtml);
    const links = [];
    $("a[href*='op=viewmanif']").each((_, el) => {
      const href = $(el).attr("href");
      if (href) links.push(new URL(href, "https://www.mairie-corte.fr/").href);
    });

    console.log(`Found ${links.length} events.`);

    // 2. Process Details
    for (const link of links) {
      const { content: detailHtml, rawDocId } = await fetchAndStoreRawDocument({
        url: link,
        sourceId,
        crawlRunId: runId,
      });

      if (!detailHtml) continue;

      const parsed = parseDetail(detailHtml);

      // Upsert into posts
      // metadata: { source_url: link, raw_doc_id: rawDocId, event_start: ..., event_end: ... }

      const post = {
        title: parsed.title,
        content: parsed.contentHtml, // or parsed.contentText
        type: "event",
        user_id: null, // System user or leave null? Maybe specific 'bot' user
        metadata: {
          source_url: link,
          raw_document_id: rawDocId,
          event_start: parsed.startDate,
          event_end: parsed.endDate,
        },
        // We need a unique constraint or check ID.
        // For external sync, maybe store external_id in metadata and check it.
        // Or upsert on a stable slug if valid.
      };

      // For "events", we might not have a dedicated table in original schema, but new plan uses 'posts'.
      // But 'posts' usually requires a user_id.
      // We'll skip actual upsert implementation details until we have a bot user ID.
      // Or we assume a trigger defaults it.

      console.log(`Parsed event: ${parsed.title}`);
    }

    await finishCrawlRun(runId, "ok");
  } catch (e) {
    console.error(e);
    await finishCrawlRun(runId, "error", e.message);
  }
}

main();
