#!/usr/bin/env node
// llama-repl-realtime.js
import { spawn, execSync } from "child_process";
import readline from "readline";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
const isDaemon = args.includes("--daemon");
const isHeadless = args.includes("--headless") || isDaemon;

const SERVER_HOST = "127.0.0.1";
let SERVER_PORT = parseInt(getArgValue("--port", "8080"), 10);
if (!Number.isFinite(SERVER_PORT) || SERVER_PORT <= 0) {
  SERVER_PORT = 8080;
}
let THREADS = parseInt(getArgValue("--threads", "2"), 10);
if (!Number.isFinite(THREADS) || THREADS <= 0) {
  THREADS = 2;
}
let CTX_SIZE = parseInt(getArgValue("--ctx-size", "4096"), 10);
if (!Number.isFinite(CTX_SIZE) || CTX_SIZE <= 0) {
  CTX_SIZE = 4096;
}
const SOVEREIGN_PORT = parseInt(getArgValue("--port", "8880"), 10);
const SERVER_URL = `http://${SERVER_HOST}:${SOVEREIGN_PORT}/v1/llm`;
const HEALTH_URL = `http://${SERVER_HOST}:${SOVEREIGN_PORT}/health`;

// === Models (Information only, server handles loading) ===
const MODELS = {
  "Qwen2.5-Coder": "Sovereign Default",
};
let currentModel = "Qwen2.5-Coder";

// === REPL / Session ===
let chatHistory = [];
let llamaServerProcess = null;
let temperature = 0.2;
let max_tokens = 300;

// JSON output file for Trae (temps réel)
const TRAE_JSON_FILE = path.resolve("trae-session.json");
const PID_FILE = path.resolve(__dirname, "../llama-server.pid");

function writeTraeJSON(prompt, response, model) {
  const data = {
    model,
    prompt,
    response,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(TRAE_JSON_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// === Clipboard ===
function copyToClipboard(text) {
  try {
    execSync(`echo ${text.replace(/"/g, '\\"')} | clip`);
  } catch {
    console.log("(Failed to copy to clipboard)");
  }
}

// === Launch server if not running ===
function launchServer() {
  console.log(`Launching Sovereign AI Service on port ${SOVEREIGN_PORT}...`);

  const projectRoot = path.resolve(__dirname, "..");
  const modelsDir = path.join(projectRoot, "packages", "models");

  if (isDaemon) {
    const logFile = fs.openSync(path.resolve("sovereign-server.log"), "a");
    // Use pnpm/npm to start the service
    llamaServerProcess = spawn("pnpm", ["run", "sovereign:up"], {
      cwd: modelsDir,
      detached: true,
      stdio: ["ignore", logFile, logFile],
      shell: true,
    });
    llamaServerProcess.unref();
  } else {
    // In interactive mode, we spawn it but it might clutter the REPL if we share stdio.
    // Better to warn user to start it separately or run in background.
    console.log("Starting Sovereign AI in background...");
    llamaServerProcess = spawn("pnpm", ["run", "sovereign:up"], {
      cwd: modelsDir,
      stdio: "inherit",
      shell: true,
    });
  }
}

async function serverAlive() {
  try {
    const res = await fetch(HEALTH_URL);
    return res.ok;
  } catch {
    return false;
  }
}

// === Export Trae provider ===
function exportTraeProvider(modelName, modelPath) {
  const provider = {
    provider: "Custom",
    name: `Local ${modelName}`,
    url: SERVER_URL,
    model: modelPath,
    headers: { "Content-Type": "application/json" },
  };
  const outFile = path.resolve(`trae-provider-${modelName}.json`);
  fs.writeFileSync(outFile, JSON.stringify(provider, null, 2), "utf-8");
  console.log(`Trae provider exported: ${outFile}`);
}

// === REPL ===
async function startREPL() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "llama> ",
  });

  console.log(
    "REPL LLaMA temps réel. Commands:\n" +
      "  /model <name>   : switch model\n" +
      "  /models         : list models\n" +
      "  /export         : export current model for Trae\n" +
      "  /temp <0-1>     : set temperature\n" +
      "  /max <num>      : set max_tokens\n" +
      "  /history        : show session history\n" +
      "  Ctrl+C          : exit\n"
  );

  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    // === Commands ===
    if (input.startsWith("/")) {
      const [cmd, arg] = input.split(" ");
      switch (cmd) {
        case "/model":
          if (MODELS[arg]) {
            currentModel = arg;
            console.log(`Switched to ${arg}`);
          } else console.log(`Model not found: ${arg}`);
          break;
        case "/models":
          console.log("Available models:");
          Object.keys(MODELS).forEach((m) => console.log(`  - ${m}`));
          break;
        case "/export":
          exportTraeProvider(currentModel, MODELS[currentModel]);
          break;
        case "/temp": {
          const t = parseFloat(arg);
          if (!isNaN(t) && t >= 0 && t <= 1) {
            temperature = t;
            console.log(`Temperature: ${temperature}`);
          } else console.log("Invalid temperature");
          break;
        }

        case "/max": {
          const m = parseInt(arg);
          if (!isNaN(m) && m > 0) {
            max_tokens = m;
            console.log(`Max tokens: ${max_tokens}`);
          } else console.log("Invalid max_tokens");
          break;
        }
      }
      rl.prompt();
      return;
    }

    // === Send prompt ===
    chatHistory.push(input);
    const fullPrompt =
      `You are a senior software engineer. Respond ONLY in English. Output code only when asked for code.\n\n` +
      chatHistory.map((msg, i) => `User${i + 1}: ${msg}`).join("\n") +
      "\nAssistant:";

    try {
      const res = await fetch(SERVER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: fullPrompt,
          max_tokens,
          temperature,
        }),
      });
      if (!res.ok) {
        console.error("Server error:", res.status, res.statusText);
        rl.prompt();
        return;
      }
      const data = await res.json();
      const choice = data.choices?.[0] || {};
      const text = choice.text?.trim() || choice.message?.content?.trim() || "[No output]";
      const tokensUsed = data.usage?.total_tokens ?? "unknown";
      console.log(`\n[Tokens: ${tokensUsed}]\n${text}\n`);

      // Copy code automatically
      if (text.includes("```")) {
        const codeOnly = text
          .replace(/```[\w]*\n?/g, "")
          .replace(/```/g, "")
          .trim();
        copyToClipboard(codeOnly);
      }

      // Write JSON for Trae (temps réel)
      writeTraeJSON(fullPrompt, text, currentModel);
    } catch (err) {
      console.error("Request failed:", err);
    }

    rl.prompt();
  });

  rl.on("SIGINT", () => {
    console.log("\nExiting...");
    if (llamaServerProcess) llamaServerProcess.kill();
    process.exit(0);
  });
}

