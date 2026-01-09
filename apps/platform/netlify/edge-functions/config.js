// src/netlify/edge-functions/config.js
// Return a cacheable public view of the config

// netlify/edge-functions/config.js
import { loadInstanceConfig } from "../../src/common/config/instanceConfig.edge.js";

// ---------------
// Helpers
// ---------------

function pickEffectiveValue(row) {
  if (row.value_json !== null && row.value_json !== undefined) return row.value_json;
  if (row.value !== null && row.value !== undefined) return row.value;
  return null;
}

function computeEtagFromRows(rowsByKey) {
  // ETag stable, faible coût : basé sur max(updated_at) + nombre de clés
  let max = "";
  let count = 0;
  for (const k in rowsByKey) {
    const r = rowsByKey[k];
    if (!r) continue;
    count++;
    const u = r.updated_at || "";
    if (u > max) max = u;
  }
  return `W/"cfg-${count}-${max}"`; // weak etag
}

// ---------------
// Handler
// ---------------

export default async (request, context) => {
  // Cache mémoire par isolat
  const table = await loadInstanceConfig(); // { [key]: row }

  // Filtrer : uniquement public, et jamais secret
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
  const inm = request.headers.get("if-none-match");
  if (inm && inm === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        etag: etag,
        "cache-control": "public, max-age=60, stale-while-revalidate=600",
      },
    });
  }

  return new Response(JSON.stringify(out), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      etag: etag,
      // CDN: cache 60s, et peut servir stale pendant 10 min pendant revalidation
      "cache-control": "public, max-age=60, stale-while-revalidate=600",
    },
  });
};
