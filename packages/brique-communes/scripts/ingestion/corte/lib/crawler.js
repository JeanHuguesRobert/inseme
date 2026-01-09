import crypto from "crypto";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import { loadConfig, getConfig } from "../../../../../cop-host/src/scripts/config";

// Load configuration
await loadConfig();

const SUPABASE_URL = getConfig("supabase_url");
const SUPABASE_SERVICE_ROLE_KEY = getConfig("supabase_service_role_key");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Calculates SHA-256 hash of content
 * @param {string} content
 * @returns {string} hex hash
 */
export function hashContent(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Fetches a URL and stores it in municipal_raw_documents.
 * Checks for existing hash to avoid duplication.
 * @param {object} params
 * @param {string} params.url - URL to fetch
 * @param {string} params.sourceId - ID from sources_web
 * @param {string} [params.crawlRunId] - ID from crawl_runs
 * @param {object} [params.metadata] - Additional metadata
 * @returns {Promise<object>} { rawDocId: string, isNew: boolean, content: string, error: any }
 */
export async function fetchAndStoreRawDocument({ url, sourceId, crawlRunId, metadata = {} }) {
  console.log(`GET ${url}`);
  try {
    const res = await axios.get(url, {
      timeout: 30000,
      responseType: "arraybuffer", // handle binary if needed, but usually text for html
    });

    const contentType = res.headers["content-type"];
    const isText =
      contentType &&
      (contentType.includes("text") || contentType.includes("json") || contentType.includes("xml"));

    let bodyText = null;
    let bodyBuffer = null;

    if (isText) {
      bodyText = res.data.toString("utf8");
    } else {
      bodyBuffer = res.data;
    }

    // Hash content (using text if available, else buffer)
    const content = bodyText || bodyBuffer;
    const hash = hashContent(content);

    // 1. Check if exists
    const { data: existing } = await supabase
      .from("municipal_raw_documents")
      .select("id, hash_content")
      .eq("url", url)
      .eq("hash_content", hash)
      .maybeSingle();

    if (existing) {
      console.log(`  -> Document unchanged (id: ${existing.id})`);
      return { rawDocId: existing.id, isNew: false, content: bodyText, error: null };
    }

    // 2. Insert new version
    const { data: newDoc, error } = await supabase
      .from("municipal_raw_documents")
      .insert({
        source_id: sourceId,
        crawl_run_id: crawlRunId,
        url: url,
        content_type: contentType,
        http_status: res.status,
        etag: res.headers["etag"],
        last_modified: res.headers["last-modified"],
        body: bodyBuffer ? Buffer.from(bodyBuffer).toString("base64") : null, // Store binary as base64 or Use storage? keeping it simple for now (bytea column supports binary but JS client handles it differently)
        // Adjusting: if column is bytea, we might need special handling.
        // For 'body_text', we store the text.
        body_text: bodyText,
        hash_content: hash,
        metadata: metadata,
      })
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    console.log(`  -> Stored new version (id: ${newDoc.id})`);
    return { rawDocId: newDoc.id, isNew: true, content: bodyText, error: null };
  } catch (error) {
    console.error(`Error fetching ${url}:`, error.message);
    return { rawDocId: null, isNew: false, content: null, error };
  }
}

/**
 * Ensures a source exists in sources_web
 */
export async function ensureSource({ label, baseUrl }) {
  const { data: source, error } = await supabase
    .from("sources_web")
    .select("id")
    .eq("label", label)
    .maybeSingle();

  if (source) return source.id;

  const { data: newSource, error: insertError } = await supabase
    .from("sources_web")
    .insert({ label, base_url: baseUrl })
    .select("id")
    .single();

  if (insertError) throw insertError;
  return newSource.id;
}

/**
 * Starts a crawl run
 */
export async function startCrawlRun(sourceId) {
  const { data, error } = await supabase
    .from("crawl_runs")
    .insert({ source_id: sourceId, status: "running" })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

/**
 * Finishes a crawl run
 */
export async function finishCrawlRun(runId, status = "ok", errorMsg = null) {
  await supabase
    .from("crawl_runs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      error_message: errorMsg,
    })
    .eq("id", runId);
}
