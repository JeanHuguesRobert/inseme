#!/usr/bin/env node
import http from "http";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import { KokoroTTS } from "kokoro-js";
import WebSocket, { WebSocketServer } from "ws";
import dotenv from "dotenv";
import os from "os";
import {
  createMetricsSnapshot,
  createRouter,
  probeProviderModels,
  sanitizeNodeForPersistence,
} from "../../magistral/src/router.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define Magistral paths globally
const MAGISTRAL_DIR = path.resolve(__dirname, "..", "..", "magistral");
const METRICS_FILE = path.join(MAGISTRAL_DIR, ".metrics-cache.json");
const LOG_FILE = path.join(MAGISTRAL_DIR, ".magistral-traffic.log");

// Load .env from project root
dotenv.config({ path: path.join(__dirname, "..", "..", "..", ".env") });

const args = process.argv.slice(2);
const command = args[0] && !args[0].startsWith("--") ? args[0] : null;

function getArgValue(flag, defaultValue) {
  const index = args.indexOf(flag);
  if (index === -1) return defaultValue;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) return defaultValue;
  return value;
}

const isHelp = args.includes("--help") || args.includes("-h") || command === "help";
const isStatus = args.includes("--status") || command === "status";
const isStop = args.includes("--stop") || args.includes("--down") || command === "stop";

const AI_HOST = "127.0.0.1";
let AI_PORT = parseInt(getArgValue("--port", "8880"), 10);
if (!Number.isFinite(AI_PORT) || AI_PORT <= 0) {
  AI_PORT = 8880;
}

let LLAMA_PORT = parseInt(getArgValue("--llama-port", "8081"), 10);
if (!Number.isFinite(LLAMA_PORT) || LLAMA_PORT <= 0) {
  LLAMA_PORT = 8081;
}

let THREADS = parseInt(getArgValue("--threads", "4"), 10);
if (!Number.isFinite(THREADS) || THREADS <= 0) {
  THREADS = 4;
}

let CTX_SIZE = parseInt(getArgValue("--ctx-size", "32768"), 10);
if (!Number.isFinite(CTX_SIZE) || CTX_SIZE <= 0) {
  CTX_SIZE = 32768;
}

// Models mapping (reuse from scripts/llama.js)
const MODELS = {
  "Qwen2.5-Coder": "C:\\tweesic\\inseme\\models\\Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf",
  "Gemma3-1B": "C:\\llama\\models\\gemma3-1b.gguf",
};

let currentModel = getArgValue("--model", "Qwen2.5-Coder");
if (!MODELS[currentModel]) {
  currentModel = "Qwen2.5-Coder";
}

function printUsage() {
  console.log(`
Usage: node src/ai.js [start|status|stop] [options]

Options:
  --port <port>        Sovereign HTTP server port (default: 8880)
  --llama-port <port>  llama-server OpenAI-compatible port (default: 8081)
  --model <name>       Model key: ${Object.keys(MODELS).join(", ")}
  --status             Check service status
  --stop               Stop the running service
`);
}

const LLAMA_HOST = "127.0.0.1";
const LLAMA_BASE_URL = `http://${LLAMA_HOST}:${LLAMA_PORT}`;

let llamaProcess = null;
let tts = null;

// --- Service Registration ---
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (i.e. 127.0.0.1) and non-IPv4 addresses
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
}

async function registerAiService(port, status = "online") {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const roomSlug = process.env.BAR_ROOM_SLUG || "cyrnea";

  if (!supabaseUrl || !serviceKey) {
    console.warn("[AI] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing. Skipping registration.");
    return;
  }

  const localIp = getLocalIp();
  const aiUrl = `http://${localIp}:${port}`;

  console.log(`[AI] Registering service (${status}) on ${aiUrl} for room ${roomSlug}...`);

  try {
    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };

    // 1. Get current room settings
    const getUrl = `${supabaseUrl}/rest/v1/inseme_rooms?slug=eq.${roomSlug}&select=id,settings`;
    const res = await fetch(getUrl, { headers });

    if (!res.ok) {
      console.error(`[AI] Room '${roomSlug}' not found or Supabase error: ${res.status}`);
      return;
    }

    const rows = await res.json();
    if (!rows || rows.length === 0) {
      console.error(`[AI] Room '${roomSlug}' not found.`);
      return;
    }

    const room = rows[0];
    const settings = room.settings || {};

    // 2. Update settings
    settings["ai_server_url"] = status === "online" ? aiUrl : null;
    settings["ai_server_status"] = status;
    settings["ai_server_last_seen"] = new Date().toISOString();

    const updateUrl = `${supabaseUrl}/rest/v1/inseme_rooms?id=eq.${room.id}`;
    const updateRes = await fetch(updateUrl, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ settings }),
    });

    if (updateRes.ok) {
      console.log(`[AI] Service successfully registered in Supabase.`);
    } else {
      console.error(
        `[AI] Supabase registration failed: ${updateRes.status} ${updateRes.statusText}`
      );
    }
  } catch (e) {
    console.error(`[AI] Error during Supabase registration:`, e);
  }
}

