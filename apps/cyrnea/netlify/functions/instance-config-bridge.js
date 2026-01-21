import { loadInstanceConfig } from "@inseme/cop-host/config/instanceConfig.backend.js";
// Ensure Node.js fetch respects HTTP_PROXY/NO_PROXY in Netlify/Local envs
import "@inseme/cop-host/utils/node-proxy.js";

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

export async function handler(event, _context) {
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

    const etag = computeEtagFromRows(table);

    const inm = event.headers && (event.headers["if-none-match"] || event.headers["If-None-Match"]);
    if (inm && inm === etag) {
      return {
        statusCode: 304,
        headers: {
          ...headers,
          etag,
          "Cache-Control": "public, max-age=60, stale-while-revalidate=600",
        },
        body: "",
      };
    }

    return {
      statusCode: 200,
      headers: {
        ...headers,
        etag,
        "Cache-Control": "public, max-age=60, stale-while-revalidate=600",
      },
      body: JSON.stringify(table),
    };
  } catch (error) {
    console.error("instance-config-bridge error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Internal server error",
        details: error && error.message ? error.message : String(error),
      }),
    };
  }
}