// === Stop server ===
function stopServer() {
  console.log("Requesting Sovereign AI Service to stop...");

  // Use pnpm to stop it gracefully first
  try {
    const projectRoot = path.resolve(__dirname, "..");
    const modelsDir = path.join(projectRoot, "packages", "models");
    execSync("pnpm run sovereign:down", {
      cwd: modelsDir,
      stdio: "inherit",
      shell: true,
    });
    console.log("Sovereign AI stopped gracefully.");
    return;
  } catch (_e) {
    console.log("Graceful stop failed, trying force kill...");
  }

  // Fallback: kill node process running ai.js if needed, but pnpm script should handle it.
  // If we really need to force kill ports:
  const isWin = process.platform === "win32";
  const CMD = isWin
    ? `taskkill /F /IM node.exe /FI "WINDOWTITLE eq Sovereign*"` // Hard to target specifically without PID
    : "pkill -f 'src/ai.js'"; // risky on shared systems

  console.log(
    "Please check if process is stopped. Force kill not fully implemented to avoid collateral damage."
  );
}

// === MAIN ===
(async () => {
  const alreadyRunning = await serverAlive();

  if (isStop) {
    stopServer();
    process.exit(0);
  }

  if (isStatus) {
    if (alreadyRunning) {
      console.log(`Sovereign AI server is running on port ${SOVEREIGN_PORT}.`);
      process.exit(0);
    } else {
      console.log(`Sovereign AI server is NOT running on port ${SOVEREIGN_PORT}.`);
      process.exit(1);
    }
  }

  if (!alreadyRunning) {
    launchServer();
    console.log(`Waiting for server on port ${SOVEREIGN_PORT}...`);

    // Poll for up to 60 seconds
    let attempts = 60;
    while (attempts > 0) {
      if (await serverAlive()) break;
      await new Promise((r) => setTimeout(r, 1000));
      attempts--;
      if (attempts % 10 === 0) process.stdout.write(".");
    }
    console.log(""); // Newline
  } else {
    console.log(`Sovereign AI server already running on port ${SOVEREIGN_PORT}`);
  }

  if (isHeadless) {
    if (isDaemon) {
      // For daemon, we just verify it's up (after the wait) and exit
      const up = await serverAlive();
      if (up) {
        console.log(`[Daemon] Server is running on port ${SOVEREIGN_PORT}.`);
        process.exit(0);
      } else {
        console.error(
          `[Daemon] Server failed to respond within timeout. Check sovereign-server.log.`
        );
        process.exit(1);
      }
    }

    if (llamaServerProcess) {
      llamaServerProcess.on("exit", (code) => {
        process.exit(code == null ? 0 : code);
      });
    }
    process.on("SIGINT", () => {
      if (llamaServerProcess) llamaServerProcess.kill();
      process.exit(0);
    });
    process.on("SIGTERM", () => {
      if (llamaServerProcess) llamaServerProcess.kill();
      process.exit(0);
    });
    console.log(`Headless mode active. Managing sovereign-server on port ${SOVEREIGN_PORT}.`);
    return;
  }

  if (!isDaemon) {
    startREPL();
  }
})();
