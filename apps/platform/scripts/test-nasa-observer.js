import test from "node:test";
import assert from "node:assert/strict";
import { projectLocalNasaStatus, readLocalNasaObserver } from "../netlify/edge-functions/nasa-observer.js";

const node = {
  node_id: "resource://fracta2", hostname: "fracta2", ok: true,
  generated_at: "2026-11-17T18:00:00Z", health_score: 4, uptime_seconds: 12345,
  peer_count_fresh: 2, probes: { applicable_count: 3, failed_count: 0,
    items: [{ probe_kind: "http", target: "local-health", ok: true, result: { secret: "private" } }] },
  jobs: { total: 1, enabled: 1, failed_last_run: 0,
    items: [{ job_id: "probe", kind: "schedule", enabled: true, last_ok: true, private_params: "private" }] },
  sqlite_stats: { cop_outbox_pending: 0, private_paths: "private" },
  tokens: { admin: "secret" },
};
const fleet = { generated_at: "2026-11-17T18:00:00Z",
  nodes: [{ host: "fracta2", online: true, health_score: 4, endpoint: "http://10.0.0.1", label: "Fracta 2" },
    { host: "unknown", online: null, health_score: null, label: "Unknown" }] };

test("Principal observer projector emits only explicit fields, preserving unknown states", () => {
  const view = projectLocalNasaStatus(node, fleet);
  assert.equal(view.node.hostname, "fracta2");
  assert.equal(view.node.probes.failed_count, 0);
  assert.equal(view.node.pending_cop_outbox, 0);
  assert.equal(view.fleet.nodes[1].online, null);
  const text = JSON.stringify(view);
  for (const disallowed of ["secret", "private", "10.0.0.1", "tokens", "endpoint", "private_paths"]) {
    assert.equal(text.includes(disallowed), false, disallowed);
  }
});

test("Observer cannot be made into SSRF by supplying another origin", async () => {
  let calls = 0;
  const result = await readLocalNasaObserver("http://other-host:8794", () => { calls++; });
  assert.equal(result.status, "refused");
  assert.equal(calls, 0);
  assert.equal((await readLocalNasaObserver("")).status, "not_configured");
});

test("Observable local ONA delivers only two fixed GET requests", async () => {
  const paths = [];
  const localFetch = async (url, init) => {
    paths.push([url, init.method, init.headers.Accept]);
    return { ok: true, json: async () => url.endsWith("/node/status") ? node : fleet };
  };
  const result = await readLocalNasaObserver("http://127.0.0.1:8794", localFetch);
  assert.equal(result.status, "available");
  assert.equal(result.view.fleet.nodes.length, 2);
  assert.deepEqual(paths.map(v => v[0]).sort(), [
    "http://127.0.0.1:8794/cgi-bin/fleet",
    "http://127.0.0.1:8794/node/status",
  ]);
  assert.ok(paths.every((v) => v[1] === "GET" && v[2] === "application/json"));
});

test("Partial failures remain explicitly degraded and never report healthy by default", async () => {
  const result = await readLocalNasaObserver("http://127.0.0.1:8794",
    async url => url.endsWith("/node/status")
      ? { ok: true, json: async () => node }
      : { ok: false });
  assert.equal(result.status, "degraded");
  assert.equal(result.view.fleet, null);
  assert.equal(result.view.node.hostname, "fracta2");
});
