import crypto from "node:crypto";

const EVENT_SCHEMA = "artifact-access-event/v1";
const ALLOWED_EVENTS = new Set(["LANDING", "OPEN_PDF", "REDIRECT"]);

export async function handler(event) {
  try {
    const config = loadConfig(process.env);
    if (!config) return unavailable();

    const request = normalizeRequest(event);
    const match = request.pathname.match(/\/artifact-access\/a\/([^/]+)(?:\/(open|redirect))?\/?$/);
    if (!match) return response(404, "Not found");

    const token = decodeURIComponent(match[1]);
    const action = match[2] || null;
    const token_ref = tokenRefFromToken(token);

    const mapping = await rpc("artifact_access_token_lookup", { p_token_ref: token_ref });
    if (!mapping || mapping.disabled_at) return response(404, "Not found");
    if (mapping.artifact_ref !== config.artifact_ref) return response(404, "Not found");

    if (request.method === "GET" && !action) {
      await appendEvent({ token_ref, event: "LANDING", artifact_ref: config.artifact_ref });
      return html(200, renderLanding({ token, config }));
    }

    if (request.method === "POST" && action === "open") {
      await appendEvent({ token_ref, event: "OPEN_PDF", artifact_ref: config.artifact_ref });
      return redirect(303, targetUrl(config));
    }

    if (request.method === "GET" && action === "redirect") {
      await appendEvent({ token_ref, event: "REDIRECT", artifact_ref: config.artifact_ref });
      return redirect(302, targetUrl(config));
    }

    return response(405, "Method not allowed", { Allow: "GET, POST" });
  } catch (error) {
    console.error("artifact-access error", error?.message || error);
    return response(500, "Internal error");
  }
}

function loadConfig(env) {
  if (!env.WATCHERS_CONFIG_JSON || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  const config = JSON.parse(env.WATCHERS_CONFIG_JSON);
  if (config.schema !== "watch-the-watchers/config-v1") throw new Error("invalid_config_schema");
  if (!["REVIEW", "FROZEN"].includes(config.state)) throw new Error("invalid_config_state");
  if (!config.artifact_ref) throw new Error("artifact_ref_required");
  if (config.state === "REVIEW" && !config.review_url) throw new Error("review_url_required");
  if (config.state === "FROZEN") {
    const frozen = config.frozen || {};
    for (const field of ["repository", "release_tag", "asset_filename", "sha256", "asset_url"]) {
      if (!frozen[field]) throw new Error(`frozen_${field}_required`);
    }
    if (!/^[0-9a-f]{64}$/i.test(frozen.sha256)) throw new Error("invalid_frozen_sha256");
  }
  return config;
}

function normalizeRequest(event) {
  const raw = event.rawUrl || event.raw_url || `https://watch.invalid${event.path || "/"}`;
  return {
    method: String(event.httpMethod || event.requestContext?.http?.method || "GET").toUpperCase(),
    pathname: new URL(raw, "https://watch.invalid").pathname,
  };
}

function tokenRefFromToken(token) {
  if (typeof token !== "string" || token.length < 22 || token.length > 128) throw new Error("invalid_token");
  if (!/^[A-Za-z0-9_-]+$/.test(token)) throw new Error("invalid_token");
  return "sha256:" + crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

async function appendEvent({ token_ref, event, artifact_ref }) {
  if (!ALLOWED_EVENTS.has(event)) throw new Error("invalid_event");
  return rpc("artifact_access_event_append", {
    p_event: {
      schema: EVENT_SCHEMA,
      token_ref,
      event,
      timestamp: new Date().toISOString(),
      artifact_ref,
    },
  });
}

async function rpc(name, body) {
  const base = process.env.SUPABASE_URL.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(`${base}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`supabase_rpc_${name}_${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function targetUrl(config) {
  return config.state === "FROZEN" ? config.frozen.asset_url : config.review_url;
}

function renderLanding({ token, config }) {
  const disclosure = config.state === "FROZEN"
    ? "Ce lien est individualisé et peut produire une trace technique minimale de son utilisation. Cette trace établit seulement qu’un chemin d’accès a été sollicité ; elle ne prouve pas qu’une personne a lu le document. Une voie canonique non instrumentée permet d’accéder aux mêmes octets gelés et d’en vérifier le SHA-256."
    : "Ce lien est individualisé et peut produire une trace technique minimale de son utilisation. Cette trace établit seulement qu’un chemin d’accès a été sollicité ; elle ne prouve pas qu’une personne a lu le document. Le document présenté est encore en état REVIEW et peut changer avant gel définitif.";

  const canonical = config.state === "FROZEN"
    ? `<p><a rel="noreferrer" href="${escapeAttr(config.frozen.asset_url)}">Accès canonique non instrumenté</a></p>`
    : "";

  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Accès au document</title></head>
<body><main>
<h1>Accès au document</h1>
<p>${escapeHtml(disclosure)}</p>
<p>État : <strong>${config.state}</strong></p>
<form method="post" action="/artifact-access/a/${encodeURIComponent(token)}/open">
<button type="submit">Ouvrir le PDF</button>
</form>
${canonical}
</main></body></html>`;
}

function html(statusCode, body) {
  return {
    statusCode,
    headers: baseHeaders({ "Content-Type": "text/html; charset=utf-8" }),
    body,
  };
}

function response(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: baseHeaders({ "Content-Type": "text/plain; charset=utf-8", ...headers }),
    body,
  };
}

function redirect(statusCode, location) {
  return {
    statusCode,
    headers: baseHeaders({ Location: location }),
    body: "",
  };
}

function unavailable() {
  return response(503, "Service unavailable");
}

function baseHeaders(extra = {}) {
  return {
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    ...extra,
  };
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('"', "&quot;");
}
