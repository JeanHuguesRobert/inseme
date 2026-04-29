#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// Basic argument parsing
const args = process.argv.slice(2);
let pilotPath = "";
let blueprintName = "coding";
let mapName = "default";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--pilot" && args[i + 1]) pilotPath = args[++i];
  if (args[i] === "--blueprint" && args[i + 1]) blueprintName = args[++i];
  if (args[i] === "--map" && args[i + 1]) mapName = args[++i];
}

if (!pilotPath) {
  console.error(
    "Usage: node launcher.js --pilot <path_to_pilot_script> [--blueprint <name>] [--map <name>]"
  );
  process.exit(1);
}

// Load configurations
const loadJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf-8"));
const blueprintFile = path.join(rootDir, "registry", "blueprints", `${blueprintName}.json`);

// Helper to load map (JS or JSON)
const loadMap = async (name) => {
  const jsPath = path.join(rootDir, "registry", "maps", `${name}.js`);
  const jsonPath = path.join(rootDir, "registry", "maps", `${name}.json`);

  if (fs.existsSync(jsPath)) {
    const module = await import(fileURLToPath(new URL(`file://${jsPath}`)));
    return module.default;
  } else if (fs.existsSync(jsonPath)) {
    return JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  } else {
    throw new Error(`Map '${name}' not found (tried .js and .json)`);
  }
};

const config = {
  protocol: "MAGISTRAL-v1",
  runtime: {
    port: parseInt(process.env.PORT || "8082", 10),
    host: process.env.HOST || "127.0.0.1",
    log_level: "info",
  },
  input: {
    blueprint: loadJson(blueprintFile),
    map: await loadMap(mapName),
  },
  secrets: {
    API_KEYS: {
      GROQ_API_KEY: process.env.GROQ_API_KEY || process.env.groq_api_key || "",
      TOGETHER_API_KEY: process.env.TOGETHER_API_KEY || process.env.together_api_key || "",
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || process.env.openai_api_key || "",
    },
  },
};

// Spawn Pilot
const pilotExt = path.extname(pilotPath);
const isJs = pilotExt === ".js" || pilotExt === ".mjs" || pilotExt === ".ts";
const spawnCommand = isJs ? "deno" : pilotPath;
const spawnArgs = isJs ? ["run", "-A", pilotPath] : [];

const pilotProcess = spawn(spawnCommand, spawnArgs, {
  stdio: ["pipe", "pipe", "inherit"], // Pipe stdin, stdout, inherit stderr
  cwd: process.cwd(),
});

let isReady = false;

// Listen to Pilot's stdout for the MAGISTRAL_READY handshake
pilotProcess.stdout.on("data", (data) => {
  const output = data.toString();

  if (!isReady && output.includes("MAGISTRAL_READY:")) {
    isReady = true;
    const match = output.match(/MAGISTRAL_READY:\s*(https?:\/\/[^\s]+)/);
    if (match) {
      console.log(`[Core] 🟢 Magistral Protocol Initialized!`);
      console.log(`[Core] 🚀 Pilot available at: ${match[1]}`);
    }
  }

  if (isReady) {
    // Forward any other console logs from the pilot
    process.stdout.write(output);
  }
});

pilotProcess.on("close", (code) => {
  console.log(`[Core] Pilot process exited with code ${code}`);
  process.exit(code);
});

// Inject configuration payload via STDIN
pilotProcess.stdin.write(JSON.stringify(config));
pilotProcess.stdin.end();

// Handle termination signals to kill the pilot process
const cleanup = () => {
  if (pilotProcess) {
    pilotProcess.kill();
  }
  process.exit(0);
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
