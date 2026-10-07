import { createAccessEvent, renderLandingHtml, resolveArtifactTarget, validateConfig } from "./watch-the-watchers.js";

export function createWatchTheWatchersHandler({
  config,
  lookupToken,
  appendEvent,
  now = () => new Date().toISOString(),
}) {
  validateConfig(config);
  if (typeof lookupToken !== "function") throw new Error("lookup_token_required");
  if (typeof appendEvent !== "function") throw new Error("append_event_required");

  return async function handle(request) {
    const url = new URL(request.url, "https://watch.invalid");
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] !== "a" || !parts[1]) return response(404, "Not found");

    const token = decodeURIComponent(parts[1]);
    const mapping = await lookupToken(token);
    if (!mapping?.token_ref) return response(404, "Not found");

    const token_ref = mapping.token_ref;
    const artifact_ref = config.artifact_ref;

    if (request.method === "GET" && parts.length === 2) {
      await appendEvent(createAccessEvent({
        token_ref,
        event: "LANDING",
        artifact_ref,
        timestamp: now(),
      }));
      return {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "referrer-policy": "no-referrer",
        },
        body: renderLandingHtml({ token_ref: token, config }),
      };
    }

    if (request.method === "POST" && parts[2] === "open" && parts.length === 3) {
      await appendEvent(createAccessEvent({
        token_ref,
        event: "OPEN_PDF",
        artifact_ref,
        timestamp: now(),
      }));
      const target = resolveArtifactTarget(config);
      return redirect(303, target.target_url);
    }

    if (request.method === "GET" && parts[2] === "redirect" && parts.length === 3) {
      await appendEvent(createAccessEvent({
        token_ref,
        event: "REDIRECT",
        artifact_ref,
        timestamp: now(),
      }));
      const target = resolveArtifactTarget(config);
      return redirect(302, target.target_url);
    }

    return response(405, "Method not allowed", { allow: "GET, POST" });
  };
}

function redirect(status, location) {
  return {
    status,
    headers: {
      location,
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
    },
    body: "",
  };
}

function response(status, body, extraHeaders = {}) {
  return {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      ...extraHeaders,
    },
    body,
  };
}