async function llamaAlive() {
  try {
    const res = await fetch(`${LLAMA_BASE_URL}/v1/models`);
    return res.ok;
  } catch {
    return false;
  }
}

function launchLlamaServer() {
  const modelPath = MODELS[currentModel];
  if (!modelPath || !fs.existsSync(modelPath)) {
    console.error(`[AI] Model not found: ${modelPath}`);
    process.exit(1);
  }

  console.log(`[AI] Launching llama-server on port ${LLAMA_PORT} with model: ${modelPath}`);

  llamaProcess = spawn(
    "C:\\llama\\llama-server.exe",
    [
      "-m",
      modelPath,
      "--threads",
      THREADS.toString(),
      "--ctx-size",
      CTX_SIZE.toString(),
      "--host",
      LLAMA_HOST,
      "--port",
      LLAMA_PORT.toString(),
      "--no-mmap",
    ],
    { stdio: ["ignore", "pipe", "pipe"] }
  );

  const logFilter = (data) => {
    const str = data.toString();
    // Filter out health check logs from /status polling
    // We split by lines to avoid filtering out other important logs in the same chunk
    const lines = str.split("\n");
    const filteredLines = lines.filter((line) => {
      // Check for the specific log pattern (ignoring potential ANSI codes or minor spacing)
      return !line.match(/request:\s+GET\s+\/v1\/models.*200/);
    });

    if (filteredLines.length < lines.length) {
      if (filteredLines.length > 0) {
        process.stdout.write(filteredLines.join("\n"));
      }
      return;
    }

    process.stdout.write(data);
  };

  llamaProcess.stdout.on("data", logFilter);
  // Apply the same filter to stderr, as llama-server might log requests there
  llamaProcess.stderr.on("data", (data) => {
    const str = data.toString();
    const lines = str.split("\n");
    const filteredLines = lines.filter((line) => {
      return !line.match(/request:\s+GET\s+\/v1\/models.*200/);
    });

    if (filteredLines.length < lines.length) {
      if (filteredLines.length > 0) {
        process.stderr.write(filteredLines.join("\n"));
      }
      return;
    }
    process.stderr.write(data);
  });

  llamaProcess.on("exit", (code) => {
    console.log(`[AI] llama-server exited with code ${code}`);
  });
}

async function waitForLlama(timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await llamaAlive()) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function initTTS() {
  if (tts) return;
  const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
  console.log(`[AI] Initializing Kokoro TTS (${MODEL_ID})...`);
  tts = await KokoroTTS.from_pretrained(MODEL_ID, {
    dtype: "q8",
    device: "cpu",
  });
  console.log("[AI] Kokoro TTS model loaded.");
}

function encodeWAV(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  floatTo16BitPCM(view, 44, samples);

  return Buffer.from(buffer);
}

