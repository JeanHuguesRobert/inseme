#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const SCRIPTS_DIR = path.join(ROOT_DIR, "scripts");
const PID_FILE_DEFAULT = path.join(ROOT_DIR, ".magistral.pid");
// const LOG_OUT = path.join(ROOT_DIR, "magistral.out");
// const LOG_ERR = path.join(ROOT_DIR, "magistral.err");

// Default Config
let PORT = 8082;
const args = process.argv.slice(2);

// Parse --port argument
const portIndex = args.indexOf("--port");
if (portIndex !== -1 && args[portIndex + 1]) {
  PORT = parseInt(args[portIndex + 1], 10);
}

const BASE_URL = `http://127.0.0.1:${PORT}`;
const PID_FILE = path.join(ROOT_DIR, `.magistral.${PORT}.pid`);
const LOG_OUT = path.join(ROOT_DIR, `magistral.${PORT}.out`);
const LOG_ERR = path.join(ROOT_DIR, `magistral.${PORT}.err`);

const command = args[0];

if (!command) {
  printUsage();
  process.exit(1);
}

async function main() {
  switch (command) {
    case "start":
      startServer();
      break;
    case "stop":
      stopServer();
      break;
    case "status":
      await checkStatus();
      break;
    case "logs":
      showLogs(args.slice(1));
      break;
    case "add-node":
      await addNode(args.slice(1));
      break;
    case "disable-node":
      await disableNode(args.slice(1));
      break;
    case "metrics":
      await showMetrics();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

function printUsage() {
  console.log(`
Usage: magistral <command> [options]

Commands:
  start         Start the Magistral Pilot (detached)
  stop          Stop the running pilot
  status        Check pilot status
  logs          Show recent logs (tail)
  metrics       Show traffic metrics
  add-node      Add a new provider node
                Usage: magistral add-node <json_string>
  disable-node  Disable a provider node
                Usage: magistral disable-node <node_id> [reason]
`);
}

function startServer() {
  // Backward compatibility: check default PID file if port is 8082
  const pidFile = PORT === 8082 && fs.existsSync(PID_FILE_DEFAULT) ? PID_FILE_DEFAULT : PID_FILE;

  if (fs.existsSync(pidFile)) {
    const pid = parseInt(fs.readFileSync(pidFile, "utf-8"), 10);
    try {
      process.kill(pid, 0);
      console.log(`Magistral is already running (PID ${pid})`);
      return;
    } catch (_e) {
      console.log("Found stale PID file. Removing...");
      fs.unlinkSync(pidFile);
    }
  }

  console.log(`Starting Magistral Pilot on port ${PORT}...`);
  const out = fs.openSync(LOG_OUT, "a");
  const err = fs.openSync(LOG_ERR, "a");

  // We need to pass arguments to launcher.js if needed.
  // For now, we use defaults.
  // We assume the pilot is the reference-js/src/main.js one.
  const pilotScript = path.resolve(ROOT_DIR, "pilots/reference-js/src/main.js");

  const subprocess = spawn(
    "node",
    [path.join(SCRIPTS_DIR, "launcher.js"), "--pilot", pilotScript],
    {
      env: { ...process.env, PORT: PORT.toString() },
      detached: true,
      stdio: ["ignore", out, err],
      cwd: ROOT_DIR,
    }
  );

  subprocess.unref();
  fs.writeFileSync(pidFile, subprocess.pid.toString());
  console.log(`Pilot started with PID ${subprocess.pid}`);
  console.log(`Logs: ${LOG_OUT}`);
}

function stopServer() {
  const pidFile = PORT === 8082 && fs.existsSync(PID_FILE_DEFAULT) ? PID_FILE_DEFAULT : PID_FILE;

  if (!fs.existsSync(pidFile)) {
    console.log(`Magistral is not running (no PID file for port ${PORT}).`);
    return;
  }

  const pid = parseInt(fs.readFileSync(pidFile, "utf-8"), 10);
  console.log(`Stopping Magistral Pilot (PID ${pid}) on port ${PORT}...`);

  try {
    process.kill(pid, "SIGTERM");
    // Wait a bit?
    fs.unlinkSync(pidFile);
    console.log("Stopped.");
  } catch (e) {
    console.error(`Failed to stop process on port ${PORT}:`, e.message);
  }
}

async function checkStatus() {
  const pidFile = PORT === 8082 && fs.existsSync(PID_FILE_DEFAULT) ? PID_FILE_DEFAULT : PID_FILE;

  if (fs.existsSync(pidFile)) {
    const pid = parseInt(fs.readFileSync(pidFile, "utf-8"), 10);
    try {
      process.kill(pid, 0);
      console.log(`Process: Running (PID ${pid}) on port ${PORT}`);

      // Check API
      try {
        const res = await fetch(`${BASE_URL}/v1/magistral/metrics`);
        if (res.ok) {
          console.log(`API: Online (${BASE_URL})`);
          const data = await res.json();
          console.log(`Nodes: ${data.nodes?.length || 0}`);
        } else {
          console.log(`API: Error ${res.status}`);
        }
      } catch (e) {
        console.log(`API: Unreachable (${e.message})`);
      }
    } catch (_e) {
      console.log(`Process: Not running (Stale PID file)`);
    }
  } else {
    console.log(`Process: Not running on port ${PORT}`);
  }
}

function showLogs(cmdArgs) {
  // Simple tail implementation or just cat last N lines
  if (!fs.existsSync(LOG_OUT)) {
    console.log("No log file found.");
    return;
  }

  const nlines = cmdArgs ? parseInt(cmdArgs[0], 10) : 20;

  console.log(`--- Last ${nlines} lines of logs ---`);
  try {
    // Use system tail if available (windows has Get-Content -Tail in powershell, but this is node)
    // We'll just read the file and take last lines.
    const content = fs.readFileSync(LOG_OUT, "utf-8");
    const lines = content.trim().split("\n");
    console.log(lines.slice(-nlines).join("\n"));
  } catch (e) {
    console.error("Error reading logs:", e.message);
  }
}

async function showMetrics() {
  try {
    const res = await fetch(`${BASE_URL}/v1/magistral/metrics`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Error fetching metrics:", e.message);
  }
}

async function addNode(cmdArgs) {
  const jsonStr = cmdArgs[0];
  if (!jsonStr) {
    console.error("Error: JSON string required");
    return;
  }

  try {
    const node = JSON.parse(jsonStr);
    const res = await fetch(`${BASE_URL}/v1/magistral/map/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(node),
    });

    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Error adding node:", e.message);
  }
}

async function disableNode(cmdArgs) {
  const id = cmdArgs[0];
  const reason = cmdArgs[1] || "manual";

  if (!id) {
    console.error("Error: Node ID required");
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/v1/magistral/nodes/${id}/disable`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });

    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Error disabling node:", e.message);
  }
}

main().catch(console.error);
