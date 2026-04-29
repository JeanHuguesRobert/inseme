/**
 * Magistral Pilot - Native Deno Implementation
 * Imports routing logic from the shared @magistral/core router module.
 */
/* global Deno */

import {
  createMetricsSnapshot,
  createRouter,
  probeProviderModels,
  sanitizeNodeForPersistence,
} from "../../../src/router.js";

const METRICS_FILE = ".metrics-cache.json";
const LOG_FILE = ".magistral-traffic.log";

// Helper: Append to log file (NDJSON) with rotation
async function appendLogToFile(entry) {
  try {
    const line = JSON.stringify(entry) + "\n";
    await Deno.writeTextFile(LOG_FILE, line, { append: true });

    // Rotate if > 10MB
    const info = await Deno.stat(LOG_FILE);
    if (info.size > 10 * 1024 * 1024) {
      const backup = LOG_FILE + ".1";
      try {
        await Deno.remove(backup);
      } catch (e) {
        if (!(e instanceof Deno.errors.NotFound)) throw e;
      }
      await Deno.rename(LOG_FILE, backup);
    }
  } catch (err) {
    console.error("Failed to append to log file:", err);
  }
}

// Helper: Load metrics
async function loadMetrics(registry) {
  try {
    const data = await Deno.readTextFile(METRICS_FILE);
    const json = JSON.parse(data);
    registry.loadFrom(json);
    console.log(`[Magistral] Loaded metrics from ${METRICS_FILE}`);
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) {
      console.error(`[Magistral] Failed to load metrics: ${err.message}`);
    }
  }
}

// Helper: Load log tail
async function loadLogTail(trafficLog) {
  try {
    const data = await Deno.readTextFile(LOG_FILE);
    const lines = data.trim().split("\n");
    // Take last 500 lines
    const tail = lines.slice(-500);
    for (const line of tail) {
      if (!line.trim()) continue;
      try {
        trafficLog.append(JSON.parse(line));
      } catch {
        // ignore
      }
    }
    console.log(`[Magistral] Loaded ${tail.length} log entries from ${LOG_FILE}`);
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) {
      console.error(`[Magistral] Failed to load log tail: ${err.message}`);
    }
  }
}

// 1. Boot: Read config from stdin
async function readConfigFromStdin() {
  const decoder = new TextDecoder();
  let payload = "";
  for await (const chunk of Deno.stdin.readable) {
    payload += decoder.decode(chunk);
  }

  if (!payload.trim()) {
    console.error("Pilot received empty STDIN.");
    Deno.exit(1);
  }

  try {
    return JSON.parse(payload);
  } catch (err) {
    console.error("Pilot failed to parse JSON from STDIN:", err.message);
    Deno.exit(1);
  }
}