function floatTo16BitPCM(output, offset, input) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, input[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7fff;
    output.setInt16(offset, s, true);
  }
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function jsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (_e) {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

const UI_DIR = path.resolve(__dirname, "../../magistral/ui");

function serveStatic(res, filePath) {
  const fullPath = path.join(UI_DIR, filePath);
  // Security check
  if (!fullPath.startsWith(UI_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(fullPath, (err, content) => {
    if (err) {
      if (err.code === "ENOENT") {
        res.writeHead(404);
        res.end("Not Found");
      } else {
        res.writeHead(500);
        res.end("Internal Server Error");
      }
    } else {
      const ext = path.extname(fullPath);
      const mime =
        {
          ".html": "text/html",
          ".css": "text/css",
          ".js": "application/javascript",
          ".json": "application/json",
          ".png": "image/png",
          ".svg": "image/svg+xml",
        }[ext] || "application/octet-stream";

      res.writeHead(200, { "Content-Type": mime });
      res.end(content);
    }
  });
}

// --------------------------------------------------------------------------
// Embedded Magistral Router (activated when MAGISTRAL_API_KEY is set)
// Backed by @magistral/core — shared with the Deno pilot.
// --------------------------------------------------------------------------

function isMagistralEnabled() {
  return !!process.env.MAGISTRAL_API_KEY;
}

let _magistralRouter = null;

function getMagistralRouter() {
  if (_magistralRouter) return _magistralRouter;

  const localFallback = {
    id: "local-llama",
    url: `${LLAMA_BASE_URL}/v1/chat/completions`,
    model: MODELS[currentModel] || currentModel,
    tier: "fallback",
    weight: 1,
  };

  let cloudNodes = [];
  try {
    const mapPath = path.resolve(
      __dirname,
      "..",
      "..",
      "magistral",
      "registry",
      "maps",
      "default.json"
    );
    cloudNodes = JSON.parse(fs.readFileSync(mapPath, "utf-8")).filter(
      (n) => !n.url.includes("8081")
    ); // dedupe: local-llama is already added below
  } catch {
    /* magistral registry not found — sovereign-only mode */
  }

  const map = [...cloudNodes, localFallback];
  const apiKeys = {
    GROQ_API_KEY: process.env.GROQ_API_KEY || "",
    TOGETHER_API_KEY: process.env.TOGETHER_API_KEY || "",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  };

  _magistralRouter = createRouter({ map, apiKeys, log: console.warn });
  _magistralRouter.map = map; // Expose map for dynamic updates
  const { registry, trafficLog } = _magistralRouter;

  // --- Persistence Logic ---
  // Paths are defined globally (MAGISTRAL_DIR, METRICS_FILE, LOG_FILE)

  // 1. Cold start: Load metrics
  try {
    if (fs.existsSync(METRICS_FILE)) {
      const data = JSON.parse(fs.readFileSync(METRICS_FILE, "utf-8"));
      registry.loadFrom(data);
      console.log("[Magistral] Loaded metrics from cache.");
    }
  } catch (e) {
    console.warn("[Magistral] Failed to load metrics cache:", e.message);
  }

  // 2. Auto-save metrics (every 60s)
  setInterval(() => {
    if (registry.isDirty()) {
      try {
        const json = JSON.stringify(registry.serialize(), null, 2);
        fs.writeFileSync(METRICS_FILE, json);
        registry.clearDirty();
      } catch (e) {
        console.error("[Magistral] Failed to save metrics:", e.message);
      }
    }
  }, 60000);

  // 3. Log persistence (monkey-patch trafficLog.append)
  const originalAppend = trafficLog.append.bind(trafficLog);
  trafficLog.append = (entry) => {
    originalAppend(entry);

    // Append to NDJSON file
    try {
      const line = JSON.stringify(entry) + "\n";
      fs.appendFileSync(LOG_FILE, line);

      // Rotate if > 10MB
      const stats = fs.statSync(LOG_FILE);
      if (stats.size > 10 * 1024 * 1024) {
        const backup = LOG_FILE + ".1";
        if (fs.existsSync(backup)) fs.unlinkSync(backup);
        fs.renameSync(LOG_FILE, backup);
      }
    } catch (e) {
      console.error("[Magistral] Log write failed:", e.message);
    }
  };

  // 4. Cold start: Load log tail (last 500 lines)
  try {
    if (fs.existsSync(LOG_FILE)) {
      const content = fs.readFileSync(LOG_FILE, "utf-8");
      const lines = content.trim().split("\n");
      const tail = lines.slice(-500);
      tail.forEach((line) => {
        try {
          if (line.trim()) originalAppend(JSON.parse(line));
        } catch {}
      });
      console.log(`[Magistral] Loaded ${tail.length} log entries.`);
    }
  } catch (e) {
    console.warn("[Magistral] Failed to load log history:", e.message);
  }

  return _magistralRouter;
}

/**
 * Route a payload through the embedded Magistral router.
 * Tier defaults to 'fast' when model === 'magistral'.
 */
async function routeMagistral(payload) {
  const { route } = getMagistralRouter();
  const tier = payload.model === "magistral" ? "fast" : payload.model || "fast";
  return route(payload, tier);
}

/** Simple routing helper for non-magistral requests (direct Llama). */
function buildProxyArgs(body, defaultModel) {
  const resolvedModel = MODELS[body.model] || MODELS[defaultModel];
  return {
    fetchUrl: `${LLAMA_BASE_URL}/v1/chat/completions`,
    fetchHeaders: { "Content-Type": "application/json" },
    resolvedModel,
  };
}

function startServer() {
  const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = parsedUrl.pathname || "/";

    if (
      req.method === "GET" &&
      (pathname === "/" || pathname === "/__inspector" || pathname === "/index.html")
    ) {
      serveStatic(res, "index.html");
      return;
    }

    if (
      req.method === "GET" &&
      (pathname.endsWith(".js") ||
        pathname.endsWith(".css") ||
        pathname.endsWith(".json") ||
        pathname.endsWith(".svg"))
    ) {
      const relPath = pathname.startsWith("/") ? pathname.substring(1) : pathname;
      serveStatic(res, relPath);
      return;
    }

    if (req.method === "GET" && pathname === "/health") {
      const llmOk = await llamaAlive();
      const ttsOk = !!tts;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: llmOk && ttsOk ? "ok" : "degraded",
          llm: llmOk,
          tts: ttsOk,
          llama_port: LLAMA_PORT,
        })
      );
      return;
    }

    if (req.method === "GET" && pathname === "/v1/models") {
      try {
        const llamaRes = await fetch(`${LLAMA_BASE_URL}/v1/models`);
        if (!llamaRes.ok) {
          throw new Error(`LLM backend returned ${llamaRes.status}`);
        }
        const data = await llamaRes.json();
        if (data && data.data) {
          data.data.push({
            id: "magistral",
            object: "model",
            owned_by: "magistral",
            created: Date.now(),
          });
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(data));
      } catch (e) {
        console.error("[AI] /v1/models error:", e);
        // Fallback stub if Llama is down but node is alive
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            object: "list",
            data: [
              { id: currentModel, object: "model", owned_by: "sovereign", created: Date.now() },
              { id: "magistral", object: "model", owned_by: "magistral", created: Date.now() },
            ],
          })
        );
      }
      return;
    }

    if (req.method === "GET" && pathname === "/status") {
      const llmOk = await llamaAlive();
      const ttsOk = !!tts;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: llmOk || ttsOk ? "active" : "idle",
          port: AI_PORT,
          llm_loaded: llmOk,
          tts_loaded: ttsOk,
          model: currentModel,
          uptime: Math.floor(process.uptime()),
          features: {
            llm: true,
            tts: true,
            sse: true,
          },
        })
      );
      return;
    }

    // --- Magistral Management API ---
    if (pathname.startsWith("/magistral/") || pathname.startsWith("/v1/magistral/")) {
      const router = getMagistralRouter();
      const registry = router.registry;
      const trafficLog = router.trafficLog;

      // POST .../nodes/:id/disable
      if (req.method === "POST" && pathname.match(/\/magistral\/nodes\/[^\/]+\/disable/)) {
        const parts = pathname.split("/");
        const id = parts[parts.indexOf("nodes") + 1];
        let reason = "manual";
        try {
          const body = await jsonBody(req);
          if (body.reason) reason = body.reason;
        } catch {}
        registry.disable(id, reason);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, id, status: "disabled" }));
        return;
      }

      // POST .../nodes/:id/enable
      if (req.method === "POST" && pathname.match(/\/magistral\/nodes\/[^\/]+\/enable/)) {
        const parts = pathname.split("/");
        const id = parts[parts.indexOf("nodes") + 1];
        registry.enable(id);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, id, status: "active" }));
        return;
      }

      // GET .../logs
      if (req.method === "GET" && pathname.endsWith("/magistral/logs")) {
        const limit = parseInt(parsedUrl.searchParams.get("limit") || "50", 10);
        const logs = trafficLog.tail(limit);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ logs }));
        return;
      }

      // GET .../metrics
      if (req.method === "GET" && pathname.endsWith("/magistral/metrics")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify(
            createMetricsSnapshot(router.getMap(), registry, { protocol: "MAGISTRAL-v1" })
          )
        );
        return;
      }

      // DELETE .../logs
      if (req.method === "DELETE" && pathname.endsWith("/magistral/logs")) {
        trafficLog.buffer = []; // Clear in-memory buffer
        trafficLog._dirty = true;
        try {
          fs.writeFileSync(LOG_FILE, ""); // Truncate file
        } catch (e) {
          console.error("[Magistral] Failed to clear log file:", e.message);
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // POST .../map/add
      if (req.method === "POST" && pathname.endsWith("/magistral/map/add")) {
        try {
          const body = await jsonBody(req);
          // Support both wrapped { node: ... } and raw node object for compatibility
          const node = router.addNode(body.node || body);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, node }));
        } catch (err) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // POST .../map/save
      if (req.method === "POST" && pathname.endsWith("/magistral/map/save")) {
        try {
          const savePath = path.resolve(MAGISTRAL_DIR, "registry", "maps", "default-new.json");
          const currentMap = router.getMap().map(sanitizeNodeForPersistence);
          fs.writeFileSync(savePath, JSON.stringify(currentMap, null, 2));
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, path: savePath }));
        } catch (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // POST .../probe
      if (req.method === "POST" && pathname.endsWith("/magistral/probe")) {
        try {
          const body = await jsonBody(req);
          const { baseUrl, apiKey } = body;
          if (!baseUrl) throw new Error("baseUrl is required");
          const data = await probeProviderModels(baseUrl, apiKey);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(data));
        } catch (err) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }
    }

    if (req.method === "GET" && (pathname === "/__exit" || pathname === "/stop")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "stopping" }));

      // Register offline before exit
      await registerAiService(AI_PORT, "offline");

      setTimeout(() => {
        if (llamaProcess) {
          try {
            llamaProcess.kill();
          } catch {}
        }
        process.exit(0);
      }, 500);
      return;
    }

    if (req.method === "POST" && parsedUrl.pathname === "/v1/llm2tts") {
      try {
        const body = await jsonBody(req);
        const prompt = body.prompt || "";
        if (!prompt) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing prompt" }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/octet-stream" });

        // 1. Fetch LLM streaming (real streaming with sentence buffering)
        const { fetchUrl, fetchHeaders, resolvedModel } = buildProxyArgs(body, currentModel);

        const llmRes = await fetch(fetchUrl, {
          method: "POST",
          headers: fetchHeaders,
          body: JSON.stringify({
            model: resolvedModel,
            messages: [{ role: "user", content: prompt }],
            max_tokens: body.max_tokens || 256,
            stream: true,
          }),
        });

        const decoder = new TextDecoder("utf-8");
        let rawBuffer = "";
        let sentenceBuffer = "";

        for await (const chunk of llmRes.body) {
          rawBuffer += decoder.decode(chunk, { stream: true });
          let lines = rawBuffer.split("\n");
          rawBuffer = lines.pop(); // Keep partial line

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const dataStr = trimmed.slice(6);
            if (dataStr === "[DONE]") continue;

            try {
              const json = JSON.parse(dataStr);
              const token = json.choices?.[0]?.text || json.choices?.[0]?.delta?.content || "";
              sentenceBuffer += token;

              // Split sentences
              let match;
              while ((match = sentenceBuffer.match(/[.!?]+(?:\s+|$)/))) {
                const endIndex = match.index + match[0].length;
                const sentence = sentenceBuffer.slice(0, endIndex);
                sentenceBuffer = sentenceBuffer.slice(endIndex);

                if (sentence.trim()) {
                  const audio = await tts.generate(sentence, {
                    voice: body.voice || null,
                  });
                  const wavBuffer = encodeWAV(audio.audio, audio.sampling_rate);

                  const chunkSize = 2048;
                  for (let i = 0; i < wavBuffer.length; i += chunkSize) {
                    const b64 = wavBuffer.slice(i, i + chunkSize).toString("base64") + "\n";
                    res.write(b64);
                  }
                }
              }
            } catch (_e) {
              // ignore
            }
          }
        }

        // Flush remaining text
        if (sentenceBuffer.trim()) {
          const audio = await tts.generate(sentenceBuffer, {
            voice: body.voice || null,
          });
          const wavBuffer = encodeWAV(audio.audio, audio.sampling_rate);
          const chunkSize = 2048;
          for (let i = 0; i < wavBuffer.length; i += chunkSize) {
            const b64 = wavBuffer.slice(i, i + chunkSize).toString("base64") + "\n";
            res.write(b64);
          }
        }
        res.end();
      } catch (e) {
        console.error("[AI] /v1/llm2tts error:", e);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    if (req.method === "POST" && parsedUrl.pathname === "/v1/llm/stream") {
      try {
        const body = await jsonBody(req);
        const prompt = body.prompt || "";
        const maxTokens = body.max_tokens || 256;
        const temperature = body.temperature ?? 0.7;

        if (!prompt) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing 'prompt'" }));
          return;
        }

        const { fetchUrl, fetchHeaders, resolvedModel } = buildProxyArgs(body, currentModel);

        const llamaRes = await fetch(fetchUrl, {
          method: "POST",
          headers: fetchHeaders,
          body: JSON.stringify({
            model: resolvedModel,
            messages: [{ role: "user", content: prompt }],
            max_tokens: maxTokens,
            temperature,
            stream: true,
          }),
        });

        if (!llamaRes.ok || !llamaRes.body) {
          const text = await llamaRes.text().catch(() => "");
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "LLM backend error",
              status: llamaRes.status,
              body: text,
            })
          );
          return;
        }

        res.writeHead(200, {
          "Content-Type": "text/plain; charset=utf-8",
          "Transfer-Encoding": "chunked",
        });

        const decoder = new TextDecoder("utf-8");
        let rawBuffer = "";

        for await (const chunk of llamaRes.body) {
          rawBuffer += decoder.decode(chunk, { stream: true });
          let lines = rawBuffer.split("\n");
          rawBuffer = lines.pop();

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const dataStr = trimmed.slice(6);
            if (dataStr === "[DONE]") continue;

            try {
              const json = JSON.parse(dataStr);
              const token = json.choices?.[0]?.text || json.choices?.[0]?.delta?.content || "";
              if (token && !res.writableEnded) {
                res.write(token);
              }
            } catch {}
          }
        }

        if (!res.writableEnded) {
          res.end();
        }
      } catch (e) {
        console.error("[AI] /v1/llm/stream error:", e);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
        }
        if (!res.writableEnded) {
          res.end(JSON.stringify({ error: e.message }));
        }
      }
      return;
    }

    if (
      req.method === "POST" &&
      (parsedUrl.pathname === "/v1/completions" || parsedUrl.pathname === "/v1/chat/completions")
    ) {
      try {
        const body = await jsonBody(req);
        const prompt = body.prompt || body.messages?.[0]?.content || "";
        const maxTokens = body.max_tokens ?? 256;
        const temperature = body.temperature ?? 0.7;
        const stream = body.stream === true;

        if (!prompt) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing 'prompt'" }));
          return;
        }

        const messages =
          Array.isArray(body.messages) && body.messages.length
            ? body.messages
            : [{ role: "user", content: prompt }];

        // --- Embedded Magistral routing ---
        if (isMagistralEnabled() && body.model === "magistral") {
          try {
            const upstreamRes = await routeMagistral({ ...body, messages, stream });
            if (stream) {
              res.writeHead(200, {
                "Content-Type": upstreamRes.headers.get("content-type") || "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
              });
              for await (const chunk of upstreamRes.body) {
                if (!res.writableEnded) res.write(chunk);
              }
              if (!res.writableEnded) res.end();
            } else {
              const data = await upstreamRes.json();
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify(data));
            }
          } catch (err) {
            res.writeHead(503, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // --- Direct Llama routing ---
        const { fetchUrl, fetchHeaders, resolvedModel } = buildProxyArgs(body, currentModel);

        if (!stream) {
          const llamaRes = await fetch(fetchUrl, {
            method: "POST",
            headers: fetchHeaders,
            body: JSON.stringify({
              model: resolvedModel,
              messages,
              max_tokens: maxTokens,
              temperature,
              stream: false,
            }),
          });
          if (!llamaRes.ok) {
            const text = await llamaRes.text();
            res.writeHead(502, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({ error: "LLM backend error", status: llamaRes.status, body: text })
            );
            return;
          }
          const data = await llamaRes.json();
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(data));
          return;
        }

        const llamaRes = await fetch(fetchUrl, {
          method: "POST",
          headers: fetchHeaders,
          body: JSON.stringify({
            model: resolvedModel,
            messages,
            max_tokens: maxTokens,
            temperature,
            stream: true,
          }),
        });
        if (!llamaRes.ok || !llamaRes.body) {
          const text = await llamaRes.text().catch(() => "");
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({ error: "LLM backend error", status: llamaRes.status, body: text })
          );
          return;
        }
        res.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        for await (const chunk of llamaRes.body) {
          if (!res.writableEnded) res.write(chunk);
        }
        if (!res.writableEnded) res.end();
      } catch (e) {
        console.error("[AI] /v1/completions SSE proxy error:", e);
        if (!res.headersSent) res.writeHead(500, { "Content-Type": "application/json" });
        if (!res.writableEnded) res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    if (req.method === "POST" && parsedUrl.pathname === "/v1/llm") {
      try {
        const body = await jsonBody(req);
        const prompt = body.prompt || "";
        const maxTokens = body.max_tokens || 256;
        const temperature = body.temperature ?? 0.7;

        if (!prompt) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing 'prompt'" }));
          return;
        }

        const { fetchUrl, fetchHeaders, resolvedModel } = buildProxyArgs(body, currentModel);

        const llamaRes = await fetch(fetchUrl, {
          method: "POST",
          headers: fetchHeaders,
          body: JSON.stringify({
            model: resolvedModel,
            messages: [{ role: "user", content: prompt }],
            max_tokens: maxTokens,
            temperature,
          }),
        });

        if (!llamaRes.ok) {
          const text = await llamaRes.text();
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "LLM backend error",
              status: llamaRes.status,
              body: text,
            })
          );
          return;
        }

        const data = await llamaRes.json();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(data));
      } catch (e) {
        console.error("[AI] /v1/llm error:", e);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    if (req.method === "POST" && parsedUrl.pathname === "/v1/audio/speech") {
      try {
        const body = await jsonBody(req);
        const text = body.input || body.text;
        const voice = body.voice || "af_bella";
        const speed = body.speed || 1.0;

        if (!text) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing 'input' text" }));
          return;
        }

        const audio = await tts.generate(text, {
          voice,
          speed,
        });

        const wavBuffer = encodeWAV(audio.audio, audio.sampling_rate);

        res.writeHead(200, {
          "Content-Type": "audio/wav",
          "Content-Length": wavBuffer.length,
        });
        res.end(wavBuffer);
      } catch (e) {
        console.error("[AI] /v1/audio/speech error:", e);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    res.writeHead(404);
    res.end("Not Found");
  });

  // --- WebSocket LLM→TTS streaming ---
  const wss = new WebSocketServer({ server, path: "/ws/llm_tts" });
  wss.on("connection", (ws) => {
    ws.on("message", async (message) => {
      try {
        const clientPayload = JSON.parse(message);
        const prompt = clientPayload.prompt || "";
        const voice = clientPayload.voice || null;
        if (!prompt) return;

        const { fetchUrl, fetchHeaders, resolvedModel } = buildProxyArgs(
          clientPayload,
          currentModel
        );

        const llmRes = await fetch(fetchUrl, {
          method: "POST",
          headers: fetchHeaders,
          body: JSON.stringify({
            model: resolvedModel,
            messages: [{ role: "user", content: prompt }],
            max_tokens: 256,
            stream: true,
          }),
        });

        const decoder = new TextDecoder("utf-8");
        let rawBuffer = "";
        let sentenceBuffer = "";
        let streamEnded = false;

        for await (const chunk of llmRes.body) {
          rawBuffer += decoder.decode(chunk, { stream: true });
          let lines = rawBuffer.split("\n");
          rawBuffer = lines.pop();

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const dataStr = trimmed.slice(6).trim();

            if (dataStr === "[DONE]") {
              if (sentenceBuffer.trim()) {
                const audio = await tts.generate(sentenceBuffer, {
                  voice,
                });
                const wavB64 = encodeWAV(audio.audio, audio.sampling_rate).toString("base64");
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(
                    JSON.stringify({
                      text: sentenceBuffer,
                      audio_chunk: wavB64,
                    })
                  );
                }
                sentenceBuffer = "";
              }
              streamEnded = true;
              break;
            }

            try {
              const json = JSON.parse(dataStr);
              const token = json.choices?.[0]?.text || json.choices?.[0]?.delta?.content || "";
              sentenceBuffer += token;

              let match;
              while ((match = sentenceBuffer.match(/[.!?]+(?:\s+|$)/))) {
                const endIndex = match.index + match[0].length;
                const sentence = sentenceBuffer.slice(0, endIndex);
                sentenceBuffer = sentenceBuffer.slice(endIndex);

                if (sentence.trim()) {
                  const audio = await tts.generate(sentence, {
                    voice,
                  });
                  const wavB64 = encodeWAV(audio.audio, audio.sampling_rate).toString("base64");
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(
                      JSON.stringify({
                        text: sentence,
                        audio_chunk: wavB64,
                      })
                    );
                  }
                }
              }
            } catch (_e) {}
          }

          if (streamEnded) {
            break;
          }
        }

        if (!streamEnded && sentenceBuffer.trim()) {
          const audio = await tts.generate(sentenceBuffer, {
            voice,
          });
          const wavB64 = encodeWAV(audio.audio, audio.sampling_rate).toString("base64");
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                text: sentenceBuffer,
                audio_chunk: wavB64,
              })
            );
          }
        }

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ done: true }));
          ws.close();
        }
      } catch (e) {
        console.error("[WS] error:", e);
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(
              JSON.stringify({
                error: e.message || "LLM2TTS stream error",
              })
            );
          } catch {}
          ws.close();
        }
      }
    });
    ws.on("close", () => {});
  });

  server.listen(AI_PORT, AI_HOST, async () => {
    console.log(`[AI] Unified AI server listening on http://${AI_HOST}:${AI_PORT}`);
    // Register online
    await registerAiService(AI_PORT, "online");
  });
}

