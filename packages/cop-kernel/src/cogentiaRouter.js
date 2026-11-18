// File: src/cogentiaRouter.js
// Description:
//   Reusable "Cogentia router" helpers for envelope-only routing of cognitive packets.
//   This extracts the policy logic that was inline in the bac-à-sable demo
//   into a first-class, importable helper (as suggested in the SESSION_RESUME
//   parking lot and follow-ups).
//
//   Core contract (envelope-only):
//   - Router inspects only envelope fields (packetKind, routeTo, requiredCapability, riskLevel, ...)
//   - Uses CapabilityRegistry (or compatible) for canSatisfy(requiredCapability)
//   - Never touches .payload
//   - Forwards via provided bus if decision is made
//
//   This is the "method-governed routing policy" layer as a higher handler on the bus.
//   Hybrid approach (preferred): primary policy lives here (bus handlers using the helper
//   + CapabilityRegistry), while JobScheduler can be wired to consult the same registry
//   for validation during scheduling (see COPJobScheduler constructor + schedule()).
//   The bus is the neutral switching fabric; policy decisions (cop.packet.routed) can
//   influence or be reacted to by the operational scheduler.
//
//   Usage in bac-à-sable or apps:
//     import { cogentiaRoutePacket } from '@inseme/cop-kernel';
//     const decision = await cogentiaRoutePacket(cognitivePacket, {
//       registry: ctx.capabilityRegistry,
//       forwardToBus: someTopicBus,
//     });
//
//   For reactive handler style (subscribe and auto-apply):
//     const unsub = bus.subscribe('cognitive-packet', async (evt) => {
//       await cogentiaRoutePacket(evt.data, { registry, forwardToBus });
//     });

import { defaultCapabilityRegistry } from "./capabilityRegistry.js";
import { recordPacketHop } from "./Cop-kerneltasks.js";

/**
 * Core reusable router policy function.
 * Inspects *only* the envelope. Consults registry for capability satisfaction.
 * If decision is to forward and forwardToBus is provided, publishes the routed packet.
 *
 * @param {Object} pkt - the cognitive packet { envelope, payload, packetKind }
 * @param {Object} [opts]
 * @param {Object} [opts.registry] - CapabilityRegistry instance (defaults to defaultCapabilityRegistry)
 * @param {Object} [opts.forwardToBus] - bus to publish "cognitive-packet.routed" to
 * @param {string} [opts.source='cogentia-router'] - source for the forwarded event
 * @returns {Promise<Object>} decision { action: 'forwarded-to-handler' | 'no-match', capabilitySatisfied: boolean, chosenCapability?: string }
 */
export async function cogentiaRoutePacket(
  pkt,
  { registry = defaultCapabilityRegistry, forwardToBus, source = "cogentia-router" } = {}
) {
  const { envelope } = pkt || {};
  const { packetKind, routeTo, requiredCapability, riskLevel } = envelope || {};

  // These logs are useful for bac-à-sable / demo / debugging.
  // In production router handlers you may want to pass a logger or suppress.
  console.log("[COGENTIA-ROUTER] Envelope-only inspection:");
  console.log(`  packetKind=${packetKind}`);
  console.log(`  routeTo=${routeTo}`);
  console.log(`  requiredCapability=${requiredCapability}`);
  console.log(`  riskLevel=${riskLevel}`);
  // (In a real handler you might suppress these or use a passed logger.)

  const capabilityOk = !registry || registry.canSatisfy(requiredCapability);

  if (capabilityOk && requiredCapability) {
    console.log(
      `[COGENTIA-ROUTER] Decision: forward (capability '${requiredCapability}' satisfied via registry).`
    );

    const routingDecision = {
      chosenCapability: requiredCapability,
      reason: `envelope-matched-${requiredCapability}`,
      capabilitySatisfied: true,
    };

    if (forwardToBus && typeof forwardToBus.publish === "function") {
      // App-specific routed event (back-compat with demo subscriptions etc.)
      await forwardToBus.publish({
        type: "cognitive-packet.routed",
        data: pkt,
        source,
        routingDecision,
      });

      // Canonical cop.packet.* event (in addition to / as wrapper around custom types).
      // This addresses the open question in the resume: we now emit cop.packet.*
      // alongside the custom "cognitive-packet.*" so that external Cogentia routers
      // or handlers can uniformly subscribe to cop.packet.* events.
      await forwardToBus.publish({
        type: "cop.packet.routed",
        data: {
          packet: pkt,
          routingDecision,
        },
        source,
      });
    }

    const decision = {
      action: "forwarded-to-handler",
      capabilitySatisfied: true,
      chosenCapability: requiredCapability,
      reason: `envelope-matched-${requiredCapability}`,
    };
    return decision;
  }

  return { action: "no-match", capabilitySatisfied: capabilityOk };
}

