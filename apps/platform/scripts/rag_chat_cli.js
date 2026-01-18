#!/usr/bin/env node
import fs from "node:fs/promises";
import { loadConfig, getConfig, createSupabaseClient } from "./lib/config.js";

// Charger la configuration
await loadConfig();

const OPENAI_KEY = getConfig("openai_api_key");
const SUPABASE_URL = getConfig("supabase_url");
const SUPABASE_SERVICE_ROLE_KEY = getConfig("supabase_service_role_key");

let supabaseClient = null;
function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment");
  }
  supabaseClient = createSupabaseClient();
  return supabaseClient;
}

const EMBEDDING_MODEL = getConfig("openai_embedding_model", "text-embedding-3-small");
const CHAT_MODEL = getConfig("openai_model", "gpt-3.5-turbo");
const DEFAULT_SQL_LIMIT = 100;
const DEFAULT_SQL_FORMAT = "json";
const DEFAULT_CHAT_PATH = "/api/chat-stream";

function parseCliArgs(argv) {
  const opts = {
    question: null,
    json: false,
    top: 5,
    fetchLimit: 1000,
    sql: null,
    sqlFile: null,
    sqlLimit: null,
    sqlFormat: DEFAULT_SQL_FORMAT,
    sqlEndpoint: null,
    server: false,
    cliToken: null,
    authToken: null,
    role: null,
    mode: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    switch (token) {
      case "--json":
        opts.json = true;
        break;
      case "--server":
        opts.server = true;
        break;
      case "--role":
        opts.role = argv[i + 1];
        i++;
        break;
      case "--mode":
        opts.mode = argv[i + 1];
        i++;
        break;
      case "--top":
        opts.top = Number(argv[i + 1]) || opts.top;
        i++;
        break;
      case "--fetch-limit":
        opts.fetchLimit = Number(argv[i + 1]) || opts.fetchLimit;
        i++;
        break;
      case "--sql":
        opts.sql = argv[i + 1] || "";
        i++;
        break;
      case "--sql-file":
        opts.sqlFile = argv[i + 1] || "";
        i++;
        break;
      case "--limit":
      case "--sql-limit":
        opts.sqlLimit = Number(argv[i + 1]);
        i++;
        break;
      case "--format":
      case "--sql-format":
        opts.sqlFormat = (argv[i + 1] || DEFAULT_SQL_FORMAT).toLowerCase();
        i++;
        break;
      case "--endpoint":
      case "--sql-endpoint":
        opts.sqlEndpoint = argv[i + 1] || "";
        i++;
        break;
      case "--cli-token":
        opts.cliToken = argv[i + 1] || "";
        i++;
        break;
      case "--auth":
      case "--auth-token":
        opts.authToken = argv[i + 1] || "";
        i++;
        break;
      default:
        if (!token.startsWith("--") && !opts.question) {
          opts.question = token;
        } else if (!token.startsWith("--") && opts.question) {
          opts.question += " " + token;
        } else {
          console.warn(`Unknown argument: ${token}`);
        }
    }
  }

  if (opts.sqlFormat !== "json" && opts.sqlFormat !== "markdown") {
    opts.sqlFormat = DEFAULT_SQL_FORMAT;
  }
  return opts;
}

function resolveSqlEndpoint(cliOverride) {
  const source =
    (cliOverride && cliOverride.trim()) ||
    (getConfig("rag_sql_endpoint") || "").trim() ||
    (getConfig("rag_chat_endpoint") || "").trim() ||
    (getConfig("app_url") || "").trim();
  if (!source) {
    throw new Error(
      "Missing SQL endpoint. Set RAG_SQL_ENDPOINT, RAG_CHAT_ENDPOINT, or URL environment variable."
    );
  }
  if (/\/api\/chat-stream/i.test(source)) {
    return source;
  }
  return source.replace(/\/$/, "") + DEFAULT_CHAT_PATH;
}

function buildSqlHeaders(cliTokenOverride, authTokenOverride) {
  const headers = { "Content-Type": "application/json" };
  const cliToken = (cliTokenOverride || getConfig("cli_token") || "").trim();
  if (cliToken) headers["x-cli-token"] = cliToken;
  const bearer = (
    authTokenOverride ||
    getConfig("sql_auth_token") ||
    getConfig("supabase_jwt") ||
    ""
  ).trim();
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  return headers;
}

function prettyPrintSqlResult(result) {
  const { status, source, rowCount, limitApplied, durationMs, columns, rows, error, metadata } =
    result || {};
  console.log(`[SQL] Status: ${status || "unknown"} via ${source || "n/a"}`);
  if (typeof rowCount === "number") {
    console.log(`[SQL] Rows: ${rowCount} ${limitApplied ? `(limit ${limitApplied})` : ""}`);
  }
  if (typeof durationMs === "number") {
    console.log(`[SQL] Duration: ${durationMs.toFixed(2)}ms`);
  }
  if (columns && columns.length > 0 && Array.isArray(rows) && rows.length > 0) {
    console.table(rows);
  } else {
    console.log("[SQL] No rows returned.");
  }
  if (error) {
    console.log("[SQL] Error:", error);
  }
  if (metadata) {
    console.log("[SQL] Metadata:", JSON.stringify(metadata, null, 2));
  }
}

