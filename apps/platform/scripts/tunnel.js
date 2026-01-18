#!/usr/bin/env node
/**
 * Script to create a tunnel (Cloudflare or Ngrok) for the platform API
 */

import ngrok from "ngrok";
import { exec } from "child_process";
import { promisify } from "util";
import minimist from "minimist";
import http from "http";
import net from "net";
import fs from "fs";
import { spawn } from "child_process";

const execAsync = promisify(exec);
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { loadConfig, getConfig } from "./lib/config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// CRITICAL: Prevent the tunnel script from proxying itself
// This avoids circular dependencies when ngrok/fetch try to use the proxy we are currently starting
delete process.env.HTTP_PROXY;
delete process.env.HTTPS_PROXY;
delete process.env.http_proxy;
delete process.env.https_proxy;

const ROOT_DIR = path.resolve(__dirname, "../../../");
const ENV_PATH = path.join(ROOT_DIR, ".env");

// Load configuration from .env and Vault
await loadConfig();

function updateEnvProxy(proxyPort) {
  debugLog(`Updating .env with proxy port: ${proxyPort}`, "ENV");
  if (!fs.existsSync(ENV_PATH)) {
    debugLog(`.env file not found at ${ENV_PATH}`, "ENV");
    return;
  }

  try {
    let content = fs.readFileSync(ENV_PATH, "utf8");
    const markerStart = "# [INSEME TUNNEL PROXY START]";
    const markerEnd = "# [INSEME TUNNEL PROXY END]";
    const proxyLines = `${markerStart}
HTTP_PROXY=http://localhost:${proxyPort}
HTTPS_PROXY=http://localhost:${proxyPort}
VITE_PROXY_URL=http://localhost:${proxyPort}/
${markerEnd}`;

    const startIndex = content.indexOf(markerStart);
    const endIndex = content.indexOf(markerEnd);

    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      debugLog("Found existing proxy block in .env, replacing...", "ENV");
      // Replace existing block
      content =
        content.substring(0, startIndex) +
        proxyLines +
        content.substring(endIndex + markerEnd.length);
    } else {
      debugLog("Appending new proxy block to .env", "ENV");
      // Append new block
      content = content.trimEnd() + `\n\n${proxyLines}\n`;
    }

    fs.writeFileSync(ENV_PATH, content, "utf8");
    console.log(`✅ .env mis à jour : PROXY -> http://localhost:${proxyPort}`);
    console.log(`✅ .env mis à jour : VITE_PROXY_URL -> http://localhost:${proxyPort}/`);
  } catch (err) {
    debugLog(`Error updating .env: ${err.message}`, "ENV");
    console.warn("⚠️ Impossible de mettre à jour le fichier .env :", err.message);
  }
}

function removeEnvProxy() {
  debugLog("Removing proxy from .env", "ENV");
  if (!fs.existsSync(ENV_PATH)) return;

  try {
    let content = fs.readFileSync(ENV_PATH, "utf8");
    const markerStart = "# [INSEME TUNNEL PROXY START]";
    const markerEnd = "# [INSEME TUNNEL PROXY END]";

    const startIndex = content.indexOf(markerStart);
    const endIndex = content.indexOf(markerEnd);

    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      debugLog("Found proxy block in .env, removing...", "ENV");
      // Remove the block and surrounding newlines if possible
      let before = content.substring(0, startIndex);
      let after = content.substring(endIndex + markerEnd.length);
      content = (before.trimEnd() + "\n" + after.trimStart()).trim();
      fs.writeFileSync(ENV_PATH, content + "\n", "utf8");
      console.log("🧹 .env nettoyé (variables PROXY retirées)");
    } else {
      debugLog("No proxy block found in .env", "ENV");
    }
  } catch (err) {
    debugLog(`Error cleaning .env: ${err.message}`, "ENV");
    console.warn("⚠️ Impossible de nettoyer le fichier .env :", err.message);
  }
}

const argv = minimist(process.argv.slice(2), {
  alias: { h: "help" },
});

if (argv.help) {
  console.log(`
Usage: tunnel.js [options]

Options:
  --port <number>        Port de l'application locale (default: 8888)
  --proxy-port <number>  Port du proxy stable (default: port + 1)
  --proxy                Utiliser un proxy sidecar pour la stabilité (default: true)
  --no-proxy             Désactiver le proxy sidecar et tunnel direct vers port
  --force                Forcer le lancement même si un proxy tourne déjà
  --room <slug>          Slug de la room Supabase (default: cyrnea)
  --redirect             Activer la redirection globale de l'instance déployée vers ce tunnel
  --off                  Désactiver la redirection globale et nettoyer les métadonnées sans lancer de tunnel
  --verbose              Afficher tout le trafic passant par le proxy
  --debug                Afficher des informations de debug détaillées
  --slow <ms>            Simuler de la latence (ajoute X ms à chaque requête)
  --inject "H: V"        Injecter un header HTTP dans chaque requête (ex: "Authorization: Bearer 123")
  --help, -h       Show this help message

Environment variables required (one of the tunnels):
  
  [Cloudflare (Preferred)]
  CLOUDFLARE_TUNNEL_TOKEN   Token for your cloudflare tunnel (zero trust)
  CLOUDFLARE_DOMAIN         The domain/subdomain you mapped (e.g. cyrnea.lepp.fr)

  [Ngrok (Fallback)]
  NGROK_AUTH_TOKEN          Get one at: https://dashboard.ngrok.com/get-started/your-authtoken

  [Database]
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  `);
  process.exit(0);
}

