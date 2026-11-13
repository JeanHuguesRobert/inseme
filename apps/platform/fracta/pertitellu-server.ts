/**
 * Fracta preview HTTP adapter for the Inseme Platform pertitellu-corte instance.
 *
 * Provides a health check endpoint, manages CORS / proxy headers,
 * and routes API calls to Edge / brique handlers.
 */

const hostname = Deno.env.get("PERTITELLU_HOST") || "127.0.0.1";
const port = Number(Deno.env.get("PERTITELLU_PORT") || "8893");

if (Deno.env.get("PERTITELLU_IGNORE_PROXY") === "1") {
  for (const key of [
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "http_proxy",
    "https_proxy",
    "all_proxy",
  ]) {
    try {
      Deno.env.delete(key);
    } catch {
      // Ignore in restricted environments
    }
  }
}

function publicRequest(request: Request) {
  const incoming = new URL(request.url);
  const protocol = request.headers.get("x-forwarded-proto") || incoming.protocol.replace(":", "");
  const host =
    request.headers.get("x-forwarded-host") || request.headers.get("host") || incoming.host;
  const url = new URL(`${protocol}://${host}${incoming.pathname}${incoming.search}`);
  return new Request(url, request);
}

export async function handlePertitelluRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const _publicFacingRequest = publicRequest(request);

  if (
    url.pathname === "/health" ||
    url.pathname === "/api/health" ||
    url.pathname === "/api/pertitellu/health"
  ) {
    return Response.json({
      ok: true,
      service: "pertitellu-corte",
      instance: "pertitellu-corte",
      runtime: "fracta-preview",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    });
  }

  if (url.pathname === "/api/instance") {
    return Response.json({
      subdomain: "pertitellu-corte",
      community_name: "Le Petit Parti — Corte",
      deployment_kind: "civic",
      application_profile: "civic-platform",
      canonical_url: "https://lepp.baronsmariani.org",
      // Do not advertise an unconfigured preview gateway.
      preview_url: Deno.env.get("PERTITELLU_PREVIEW_URL") || null,
    });
  }

  return Response.json({ error: "not_found", instance: "pertitellu-corte" }, { status: 404 });
}

export const pertitelluHttpService = {
  id: "pertitellu-corte",
  mounts: ["/api/pertitellu", "/api/health"],
  handle: handlePertitelluRequest,
};

if (import.meta.main) {
  console.log(`[pertitellu-preview] Starting Fracta preview server on http://${hostname}:${port}`);
  Deno.serve({ hostname, port }, handlePertitelluRequest);
}