async function boot() {
  const config = await readConfigFromStdin();

  const host = config.runtime?.host || "127.0.0.1";
  const port = config.runtime?.port || 8082;
  const mapNodes = config.input?.map || [];
  const apiKeys = config.secrets?.API_KEYS || {};

  // One shared router instance for the lifetime of this pilot
  const { route, registry, trafficLog, addNode, getMap } = createRouter({
    map: mapNodes,
    apiKeys,
    log: console.warn,
  });

  // Hook up persistence
  await loadMetrics(registry);
  await loadLogTail(trafficLog);

  // Intercept trafficLog.append to write to disk
  const originalAppend = trafficLog.append.bind(trafficLog);
  trafficLog.append = (entry) => {
    originalAppend(entry);
    appendLogToFile(entry);
  };

  // Auto-save metrics every 60s
  setInterval(async () => {
    if (registry.isDirty()) {
      try {
        const json = JSON.stringify(registry.serialize(), null, 2);
        await Deno.writeTextFile(METRICS_FILE, json);
        registry.clearDirty();
      } catch (err) {
        console.error("Failed to save metrics:", err);
      }
    }
  }, 60000);

  console.log(`MAGISTRAL_READY: http://${host}:${port}`);

  Deno.serve({ port, hostname: host }, async (req) => {
    const url = new URL(req.url);

    const corsHeaders = new Headers({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS, DELETE",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Helper for serving static files from UI directory
    const UI_DIR_URL = new URL("../../../ui/", import.meta.url);

    async function serveUiFile(filename) {
      try {
        // Resolve path safely
        const fileUrl = new URL(filename, UI_DIR_URL);
        // Simple security check: ensure the resolved URL still starts with the base UI_DIR_URL
        if (!fileUrl.href.startsWith(UI_DIR_URL.href)) {
          return new Response("Forbidden", { status: 403 });
        }

        const data = await Deno.readFile(fileUrl);
        const ext = filename.split(".").pop();
        const contentType =
          {
            html: "text/html",
            css: "text/css",
            js: "application/javascript",
            json: "application/json",
            png: "image/png",
            svg: "image/svg+xml",
          }[ext] || "application/octet-stream";

        return new Response(data, {
          headers: {
            "Content-Type": contentType,
            // We allow CORS for the UI assets too
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (e) {
        if (e instanceof Deno.errors.NotFound) {
          return new Response("Not Found", { status: 404 });
        }
        console.error("Static file error:", e);
        return new Response("Internal Server Error", { status: 500 });
      }
    }

    // GET / (Modular UI)
    if (url.pathname === "/" && req.method === "GET") {
      return serveUiFile("index.html");
    }

    // Serve static UI assets (style.css, app.js, modules/...)
    // Any GET request not starting with /v1/ is treated as a static file request
    if (req.method === "GET" && !url.pathname.startsWith("/v1/")) {
      const path = url.pathname.slice(1); // remove leading slash
      if (path) {
        return serveUiFile(path);
      }
    }

    // GET /v1/models
    if (url.pathname === "/v1/models" && req.method === "GET") {
      const tiers = Array.from(new Set(mapNodes.map((n) => n.tier)));
      const modelsData = tiers.map((tier) => ({
        id: tier,
        object: "model",
        created: Date.now(),
        owned_by: "magistral",
      }));
      corsHeaders.set("Content-Type", "application/json");
      return new Response(JSON.stringify({ object: "list", data: modelsData }), {
        headers: corsHeaders,
      });
    }

    // GET /v1/magistral/metrics
    if (url.pathname === "/v1/magistral/metrics" && req.method === "GET") {
      corsHeaders.set("Content-Type", "application/json");
      return new Response(JSON.stringify(createMetricsSnapshot(mapNodes, registry, config)), {
        headers: corsHeaders,
      });
    }

    // POST /v1/magistral/nodes/:id/disable
    if (
      new RegExp("/v1/magistral/nodes/[^/]+/disable").test(url.pathname) &&
      req.method === "POST"
    ) {
      const id = url.pathname.split("/")[4];
      let reason = "manual";
      try {
        const body = await req.json();
        if (body.reason) reason = body.reason;
      } catch {
        // ignore
      }

      registry.disable(id, reason);
      corsHeaders.set("Content-Type", "application/json");
      return new Response(JSON.stringify({ success: true, id, status: "disabled" }), {
        headers: corsHeaders,
      });
    }

    // POST /v1/magistral/nodes/:id/enable
    if (
      new RegExp("/v1/magistral/nodes/[^/]+/enable").test(url.pathname) &&
      req.method === "POST"
    ) {
      const id = url.pathname.split("/")[4];
      registry.enable(id);
      corsHeaders.set("Content-Type", "application/json");
      return new Response(JSON.stringify({ success: true, id, status: "active" }), {
        headers: corsHeaders,
      });
    }

    // POST /v1/magistral/probe
    if (url.pathname === "/v1/magistral/probe" && req.method === "POST") {
      try {
        const { baseUrl, apiKey } = await req.json();
        if (!baseUrl) throw new Error("baseUrl is required");
        const data = await probeProviderModels(baseUrl, apiKey);
        corsHeaders.set("Content-Type", "application/json");
        return new Response(JSON.stringify(data), { headers: corsHeaders });
      } catch (err) {
        corsHeaders.set("Content-Type", "application/json");
        return new Response(JSON.stringify({ error: err.message }), {
          status: 400,
          headers: corsHeaders,
        });
      }
    }

    // POST /v1/magistral/map/add
    if (url.pathname === "/v1/magistral/map/add" && req.method === "POST") {
      try {
        const body = await req.json();
        const node = addNode(body.node || body);
        corsHeaders.set("Content-Type", "application/json");
        return new Response(JSON.stringify({ success: true, node }), { headers: corsHeaders });
      } catch (err) {
        corsHeaders.set("Content-Type", "application/json");
        return new Response(JSON.stringify({ error: err.message }), {
          status: 400,
          headers: corsHeaders,
        });
      }
    }

    // POST /v1/magistral/map/save
    if (url.pathname === "/v1/magistral/map/save" && req.method === "POST") {
      try {
        const savePath = "registry/maps/default-new.json";
        // We assume we are in packages/magistral/pilots/reference-js/
        // But we need to write to packages/magistral/registry/maps/
        // The CWD when running this script via launcher.js is usually packages/magistral/
        // Let's try relative path from CWD
        const currentMap = getMap().map(sanitizeNodeForPersistence);
        await Deno.writeTextFile(savePath, JSON.stringify(currentMap, null, 2));
        corsHeaders.set("Content-Type", "application/json");
        return new Response(JSON.stringify({ success: true, path: savePath }), {
          headers: corsHeaders,
        });
      } catch (err) {
        corsHeaders.set("Content-Type", "application/json");
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: corsHeaders,
        });
      }
    }

    // GET /v1/magistral/logs
    if (url.pathname === "/v1/magistral/logs" && req.method === "GET") {
      const n = parseInt(url.searchParams.get("n") || url.searchParams.get("limit") || "100");
      const nodeId = url.searchParams.get("nodeId");
      const status = url.searchParams.get("status")
        ? parseInt(url.searchParams.get("status"))
        : undefined;
      const since = url.searchParams.get("since");

      let logs = trafficLog.tail(n);

      // Apply filters if needed (tail returns last N, but we might want to filter from buffer)
      // TrafficLog.filter returns filtered list from entire buffer
      if (nodeId || status || since) {
        logs = trafficLog.filter({ nodeId, status, since });
        // re-apply limit
        logs = logs.slice(-n);
      }

      corsHeaders.set("Content-Type", "application/json");
      return new Response(JSON.stringify({ logs }), { headers: corsHeaders });
    }

    // DELETE /v1/magistral/logs
    if (url.pathname === "/v1/magistral/logs" && req.method === "DELETE") {
      trafficLog.buffer = []; // Clear in-memory
      trafficLog._dirty = true;
      try {
        await Deno.writeTextFile(LOG_FILE, ""); // Truncate file
      } catch (e) {
        console.error("Failed to truncate log file:", e);
      }
      corsHeaders.set("Content-Type", "application/json");
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // GET /__admin — serve the admin UI
    if (url.pathname === "/__admin" && req.method === "GET") {
      try {
        const adminUrl = new URL("./admin.html", import.meta.url);
        const fileContent = await Deno.readTextFile(adminUrl);
        corsHeaders.set("Content-Type", "text/html");
        return new Response(fileContent, { status: 200, headers: corsHeaders });
      } catch (err) {
        console.error("Failed to serve admin.html:", err);
        return new Response("Admin UI HTML not found.", { status: 404 });
      }
    }

    // POST /v1/chat/completions
    if (url.pathname === "/v1/chat/completions" && req.method === "POST") {
      const authHeader = req.headers.get("authorization") || "";
      if (authHeader !== "Bearer sesame") {
        corsHeaders.set("Content-Type", "application/json");
        return new Response(JSON.stringify({ error: "Unauthorized Magistral Access" }), {
          status: 401,
          headers: corsHeaders,
        });
      }

      let payload;
      try {
        payload = await req.json();
      } catch {
        corsHeaders.set("Content-Type", "application/json");
        return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const tier = payload.model || "fast";

      try {
        const upstreamRes = await route(payload, tier);
        // Proxy all response headers + body natively
        for (const [key, val] of upstreamRes.headers.entries()) {
          corsHeaders.set(key, val);
        }
        return new Response(upstreamRes.body, { status: 200, headers: corsHeaders });
      } catch (err) {
        corsHeaders.set("Content-Type", "application/json");
        return new Response(JSON.stringify({ error: err.message }), {
          status: 503,
          headers: corsHeaders,
        });
      }
    }

    corsHeaders.set("Content-Type", "application/json");
    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: corsHeaders,
    });
  });
}

if (import.meta.main) {
  boot();
}