const PORT = argv.port || getConfig("platform_port") || 8888;
const PROXY_PORT = argv["proxy-port"] || getConfig("proxy_port") || Number(PORT) + 1;
const USE_PROXY = argv.proxy !== false; // Default to true if not --no-proxy
const FORCE_START = !!argv.force;
const ROOM_SLUG = argv.room || getConfig("bar_room_slug") || "cyrnea";
const REDIRECT_ENABLED = !!argv.redirect;
const VERBOSE = !!argv.verbose;
const DEBUG_MODE = !!argv.debug;
const LATENCY = parseInt(argv.slow) || 0;
const INJECT_HEADER = argv.inject;
const IS_NODEMON = !!process.env.NODEMON;

const TRAFFIC_HISTORY = [];
const MAX_HISTORY = 100;
const SSE_CLIENTS = new Set();
let TARGET_ONLINE = false;
let LAST_TRAFFIC_TIME = 0;
let PUBLIC_URL = null;

let STATS = {
  in_count: 0,
  out_count: 0,
  error_count: 0,
  bytes_in: 0,
  bytes_out: 0,
  since: Date.now(),
};

// Terminal Support
let SHELL_PROCESS = null;
const SHELL_HISTORY = [];
const MAX_SHELL_HISTORY = 1000;

function startShell() {
  if (SHELL_PROCESS) return;

  const isWin = process.platform === "win32";
  const shell = isWin ? "powershell.exe" : "bash";
  const args = isWin
    ? [
        "-NoExit",
        "-Command",
        "$OutputEncoding = [Console]::OutputEncoding = [Console]::InputEncoding = [System.Text.Encoding]::UTF8; chcp 65001 > $null",
      ]
    : [];

  SHELL_PROCESS = spawn(shell, args, {
    cwd: ROOT_DIR,
    env: { ...process.env, COLUMNS: 80, LINES: 24 },
  });

  const broadcastShell = (data, source) => {
    const text = data.toString();
    const payload = JSON.stringify({
      type: "terminal",
      timestamp: new Date().toISOString(),
      message: text,
      source,
    });
    SHELL_HISTORY.push({ timestamp: new Date().toISOString(), message: text, source });
    if (SHELL_HISTORY.length > MAX_SHELL_HISTORY) SHELL_HISTORY.shift();
    SSE_CLIENTS.forEach((client) => client.write(`data: ${payload}\n\n`));
  };

  SHELL_PROCESS.stdout.on("data", (data) => broadcastShell(data, "stdout"));
  SHELL_PROCESS.stderr.on("data", (data) => broadcastShell(data, "stderr"));
  SHELL_PROCESS.on("exit", (code) => {
    broadcastShell(`\n[Shell exited with code ${code}]\n`, "system");
    SHELL_PROCESS = null;
    // Restart shell after a short delay
    setTimeout(startShell, 2000);
  });
}

// Start shell immediately
startShell();

let IS_PROXY_ENABLED = true; // Track if HTTP_PROXY is enabled in .env
let CF_PROCESS = null; // Track cloudflare process
let IS_TUNNEL_RUNNING = false;
let PROXY_SERVER = null;

function broadcastRequest(data) {
  const payload = JSON.stringify(data);
  SSE_CLIENTS.forEach((client) => {
    client.write(`data: ${payload}\n\n`);
  });
}

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
}

function getStatusPayload() {
  const payload = {
    type: "status",
    online: TARGET_ONLINE,
    url: PUBLIC_URL,
    debug: DEBUG_MODE,
    port: PORT,
    proxyPort: PROXY_PORT,
    isNodemon: IS_NODEMON,
    localIp: getLocalIp(),
  };

  payload.supervision = {
    isProxyEnabled: IS_PROXY_ENABLED,
    isTunnelRunning: IS_TUNNEL_RUNNING,
  };

  if (TUNNEL_TYPE === "ngrok" && IS_TUNNEL_RUNNING) {
    payload.supervision.ngrok_local = "http://localhost:4040";
    payload.supervision.ngrok_cloud = "https://dashboard.ngrok.com/tunnels/agents";
  }

  return payload;
}

