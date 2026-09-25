import assert from "node:assert/strict";
import test from "node:test";
import { createLocalClaudeAcpMap } from "../registry/maps/local-claude-acp.js";

test("local Claude ACP map defaults to fallback tier and needs no explicit key (OAuth session)", () => {
  const [node] = createLocalClaudeAcpMap(
    {
      CLAUDE_ACP_COMMAND: "/usr/local/bin/claude-agent-acp",
      MAGISTRAL_CLAUDE_ACP_WORKSPACE: "/srv/public-guide",
    },
    "linux"
  );
  assert.equal(node.adapter, "acp_stdio");
  assert.equal(node.tier, "fallback");
  assert.equal(node.env.ANTHROPIC_API_KEY, undefined);
  assert.equal(node.env.HTTPS_PROXY, "");
  assert.equal(node.env.NO_PROXY, "*");
});

test("local Claude ACP map carries ANTHROPIC_API_KEY through when explicitly set", () => {
  const [node] = createLocalClaudeAcpMap(
    {
      CLAUDE_ACP_COMMAND: "/usr/local/bin/claude-agent-acp",
      MAGISTRAL_CLAUDE_ACP_WORKSPACE: "/srv/public-guide",
      ANTHROPIC_API_KEY: "sk-ant-test",
    },
    "linux"
  );
  assert.equal(node.env.ANTHROPIC_API_KEY, "sk-ant-test");
});

test("local Claude ACP map can explicitly retain host proxy settings", () => {
  const [node] = createLocalClaudeAcpMap(
    {
      CLAUDE_ACP_COMMAND: "/usr/local/bin/claude-agent-acp",
      MAGISTRAL_CLAUDE_ACP_WORKSPACE: "/srv/public-guide",
      MAGISTRAL_CLAUDE_ACP_INHERIT_PROXY: "1",
    },
    "linux"
  );
  assert.deepEqual(node.env, {});
});

test("local Claude ACP map refuses a relative command or workspace", () => {
  assert.throws(
    () =>
      createLocalClaudeAcpMap(
        {
          CLAUDE_ACP_COMMAND: "claude-agent-acp.cmd",
          MAGISTRAL_CLAUDE_ACP_WORKSPACE: "C:\\work\\public-guide",
        },
        "win32"
      ),
    /absolute path/
  );
  assert.throws(
    () =>
      createLocalClaudeAcpMap(
        {
          CLAUDE_ACP_COMMAND: "C:\\Users\\jhr\\claude-agent-acp.cmd",
          MAGISTRAL_CLAUDE_ACP_WORKSPACE: "public-guide",
        },
        "win32"
      ),
    /absolute path.*isolated public directory/
  );
});
