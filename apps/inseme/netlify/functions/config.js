// src/netlify/functions/config.js
// Return a cacheable public view of the config (Node.js version)

import { loadInstanceConfig } from "../../common/config/instanceConfig.backend.js";

function pickEffectiveValue(row) {
  if (row.value_json !== null && row.value_json !== undefined) return row.value_json;
  if (row.value !== null && row.value !== undefined) return row.value;
  return null;
}

function computeEtagFromRows(rowsByKey) {
  let max = "";
  let count = 0;
  for (const k in rowsByKey) {
    const r = rowsByKey[k];
    if (!r) continue;
    count++;
    const u = r.updated_at || "";
    if (u > max) max = u;
  }
  return `W/"cfg-${count}-${max}"`;
}

export async function handler(event, context) {
  // CORS
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Ophelia-Instance",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  try {
    const table = await loadInstanceConfig();
    
    const out = Object.create(null);
    for (const [k, row] of Object.entries(table)) {
      if (!row) continue;
      if (row.is_secret === true) continue;
      if (row.is_public !== true) continue;

      out[k] = pickEffectiveValue(row);
    }

    const etag = computeEtagFromRows(
      Object.fromEntries(
        Object.entries(table).filter(([_, r]) => r && r.is_public === true && r.is_secret !== true)
      )
    );

    // Support 304
    const inm = event.headers["if-none-match"];
    if (inm && inm === etag) {
      return {
        statusCode: 304,
        headers: {
          ...headers,
          etag: etag,
          "Cache-Control": "public, max-age=60, stale-while-revalidate=600",
        },
        body: "",
      };
    }

    return {
      statusCode: 200,
      headers: {
        ...headers,
        etag: etag,
        "Cache-Control": "public, max-age=60, stale-while-revalidate=600",
      },
      body: JSON.stringify(out),
    };
  } catch (error) {
    console.error("Config function error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal server error", details: error.message }),
    };
  }
}
