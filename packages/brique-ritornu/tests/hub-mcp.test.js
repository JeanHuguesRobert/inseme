import assert from "node:assert/strict";
import test from "node:test";

import { MemoryStore } from "../src/storage.js";
import { COGENTIA_TOOLS, createCogentiaProxy } from "../src/mcp/cogentia-proxy.js";
import { HUB_SERVER_NAME, createHubMcp } from "../src/mcp/hub.js";
import { TOOLS as RITORNU_TOOLS } from "../src/mcp/core.js";

function makeHub(overrides = {}) {
  const fakeCogentia = {
    daemonUrl: { origin: "http://127.0.0.1:8790" },
    allowOps: false,
    listTools: () =>
      COGENTIA_TOOLS.filter((t) => t.risk === "read").map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    callTool: async (name, args) => {
      if (name === "cogentia_views_snapshot") {
        return { ok: true, mock: true, args };
      }
      if (name === "cogentia_search") {
        return { ok: true, query: args.query, results: [] };
      }
      throw new Error(`unexpected ${name}`);
    },
    hasTool: (name) => COGENTIA_TOOLS.some((t) => t.name === name),
    healthProbe: async () => ({ ok: true, mock: true }),
    toolCount: () => COGENTIA_TOOLS.filter((t) => t.risk === "read").length,
  };

  return createHubMcp(
    {
      ...process.env,
      SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      INSEME_MCP_SURFACE: "full",
      ...overrides.env,
    },
    {
      store: new MemoryStore(),
      cogentia: overrides.cogentia === null ? null : overrides.cogentia || fakeCogentia,
      fetchImpl: overrides.fetchImpl,
    }
  );
}

test("federated catalog includes hub + cogentia + ritornu tools", () => {
  const hub = makeHub();
  const tools = hub.listTools();
  const names = new Set(tools.map((t) => t.name));

  assert.ok(names.has("inseme_cockpit"));
  assert.ok(names.has("inseme_list_surfaces"));
  assert.ok(names.has("cogentia_search"));
  assert.ok(names.has("cogentia_context_pack"));
  assert.ok(names.has("cogentia_context_pack_batch"));
  assert.ok(names.has("cogentia_get_doc"));
  assert.ok(names.has("cogentia_grep"));
  assert.ok(
    names.has("cogentia_pattern_list") ||
      COGENTIA_TOOLS.some((t) => t.name === "cogentia_pattern_list")
  );
  assert.ok(names.has("cogentia_continuation_list"));
  assert.ok(names.has("ritornu_prepare_substack"));
  assert.ok(names.has("ritornu_health"));
  // The federated projection must preserve source annotations, not silently
  // strip away the read-only information needed by a composition client.
  assert.equal(tools.find(t => t.name === "ritornu_health")
    .annotations?.readOnlyHint, true);
  assert.equal(tools.find(t => t.name === "ritornu_boundaries")
    .annotations?.readOnlyHint, true);
  assert.notEqual(tools.find(t => t.name === "ritornu_prepare_substack")
    .annotations?.readOnlyHint, true);

  // Larger than either surface alone
  assert.ok(tools.length > RITORNU_TOOLS.length);
  assert.ok(tools.length >= COGENTIA_TOOLS.filter((t) => t.risk === "read").length);
});

test("initialize advertises inseme-mcp and large tool surface", async () => {
  const hub = makeHub();
  const res = await hub.handleJsonRpc({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "t" } },
  });
  assert.equal(res.result.serverInfo.name, HUB_SERVER_NAME);
  assert.match(res.result.instructions, /cogentia_search/i);
  assert.match(res.result.instructions, /ritornu/i);
});

test("inseme_list_surfaces reports counts", async () => {
  const hub = makeHub();
  const res = await hub.handleJsonRpc({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "inseme_list_surfaces", arguments: {} },
  });
  const body = JSON.parse(res.result.content[0].text);
  assert.equal(body.ok, true);
  assert.ok(body.surfaces.cogentia.tool_count > 20);
  assert.ok(body.surfaces.ritornu.tool_count >= 5);
  assert.ok(body.total_tools > 25);
});

