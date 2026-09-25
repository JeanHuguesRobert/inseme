import assert from "node:assert/strict";
import test from "node:test";
import { createLocalClaudeAcpMap } from "../registry/maps/local-claude-acp.js";

test("local Claude ACP map defaults to fallback tier and carries the API key", () => {
  const [node] = createLocalClaudeAcpMap(
    {
      CLAUDE_ACP_COMMAND: "/usr/local/bin/claude-code-acp",
      MAGISTRAL_CLAUDE_ACP_WORKSPACE: "/srv/public-guide",
      ANTHROPIC_API_KEY: "sk-ant-test",
    },
    "linux"
  );
  assert.equal(node.adapter, "acp_stdio");
  assert.equal(node.tier, "fallback");
  assert.equal(node.env.ANTHROPIC_API_KEY, "sk-ant-test");
  assert.equal(node.env.HTTPS_PROXY, "");
  assert.equal(node.env.NO_PROXY, "*");
});

test("local Claude ACP map can explicitly retain host proxy settings", () => {
  const [node] = createLocalClaudeAcpMap(
    {
      CLAUDE_ACP_COMMAND: "/usr/local/bin/claude-code-acp",
      MAGISTRAL_CLAUDE_ACP_WORKSPACE: "/srv/public-guide",
      ANTHROPIC_API_KEY: "sk-ant-test",
      MAGISTRAL_CLAUDE_ACP_INHERIT_PROXY: "1",
    },
    "linux"
  );
  assert.deepEqual(node.env, { ANTHROPIC_API_KEY: "sk-ant-test" });
});

test("local Claude ACP map refuses a relative command or workspace", () => {
  assert.throws(
    () =>
      createLocalClaudeAcpMap(
        {
          CLAUDE_ACP_COMMAND: "claude-code-acp.cmd",
          MAGISTRAL_CLAUDE_ACP_WORKSPACE: "C:\\work\\public-guide",
          ANTHROPIC_API_KEY: "sk-ant-test",
        },
        "win32"
      ),
    /absolute path/
  );
  assert.throws(
    () =>
      createLocalClaudeAcpMap(
        {
          CLAUDE_ACP_COMMAND: "C:\\Users\\jhr\\claude-code-acp.cmd",
          MAGISTRAL_CLAUDE_ACP_WORKSPACE: "public-guide",
          ANTHROPIC_API_KEY: "sk-ant-test",
        },
        "win32"
      ),
    /absolute path.*isolated public directory/
  );
});

test("local Claude ACP map requires an API key", () => {
  assert.throws(
    () =>
      createLocalClaudeAcpMap(
        {
          CLAUDE_ACP_COMMAND: "/usr/local/bin/claude-code-acp",
          MAGISTRAL_CLAUDE_ACP_WORKSPACE: "/srv/public-guide",
        },
        "linux"
      ),
    /ANTHROPIC_API_KEY is required/
  );
});
