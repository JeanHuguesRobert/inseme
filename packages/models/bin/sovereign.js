#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { spawn, execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT_DIR, "src");

// Default Config
let PORT = 8880;
const args = process.argv.slice(2);

// Parse --port argument
const portIndex = args.indexOf("--port");
if (portIndex !== -1 && args[portIndex + 1]) {
  PORT = parseInt(args[portIndex + 1], 10);
}

const BASE_URL = `http://127.0.0.1:${PORT}`;
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
      checkStatus();
      break;
    case "chat":
      await chat(args.slice(1));
      break;
    case "tts":
      await tts(args.slice(1));
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

function printUsage() {
  console.log(`
Usage: sovereign <command> [options]

Commands:
  start     Start the Sovereign AI server (detached)
  stop      Stop the running server
  status    Check server status
  chat      Send a chat message to the LLM
            Usage: sovereign chat "Your message" [--model <model>]
  tts       Generate speech from text
            Usage: sovereign tts "Text to speak" [--voice <voice>] [--output <file.wav>]
`);
}

function startServer() {
  console.log(`Starting Sovereign AI Server on port ${PORT}...`);
  const out = fs.openSync(path.join(ROOT_DIR, `sovereign.${PORT}.out`), "a");
  const err = fs.openSync(path.join(ROOT_DIR, `sovereign.${PORT}.err`), "a");

  const subprocess = spawn(
    "node",
    [path.join(SRC_DIR, "ai.js"), "start", "--port", PORT.toString(), "--model", "Qwen2.5-Coder"],
    {
      detached: true,
      stdio: ["ignore", out, err],
      cwd: ROOT_DIR,
    }
  );

  subprocess.unref();
  console.log(`Server started with PID ${subprocess.pid}`);
  console.log(`Logs: ${path.join(ROOT_DIR, `sovereign.${PORT}.out`)}`);
}

function stopServer() {
  console.log(`Stopping Sovereign AI Server on port ${PORT}...`);
  try {
    // Capture output and print it
    const output = execSync(`node ${path.join(SRC_DIR, "ai.js")} --port ${PORT} --stop`).toString();
    console.log(output);
  } catch (e) {
    console.error("Failed to stop server:", e.message);
    if (e.stdout) console.log(e.stdout.toString());
    if (e.stderr) console.error(e.stderr.toString());
  }
}

function checkStatus() {
  try {
    const output = execSync(
      `node ${path.join(SRC_DIR, "ai.js")} --port ${PORT} --status`
    ).toString();
    console.log(output);
  } catch (e) {
    console.error("Failed to check status:", e.message);
    if (e.stdout) console.log(e.stdout.toString());
    if (e.stderr) console.error(e.stderr.toString());
  }
}

async function chat(cmdArgs) {
  const message = cmdArgs[0];
  if (!message || message.startsWith("--")) {
    console.error("Error: Message required");
    return;
  }

  // Parse options
  let model = "sovereign";
  const modelIdx = cmdArgs.indexOf("--model");
  if (modelIdx !== -1 && cmdArgs[modelIdx + 1]) {
    model = cmdArgs[modelIdx + 1];
  }

  try {
    const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: message }],
        stream: false,
      }),
    });

    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }

    const data = await res.json();
    console.log(data.choices?.[0]?.message?.content || data);
  } catch (e) {
    console.error("Chat error:", e.message);
    if (e.cause?.code === "ECONNREFUSED") {
      console.error("Is the server running? Try: sovereign start");
    }
  }
}

async function tts(cmdArgs) {
  const text = cmdArgs[0];
  if (!text || text.startsWith("--")) {
    console.error("Error: Text required");
    return;
  }

  // Parse options
  let voice = "af_bella";
  const voiceIdx = cmdArgs.indexOf("--voice");
  if (voiceIdx !== -1 && cmdArgs[voiceIdx + 1]) {
    voice = cmdArgs[voiceIdx + 1];
  }

  let outputFile = "output.wav";
  const outIdx = cmdArgs.indexOf("--output");
  if (outIdx !== -1 && cmdArgs[outIdx + 1]) {
    outputFile = cmdArgs[outIdx + 1];
  }

  console.log(`Generating speech for: "${text}"...`);

  try {
    const res = await fetch(`${BASE_URL}/v1/audio/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: text,
        voice,
      }),
    });

    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(outputFile, buffer);
    console.log(`Saved to ${outputFile}`);
  } catch (e) {
    console.error("TTS error:", e.message);
  }
}

main().catch(console.error);
