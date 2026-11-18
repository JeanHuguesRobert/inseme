#!/usr/bin/env node
/**
 * Fractanet 3-node, read-only reality probe.
 *
 * Tests only one fixed deterministic Node.js expression over the existing
 * SSH aliases, with no packet upload, source mutation or third-party call.
 * ONA node observability is not conflated with COP handler admission.
 * Does not create a new runtime, registry or scheduler.
 *
 * Run from Fracta2: node packages/cop-kernel/scripts/fractarouting-three-node-preflight.js
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { projectCognitiveNextHop } from "../src/cogentiaRouter.js";

const execFileAsync = promisify(execFile);
const benignProbe = 'node -p "2+3"';
const checks = [
  { node_id: "resource://fracta2", locality: "local",
    command: "node", args: ["-p", "2+3"] },
  { node_id: "resource://i7-thinkpad-jhr", locality: "ssh-thinkpad",
    command: "ssh",
    args: ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes",
      "-o", "UpdateHostKeys=no", "-o", "ConnectTimeout=4",
      "-o", "ForwardAgent=no", "thinkpad", benignProbe] },
  { node_id: "resource://poco-jhr", locality: "ssh-termux",
    command: "ssh",
    args: ["-T", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes",
      "-o", "UpdateHostKeys=no", "-o", "ConnectTimeout=4",
      "-o", "ForwardAgent=no", "-o", "ClearAllForwardings=yes",
      "-p", "8022", "u0_a393@poco-jhr", benignProbe] },
];

const testOne = async (entry) => {
  const start = performance.now();
  try {
    const { stdout } = await execFileAsync(entry.command, entry.args, {
      timeout: 9000, maxBuffer: 2000, windowsHide: true,
    });
    return { node_id: entry.node_id, locality: entry.locality,
      diagnostic_nodejs_compute: stdout.trim() === "5",
      round_trip_ms: Math.round(performance.now() - start),
      probe: "nodejs_deterministic_arithmetic",
    };
  } catch {
    return { node_id: entry.node_id, locality: entry.locality,
      diagnostic_nodejs_compute: false, round_trip_ms: null,
      probe: "nodejs_deterministic_arithmetic", error: "connection_or_runtime_failed" };
  }
};

const nodes = await Promise.all(checks.map(testOne));
let peers = [];
let peerStatus = "unavailable";
try {
  const response = await fetch("http://127.0.0.1:8794/node/peers?fresh=0", {
    method: "GET", signal: AbortSignal.timeout(3500),
    headers: { Accept: "application/json" },
  });
  if (response.ok) {
    const snapshot = await response.json();
    if (snapshot?.node_id === "resource://fracta2" &&
        snapshot?.schema === "operium.node.peers.v1") {
      peers = Array.isArray(snapshot.peers) ? snapshot.peers : [];
      peerStatus = "available";
    }
  }
} catch {
  // No route is invented to compensate for observer failure.
}

// The three-node computation smoke probes are *not* registered COP handler
// offers. Routing a packet needs an independently observable capability offer,
// current claim/mandate and a return contract.
const packet = {
  envelope: {
    id: "packet:three-node-readonly-preflight",
    requiredCapability: "cogentia.packet.handler.v1",
    ithaca: { return_target: "continuation:three-node-preflight/result" },
    hops: [],
  },
};
const routing = projectCognitiveNextHop(packet, {
  observerNode: "resource://fracta2", peers, handlerOffers: [],
  pathTraces: [], now: new Date(),
});
const result = {
  schema: "fractanet.three_node_compute_preflight.v1",
  observed_at: new Date().toISOString(),
  observer_node: "resource://fracta2",
  mode: "read_only_diagnostic",
  measurement_limits: ["single_sample", "ssh_and_node_startup_included",
    "not_cpu_throughput", "no_cop_packet_processed"],
  nodes,
  local_ona_peer_registry: {
    status: peerStatus,
    known_count: peers.length,
    fresh_count: peers.filter(p => p.fresh === true).length,
    capabilities_seen: [...new Set(peers.flatMap(p => Array.isArray(p.capabilities)
      ? p.capabilities.filter(c => typeof c === "string") : []))].sort(),
  },
  routing: {
    status: routing.status,
    candidate_next_hop: routing.next_hop,
    reason: routing.reasons,
    packet_forwarded: false,
    cop_receipt_produced: false,
    provider_claimed: false,
  },
  note: "Successful SSH calculation does not constitute COP packet handoff or a fresh packet handler offer.",
};
console.log(JSON.stringify(result, null, 2));
if (nodes.some(n => !n.diagnostic_nodejs_compute)) process.exitCode = 2;