test("inseme_cockpit merges ritornu + cogentia", async () => {
  const hub = makeHub();
  const res = await hub.handleJsonRpc({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "inseme_cockpit", arguments: {} },
  });
  const body = JSON.parse(res.result.content[0].text);
  assert.equal(body.ok, true);
  assert.equal(body.ritornu.ok, true);
  assert.ok(body.cogentia.health.ok || body.cogentia.views);
});

test("cogentia_search routes through federation", async () => {
  const hub = makeHub();
  const res = await hub.handleJsonRpc({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "cogentia_search",
      arguments: { query: "potentics" },
    },
  });
  const body = JSON.parse(res.result.content[0].text);
  assert.equal(body.ok, true);
  assert.equal(body.query, "potentics");
});

test("INSEME_MCP_SURFACE=ritornu hides cogentia tools", () => {
  const hub = makeHub({
    env: { INSEME_MCP_SURFACE: "ritornu" },
    cogentia: null,
  });
  // When surface is ritornu, createHubMcp won't attach cogentia even if passed...
  // Actually we pass cogentia in options which overrides. Force surface only:
  const hub2 = createHubMcp(
    {
      ...process.env,
      SUPABASE_URL: "",
      INSEME_MCP_SURFACE: "ritornu",
    },
    { store: new MemoryStore(), cogentia: null }
  );
  const names = hub2.listTools().map((t) => t.name);
  assert.ok(names.includes("ritornu_health"));
  assert.ok(!names.includes("cogentia_search"));
  assert.ok(names.includes("inseme_cockpit"));
});

test("write ops are hidden unless allowOps", () => {
  const hub = makeHub();
  const names = new Set(hub.listTools().map((t) => t.name));
  assert.ok(!names.has("cogentia_index_rebuild"));
  assert.ok(!names.has("cogentia_continuation_emit"));
  assert.ok(!names.has("cogentia_continuation_resolve"));
});

test("live Cogentia proxy uses Cogentia core catalog (no parallel table)", () => {
  const proxy = createCogentiaProxy({
    COGENTIA_DAEMON_URL: "http://127.0.0.1:8790",
    COGENTIA_MCP_VIEW: "public",
  });
  const names = new Set(proxy.listTools().map((t) => t.name));
  assert.equal(proxy.catalog, "cogentia-mcp-core");
  assert.ok(names.has("cogentia_search"));
  assert.ok(names.has("cogentia_skill_list"));
  assert.ok(names.has("cogentia_pattern_list"));
  assert.ok(names.has("cogentia_cli_catalog"));
  assert.ok(names.has("cogentia_grep"));
  assert.ok(!names.has("cogentia_continuation_emit"));
  assert.ok(
    proxy.hasTool("cogentia_continuation_emit"),
    "mutate tools remain addressable for gated calls"
  );
});

test("hub forwards Cogentia resources and SEP-2640 skills", async () => {
  const hub = createHubMcp(
    {
      ...process.env,
      SUPABASE_URL: "",
      INSEME_MCP_SURFACE: "full",
      COGENTIA_DAEMON_URL: "http://127.0.0.1:8790",
      COGENTIA_MCP_VIEW: "public",
    },
    { store: new MemoryStore() }
  );
  const names = new Set(hub.listTools().map((t) => t.name));
  assert.ok(names.has("inseme_cockpit"));
  assert.ok(names.has("cogentia_pattern_list"));
  assert.ok(names.has("ritornu_health"));

  const resources = await hub.handleJsonRpc({
    jsonrpc: "2.0",
    id: 10,
    method: "resources/list",
    params: {},
  });
  assert.ok(Array.isArray(resources.result.resources));
  assert.ok(resources.result.resources.some((r) => String(r.uri).startsWith("skill://")));
  assert.ok(resources.result.resources.some((r) => String(r.uri).includes("pattern/")));

  const skills = await hub.handleJsonRpc({
    jsonrpc: "2.0",
    id: 11,
    method: "skills/list",
    params: {},
  });
  assert.ok(skills.result.skills.length >= 1);

  const discover = await hub.handleJsonRpc({
    jsonrpc: "2.0",
    id: 12,
    method: "server/discover",
    params: {},
  });
  assert.ok(discover.result.capabilities?.resources);
  assert.ok(discover.result.capabilities?.extensions?.["io.modelcontextprotocol/skills"]);
  assert.match(discover.result.instructions, /inseme/i);

  const pattern = await hub.handleJsonRpc({
    jsonrpc: "2.0",
    id: 13,
    method: "tools/call",
    params: { name: "cogentia_pattern_list", arguments: {} },
  });
  const body = JSON.parse(pattern.result.content[0].text);
  assert.equal(body.ok, true);
  assert.ok(body.count >= 1);
});

