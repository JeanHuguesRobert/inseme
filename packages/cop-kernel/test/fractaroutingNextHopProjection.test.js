import test from "node:test";
import assert from "node:assert/strict";
import { projectCognitiveNextHop } from "../src/cogentiaRouter.js";

const now = new Date("2026-11-18T08:00:00.000Z");
const origin = "resource://fracta2";
const thinkpad = "resource://i7-thinkpad-jhr";
const phone = "resource://poco-jhr";
const packet = {
  envelope: { id: "packet:synthetic-routing-diagnostic",
    requiredCapability: "nodejs.compute.diagnostic",
    ithaca: { return_target: "continuation:synthetic/result" }, hops: [] },
  payload: { private_material: "never-emit-or-inspect" },
};
const offer = (node_id) => ({
  node_id, available: true, capabilities: ["nodejs.compute.diagnostic"],
  evidence_ref: "diag:measured-nodejs-exec",
  observed_at: "2026-11-18T07:59:20Z", ttl_seconds: 180,
});
const peer = (node_id) => ({
  node_id, fresh: true, last_seen: "2026-11-18T07:59:50Z",
  ttl_seconds: 300, capabilities: ["operium.node.v1"],
});
const project = (opts = {}, pkt = packet) => projectCognitiveNextHop(pkt, {
  observerNode: origin, now, ...opts,
});

test("Three nodes known from Tailscale/SSH do not fabricate Cognitive Packet handlers", () => {
  const peers = [peer(thinkpad), peer(phone)];
  const input = { peers, handlerOffers: [] };
  const before = JSON.stringify([packet, input]);
  const output = project(input);
  assert.equal(output.status, "park_no_route");
  assert.equal(output.next_hop, null);
  assert.equal(output.packet_forwarded, false);
  assert.equal(output.execution_authorized, null);
  assert.equal(output.claim_acquired, false);
  assert.ok(output.reasons.includes("no_fresh_evidenced_next_hop_for_required_capability"));
  assert.equal(JSON.stringify([packet, input]), before);
  assert.ok(!JSON.stringify(output).includes("never-emit-or-inspect"));
});

test("An independently observed local handler is preferred before offloading", () => {
  const out = project({ handlerOffers: [offer(origin), offer(thinkpad)],
    peers: [peer(thinkpad)] });
  assert.equal(out.status, "local_handler_candidate");
  assert.equal(out.next_hop, origin);
  assert.equal(out.packet_forwarded, false);
});

test("A fresh adjacent capability offer becomes next-hop candidate, never execution", () => {
  const out = project({ handlerOffers: [offer(thinkpad)], peers: [peer(thinkpad)] });
  assert.equal(out.status, "next_hop_candidate");
  assert.equal(out.next_hop, thinkpad);
  assert.equal(out.destination_node, thinkpad);
  assert.equal(out.candidate_basis, "direct_capability_offer");
  assert.equal(out.route_cost_ms, null);
  assert.equal(out.claim_acquired, false);
  assert.equal(out.execution_authorized, null);
});

test("Expired local advert, stale peer and missing receipt exclude candidates", () => {
  const stale = { ...peer(thinkpad), last_seen: "2026-11-18T07:40:00Z" };
  assert.equal(project({ handlerOffers: [offer(thinkpad)], peers: [stale] }).status,
    "park_no_route");
  const expired = { ...offer(thinkpad), observed_at: "2026-11-18T07:40:00Z" };
  assert.equal(project({ handlerOffers: [expired], peers: [peer(thinkpad)] }).status,
    "park_no_route");
  const unproved = { ...offer(thinkpad), evidence_ref: null };
  assert.equal(project({ handlerOffers: [unproved], peers: [peer(thinkpad)] }).status,
    "park_no_route");
});

test("A receipt-backed two-hop path can point to a capability beyond next neighbor", () => {
  const pathTrace = {
    next_hop: thinkpad, destination_node: phone,
    capability: "nodejs.compute.diagnostic",
    receipt_ref: "cop:receipt:measured-test", receipt_verified: true,
    success: true, total_ms: 81,
    observed_at: "2026-11-18T07:59:00Z", ttl_seconds: 300,
  };
  const out = project({ handlerOffers: [offer(phone)], peers: [peer(thinkpad)],
    pathTraces: [pathTrace] });
  assert.equal(out.status, "next_hop_candidate");
  assert.equal(out.next_hop, thinkpad);
  assert.equal(out.destination_node, phone);
  assert.equal(out.candidate_basis, "cop_receipt_path_trace");
  assert.equal(out.source_trace_ref, pathTrace.receipt_ref);
  assert.equal(out.route_cost_ms, 81);
  const noEvidence = project({ handlerOffers: [offer(phone)], peers: [peer(thinkpad)],
    pathTraces: [{ ...pathTrace, receipt_ref: undefined }] });
  assert.equal(noEvidence.status, "park_no_route");
  const notVerified = project({ handlerOffers: [offer(phone)], peers: [peer(thinkpad)],
    pathTraces: [{ ...pathTrace, receipt_verified: false }] });
  assert.equal(notVerified.status, "park_no_route");
});

test("Loop, hop budget and closure restrictions stop speculative forwarding", () => {
  const opts = { handlerOffers: [offer(thinkpad)], peers: [peer(thinkpad)] };
  assert.equal(project(opts, { envelope: { ...packet.envelope,
    hops: [{ node_id: thinkpad }] } }).status, "park_no_route");
  assert.equal(project({ ...opts, maxHops: 0 }).status, "park_no_route");
  assert.equal(project(opts, { envelope: { ...packet.envelope,
    closure: { admissible_handlers: [phone] } } }).status, "park_no_route");
});

test("The last received hop may be the observer; earlier revisits still stop", () => {
  const opts = { handlerOffers: [offer(thinkpad)], peers: [peer(thinkpad)] };
  const arrived = project(opts, { envelope: { ...packet.envelope,
    hops: [{ node_id: origin }] } });
  assert.equal(arrived.status, "next_hop_candidate");
  const reentered = project(opts, { envelope: { ...packet.envelope,
    hops: [{ node_id: origin }, { node_id: phone }] } });
  assert.equal(reentered.status, "park_no_route");
  const outOfBudget = project({ ...opts, maxHops: 1 }, { envelope: { ...packet.envelope,
    hops: [{ node_id: origin }] } });
  assert.equal(outOfBudget.status, "park_no_route");
});

test("Wrong packet identity, absent capability and future observations never route", () => {
  assert.equal(project({}, { envelope: { requiredCapability: "nodejs.compute.diagnostic" } }).status,
    "unclassified");
  assert.equal(project({}, { envelope: { id: "packet:without-cap" } }).status,
    "unclassified");
  const future = { ...peer(thinkpad), last_seen: "2026-11-18T09:01:00Z" };
  assert.equal(project({ handlerOffers: [offer(thinkpad)], peers: [future] }).status,
    "park_no_route");
});