async function runSqlWorkflow(options) {
  let sql = options.sql;
  if ((!sql || !sql.trim()) && options.sqlFile) {
    const fileContents = await fs.readFile(options.sqlFile, "utf-8");
    sql = fileContents;
  }
  if (!sql || !sql.trim()) {
    throw new Error("No SQL provided. Use --sql or --sql-file to supply a SELECT statement.");
  }
  const endpoint = resolveSqlEndpoint(options.sqlEndpoint);
  const format = options.sqlFormat === "markdown" ? "markdown" : DEFAULT_SQL_FORMAT;
  const limit =
    Number.isFinite(options.sqlLimit) && options.sqlLimit > 0
      ? options.sqlLimit
      : DEFAULT_SQL_LIMIT;

  console.log(`[SQL] Endpoint: ${endpoint}`);
  console.log(`[SQL] Limit: ${limit} | Format: ${format}`);

  const body = { sql, limit, format };
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: buildSqlHeaders(options.cliToken, options.authToken),
    body: JSON.stringify(body),
  });

  const text = await resp.text();
  // console.log("DEBUG: Raw server response:", text);
  if (!resp.ok) {
    let detail = text;
    try {
      detail = JSON.parse(text);
    } catch {
      // ignore
    }
    const message = typeof detail === "string" ? detail : JSON.stringify(detail, null, 2);
    throw new Error(`[SQL] Request failed (${resp.status}): ${message}`);
  }

  if (format === "markdown") {
    // Filter out metadata lines if any
    const lines = text
      .split("\n")
      .filter((l) => l.trim() && !l.startsWith("__") && !l.startsWith("<Think>"));
    console.log(lines.join("\n").trim());
    return;
  }

  let parsed;
  try {
    // Try to find the first valid JSON line that isn't metadata
    const lines = text.split("\n");
    let jsonFound = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("__") || trimmed.startsWith("<Think>")) continue;
      try {
        parsed = JSON.parse(trimmed);
        jsonFound = true;
        break;
      } catch (e) {
        // Not a valid JSON line, continue
      }
    }
    if (!jsonFound) {
      throw new Error("No valid JSON result found in response.");
    }
  } catch (err) {
    throw new Error(`[SQL] Unable to parse JSON response: ${err.message}`);
  }

  if (options.json) {
    console.log(JSON.stringify(parsed, null, 2));
  } else {
    prettyPrintSqlResult(parsed);
  }
}

async function getEmbedding(text) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error("Embedding error: " + err);
  }
  const j = await res.json();
  return j.data[0].embedding;
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
function norm(a) {
  return Math.sqrt(dot(a, a));
}
function cosine(a, b) {
  return dot(a, b) / (norm(a) * norm(b));
}

async function fetchChunks(limit = 1000) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("knowledge_chunks")
    .select("id,text,embedding,metadata,source_id")
    .limit(limit);
  if (error) throw error;
  return data.map((r) => {
    let emb = r.embedding;
    if (typeof emb === "string") {
      try {
        emb = JSON.parse(emb);
      } catch (e) {
        emb = emb.split(",").map(Number);
      }
    }
    return { ...r, embedding: emb };
  });
}