async function handleStatus() {
  try {
    const res = await fetch(`http://${AI_HOST}:${AI_PORT}/health`);
    if (!res.ok) {
      console.log(`[AI] Server on port ${AI_PORT} responded with status ${res.status}`);
      process.exit(1);
    }
    const data = await res.json();
    console.log(
      `[AI] Status: ${data.status} (llm=${data.llm}, tts=${data.tts}) on port ${AI_PORT}`
    );
    process.exit(0);
  } catch {
    console.log(`[AI] Unified server is OFFLINE on port ${AI_PORT}`);
    process.exit(1);
  }
}

async function handleStop() {
  try {
    const res = await fetch(`http://${AI_HOST}:${AI_PORT}/__exit`);
    if (res.ok) {
      console.log("[AI] Stop request sent successfully.");
      process.exit(0);
    }
    console.log(`[AI] Stop request failed with status ${res.status} on port ${AI_PORT}`);
    process.exit(1);
  } catch {
    console.log(`[AI] Unified server is already OFFLINE on port ${AI_PORT}`);
    process.exit(0);
  }
}

async function loadInstanceConfig() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return;
  }

  try {
    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };

    // Fetch instance_config (limit 1000)
    const res = await fetch(`${supabaseUrl}/rest/v1/instance_config?select=key,value&limit=1000`, {
      headers,
    });

    if (!res.ok) {
      // Table might not exist or other error, just ignore
      return;
    }

    const rows = await res.json();
    let count = 0;
    if (Array.isArray(rows)) {
      for (const row of rows) {
        if (row.key && row.value && !process.env[row.key]) {
          // Only set if not already present in env (env takes precedence)
          // Ensure value is a string for process.env
          const val = typeof row.value === "object" ? JSON.stringify(row.value) : String(row.value);
          process.env[row.key] = val;

          // Identify if it looks like an API key for logging
          if (row.key.includes("API_KEY") || row.key.includes("SECRET")) {
            count++;
          }
        }
      }
    }
    if (count > 0) {
      console.log(`[AI] Loaded ${count} keys from instance config.`);
    }
  } catch (e) {
    console.warn(`[AI] Error loading instance config:`, e.message);
  }
}

async function main() {
  if (isHelp) {
    printUsage();
    return;
  }

  if (isStatus) {
    await handleStatus();
    return;
  }

  if (isStop) {
    await handleStop();
    return;
  }

  if (command === "start" && !args.includes("--model")) {
    console.error("[AI] Missing --model for explicit start command.");
    printUsage();
    process.exit(1);
  }

  // Load instance config (API keys, etc.) before starting
  await loadInstanceConfig();

  if (!(await llamaAlive())) {
    launchLlamaServer();
    const ok = await waitForLlama();
    if (!ok) {
      console.error("[AI] llama-server failed to start within timeout.");
      process.exit(1);
    }
  } else {
    console.log(`[AI] llama-server already running on ${LLAMA_BASE_URL}`);
  }

  await initTTS();
  startServer();

  process.on("SIGINT", () => {
    console.log("[AI] SIGINT received, shutting down...");
    if (llamaProcess) {
      try {
        llamaProcess.kill();
      } catch {}
    }
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("[AI] SIGTERM received, shutting down...");
    if (llamaProcess) {
      try {
        llamaProcess.kill();
      } catch {}
    }
    process.exit(0);
  });
}

main().catch((e) => {
  console.error("[AI] Fatal error:", e);
  process.exit(1);
});