function broadcastStatus() {
  const json = JSON.stringify(getStatusPayload());
  SSE_CLIENTS.forEach((client) => {
    client.write(`data: ${json}\n\n`);
  });
}

function broadcastStats() {
  const payload = JSON.stringify({ type: "stats", stats: STATS });
  SSE_CLIENTS.forEach((client) => {
    client.write(`data: ${payload}\n\n`);
  });
}

function debugLog(message, context = "") {
  if (!DEBUG_MODE) return;
  const timestamp = new Date().toISOString();
  const formatted = `[DEBUG] [${timestamp}] ${context ? `(${context}) ` : ""}${message}`;
  console.log(formatted);

  const payload = JSON.stringify({
    type: "debug",
    timestamp,
    message,
    context,
  });
  SSE_CLIENTS.forEach((client) => {
    client.write(`data: ${payload}\n\n`);
  });
}

// Background check for target app (low frequency: 5s)
setInterval(async () => {
  if (SSE_CLIENTS.size === 0) return; // Only check if someone is watching

  // Optimization: If we've seen traffic in the last 30 seconds, assume app is online
  const now = Date.now();
  if (TARGET_ONLINE && now - LAST_TRAFFIC_TIME < 30000) {
    return;
  }

  try {
    const conn = net.connect(PORT, "localhost");
    conn.on("connect", () => {
      if (!TARGET_ONLINE) {
        TARGET_ONLINE = true;
        broadcastStatus();
      }
      conn.destroy();
    });
    conn.on("error", () => {
      if (TARGET_ONLINE) {
        TARGET_ONLINE = false;
        broadcastStatus();
      }
    });
    conn.setTimeout(1000, () => conn.destroy());
  } catch (e) {
    if (TARGET_ONLINE) {
      TARGET_ONLINE = false;
      broadcastStatus();
    }
  }
}, 5000);

// Tunnel selection logic
const CF_TOKEN = getConfig("cloudflare_tunnel_token");
const CF_DOMAIN = getConfig("cloudflare_domain");
const NGROK_TOKEN = getConfig("ngrok_auth_token");

const SUPABASE_URL = getConfig("supabase_url");
const SERVICE_KEY = getConfig("supabase_service_role_key");

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env");
  process.exit(1);
}

if (!CF_TOKEN && !NGROK_TOKEN) {
  console.error("ERROR: Either CLOUDFLARE_TUNNEL_TOKEN or NGROK_AUTH_TOKEN must be provided.");
  process.exit(1);
}

const TUNNEL_TYPE = CF_TOKEN ? "cloudflare" : "ngrok";
console.log(`\n--- TUNNEL MODE: ${TUNNEL_TYPE.toUpperCase()} ---`);
console.log(`--- START TIME: ${new Date().toLocaleTimeString()} ---`);

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function runOperationalTests() {
  console.log("🔍 Running operational tests...");

  // 1. Test Supabase connectivity
  try {
    const { data: rooms, error: roomsError } = await supabase
      .from("inseme_rooms")
      .select("id")
      .limit(1);

    if (roomsError) throw roomsError;
    console.log("✅ Supabase connection: OK");
  } catch (err) {
    console.error("❌ Supabase connection FAILED:", err.message);
    process.exit(1);
  }

  // 2. Test Room existence/creation permissions
  try {
    const { data: room, error: fetchError } = await supabase
      .from("inseme_rooms")
      .select("id")
      .eq("slug", ROOM_SLUG)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!room) {
      console.log(`ℹ️ Room '${ROOM_SLUG}' not found, will be created.`);
    } else {
      console.log(`✅ Room '${ROOM_SLUG}' access: OK`);
    }
  } catch (err) {
    console.error(`❌ Room '${ROOM_SLUG}' access FAILED:`, err.message);
    process.exit(1);
  }

  console.log("🚀 Operational tests passed!\n");
}

async function patchSiteConfig({ enabled, url }) {
  console.log(`Updating site_config: enabled=${enabled}, url=${url}...`);
  try {
    // get first user id (assumes a users row exists)
    const { data: users, error: userError } = await supabase.from("users").select("id").limit(1);

    if (userError) throw userError;
    if (!users || users.length === 0) throw new Error("No users row found to patch.");
    const id = users[0].id;

    const body = {
      metadata: { site_config: { redirect_enabled: enabled, redirect_url: url || null } },
    };

    const { error: patchError } = await supabase.from("users").update(body).eq("id", id);

    if (patchError) throw patchError;
    console.log(`✅ site_config updated: enabled=${enabled} url=${url}`);
  } catch (err) {
    console.error(`❌ Failed to patch site_config:`, err.message);
  }
}