/**
 * Convenience factory for a simple reactive Cogentia router "handler".
 * Returns an object with a subscribe handler you can attach to a bus.
 *
 * Example:
 *   const router = createCogentiaRouterAgent({ registry, forwardToBus });
 *   const unsub = topicBusA.subscribe('cognitive-packet', router.handler);
 *
 * The handler is async and safe to use with the improved SubBus delivery.
 */
export function createCogentiaRouterAgent({
  registry,
  forwardToBus,
  source = "cogentia-router-handler",
} = {}) {
  return {
    handler: async (evt) => {
      if (evt && evt.data) {
        await cogentiaRoutePacket(evt.data, { registry, forwardToBus, source });
      }
    },
    // You can also expose the raw policy if needed
    route: (pkt, opts) => cogentiaRoutePacket(pkt, { registry, forwardToBus, source, ...opts }),
  };
}

/**
 * Resilient Multi-Regime Packet Router.
 *
 * Implements:
 * 1. Direct Next-Hop Optimization (uses envelope.routeTo or preferred provider when healthy).
 * 2. Automatic Fallback to alternative registered capability providers if direct hop fails/unreachable.
 * 3. Fallback to Attractor Pool (cop.packet.attractor_search) if no direct provider is available.
 * 4. Store & Forward Spooling if completely partitioned/offline.
 *
 * @param {Object} pkt - The Cognitive Packet
 * @param {Object} [opts]
 * @param {Object} [opts.registry] - CapabilityRegistry instance
 * @param {Object} [opts.forwardToBus] - Bus to emit routing events to
 * @param {Function} [opts.probeNode] - async (nodeId) => boolean
 * @param {Array} [opts.spoolQueue] - Array to collect spooled packets if offline
 * @param {string} [opts.source='cogentia-resilient-router']
 * @returns {Promise<Object>} routingResult
 */
