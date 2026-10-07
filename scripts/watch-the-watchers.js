import crypto from "node:crypto";

export const ACCESS_EVENT_SCHEMA = "artifact-access-event/v1";
export const ACCESS_CONFIG_SCHEMA = "watch-the-watchers/config-v1";

const STATES = new Set(["REVIEW", "FROZEN"]);
const EVENTS = new Set(["LANDING", "OPEN_PDF", "REDIRECT"]);

export function createOpaqueToken(bytes = 24) {
  if (!Number.isInteger(bytes) || bytes < 16 || bytes > 64) {
    throw new Error("invalid_token_size");
  }
  return crypto.randomBytes(bytes).toString("base64url");
}

export function tokenRefFromToken(token) {
  if (typeof token !== "string" || token.length < 22 || token.length > 128) {
    throw new Error("invalid_token");
  }
  if (!/^[A-Za-z0-9_-]+$/.test(token)) throw new Error("invalid_token");
  return "sha256:" + crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export function validateConfig(config) {
  if (!config || typeof config !== "object") throw new Error("config_required");
  if (config.schema !== ACCESS_CONFIG_SCHEMA) throw new Error("unsupported_config_schema");
  if (!STATES.has(config.state)) throw new Error("invalid_state");
  if (!config.artifact_ref || typeof config.artifact_ref !== "string") throw new Error("artifact_ref_required");

  if (config.state === "REVIEW") {
    if (!config.review_url || typeof config.review_url !== "string") throw new Error("review_url_required");
    if (config.frozen) throw new Error("review_must_not_embed_frozen_coordinates");
  }

  if (config.state === "FROZEN") {
    const frozen = config.frozen;
    if (!frozen || typeof frozen !== "object") throw new Error("frozen_coordinates_required");
    for (const field of ["repository", "release_tag", "asset_filename", "sha256", "asset_url"]) {
      if (!frozen[field] || typeof frozen[field] !== "string") throw new Error(`frozen_${field}_required`);
    }
    if (!/^[0-9a-f]{64}$/i.test(frozen.sha256)) throw new Error("invalid_frozen_sha256");
  }
  return true;
}

export function validateTokenMapping(mapping) {
  if (!mapping || typeof mapping !== "object") throw new Error("mapping_required");
  if (!mapping.token_ref || typeof mapping.token_ref !== "string") throw new Error("token_ref_required");
  if (!mapping.recipient_ref || typeof mapping.recipient_ref !== "string") throw new Error("recipient_ref_required");
  if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(mapping.token_ref)) {
    throw new Error("token_must_not_encode_email");
  }
  return true;
}

export function createAccessEvent({ token_ref, event, artifact_ref, timestamp = new Date().toISOString() }) {
  if (!token_ref || typeof token_ref !== "string") throw new Error("token_ref_required");
  if (!EVENTS.has(event)) throw new Error("invalid_access_event");
  if (!artifact_ref || typeof artifact_ref !== "string") throw new Error("artifact_ref_required");
  if (Number.isNaN(Date.parse(timestamp))) throw new Error("invalid_timestamp");

  return Object.freeze({
    schema: ACCESS_EVENT_SCHEMA,
    token_ref,
    event,
    timestamp,
    artifact_ref,
  });
}

export function resolveArtifactTarget(config) {
  validateConfig(config);
  if (config.state === "REVIEW") {
    return Object.freeze({
      state: "REVIEW",
      target_url: config.review_url,
      canonical_escape: null,
      sha256: null,
    });
  }
  return Object.freeze({
    state: "FROZEN",
    target_url: config.frozen.asset_url,
    canonical_escape: {
      repository: config.frozen.repository,
      release_tag: config.frozen.release_tag,
      asset_filename: config.frozen.asset_filename,
      sha256: config.frozen.sha256,
      asset_url: config.frozen.asset_url,
    },
    sha256: config.frozen.sha256,
  });
}

export function disclosureText(config) {
  validateConfig(config);
  if (config.state === "REVIEW") {
    return [
      "Ce lien est individualisé et peut produire une trace technique minimale de son utilisation.",
      "Cette trace établit seulement qu’un chemin d’accès a été sollicité ; elle ne prouve pas qu’une personne a lu le document.",
      "Le document présenté est encore en état REVIEW et peut changer avant gel définitif.",
    ].join(" ");
  }
  return [
    "Ce lien est individualisé et peut produire une trace technique minimale de son utilisation.",
    "Cette trace établit seulement qu’un chemin d’accès a été sollicité ; elle ne prouve pas qu’une personne a lu le document.",
    "Une voie canonique non instrumentée permet d’accéder aux mêmes octets gelés et d’en vérifier le SHA-256.",
  ].join(" ");
}

export function renderLandingHtml({ token_ref, config }) {
  const target = resolveArtifactTarget(config);
  const disclosure = escapeHtml(disclosureText(config));
  const canonical = target.canonical_escape
    ? `<p><a rel="noreferrer" href="${escapeAttr(target.canonical_escape.asset_url)}">Accès canonique non instrumenté</a></p>`
    : "";
  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Accès au document</title></head>
<body>
<main>
<h1>Accès au document</h1>
<p>${disclosure}</p>
<p>État : <strong>${target.state}</strong></p>
<form method="post" action="/a/${encodeURIComponent(token_ref)}/open">
<button type="submit">Ouvrir le PDF</button>
</form>
${canonical}
</main>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('"', "&quot;");
}
