#!/usr/bin/env node
// File: packages/cop-cli/src/cli.js
// Simple CLI for COP over HTTP (Netlify Edge functions).
// Requires Node >= 18 (for global fetch).

const args = process.argv.slice(2);

async function main() {
  if (args.length === 0 || args[0] === "help" || args[0] === "--help") {
    printHelp();
    return;
  }

  const cmd = args[0];
  const rest = args.slice(1);

  try {
    if (cmd === "nodes") {
      await cmdNodes(rest);
    } else if (cmd === "agents") {
      await cmdAgents(rest);
    } else if (cmd === "identities") {
      await cmdIdentities(rest);
    } else if (cmd === "trace") {
      await cmdTrace(rest);
    } else if (cmd === "send-message") {
      await cmdSendMessage(rest);
    } else if (cmd === "tasks") {
      await cmdTasks(rest);
    } else if (cmd === "help") {
      printHelp();
    } else {
      console.error(`Commande inconnue: ${cmd}`);
      printHelp();
    }
    process.exit(1);
  } catch (err) {
    console.error("Error:", err && err.message ? err.message : String(err));
    process.exit(1);
  }
}

function printHelp() {
  const help = `
cop - COP command line interface

Usage:
  cop help
  cop nodes [--base-url URL]
  cop agents [--base-url URL]
  cop identities [--base-url URL] [--status STATUS]
  cop trace <correlation_id> [--base-url URL]
  cop send-message --from ADDR --to ADDR --intent INTENT [--payload JSON] [--channel CH] [--base-url URL]
  cop tasks [--base-url URL] [--status STATUS] [--type TYPE] [--worker NAME]
  cop task <id> [--base-url URL]

Base URL:
  --base-url URL       Override base URL (default: env COP_BASE_URL or http://localhost:8888)

Examples:
  cop nodes
  cop agents --base-url https://myapp.netlify.app
  cop identities --status active
  cop trace 8f1f1c35-...
  cop send-message --from cop://local/cli --to cop://local/echo --intent echo.test --payload '{"msg":"hello"}'
`;
  console.log(help.trim());
}

function parseFlags(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

function getBaseUrl(flags) {
  return flags["base-url"] || process.env.COP_BASE_URL || "http://localhost:8888";
}

async function cmdNodes(argv) {
  const { flags } = parseFlags(argv);
  const baseUrl = getBaseUrl(flags);
  const url = new URL("/cop-admin-registry", baseUrl);
  url.searchParams.set("resource", "nodes");

  const res = await fetch(url.toString());
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status} – ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

async function cmdAgents(argv) {
  const { flags } = parseFlags(argv);
  const baseUrl = getBaseUrl(flags);
  const url = new URL("/cop-admin-registry", baseUrl);
  url.searchParams.set("resource", "agents");

  const res = await fetch(url.toString());
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status} – ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

async function cmdIdentities(argv) {
  const { flags } = parseFlags(argv);
  const baseUrl = getBaseUrl(flags);
  const status = flags["status"];

  const url = new URL("/cop-agent-identity", baseUrl);
  if (status) {
    url.searchParams.set("status", status);
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status} – ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

async function cmdTrace(argv) {
  const { flags, positional } = parseFlags(argv);
  const baseUrl = getBaseUrl(flags);
  const correlationId = positional[0];
  if (!correlationId) {
    throw new Error("trace: missing correlation_id argument");
  }

  const url = new URL("/cop-admin-registry", baseUrl);
  url.searchParams.set("resource", "trace");
  url.searchParams.set("correlation_id", correlationId);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status} – ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

async function cmdSendMessage(argv) {
  const { flags } = parseFlags(argv);
  const baseUrl = getBaseUrl(flags);

  const from = flags["from"];
  const to = flags["to"];
  const intent = flags["intent"];
  const payloadRaw = flags["payload"] || "{}";
  const channel = flags["channel"] || null;

  if (!from || !to || !intent) {
    throw new Error(
      "send-message: --from, --to and --intent are required (and optional --payload JSON, --channel CH)"
    );
  }

  let payload;
  try {
    payload = JSON.parse(payloadRaw);
  } catch (err) {
    throw new Error("send-message: invalid JSON for --payload: " + (err && err.message));
  }

  const url = new URL("/cop", baseUrl);
  const message = {
    cop_version: "0.2",
    message_id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    correlation_id: null,
    from,
    to,
    intent,
    payload,
    channel,
    metadata: {},
    auth: null,
  };

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status} – ${txt.slice(0, 200)}`);
  }

  const data = await res.json().catch(() => null);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log("Message sent successfully (no JSON body).");
  }
}

async function cmdTasks(argv) {
  const { flags } = parseFlags(argv);
  const baseUrl = getBaseUrl(flags);
  const status = flags["status"];
  const type = flags["type"];
  const worker = flags["worker"];

  const url = new URL("/cop-admin-tasks", baseUrl);
  if (status) url.searchParams.set("status", status);
  if (type) url.searchParams.set("task_type", type);
  if (worker) url.searchParams.set("worker_agent_name", worker);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status} – ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

async function cmdTask(argv) {
  const { flags, positional } = parseFlags(argv);
  const baseUrl = getBaseUrl(flags);
  const taskId = positional[0];
  if (!taskId) {
    throw new Error("task: missing <id>");
  }

  const url = new URL("/cop-admin-tasks", baseUrl);
  url.searchParams.set("id", taskId);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status} – ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch((err) => {
  console.error("Fatal:", err && err.message ? err.message : String(err));
  process.exit(1);
});
