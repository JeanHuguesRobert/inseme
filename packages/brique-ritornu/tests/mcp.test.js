import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { MemoryStore } from "../src/storage.js";
import { PROTOCOL_VERSION, SERVER_NAME, TOOLS, createMcpCore } from "../src/mcp/core.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dirname, "..", "fixtures", "substack-backup", "raw.html");
const SAMPLE_URL = "https://example.substack.com/p/backup?utm_source=share&fbclid=x";

function makeCore(fetchImpl) {
  return createMcpCore(
    { ...process.env, SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "" },
    { fetchImpl, store: new MemoryStore() }
  );
}

test("MCP tools catalog is non-empty and named ritornu_*", () => {
  assert.ok(TOOLS.length >= 5);
  for (const t of TOOLS) {
    assert.match(t.name, /^ritornu_/);
    assert.ok(t.inputSchema);
    assert.ok(t.description);
  }
});

test("initialize negotiates protocol and advertises tools capability", async () => {
  const core = makeCore();
  const res = await core.handleJsonRpc({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test" } },
  });
  assert.equal(res.jsonrpc, "2.0");
  assert.equal(res.id, 1);
  assert.equal(res.result.protocolVersion, "2024-11-05");
  assert.equal(res.result.serverInfo.name, SERVER_NAME);
  assert.ok(res.result.capabilities.tools);
  assert.match(res.result.instructions, /Git/i);
});

test("tools/list returns catalog", async () => {
  const core = makeCore();
  const res = await core.handleJsonRpc({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
  });
  assert.equal(res.result.tools.length, TOOLS.length);
  assert.ok(res.result.tools.some((t) => t.name === "ritornu_prepare_substack"));
  for (const name of ["ritornu_health", "ritornu_boundaries"]) {
    const item = res.result.tools.find(t => t.name === name);
    assert.equal(item.annotations?.readOnlyHint, true);
  }
  assert.notEqual(res.result.tools.find(
    t => t.name === "ritornu_prepare_substack"
  ).annotations?.readOnlyHint, true);
});

test("notifications/initialized is silent", async () => {
  const core = makeCore();
  const res = await core.handleJsonRpc({
    jsonrpc: "2.0",
    method: "notifications/initialized",
  });
  assert.equal(res, null);
});

test("ritornu_health tool call returns structured MCP content", async () => {
  const core = makeCore();
  const res = await core.handleJsonRpc({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "ritornu_health", arguments: {} },
  });
  assert.equal(res.result.isError, undefined);
  assert.equal(res.result.content[0].type, "text");
  const body = JSON.parse(res.result.content[0].text);
  assert.equal(body.ok, true);
  assert.equal(body.git_write_forbidden, true);
  assert.equal(body.storage.backend, "memory");
  assert.equal(res.result.structuredContent.server, SERVER_NAME);
});

test("ritornu_prepare_substack works via mock fetch and keeps git_write_forbidden", async () => {
  const html = readFileSync(FIXTURE, "utf8");
  const fetchImpl = async (url) => ({
    ok: true,
    status: 200,
    url,
    headers: { get: () => "text/html" },
    text: async () => html,
  });
  const core = makeCore(fetchImpl);
  const res = await core.handleJsonRpc({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "ritornu_prepare_substack",
      arguments: { url: SAMPLE_URL },
    },
  });
  const body = JSON.parse(res.result.content[0].text);
  assert.equal(body.ok, true);
  assert.equal(body.git_write_forbidden, true);
  assert.equal(body.review_required, true);
  assert.equal(body.summary.title, "Backup — keeping a copy of your own words");
  assert.equal(body.candidate.state, "review-request");
  assert.equal(body.raw_html, undefined);
});

test("ritornu_prepare_substack returns unavailable without bypass on 403", async () => {
  const fetchImpl = async (url) => ({
    ok: false,
    status: 403,
    url,
    headers: { get: () => "text/html" },
    text: async () => "forbidden",
  });
  const core = makeCore(fetchImpl);
  const res = await core.handleJsonRpc({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: {
      name: "ritornu_prepare_substack",
      arguments: { url: "https://example.substack.com/p/secret" },
    },
  });
  const body = JSON.parse(res.result.content[0].text);
  assert.equal(body.ok, false);
  assert.equal(body.status, "unavailable");
  assert.ok(body.fallbacks.includes("official-export"));
});

test("ritornu_normalize_provided is offline and produces handoff-ready candidate", async () => {
  const core = makeCore();
  const res = await core.handleJsonRpc({
    jsonrpc: "2.0",
    id: 6,
    method: "tools/call",
    params: {
      name: "ritornu_normalize_provided",
      arguments: {
        raw_text: "<article><h1>Hello</h1><p>Body of the post.</p></article>",
        platform: "substack",
      },
    },
  });
  const body = JSON.parse(res.result.content[0].text);
  assert.equal(body.ok, true);
  assert.equal(body.candidate.state, "review-request");
  assert.match(body.transcription.body_markdown, /Body of the post/);

  const handoffRes = await core.handleJsonRpc({
    jsonrpc: "2.0",
    id: 7,
    method: "tools/call",
    params: {
      name: "ritornu_create_handoff",
      arguments: {
        candidate: body.candidate,
        review: {
          status: "approved",
          reviewed_by: "Jean Hugues Robert",
        },
        decisions: {
          destination_repo: "JeanHuguesRobert/barons-Mariani",
          destination_path: "research/hello_blogpost.md",
        },
      },
    },
  });
  const handoff = JSON.parse(handoffRes.result.content[0].text);
  assert.equal(handoff.ok, true);
  assert.equal(handoff.handoff.git_write_forbidden, true);
  assert.equal(handoff.handoff.patch.format, "file-proposal");
  assert.match(handoff.handoff.patch.content, /Body of the post/);
});

test("unknown tool yields isError tool result", async () => {
  const core = makeCore();
  const res = await core.handleJsonRpc({
    jsonrpc: "2.0",
    id: 8,
    method: "tools/call",
    params: { name: "ritornu_nope", arguments: {} },
  });
  assert.equal(res.result.isError, true);
});

test("default protocol version is advertised when client is unknown", async () => {
  const core = makeCore();
  const res = await core.handleJsonRpc({
    jsonrpc: "2.0",
    id: 9,
    method: "initialize",
    params: { protocolVersion: "1.0.0" },
  });
  assert.equal(res.result.protocolVersion, PROTOCOL_VERSION);
});