async function getTopMatches(query, topK = 5, fetchLimit = 1000) {
  const qEmb = await getEmbedding(query);
  const chunks = await fetchChunks(fetchLimit);
  const scored = chunks.map((c) => ({ score: cosine(qEmb, c.embedding), chunk: c }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

async function callChat(messages) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({ model: CHAT_MODEL, messages, max_tokens: 800 }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error("Chat completion error: " + err);
  }
  const j = await res.json();
  const content = j.choices?.[0]?.message?.content ?? "";
  return { content, raw: j };
}

function buildSystemPrompt(snippets) {
  let intro =
    "You are an assistant that answers using the provided document snippets. Cite sources when possible.";
  if (!snippets || snippets.length === 0) return intro;
  const ctx = snippets.map(
    (s, i) =>
      `---\nSource ${i + 1} (score=${(s.score || 0).toFixed(3)}): ${s.chunk.metadata?.canonical_pdf_path || s.chunk.source_id || "unknown"}\n${s.chunk.text}`
  );
  return intro + "\n\n" + ctx.join("\n\n");
}

function printUsage() {
  console.log(`Usage:
  # RAG mode (default, local)
  node scripts/rag_chat_cli.js "Your question" [--top N] [--fetch-limit N] [--json]

  # Server Chat mode (calls Netlify Edge Function)
  node scripts/rag_chat_cli.js "Your question" --server [--endpoint https://site/api/chat-stream]

  # Direct SQL mode (calls Netlify Edge Function)
  node scripts/rag_chat_cli.js --sql "SELECT * FROM example" [--limit N] [--format markdown|json]
    [--endpoint https://site/api/chat-stream] [--cli-token token] [--auth jwt] [--json]
`);
}

async function runServerChat(options) {
  const endpoint = resolveSqlEndpoint(options.sqlEndpoint);
  const body = {
    question: options.question,
    mode: options.mode || "auto", // Enable adaptive intelligence by default
    role: options.role || "mediator",
  };

  console.log(`[Server] Calling ${endpoint}...`);
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: buildSqlHeaders(options.cliToken, options.authToken),
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`[Server] Request failed (${resp.status}): ${text}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let fullResponse = "";

  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    buffer += chunk;

    let lines = buffer.split("\n");
    // On garde le dernier élément (potentiellement incomplet) dans le buffer
    buffer = lines.pop();

    for (const line of lines) {
      if (line.startsWith("__PROVIDER_INFO__")) {
        const info = JSON.parse(line.replace("__PROVIDER_INFO__", ""));
        process.stdout.write(
          `\n[Provider] ${info.provider} (${info.model}) - Role: ${info.role}\n`
        );
        continue;
      }
      if (line.startsWith("__TOOL_TRACE__")) {
        try {
          const trace = JSON.parse(line.replace("__TOOL_TRACE__", ""));
          const args = typeof trace.args === "string" ? trace.args : JSON.stringify(trace.args);
          process.stdout.write(`\n[Tool] ${trace.tool} ${args}\n`);
        } catch (e) {
          process.stdout.write(`\n[Tool] (Error parsing trace: ${line})\n`);
        }
        continue;
      }
      if (line.startsWith("__PROVIDERS_STATUS__")) {
        continue;
      }

      // Pour le contenu normal, on écrit la ligne telle quelle
      // Si c'était une ligne complète (issue d'un split), on rajoute le \n qu'on a enlevé au split
      process.stdout.write(line + "\n");
      fullResponse += line + "\n";
    }
  }
  // Afficher le reste du buffer s'il y en a
  if (buffer.trim()) {
    if (buffer.startsWith("__PROVIDERS_STATUS__")) {
      // Ignorer silencieusement à la fin
    } else {
      process.stdout.write(buffer + "\n");
      fullResponse += buffer + "\n";
    }
  }
  console.log("\n[Server] Chat finished.");
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  const sqlMode = Boolean(options.sql || options.sqlFile);

  if (!sqlMode && !options.question) {
    printUsage();
    process.exit(0);
  }

  if (sqlMode) {
    await runSqlWorkflow(options);
    return;
  }

  if (options.server) {
    await runServerChat(options);
    return;
  }

  if (!OPENAI_KEY) {
    console.error("Missing OPENAI_API_KEY in environment");
    process.exit(1);
  }
  try {
    getSupabaseClient();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  const rawQuery = options.question;
  const topK = options.top || 5;
  const fetchLimit = options.fetchLimit || 1000;
  const jsonOut = options.json;

  const requestId = globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`;
  const timestamp = new Date().toISOString();
  const startTime = Date.now();

  console.log("Provider: OpenAI");
  console.log("Embedding model:", EMBEDDING_MODEL);
  console.log("Chat model:", CHAT_MODEL);

  console.log("Embedding query and fetching top", topK, "chunks...");
  const matches = await getTopMatches(rawQuery, topK, fetchLimit);

  const systemPrompt = buildSystemPrompt(matches);
  const userPrompt = `Question: ${rawQuery}\n\nAnswer concisely and list sources (file names or IDs).`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  console.log("Calling chat model...");
  const chatResult = await callChat(messages);
  const answer = chatResult.content;
  const rawResp = chatResult.raw || {};

  const durationMs = Date.now() - startTime;

  const matchesMeta = matches.map((m) => ({
    chunk_id: m.chunk.id,
    source_id: m.chunk.source_id || null,
    canonical: m.chunk.metadata?.canonical_pdf_path || null,
    score: m.score,
  }));

  if (jsonOut) {
    const out = {
      request_id: requestId,
      timestamp,
      provider: "openai",
      embedding_model: EMBEDDING_MODEL,
      chat_model: CHAT_MODEL,
      top_k: topK,
      duration_ms: durationMs,
      matches: matchesMeta,
      response: {
        text: answer,
        provider_id: rawResp.id || null,
        usage: rawResp.usage || null,
      },
    };
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  console.log("\n=== Answer ===\n");
  console.log(answer);
  console.log("\n=== Matches ===\n");
  matches.forEach((m, i) => {
    console.log(
      `#${i + 1} score=${m.score.toFixed(4)} id=${m.chunk.id} src=${m.chunk.metadata?.canonical_pdf_path || m.chunk.source_id}`
    );
    console.log(
      m.chunk.text.slice(0, 400).replace(/\n+/g, " ") + (m.chunk.text.length > 400 ? "…" : "")
    );
    console.log("---");
  });
  console.log("\n=== Metadata ===\n");
  console.log(`request_id: ${requestId}`);
  console.log(`timestamp: ${timestamp}`);
  console.log(`provider: OpenAI`);
  console.log(`embedding_model: ${EMBEDDING_MODEL}`);
  console.log(`chat_model: ${CHAT_MODEL}`);
  console.log(`duration_ms: ${durationMs}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