async function notifyDeployedControl() {
  const controlUrl =
    getConfig("deployed_control_url") ||
    ((getConfig("app_base_url") || getConfig("deploy_url")) &&
      `${(getConfig("app_base_url") || getConfig("deploy_url")).replace(/\/$/, "")}/.netlify/functions/tunnel-control`);
  const secret = getConfig("tunnel_control_secret");

  if (!controlUrl || !secret) {
    console.log(
      "ℹ️ No deployed control URL or TUNNEL_CONTROL_SECRET set; skipping deployed notify."
    );
    return;
  }

  try {
    console.log("📡 Notifying deployed control endpoint:", controlUrl);
    const res = await fetch(controlUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "refresh" }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.warn("⚠️ Deployed notify returned non-OK:", res.status, txt);
    } else {
      console.log("✅ Deployed instance notified successfully.");
    }
  } catch (err) {
    console.warn("⚠️ Failed to call deployed control endpoint:", err.message);
  }
}

async function startTunnel() {
  if (IS_TUNNEL_RUNNING) return;

  if (TUNNEL_TYPE === "cloudflare") {
    debugLog(`Starting Cloudflare tunnel for domain ${CF_DOMAIN}...`, "TUNNEL");
    try {
      CF_PROCESS = exec(`cloudflared tunnel run --token ${CF_TOKEN}`);
      CF_PROCESS.stdout.on("data", (data) => console.log(`[CF] ${data.trim()}`));
      CF_PROCESS.stderr.on("data", (data) => {
        if (data.includes("error")) console.error(`[CF-ERROR] ${data.trim()}`);
      });

      const url = CF_DOMAIN.startsWith("http") ? CF_DOMAIN : `https://${CF_DOMAIN}`;
      PUBLIC_URL = url;
      IS_TUNNEL_RUNNING = true;
      broadcastStatus();

      if (USE_PROXY) await verifyTunnelReachability(url);
      await updateRoomMetadata(url);
      if (REDIRECT_ENABLED) {
        await patchSiteConfig({ enabled: true, url });
        await notifyDeployedControl();
      }
    } catch (err) {
      debugLog(`Error starting Cloudflare: ${err.message}`, "TUNNEL-ERR");
      console.error("Error starting Cloudflare tunnel:", err);
    }
  } else {
    debugLog("Starting ngrok tunnel...", "TUNNEL");
    try {
      await ngrok.authtoken(NGROK_TOKEN);
      const ngrokTargetPort = USE_PROXY ? PROXY_PORT : PORT;
      const url = await ngrok.connect({ addr: Number(ngrokTargetPort) });
      PUBLIC_URL = url;
      IS_TUNNEL_RUNNING = true;
      broadcastStatus();

      if (USE_PROXY) await verifyTunnelReachability(url);
      await updateRoomMetadata(url);
      if (REDIRECT_ENABLED) {
        await patchSiteConfig({ enabled: true, url });
        await notifyDeployedControl();
      }
      console.log("ngrok url:", url);
    } catch (err) {
      debugLog(`Error starting ngrok: ${err.message}`, "TUNNEL-ERR");
      console.error("Error starting ngrok:", err);
    }
  }
}

async function stopTunnel() {
  if (!IS_TUNNEL_RUNNING) return;

  debugLog("Stopping tunnel...", "TUNNEL");
  try {
    await updateRoomMetadata(null);
    if (REDIRECT_ENABLED) {
      await patchSiteConfig({ enabled: false, url: null });
      await notifyDeployedControl();
    }

    if (TUNNEL_TYPE === "cloudflare" && CF_PROCESS) {
      CF_PROCESS.kill();
      CF_PROCESS = null;
    } else {
      await ngrok.disconnect();
      await ngrok.kill();
    }

    PUBLIC_URL = null;
    IS_TUNNEL_RUNNING = false;
    broadcastStatus();
    console.log("✅ Tunnel stopped.");
  } catch (err) {
    debugLog(`Error stopping tunnel: ${err.message}`, "TUNNEL-ERR");
    console.error("Error stopping tunnel:", err);
  }
}