export async function routePacketResiliently(
  pkt,
  {
    registry = defaultCapabilityRegistry,
    forwardToBus = null,
    probeNode = null,
    spoolQueue = null,
    isAdmissible = null,
    isAuthorized = null,
    source = "cogentia-resilient-router",
  } = {}
) {
  if (!pkt || !pkt.envelope) {
    throw new Error("routePacketResiliently: invalid packet");
  }

  const { envelope } = pkt;
  const { routeTo, requiredCapability } = envelope;

  const diagnostics = {};
  function trackNode(nodeId, state) {
    diagnostics[nodeId] = {
      discovered: true,
      reachable: false,
      healthy: false,
      admissible: false,
      selected_or_funded: false,
      authorized: false,
      invoked: false,
      committed: false,
      ...diagnostics[nodeId],
      ...state,
    };
  }

  async function safeProbe(nodeId) {
    if (!probeNode) {
      trackNode(nodeId, { reachable: true, healthy: true });
      return true;
    }
    try {
      const ok = Boolean(await probeNode(nodeId));
      trackNode(nodeId, { reachable: ok, healthy: ok });
      return ok;
    } catch {
      trackNode(nodeId, { reachable: false, healthy: false });
      return false;
    }
  }

  async function safeAdmissible(nodeId) {
    // Check packet closure admissible_handlers if specified
    const admissibleHandlers =
      pkt.closure?.admissible_handlers ||
      pkt.envelope?.closure?.admissible_handlers ||
      pkt.envelope?.admissible_handlers;

    if (Array.isArray(admissibleHandlers) && admissibleHandlers.length > 0) {
      if (!admissibleHandlers.includes(nodeId)) {
        trackNode(nodeId, { admissible: false });
        return false;
      }
    }

    // Check optional custom isAdmissible predicate
    if (typeof isAdmissible === "function") {
      try {
        const ok = Boolean(await isAdmissible(nodeId, pkt));
        trackNode(nodeId, { admissible: ok });
        return ok;
      } catch {
        trackNode(nodeId, { admissible: false });
        return false;
      }
    }

    trackNode(nodeId, { admissible: true });
    return true;
  }

  async function safeAuthorized(nodeId) {
    const authorizedHandlers =
      pkt.closure?.authorized_handlers ||
      pkt.envelope?.closure?.authorized_handlers ||
      pkt.envelope?.authorized_handlers;

    if (Array.isArray(authorizedHandlers) && authorizedHandlers.length > 0) {
      if (!authorizedHandlers.includes(nodeId)) {
        trackNode(nodeId, { authorized: false });
        return false;
      }
    }

    if (typeof isAuthorized === "function") {
      try {
        const ok = Boolean(await isAuthorized(nodeId, pkt));
        trackNode(nodeId, { authorized: ok });
        return ok;
      } catch {
        trackNode(nodeId, { authorized: false });
        return false;
      }
    }

    trackNode(nodeId, { authorized: true });
    return true;
  }

  // 1. Direct Next-Hop Optimization
  if (routeTo) {
    trackNode(routeTo, { discovered: true });
    const isPreferredAdmissible = await safeAdmissible(routeTo);
    const isPreferredAuthorized = await safeAuthorized(routeTo);
    const isPreferredReachable = await safeProbe(routeTo);

    if (isPreferredAdmissible && isPreferredAuthorized && isPreferredReachable) {
      trackNode(routeTo, { selected_or_funded: true, invoked: true });
      recordPacketHop(pkt, {
        node_id: routeTo,
        route_reason: `direct-hop-optimization:${routeTo}`,
      });
      if (forwardToBus && typeof forwardToBus.publish === "function") {
        await forwardToBus.publish({
          type: "cop.packet.routed",
          source,
          data: { packet: pkt, method: "direct_hop", targetNode: routeTo },
        });
      }
      return {
        status: "routed_direct",
        targetNode: routeTo,
        capabilitySatisfied: true,
        diagnostics,
      };
    }

    // Direct preferred hop failed / unreachable / inadmissible / unauthorized -> Record fallback hop
    const fallbackReason = !isPreferredAdmissible
      ? `fallback:preferred-node-inadmissible:${routeTo}`
      : !isPreferredAuthorized
        ? `fallback:preferred-node-unauthorized:${routeTo}`
        : `fallback:preferred-node-unreachable:${routeTo}`;

    recordPacketHop(pkt, {
      node_id: "router",
      route_reason: fallbackReason,
    });
  }

  // 2. Alternative Provider Fallback
  // Invariant (Inseme #54, #66): provider reachable != provider admissible != provider authorized
  if (requiredCapability && registry) {
    const providers = registry.getProviders(requiredCapability);
    for (const altNode of providers) {
      trackNode(altNode, { discovered: true });
      if (altNode !== routeTo) {
        const isAltAdmissible = await safeAdmissible(altNode);
        const isAltAuthorized = await safeAuthorized(altNode);
        const isAltReachable = await safeProbe(altNode);

        if (!isAltAdmissible || !isAltAuthorized || !isAltReachable) {
          continue;
        }

        trackNode(altNode, { selected_or_funded: true, invoked: true });
        recordPacketHop(pkt, {
          node_id: altNode,
          route_reason: `fallback-provider-matched:${requiredCapability}->${altNode}`,
        });
        if (forwardToBus && typeof forwardToBus.publish === "function") {
          await forwardToBus.publish({
            type: "cop.packet.routed",
            source,
            data: { packet: pkt, method: "fallback_provider", targetNode: altNode },
          });
        }
        return {
          status: "routed_fallback",
          targetNode: altNode,
          capabilitySatisfied: true,
          chosenCapability: requiredCapability,
          diagnostics,
        };
      }
    }
  }

  // 3. Attractor Pool Broadcast
  if (forwardToBus && typeof forwardToBus.publish === "function") {
    recordPacketHop(pkt, {
      node_id: "attractor-pool",
      route_reason: `broadcast-to-attractor-pool:${requiredCapability || "general"}`,
    });
    await forwardToBus.publish({
      type: "cop.packet.attractor_search",
      source,
      data: {
        packetId: envelope.id,
        packet: pkt,
        requiredCapability,
        riskLevel: envelope.riskLevel || "read_only",
        intent: envelope.intent,
      },
    });
    return {
      status: "attractor_pool_broadcast",
      capabilitySatisfied: registry ? registry.canSatisfy(requiredCapability) : true,
      diagnostics,
    };
  }

  // 4. Store & Forward Spooling (Offline / Network Partition)
  if (Array.isArray(spoolQueue)) {
    recordPacketHop(pkt, {
      node_id: "local-spool",
      route_reason: "store-and-forward-spooled:no-active-attractor",
    });
    spoolQueue.push(pkt);
    return {
      status: "spooled_store_and_forward",
      capabilitySatisfied: false,
      spooledAt: new Date().toISOString(),
      diagnostics,
    };
  }

  return {
    status: "unroutable",
    capabilitySatisfied: false,
    reason: "no-reachable-provider-or-attractor",
    diagnostics,
  };
}

