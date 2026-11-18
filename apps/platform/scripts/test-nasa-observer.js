import test from "node:test";
import assert from "node:assert/strict";
import { projectLocalNasaStatus, projectNasaNeighbors, projectNasaComputeEvidence, readLocalNasaObserver } from "../netlify/edge-functions/nasa-observer.js";

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

const at = new Date("2026-11-17T18:02:00Z");
const peerCache = {
  schema: "operium.node.peers.v1", node_id: "resource://fracta2",
  generated_at: "2026-11-17T18:02:00Z", last_blackboard_sync_at: "2026-11-17T18:00:00Z",
  peers: [{
    node_id: "resource://thinkpad", hostname: "thinkpad", status: "online",
    last_seen: "2026-11-17T18:00:00Z", ttl_seconds: 300, fresh: true,
    endpoint: "http://10.0.0.2:8794", capabilities: ["operium.node.v1"],
    metadata: { secret: "must_not_disclose" },
  }],
};
const soma = { schema: "soma.object.v0", id: "resource://fracta2", attributes: {
  "system.cpu.load1": { value: 1.25, quality: "measured",
    source: "resource://fracta2", observed_at: "2026-11-17T18:01:00Z" },
  "system.memory.free": { value: 100000, quality: "measured", unit: "byte",
    source: "resource://fracta2", observed_at: "2026-11-17T18:01:00Z" },
  "system.memory.total": { value: 200000, quality: "measured", unit: "byte",
    source: "resource://fracta2", observed_at: "2026-11-17T18:01:00Z" },
  "system.cpu.load5": { value: -1, quality: "measured",
    source: "resource://fracta2" },
  "system.memory.used_percent": { value: 50, quality: "measured", unit: "percent",
    source: "resource://fracta2", observed_at: "2026-11-17T18:01:00Z" },
  "unauthorized.private_field": { value: "must_not_disclose" },
} };

test("Principal observer projector emits only explicit fields, preserving unknown states", () => {
  const view = projectLocalNasaStatus(node, fleet, peerCache, soma, at);
  assert.equal(view.node.hostname, "fracta2");
  assert.equal(view.node.probes.failed_count, 0);
  assert.equal(view.node.pending_cop_outbox, 0);
  assert.equal(view.fleet.nodes[1].online, null);
  assert.equal(view.neighbors.fresh_count, 1);
  assert.equal(view.neighbors.nodes[0].routing_admissible, null);
  assert.equal(view.compute.cpu_load_1m.value, 1.25);
  assert.equal(view.compute.cpu_load_5m, null);
  assert.equal(view.compute.packet_service_rate, null);

  const text = JSON.stringify(view);
  for (const disallowed of ["secret", "must_not_disclose", "private", "10.0.0.1", "10.0.0.2",
    "tokens", "endpoint", "private_paths"]) {
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

test("read-only ONA fetches four fixed local GET endpoints", async () => {
  const paths = [];
  const localFetch = async (url, init) => {
    paths.push([url, init.method, init.headers.Accept]);
    const payload = url.endsWith("/node/status") ? node :
      url.endsWith("/cgi-bin/fleet") ? fleet :
      url.endsWith("/node/peers?fresh=0") ? peerCache : soma;
    return { ok: true, json: async () => payload };
  };
  const result = await readLocalNasaObserver("http://127.0.0.1:8794", localFetch);
  assert.equal(result.status, "available");
  assert.equal(result.view.fleet.nodes.length, 2);
  assert.equal(result.view.neighbors.known_count, 1);
  assert.equal(result.view.compute.cpu_load_1m.value, 1.25);
  assert.deepEqual(paths.map(v => v[0]).sort(), [
    "http://127.0.0.1:8794/cgi-bin/fleet",
    "http://127.0.0.1:8794/node/peers?fresh=0",
    "http://127.0.0.1:8794/node/status",
    "http://127.0.0.1:8794/soma/object",
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


test("Expired or inconsistent peer reports cannot masquerade as fresh routes", () => {
  const expired = projectNasaNeighbors(peerCache, node, fleet, new Date("2026-11-17T18:07:00Z"));
  assert.equal(expired.known_count, 1);
  assert.equal(expired.fresh_count, 0);
  assert.equal(expired.nodes[0].fresh, false);
  assert.equal(expired.nodes[0].routing_admissible, null);
  assert.equal(projectNasaNeighbors({ ...peerCache, node_id: "resource://other" }, node, fleet, at), null);
  const future = { ...peerCache, peers: [{
    ...peerCache.peers[0], last_seen: "2026-11-17T19:00:00Z" }] };
  assert.equal(projectNasaNeighbors(future, node, fleet, at).fresh_count, 0);
  const raw = JSON.stringify(expired);
  assert.ok(!raw.includes("10.0.0.2"));
  assert.ok(!raw.includes("must_not_disclose"));
});

test("SOMA evidence is source-matched and never manufactures compute capacity", () => {
  assert.equal(projectNasaComputeEvidence(soma, node).memory_free.value, 100000);
  assert.equal(projectNasaComputeEvidence(soma, node).compute_slots, null);
  assert.equal(projectNasaComputeEvidence({ ...soma, id: "resource://other" }, node), null);
  const mismatched = { ...soma, attributes: {
    "system.memory.free": { value: 234, quality: "measured", source: "resource://other" } } };
  assert.equal(projectNasaComputeEvidence(mismatched, node).memory_free, null);
});