async function startProxyServer() {
  debugLog(`Starting Proxy server on port ${PROXY_PORT}`, "PROXY-INIT");

  PROXY_SERVER = http.createServer(async (req, res) => {
    debugLog(`${req.method} ${req.url}`, "PROXY-REQ");
    const start = Date.now();
    const requestId = Math.random().toString(36).substring(7);
    const parsedUrl = new URL(req.url, `http://localhost:${PROXY_PORT}`);
    const pathname = parsedUrl.pathname;

    if (VERBOSE) {
      console.log(`[Proxy] [${requestId}] ${req.method} ${req.url}`);
    }

    // Health check
    if (pathname === "/__health") {
      debugLog("Health check request", "PROXY-INTERNAL");
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("TUNNEL_OK");
      return;
    }

    // Proxy status
    if (pathname === "/__proxy_status") {
      debugLog("Proxy status request", "PROXY-INTERNAL");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "active",
          mode: "proxy",
          target_port: PORT,
          listen_port: PROXY_PORT,
          uptime: Math.floor(process.uptime()),
          features: {
            verbose: VERBOSE,
            debug: DEBUG_MODE,
            latency: LATENCY,
            injected_header: INJECT_HEADER,
          },
          history_count: TRAFFIC_HISTORY.length,
        })
      );
      return;
    }

    // Graceful Exit
    if (pathname === "/__exit") {
      const isRestart = req.url.includes("restart=true");
      debugLog(isRestart ? "Graceful restart requested" : "Graceful exit requested", "CONTROL");
      console.log(`\n👋 Graceful ${isRestart ? "restart" : "exit"} requested via /__exit`);

      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(isRestart ? "Restarting..." : "Stopping...");

      if (isRestart) {
        // If we want nodemon to restart us, we can "touch" a watched file
        try {
          const now = new Date();
          fs.utimesSync(fileURLToPath(import.meta.url), now, now);
          debugLog("Touched tunnel.js to trigger nodemon restart", "CONTROL");
        } catch (err) {
          // Ignore
        }
      }

      // Give a small delay to allow the response to be sent
      setTimeout(() => {
        debugLog("Triggering SIGINT for cleanup", "CONTROL");
        process.kill(process.pid, "SIGINT");
      }, 500);
      return;
    }

    // Inspector UI
    if (pathname === "/__inspector" || pathname === "/__inspector/") {
      debugLog("Serving Inspector UI", "PROXY-INTERNAL");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(getInspectorHTML());
      return;
    }

    // Serve static files for inspector if needed
    if (pathname.startsWith("/__inspector/")) {
      const fileName = pathname.replace("/__inspector/", "");
      if (fileName && !["reset", "events"].includes(fileName)) {
        debugLog(`Serving Inspector static file: ${fileName}`, "PROXY-INTERNAL");
        const filePath = path.join(__dirname, fileName);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(fileName).toLowerCase();
          const mimeTypes = {
            ".html": "text/html",
            ".js": "application/javascript",
            ".css": "text/css",
            ".json": "application/json",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".gif": "image/gif",
            ".svg": "image/svg+xml",
          };
          res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
          fs.createReadStream(filePath).pipe(res);
          return;
        }
      }
    }

    // Reset Stats & History
    if (pathname === "/__inspector/reset") {
      debugLog("Resetting stats and history", "CONTROL");
      STATS = {
        in_count: 0,
        out_count: 0,
        error_count: 0,
        bytes_in: 0,
        bytes_out: 0,
        since: Date.now(),
      };
      TRAFFIC_HISTORY.length = 0; // Clear history too
      broadcastStats();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "reset_ok" }));
      return;
    }

    // Terminal Input
    if (pathname === "/__inspector/terminal-input") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const { command } = JSON.parse(body);
          if (SHELL_PROCESS) {
            SHELL_PROCESS.stdin.write(command + "\n");
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "ok" }));
        } catch (e) {
          res.writeHead(400);
          res.end("Invalid JSON");
        }
      });
      return;
    }

    // Ophélia Chat Relay
    if (pathname === "/__inspector/ophelia-chat") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const { question, history } = JSON.parse(body);
          const payload = JSON.stringify({
            question,
            messages: history || [],
            room_id: "inspector-telnet",
            model: "gpt-4o",
            role: "mediator",
            room_settings: {
              name: "Inspector Telnet",
              ophelia: { voice: "nova" },
            },
          });

          // Relay to local Netlify dev (default port 8888)
          const relayReq = http.request(
            "http://localhost:8888/api/chat-stream",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload),
              },
            },
            (relayRes) => {
              res.writeHead(relayRes.statusCode, relayRes.headers);
              relayRes.pipe(res);
            }
          );

          relayReq.on("error", (err) => {
            console.error("Relay error:", err);
            res.writeHead(502);
            res.end("Ophélia API not reachable (is 'netlify dev' running?)");
          });

          relayReq.write(payload);
          relayReq.end();
        } catch (e) {
          res.writeHead(400);
          res.end("Invalid JSON");
        }
      });
      return;
    }

    // Launch Proxied Browser
    if (pathname === "/__inspector/launch-browser") {
      debugLog("Launching proxied browser", "CONTROL");
      const chromeCmd = `start chrome --proxy-server="http://localhost:${PROXY_PORT}" --user-data-dir="%TEMP%\\inseme-proxy-${PROXY_PORT}"`;
      exec(chromeCmd, (err) => {
        if (err) {
          debugLog(`Failed to launch browser: ${err.message}`, "ERROR");
        }
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    // Toggle Tunnel (IN)
    if (pathname === "/__inspector/toggle-in") {
      debugLog("Toggling tunnel (IN)", "CONTROL");
      try {
        if (IS_TUNNEL_RUNNING) {
          await stopTunnel();
        } else {
          await startTunnel();
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", running: IS_TUNNEL_RUNNING }));
      } catch (err) {
        debugLog(`Toggle-IN error: ${err.message}`, "ERROR");
        res.writeHead(500);
        res.end(err.message);
      }
      return;
    }

    // Toggle Proxy (OUT)
    if (pathname === "/__inspector/toggle-out") {
      debugLog("Toggling proxy (OUT)", "CONTROL");
      try {
        if (IS_PROXY_ENABLED) {
          removeEnvProxy();
          IS_PROXY_ENABLED = false;
        } else {
          updateEnvProxy(PROXY_PORT);
          IS_PROXY_ENABLED = true;
        }
        broadcastStatus();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", enabled: IS_PROXY_ENABLED }));
      } catch (err) {
        debugLog(`Toggle-OUT error: ${err.message}`, "ERROR");
        res.writeHead(500);
        res.end(err.message);
      }
      return;
    }

    // SSE Events for Inspector
    if (pathname === "/__inspector/events") {
      debugLog("New SSE client connected to Inspector", "SSE");
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write("retry: 10000\n\n");
      // Send terminal history
      SHELL_HISTORY.forEach((item) => {
        res.write(`data: ${JSON.stringify({ type: "terminal", ...item })}\n\n`);
      });

      SSE_CLIENTS.add(res);
      req.on("close", () => {
        debugLog("SSE client disconnected from Inspector", "SSE");
        SSE_CLIENTS.delete(res);
      });

      // Send current target status immediately
      const initialStatus = getStatusPayload();
      res.write(`data: ${JSON.stringify(initialStatus)}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "stats", stats: STATS })}\n\n`);

      // Send history
      TRAFFIC_HISTORY.forEach((item) => {
        res.write(`data: ${JSON.stringify(item)}\n\n`);
      });
      return;
    }

    // Wrapper function to handle forwarding
    const forwardRequest = () => {
      const headers = {
        ...req.headers,
        "x-forwarded-for": req.socket.remoteAddress,
        "x-inseme-proxy": "true",
        "ngrok-skip-browser-warning": "true",
      };
      if (INJECT_HEADER && INJECT_HEADER.includes(":")) {
        const [key, ...valParts] = INJECT_HEADER.split(":");
        headers[key.trim().toLowerCase()] = valParts.join(":").trim();
      }

      // Check if this is a forward proxy request (absolute URL)
      const isForward = req.url.startsWith("http://") || req.url.startsWith("https://");
      // Check if this is a gateway proxy request (prefixed path)
      const isGateway = req.url.startsWith("/http://") || req.url.startsWith("/https://");

      let proxyOptions;

      if (isForward || isGateway) {
        let targetUrl;
        if (isGateway) {
          // Remove the leading slash to get the full URL
          targetUrl = new URL(req.url.substring(1));
        } else {
          targetUrl = new URL(req.url);
        }

        proxyOptions = {
          host: targetUrl.hostname,
          port: targetUrl.port || (targetUrl.protocol === "https:" ? 443 : 80),
          path: targetUrl.pathname + targetUrl.search,
          method: req.method,
          headers: headers,
        };
      } else {
        proxyOptions = {
          host: "localhost",
          port: PORT,
          path: req.url,
          method: req.method,
          headers: headers,
        };
      }

      const proxyReq = http.request(proxyOptions, (proxyRes) => {
        debugLog(`Response from target: ${proxyRes.statusCode}`, "PROXY-RES");
        const logItem = {
          id: requestId,
          timestamp: Date.now(),
          method: req.method,
          url: isGateway ? req.url.substring(1) : req.url,
          status: proxyRes.statusCode,
          duration: Date.now() - start,
          direction: isForward || isGateway ? "out" : "in",
          req_headers: req.headers,
          res_headers: proxyRes.headers,
        };

        TRAFFIC_HISTORY.push(logItem);
        if (TRAFFIC_HISTORY.length > MAX_HISTORY) TRAFFIC_HISTORY.shift();

        // Stats
        if (isForward || isGateway) STATS.out_count++;
        else STATS.in_count++;

        if (proxyRes.statusCode >= 400) STATS.error_count++;

        broadcastRequest(logItem);
        broadcastStats();

        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.on("data", (chunk) => {
          if (isForward || isGateway) STATS.bytes_out += chunk.length;
          else STATS.bytes_in += chunk.length;
          res.write(chunk);
        });
        proxyRes.on("end", () => {
          res.end();
        });
      });

      proxyReq.on("error", (err) => {
        debugLog(`Proxy error: ${err.message || err.code || "Unknown error"}`, "PROXY-ERR");
        STATS.error_count++;
        broadcastStats();

        const logItem = {
          id: requestId,
          timestamp: Date.now(),
          method: req.method,
          url: isGateway ? req.url.substring(1) : req.url,
          status: 502,
          duration: Date.now() - start,
          direction: isForward || isGateway ? "out" : "in",
          req_headers: req.headers,
          res_headers: { error: err.message },
        };
        TRAFFIC_HISTORY.push(logItem);
        broadcastRequest(logItem);

        res.writeHead(502);
        res.end(`Proxy Error: ${err.message}`);
      });

      req.pipe(proxyReq);
    };

    // Simulate Latency if set
    if (LATENCY > 0) {
      setTimeout(forwardRequest, LATENCY);
    } else {
      forwardRequest();
    }
  });

  // Handle CONNECT for HTTPS Tunneling
  PROXY_SERVER.on("connect", (req, clientSocket, head) => {
    const [host, port] = req.url.split(":");
    debugLog(`HTTPS CONNECT request to ${host}:${port || 443}`, "PROXY-CONNECT");

    const requestId = Math.random().toString(36).substring(7);
    const logItem = {
      id: requestId,
      timestamp: Date.now(),
      method: "CONNECT",
      url: req.url,
      status: 200,
      duration: 0,
      direction: "out",
      req_headers: req.headers,
      res_headers: { note: "HTTPS Tunnel established" },
    };

    TRAFFIC_HISTORY.push(logItem);
    if (TRAFFIC_HISTORY.length > MAX_HISTORY) TRAFFIC_HISTORY.shift();
    broadcastRequest(logItem);

    const serverSocket = net.connect(port || 443, host, () => {
      debugLog(`HTTPS Tunnel connected to ${host}:${port || 443}`, "PROXY-CONNECT");
      clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      serverSocket.write(head);
      serverSocket.pipe(clientSocket);
      clientSocket.pipe(serverSocket);
    });

    serverSocket.on("error", (err) => {
      debugLog(`HTTPS Tunnel error: ${err.message}`, "PROXY-CONNECT-ERR");
      console.error(`❌ HTTPS Tunnel error to ${req.url}:`, err.message);
      clientSocket.destroy();
    });

    clientSocket.on("error", () => {
      debugLog("Client socket error during CONNECT", "PROXY-CONNECT-ERR");
      serverSocket.destroy();
    });
  });

  const serverStarted = await new Promise((resolve) => {
    PROXY_SERVER.on("error", (err) => {
      console.error(`❌ Failed to start proxy server on port ${PROXY_PORT}:`, err.message);
      resolve(false);
    });
    PROXY_SERVER.listen(PROXY_PORT, () => {
      console.log(`📡 Sidecar Proxy listening on port ${PROXY_PORT} -> target ${PORT}`);
      updateEnvProxy(PROXY_PORT);
      resolve(true);
    });
  });

  if (serverStarted) {
    console.log(`\n💡 TIP: To capture OUTGOING traffic from your app, set these env vars:`);
    console.log(`   HTTP_PROXY=http://localhost:${PROXY_PORT}`);
    console.log(`   HTTPS_PROXY=http://localhost:${PROXY_PORT}`);
    console.log(`   (Works with fetch, axios, etc.)\n`);
  }

  return serverStarted;
}

async function verifyTunnelReachability(url) {
  console.log(`🌐 Verifying tunnel reachability: ${url}`);

  // Try to fetch the public URL via the tunnel
  try {
    const healthUrl = `${url.replace(/\/$/, "")}/__health`;
    console.log(`🧪 Pinging health endpoint: ${healthUrl}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(healthUrl, {
      signal: controller.signal,
      headers: {
        "ngrok-skip-browser-warning": "true",
        "User-Agent": "InsemeTunnelVerifier/1.0",
      },
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const text = await response.text();
      if (text === "TUNNEL_OK") {
        console.log("✅ End-to-end verification: SUCCESS");
        console.log(`🚀 Proxy active: ${url} -> localhost:${PORT} (via :${PROXY_PORT})`);
      } else {
        console.warn(`⚠️ Unexpected response: ${text}`);
      }
    } else {
      console.warn(`⚠️ Health check returned status ${response.status}`);
    }
  } catch (err) {
    console.error("❌ End-to-end verification FAILED:", err.message);
  }
  return PROXY_PORT;
}

function getInspectorHTML() {
  const filePath = path.join(__dirname, "inspector.html");
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (err) {
    return `<h1>Error loading inspector</h1><p>${err.message}</p>`;
  }
}

async function updateRoomMetadata(url) {
  const localIp = getLocalIp();
  console.log(
    `Updating metadata for room: ${ROOM_SLUG} (Tunnel: ${url || "OFF"}, IP: ${localIp})...`
  );

  // 1. Fetch current room settings
  let { data: room, error: fetchError } = await supabase
    .from("inseme_rooms")
    .select("id, settings")
    .eq("slug", ROOM_SLUG)
    .maybeSingle();

  if (fetchError) {
    console.error("Error fetching room:", fetchError.message);
    return false;
  }

  if (!room) {
    console.log(`Room "${ROOM_SLUG}" not found. Creating it...`);
    const { data: newRoom, error: createError } = await supabase
      .from("inseme_rooms")
      .insert([
        {
          slug: ROOM_SLUG,
          name: ROOM_SLUG.charAt(0).toUpperCase() + ROOM_SLUG.slice(1),
          settings: {
            template: "cyrnea", // Default template for this script
            type: "bar",
            ophelia: { voice: "nova" },
            local_ip: localIp,
          },
        },
      ])
      .select("id, settings")
      .single();

    if (createError) {
      console.error("Error creating room:", createError.message);
      return false;
    }
    room = newRoom;
  }

  // 2. Patch settings with tunnel_url and local_ip
  const newSettings = {
    ...room.settings,
    tunnel_url: url,
    local_ip: localIp,
  };

  const { error: updateError } = await supabase
    .from("inseme_rooms")
    .update({ settings: newSettings })
    .eq("id", room.id);

  if (updateError) {
    console.error("Error updating room settings:", updateError.message);
    return false;
  }

  console.log(`Room '${ROOM_SLUG}' updated with tunnel_url: ${url}`);
  return true;
}

async function checkExistingProxy() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);
    const res = await fetch(`http://localhost:${PROXY_PORT}/__proxy_status`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.status === "active") {
        return data;
      }
    }
  } catch (e) {
    // Port closed or not a proxy
  }
  return null;
}

