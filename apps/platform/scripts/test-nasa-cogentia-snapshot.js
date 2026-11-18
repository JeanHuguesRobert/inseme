import test from "node:test";
import assert from "node:assert/strict";
import {
  projectCogentiaSnapshot,
  readLocalCogentiaSnapshot,
} from "../netlify/edge-functions/nasa-cogentia-snapshot.js";

const raw = {
  ok: true, protocol: "cogentia.views_snapshot.v1", generated_at: "2026-11-18T07:00:00Z",
  load: { level: "crisis", mode_recommendation: "crisis", demand_score: 100,
    capacity_score: 100, inventory: { embedding_coverage_pct: 27.9, index_built: true } },
  continuations: { alive_count: 412, alive: [
    { id: "ctn_alpha", title: "Safe title", status: "active", kind: "judgment",
      priority: "P2", subject: { repo: "cogentia", path: "/private/path" },
      resume: { api_key: "cannot-disclose" }, updated_at: "2026-11-18" },
  ] },
  issues: { total_open: 377, generated_at: "2026-11-18" },
  next_actions: [{ type: "continuation", id: "ctn_alpha", title: "Safe title",
    priority: "P2", hint: "cannot-disclose" }],
  key_views: { private: "cannot-disclose" },
  corpus: { secret: "cannot-disclose" },
};

test("Cogentia projection preserves counts and discloses no raw registry internals", () => {
  const v = projectCogentiaSnapshot(raw);
  assert.equal(v.schema, "inseme.nasa.cogentia_cockpit.v1");
  assert.equal(v.continuations.alive_count, 412);
  assert.equal(v.issues.open_count, 377);
  assert.equal(v.load.level, "crisis");
  assert.equal(v.continuations.recent[0].repo, "cogentia");
  const value = JSON.stringify(v);
  for (const forbidden of ["cannot-disclose", "/private/path", "key_views",
    "resume", "private", "api_key", "secret"]) {
    assert.ok(!value.includes(forbidden), forbidden);
  }
});

test("Cogentia snapshot origin cannot be overridden", async () => {
  let calls = 0;
  const fetchImpl = () => { calls++; throw new Error("unexpected network"); };
  assert.equal((await readLocalCogentiaSnapshot("")).status, "not_configured");
  assert.equal((await readLocalCogentiaSnapshot("http://untrusted:8790", fetchImpl)).status, "refused");
  assert.equal(calls, 0);
});

test("Only the canonical read-only snapshot route can be requested", async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, method: options.method });
    return { ok: true, json: async () => raw };
  };
  const r = await readLocalCogentiaSnapshot("http://127.0.0.1:8790", fetchImpl);
  assert.equal(r.status, "available");
  assert.deepEqual(requests, [
    { url: "http://127.0.0.1:8790/api/views/snapshot?limit=8&no_store_probe=1", method: "GET" }
  ]);
});

test("Daemon unavailable or malformed snapshot fails closed and degrades gracefully", async () => {
  assert.equal((await readLocalCogentiaSnapshot(
    "http://127.0.0.1:8790", async () => ({ ok: false }))).status, "unavailable");
  assert.equal((await readLocalCogentiaSnapshot(
    "http://127.0.0.1:8790", async () => ({ ok: true, json: async () => ({ ok: true }) }))).status,
    "unavailable");
  assert.throws(() => projectCogentiaSnapshot({ ok: true }), /unexpected_cogentia_snapshot/);
});
