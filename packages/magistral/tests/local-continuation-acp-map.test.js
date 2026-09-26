import assert from "node:assert/strict";
import test from "node:test";
import { createLocalContinuationAcpMap } from "../registry/maps/local-continuation-acp.js";

const BASE_ENV = {
  CONTINUATION_ACP_COMMAND: "/usr/bin/node",
  MAGISTRAL_CONTINUATION_ACP_WORKSPACE: "/srv/public-guide",
};

test("local continuation ACP map defaults to fallback tier with lowest weight", () => {
  const [node] = createLocalContinuationAcpMap({ ...BASE_ENV }, "linux");
  assert.equal(node.adapter, "acp_stdio");
  assert.equal(node.tier, "fallback");
  assert.equal(node.weight, 0);
  assert.equal(node.env.HTTPS_PROXY, "");
  assert.equal(node.env.NO_PROXY, "*");
});

test("local continuation ACP map passes through its own tuning env vars", () => {
  const [node] = createLocalContinuationAcpMap(
    {
      ...BASE_ENV,
      CONTINUATION_ACP_POLL_MS: "5000",
      CONTINUATION_ACP_TIMEOUT_MS: "600000",
      CONTINUATION_ACP_KIND: "custom_kind",
    },
    "linux"
  );
  assert.equal(node.env.CONTINUATION_ACP_POLL_MS, "5000");
  assert.equal(node.env.CONTINUATION_ACP_TIMEOUT_MS, "600000");
  assert.equal(node.env.CONTINUATION_ACP_KIND, "custom_kind");
});

test("local continuation ACP map passes through COGENTIA_REGISTRY so the server can find its registry", () => {
  const [node] = createLocalContinuationAcpMap(
    { ...BASE_ENV, COGENTIA_REGISTRY: "/srv/cogentia/repos/JeanHuguesRobert" },
    "linux"
  );
  assert.equal(node.env.COGENTIA_REGISTRY, "/srv/cogentia/repos/JeanHuguesRobert");
});

test("local continuation ACP map omits COGENTIA_REGISTRY when not set", () => {
  const [node] = createLocalContinuationAcpMap({ ...BASE_ENV }, "linux");
  assert.equal(node.env.COGENTIA_REGISTRY, undefined);
});

test("local continuation ACP map can explicitly retain host proxy settings", () => {
  const [node] = createLocalContinuationAcpMap(
    { ...BASE_ENV, MAGISTRAL_CONTINUATION_ACP_INHERIT_PROXY: "1" },
    "linux"
  );
  assert.deepEqual(node.env, {});
});

test("local continuation ACP map refuses a relative command or workspace", () => {
  assert.throws(
    () => createLocalContinuationAcpMap({ ...BASE_ENV, CONTINUATION_ACP_COMMAND: "node" }, "linux"),
    /absolute path/
  );
  assert.throws(
    () =>
      createLocalContinuationAcpMap(
        { ...BASE_ENV, MAGISTRAL_CONTINUATION_ACP_WORKSPACE: "public-guide" },
        "linux"
      ),
    /absolute path.*isolated public directory/
  );
});
