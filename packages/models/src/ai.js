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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
dotenv.config({ path: path.join(__dirname, "..", "..", "..", ".env") });

const args = process.argv.slice(2);

function getArgValue(flag, defaultValue) {
  const index = args.indexOf(flag);
  if (index === -1) return defaultValue;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) return defaultValue;
  return value;
}

const isStatus = args.includes("--status");
const isStop = args.includes("--stop") || args.includes("--down");

const AI_HOST = "127.0.0.1";
let AI_PORT = parseInt(getArgValue("--port", "8880"), 10);
if (!Number.isFinite(AI_PORT) || AI_PORT <= 0) {
  AI_PORT = 8880;
}

let LLAMA_PORT = parseInt(getArgValue("--llama-port", "8080"), 10);
if (!Number.isFinite(LLAMA_PORT) || LLAMA_PORT <= 0) {
  LLAMA_PORT = 8080;
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
      } catch (e) {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

function getInspectorHTML() {
  const filePath = path.join(__dirname, "ai-inspector.html");
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (err) {
    return `<h1>AI Inspector Error</h1><p>${err.message}</p>`;
  }
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

    if (req.method === "GET" && pathname === "/") {
      res.writeHead(302, { Location: "/__inspector" });
      res.end();
      return;
    }

    if (req.method === "GET" && (pathname === "/__inspector" || pathname === "/__inspector/")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(getInspectorHTML());
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
        const llmRes = await fetch(`${LLAMA_BASE_URL}/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: MODELS[currentModel],
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
            } catch (e) {
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

        const llamaRes = await fetch(`${LLAMA_BASE_URL}/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: MODELS[currentModel],
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

    if (req.method === "POST" && parsedUrl.pathname === "/v1/completions") {
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

        if (!stream) {
          const llamaRes = await fetch(`${LLAMA_BASE_URL}/v1/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: MODELS[currentModel],
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
          return;
        }

        const llamaRes = await fetch(`${LLAMA_BASE_URL}/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: MODELS[currentModel],
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
            JSON.stringify({
              error: "LLM backend error",
              status: llamaRes.status,
              body: text,
            })
          );
          return;
        }

        res.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });

        for await (const chunk of llamaRes.body) {
          if (!res.writableEnded) {
            res.write(chunk);
          }
        }

        if (!res.writableEnded) {
          res.end();
        }
      } catch (e) {
        console.error("[AI] /v1/completions SSE proxy error:", e);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
        }
        if (!res.writableEnded) {
          res.end(JSON.stringify({ error: e.message }));
        }
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

        const llamaRes = await fetch(`${LLAMA_BASE_URL}/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: MODELS[currentModel],
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

        const llmRes = await fetch(`${LLAMA_BASE_URL}/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: MODELS[currentModel],
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
            } catch (e) {}
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

async function main() {
  if (isStatus) {
    await handleStatus();
    return;
  }

  if (isStop) {
    await handleStop();
    return;
  }

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
