// scripts/backfill-lastmodifiedby.js
// Tool to fix missing lastModifiedBy metadata in posts table.

import { loadConfig, getConfig, createSupabaseClient } from "./lib/config.js";

// Charger la configuration
await loadConfig();

const SUPABASE_URL = getConfig("supabase_url");
const SUPABASE_KEY = getConfig("supabase_anon_key") || getConfig("supabase_service_role_key");
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Please set SUPABASE_URL and SUPABASE_KEY environment variables.");
  process.exit(1);
}
const supabase = createSupabaseClient();
import { appendOrMergeLastModifiedBy } from "../../../packages/cop-host/src/lib/socialMetadata.js";

async function run() {
  console.log("Starting backfill: lastModifiedBy");
  let page = 0;
  const pageSize = 200;
  while (true) {
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .is("metadata->>lastModifiedBy", null)
      .order("created_at", { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) {
      console.error("Error selecting posts:", error);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    for (const post of data) {
      const fallback = {
        id: post.author_id,
        displayName: post.author_display_name || null,
        timestampISO: post.created_at || new Date().toISOString(),
      };
      const updatedMetadata = appendOrMergeLastModifiedBy(
        post.metadata || {},
        fallback,
        fallback.timestampISO,
        0
      );
      const { error: updateError } = await supabase
        .from("posts")
        .update({ metadata: updatedMetadata })
        .eq("id", post.id);
      if (updateError) {
        console.warn("Failed to update post", post.id, updateError);
      } else {
        console.log("Updated post", post.id);
      }
    }
    page += 1;
  }
  console.log("Backfill completed");
}

run().catch((e) => {
  console.error("Error running backfill:", e);
  process.exit(1);
});