async function start() {
  if (argv.off) {
    console.log("Cleaning up metadata and disabling redirects...");
    await updateRoomMetadata(null);
    await patchSiteConfig({ enabled: false, url: null });
    await notifyDeployedControl();
    console.log("Done.");
    process.exit(0);
  }

  const existing = await checkExistingProxy();
  if (existing) {
    console.log(`\n✨ A tunnel proxy is already running on port ${PROXY_PORT}!`);
    console.log(`   Uptime: ${existing.uptime}s, Target: ${existing.target_port}`);
    console.log(`   (No need to restart if the tunnel is still active)`);

    if (!FORCE_START) {
      console.log(`\nStopping. Use --force to start anyway.`);
      process.exit(0);
    }
  }

  await runOperationalTests();

  if (USE_PROXY) {
    const ok = await startProxyServer();
    if (!ok) {
      console.error("❌ Failed to start proxy server. Aborting.");
      process.exit(1);
    }
  }

  // Start the tunnel initially
  await startTunnel();

  // Periodic health check (every 30 seconds)
  setInterval(async () => {
    if (!IS_TUNNEL_RUNNING) return;

    debugLog("Running periodic tunnel health check...", "HEALTH");
    try {
      const healthUrl = `${PUBLIC_URL.replace(/\/$/, "")}/__health`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(healthUrl, {
        signal: controller.signal,
        headers: { "ngrok-skip-browser-warning": "true" },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Health check failed with status ${response.status}`);
      }
      debugLog("Tunnel is healthy.", "HEALTH");
    } catch (err) {
      debugLog(`Tunnel health check FAILED: ${err.message}. Restarting...`, "HEALTH-ERR");
      console.warn(`\n⚠️ Tunnel public (${PUBLIC_URL}) inaccessible. Tentative de redémarrage...`);

      // Stop and restart
      IS_TUNNEL_RUNNING = false; // Force restart
      if (TUNNEL_TYPE === "cloudflare" && CF_PROCESS) {
        CF_PROCESS.kill();
        CF_PROCESS = null;
      }
      await startTunnel();
    }
  }, 30000);

  // Global cleanup
  const cleanupAll = async () => {
    if (IS_CLEANING_UP) return;
    IS_CLEANING_UP = true;

    console.log("\n🛑 Stopping everything and cleaning up...");

    // Set a safety timeout to force exit if cleanup hangs
    setTimeout(() => {
      console.log("⚠️ Cleanup timed out, forcing exit.");
      process.exit(1);
    }, 5000).unref();

    try {
      await stopTunnel();

      if (SHELL_PROCESS) {
        console.log("🛑 Stopping interactive shell...");
        SHELL_PROCESS.kill();
        SHELL_PROCESS = null;
      }

      if (PROXY_SERVER) {
        await new Promise((resolve) => {
          PROXY_SERVER.close(() => {
            console.log(`🛑 Proxy server on port ${PROXY_PORT} stopped.`);
            resolve();
          });
        });
      }

      removeEnvProxy();
      console.log("✅ Cleanup complete. Goodbye!");
      process.exit(0);
    } catch (err) {
      console.error("❌ Error during cleanup:", err);
      process.exit(1);
    }
  };

  let IS_CLEANING_UP = false;
  process.on("SIGINT", cleanupAll);
  process.on("SIGTERM", cleanupAll);
  process.on("SIGUSR2", cleanupAll);

  // Keep process alive
  /* eslint-disable no-constant-condition */
  while (true) await new Promise((r) => setTimeout(r, 60_000));
}

start();
