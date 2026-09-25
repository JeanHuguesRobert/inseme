import assert from "node:assert/strict";
import test from "node:test";
import { createLocalCodexAndClaudeAcpMap } from "../registry/maps/local-codex-and-claude-acp.js";

const CODEX_ENV = {
  CODEX_ACP_COMMAND: "/usr/local/bin/codex-acp",
  MAGISTRAL_CODEX_ACP_WORKSPACE: "/srv/public-guide/codex",
};

const CLAUDE_ENV = {
  CLAUDE_ACP_COMMAND: "/usr/local/bin/claude-agent-acp",
  MAGISTRAL_CLAUDE_ACP_WORKSPACE: "/srv/public-guide/claude",
};

test("composite map includes both providers when both are configured", () => {
  const nodes = createLocalCodexAndClaudeAcpMap({ ...CODEX_ENV, ...CLAUDE_ENV }, "linux");
  const ids = nodes.map((n) => n.id).sort();
  assert.deepEqual(ids, ["local-claude-acp", "local-codex-acp"]);
});

test("composite map works with only Codex configured", () => {
  const nodes = createLocalCodexAndClaudeAcpMap({ ...CODEX_ENV }, "linux");
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].id, "local-codex-acp");
});

test("composite map works with only Claude configured", () => {
  const nodes = createLocalCodexAndClaudeAcpMap({ ...CLAUDE_ENV }, "linux");
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].id, "local-claude-acp");
});

test("composite map refuses to produce an empty map", () => {
  assert.throws(() => createLocalCodexAndClaudeAcpMap({}, "linux"), /requires at least one of/);
});

test("Codex stays primary tier and Claude stays fallback tier by default", () => {
  const nodes = createLocalCodexAndClaudeAcpMap({ ...CODEX_ENV, ...CLAUDE_ENV }, "linux");
  const codex = nodes.find((n) => n.id === "local-codex-acp");
  const claude = nodes.find((n) => n.id === "local-claude-acp");
  assert.equal(codex.tier, "fractavolta-guide");
  assert.equal(claude.tier, "fallback");
});