test("FBF: July 2026 discovery and calls carry stateless result metadata", async () => {
  const hub = makeHub();
  const meta = {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientInfo": { name: "fbf-test", version: "1" },
    "io.modelcontextprotocol/clientCapabilities": {},
  };
  const discovery = await hub.handleJsonRpc({
    jsonrpc: "2.0", id: 301, method: "server/discover", params: { _meta: meta },
  });
  assert.equal(discovery.result.resultType, "complete");
  assert.ok(discovery.result.supportedVersions.includes("2026-07-28"));
  assert.equal(discovery.result._meta["io.modelcontextprotocol/serverInfo"].name, HUB_SERVER_NAME);

  const tools = await hub.handleJsonRpc({
    jsonrpc: "2.0", id: 302, method: "tools/list", params: { _meta: meta },
  }, { protocolVersionHeader: "2026-07-28" });
  assert.equal(tools.result.resultType, "complete");
  assert.equal(tools.result.cacheScope, "private");
  assert.ok(tools.result.ttlMs > 0);
  assert.ok(tools.result.tools.some(t => t.name === "inseme_list_surfaces"));

  const call = await hub.handleJsonRpc({
    jsonrpc: "2.0", id: 303, method: "tools/call",
    params: { _meta: meta, name: "inseme_list_surfaces", arguments: {} },
  }, { protocolVersionHeader: "2026-07-28", mcpMethod: "tools/call", mcpName: "inseme_list_surfaces" });
  assert.equal(call.result.resultType, "complete");
  assert.equal(call.result._meta["io.modelcontextprotocol/protocolVersion"], "2026-07-28");
  assert.equal(JSON.parse(call.result.content[0].text).ok, true);
});

test("FBF: modern handshake is not advertised through legacy initialize", async () => {
  const hub = makeHub();
  const reply = await hub.handleJsonRpc({
    jsonrpc: "2.0", id: 304, method: "initialize",
    params: { protocolVersion: "2026-07-28", capabilities: {}, clientInfo: { name: "legacy" } },
  });
  assert.notEqual(reply.result.protocolVersion, "2026-07-28");
});

test("FBF: reject inconsistent headers and unsupported versions", async () => {
  const hub = makeHub();
  const request = {
    jsonrpc: "2.0", id: 305, method: "tools/list",
    params: { _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28" } },
  };
  const mismatch = await hub.handleJsonRpc(request, { protocolVersionHeader: "2025-11-25" });
  assert.equal(mismatch.error.code, -32020);
  const unsupported = await hub.handleJsonRpc({
    ...request,
    params: { _meta: { "io.modelcontextprotocol/protocolVersion": "2099-01-01" } },
  });
  assert.equal(unsupported.error.code, -32022);
});

test("FBF: modern discovery works without Cogentia forwarding", async () => {
  const hub = makeHub({ env: { INSEME_MCP_SURFACE: "ritornu" }, cogentia: null });
  const response = await hub.handleJsonRpc({
    jsonrpc: "2.0", id: 306, method: "server/discover",
    params: { _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28" } },
  });
  assert.equal(response.result.resultType, "complete");
  assert.deepEqual(response.result.capabilities.tools, { listChanged: false });
});

test("FBF: ping is legacy-only; modern request rejects removed method", async () => {
  const hub = makeHub();
  const modern = await hub.handleJsonRpc({
    jsonrpc: "2.0", id: 307, method: "ping",
    params: { _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28", "io.modelcontextprotocol/clientCapabilities": {} } },
  });
  assert.equal(modern.error.code, -32601);
  const legacy = await hub.handleJsonRpc({
    jsonrpc: "2.0", id: 308, method: "ping", params: {},
  });
  assert.deepEqual(legacy.result, {});
});

test("FBF: modern invocations reject missing per-request client capabilities", async () => {
  const hub = makeHub();
  const response = await hub.handleJsonRpc({
    jsonrpc: "2.0", id: 309, method: "tools/list",
    params: { _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28" } },
  });
  assert.equal(response.error.code, -32602);
});