/**
 * Read-only, situated next-hop projection for the existing CPS router.
 * No global directory, dispatch, inferred auth, or synthetic attractor score.
 * Path traces must have receipt_verified=true from an independent COP
 * verifier, not merely a string that looks like a receipt reference.
 * The caller supplies local evidence from the existing capability registry,
 * node-local peer records, and (when present) COP-derived path traces.
 *
 * A "candidate" is NOT a handoff: actual packet claim, mandate, budget,
 * receipt and Ithaca custody are handled by the canonical COP machinery.
 */
export function projectCognitiveNextHop(pkt, {
  observerNode, peers = [], handlerOffers = [], pathTraces = [],
  now = new Date(), maxHops = 4,
} = {}) {
  const observedAt = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(observedAt.getTime())) throw new Error("invalid_observation_time");
  const envelope = pkt?.envelope || {};
  const packetId = String(envelope.id || "").trim();
  const required = String(envelope.requiredCapability || "").trim();
  const observer = String(observerNode || "").trim();
  const hopHistory = (Array.isArray(envelope.hops) ? envelope.hops : [])
    .map(h => String(h?.node_id || "").trim()).filter(Boolean);
  const visited = new Set(hopHistory);
  // The current node may already be recorded as the LAST received hop.
  // That is not a loop, but a return to it after visiting another node is.
  if (hopHistory.at(-1) === String(observerNode || "").trim())
    visited.delete(String(observerNode || "").trim());
  const base = {
    schema: "cop.fractarouting.next_hop_projection.v1",
    read_only: true,
    packet_ref: packetId || null,
    observer_node: observer || null,
    required_capability: required || null,
    observed_at: observedAt.toISOString(),
    status: null,
    next_hop: null,
    destination_node: null,
    source_trace_ref: null,
    candidate_basis: null,
    route_cost_ms: null,
    execution_authorized: null,
    claim_acquired: false,
    packet_forwarded: false,
    reasons: [],
  };
  const result = (status, reasons = [], candidate = {}) =>
    ({ ...base, status, reasons, ...candidate });

  if (!packetId || !observer || !required)
    return result("unclassified", ["missing_packet_identity_observer_or_required_capability"]);
  if (!Number.isSafeInteger(maxHops) || maxHops < 1 ||
      hopHistory.length >= maxHops || visited.has(observer))
    return result("park_no_route", ["hop_budget_or_loop_exhausted"]);

  const allowedHandlers = envelope.closure?.admissible_handlers ??
    envelope.admissible_handlers;
  const allowed = new Set(Array.isArray(allowedHandlers) ? allowedHandlers : []);
  const permits = (node) => !allowed.size || allowed.has(node);
  const evidenceFresh = (entry) => {
    const at = Date.parse(String(entry?.last_seen || entry?.observed_at || ""));
    const ttl = Number(entry?.ttl_seconds);
    const age = observedAt.getTime() - at;
    return Number.isFinite(at) && Number.isFinite(ttl) && ttl > 0 &&
      Number.isFinite(age) && age >= 0 && age <= ttl * 1000;
  };
  const offers = handlerOffers.filter(h => h?.available === true &&
    Array.isArray(h.capabilities) && h.capabilities.includes(required) &&
    typeof h.node_id === "string" && h.node_id.length > 0 &&
    typeof h.evidence_ref === "string" && h.evidence_ref.length > 0 &&
    evidenceFresh(h) && permits(h.node_id));
  if (offers.some(h => h.node_id === observer)) {
    return result("local_handler_candidate", ["locality_first", "claim_and_mandate_unverified"], {
      next_hop: observer, destination_node: observer,
      candidate_basis: "current_local_capability_offer",
    });
  }
  // Each peer is locally observed; even a fresh ONA endpoint is not itself
  // evidence of a packet processing handler.
  const adjacent = peers.filter(p => p?.fresh === true && p.node_id !== observer &&
    !visited.has(p.node_id) && evidenceFresh(p));
  const neighborIds = new Set(adjacent.map(p => p.node_id));
  const candidateRoutes = [];

  for (const offer of offers) {
    if (visited.has(offer.node_id) || offer.node_id === observer) continue;
    if (neighborIds.has(offer.node_id)) {
      candidateRoutes.push({ next_hop: offer.node_id,
        destination_node: offer.node_id, candidate_basis: "direct_capability_offer",
        source_trace_ref: null, route_cost_ms: null });
    }
    for (const trace of pathTraces) {
      if (!trace || trace.capability !== required ||
          trace.destination_node !== offer.node_id ||
          !neighborIds.has(trace.next_hop) ||
          !trace.receipt_ref || trace.receipt_verified !== true ||
          trace.success !== true || !evidenceFresh(trace) ||
          visited.has(trace.next_hop) ||
          !permits(trace.destination_node)) continue;
      candidateRoutes.push({
        next_hop: trace.next_hop, destination_node: offer.node_id,
        candidate_basis: "cop_receipt_path_trace",
        source_trace_ref: String(trace.receipt_ref).slice(0, 180),
        route_cost_ms: Number.isFinite(trace.total_ms) && trace.total_ms >= 0 ?
          trace.total_ms : null,
      });
    }
  }
  if (!candidateRoutes.length)
    return result("park_no_route", [
      "no_fresh_evidenced_next_hop_for_required_capability",
      "local_and_remote_packet_handlers_not_inferred_from_ssh_or_ona",
    ]);
  // No fabricated cost: measured paths precede unmeasured direct offers,
  // then stable names break ties deterministically. No permanent monopoly
  // is established: traces expire and discovery retains alternatives.
  candidateRoutes.sort((a, b) =>
    (a.route_cost_ms === null ? 1 : 0) - (b.route_cost_ms === null ? 1 : 0) ||
    (a.route_cost_ms ?? 0) - (b.route_cost_ms ?? 0) ||
    a.next_hop.localeCompare(b.next_hop) ||
    a.destination_node.localeCompare(b.destination_node));
  return result("next_hop_candidate", ["needs_governed_claim_and_transfer_ack"], candidateRoutes[0]);
}

export default {
  cogentiaRoutePacket,
  createCogentiaRouterAgent,
  routePacketResiliently,
  projectCognitiveNextHop,
};
