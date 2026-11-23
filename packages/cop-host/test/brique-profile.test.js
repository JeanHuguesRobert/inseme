import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadBriqueProfile, selectBriqueCapabilities } from "../src/brique-profile.js";

test("a profile selects only declared brique capabilities", () => {
  const directory = mkdtempSync(join(tmpdir(), "brique-profile-"));
  const profilePath = join(directory, "jhn.json");
  writeFileSync(
    profilePath,
    JSON.stringify({
      schema_version: 1,
      id: "jhn",
      host_app: "platform",
      core: {
        runtime: { kind: "cop-orchestration", required_packages: ["@inseme/cop-kernel"] },
        routes: ["/"],
        edge_functions: [],
      },
      briques: [{ id: "ophelia", routes: [], functions: [], edge_functions: ["chat-stream"] }],
    })
  );

  try {
    const profile = loadBriqueProfile(profilePath);
    const selected = selectBriqueCapabilities(
      {
        id: "ophelia",
        routes: [{ path: "/chat" }],
        functions: { executor: {} },
        edgeFunctions: { "chat-stream": {}, sessions: {} },
        tools: [{ function: { name: "create_room" } }],
      },
      profile
    );
    assert.deepEqual(selected.routes, []);
    assert.deepEqual(Object.keys(selected.functions), []);
    assert.deepEqual(Object.keys(selected.edgeFunctions), ["chat-stream"]);
    assert.deepEqual(selected.tools, []);
    assert.equal(selectBriqueCapabilities({ id: "wiki" }, profile), null);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("the JHN profile matches its declared briques and Edge capabilities", () => {
  const testDirectory = dirname(fileURLToPath(import.meta.url));
  const profilePath = join(testDirectory, "../../../apps/platform/brique-profiles/jhn.json");
  const profile = loadBriqueProfile(profilePath);

  assert.equal(profile.id, "jhn");
  assert.deepEqual(profile.briques, [
    { id: "ophelia", routes: [], functions: [], edge_functions: [] },
    { id: "oleole", routes: ["/", "/oleole"], functions: [], edge_functions: [] },
  ]);
  assert.deepEqual(profile.core.edge_functions, [
    {
      function: "nasa-control",
      path: "/api/nasa/control",
      source: "netlify/edge-functions/nasa-control.js",
    },
    {
      function: "interactions-desk",
      path: "/api/interactions/desk",
      source: "netlify/edge-functions/interactions-desk.js",
    },
    {
      function: "principal-consent-proxy",
      path: "/api/cop/principal-consent/*",
      source: "netlify/edge-functions/principal-consent-proxy.js",
    },
    {
      function: "gen-ophelia-chat-stream",
      path: "/api/chat-stream",
      source: "../../packages/brique-ophelia/edge/jhn-chat-stream.js",
    },
    {
      function: "jhn-cop-events",
      path: "/api/jhn-cop-events",
      source: "netlify/edge-functions/jhn-cop-events.js",
    },
    {
      function: "github-webhook",
      path: "/api/webhooks/github",
      source: "netlify/edge-functions/github-webhook.js",
    },
    {
      function: "gen-oleole-presence-api",
      path: "/api/oleole/*",
      source: "netlify/edge-functions/oleole-presence-api.source.js",
    },
    {
      function: "gen-corsica-context-api",
      path: "/api/corsica/context",
      source: "netlify/edge-functions/corsica-context-api.source.js",
    },
  ]);
  assert.deepEqual(profile.core.runtime, {
    kind: "cop-orchestration",
    required_packages: ["@inseme/cop-kernel", "@inseme/cop-host"],
  });
});
