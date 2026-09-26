import assert from "node:assert/strict";
import test from "node:test";
import { createLocalOpencodeAcpMap } from "../registry/maps/local-opencode-acp.js";

const BASE_ENV = {
  OPENCODE_ACP_COMMAND: "/usr/local/bin/opencode",
  MAGISTRAL_OPENCODE_ACP_WORKSPACE: "/srv/public-guide",
};

test("local OpenCode ACP map defaults to fallback tier and invokes the acp subcommand with no flags", () => {
  const [node] = createLocalOpencodeAcpMap({ ...BASE_ENV }, "linux");
  assert.equal(node.adapter, "acp_stdio");
  assert.equal(node.tier, "fallback");
  // opencode acp has no --model CLI flag (verified empirically, inseme#106);
  // model selection happens via a session/new config option instead.
  assert.deepEqual(node.args, ["acp"]);
  assert.equal(node.model, "opencode-default");
  assert.equal(node.env.HTTPS_PROXY, "");
  assert.equal(node.env.NO_PROXY, "*");
});

test("local OpenCode ACP map carries OPENROUTER_API_KEY through when set", () => {
  const [node] = createLocalOpencodeAcpMap(
    { ...BASE_ENV, OPENROUTER_API_KEY: "or-test-key" },
    "linux"
  );
  assert.equal(node.env.OPENROUTER_API_KEY, "or-test-key");
});

test("local OpenCode ACP map works with no OPENROUTER_API_KEY at all (OpenCode's own hosted default model)", () => {
  const [node] = createLocalOpencodeAcpMap({ ...BASE_ENV }, "linux");
  assert.equal(node.env.OPENROUTER_API_KEY, undefined);
});

test("local OpenCode ACP map can explicitly retain host proxy settings", () => {
  const [node] = createLocalOpencodeAcpMap(
    { ...BASE_ENV, OPENROUTER_API_KEY: "or-test-key", MAGISTRAL_OPENCODE_ACP_INHERIT_PROXY: "1" },
    "linux"
  );
  assert.deepEqual(node.env, { OPENROUTER_API_KEY: "or-test-key" });
});

test("local OpenCode ACP map refuses a relative command or workspace", () => {
  assert.throws(
    () => createLocalOpencodeAcpMap({ ...BASE_ENV, OPENCODE_ACP_COMMAND: "opencode" }, "linux"),
    /absolute path/
  );
  assert.throws(
    () =>
      createLocalOpencodeAcpMap(
        { ...BASE_ENV, MAGISTRAL_OPENCODE_ACP_WORKSPACE: "public-guide" },
        "linux"
      ),
    /absolute path.*isolated public directory/
  );
});
