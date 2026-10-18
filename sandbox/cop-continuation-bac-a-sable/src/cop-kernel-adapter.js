/**
 * cop-kernel-adapter.js
 *
 * Pont vers le vrai cop-kernel.
 *
 * Philosophie : on essaie d'utiliser le maximum de code réel dès que possible
 * pour faire converger COP et Cogentia et faciliter l'implémentation réelle.
 * Quand quelque chose ne marche pas encore dans cop-kernel, on le signale clairement.
 */

import { COPBus, defaultBus, createFractanetBus } from "../../../packages/cop-kernel/src/bus.js";

import { COPScheduler, defaultScheduler } from "../../../packages/cop-kernel/src/scheduler.js";

import { COPJobScheduler } from "../../../packages/cop-kernel/src/jobScheduler.js";

import {
  CapabilityRegistry,
  defaultCapabilityRegistry,
} from "../../../packages/cop-kernel/src/capabilityRegistry.js";

import { cogentiaRoutePacket } from "../../../packages/cop-kernel/src/cogentiaRouter.js";

let realCall, realResume;

try {
  const mod = await import("../../../packages/cop-kernel/src/call.js");
  realCall = mod.callAgentWithContinuation;
  realResume = mod.resumeContinuationAndSend;
  console.log(
    "[ADAPTER] Vrai code cop-kernel chargé avec succès (bus + scheduler + jobScheduler inclus)."
  );
} catch (e) {
  console.warn("[ADAPTER] Impossible de charger certains modules de cop-kernel :", e.message);
}

// Create a default JobScheduler projection wired to the low-level components.
// CognitivePacket remains the work identity; this object only projects Packet/Continuation
// work into time/backoff/obsolescence scheduling state.
// Hybrid wiring: we also pass the capabilityRegistry so that JobScheduler can consult
// policy decisions (e.g. requiredCapability satisfaction) during scheduling/obsolescence.
// The primary Cogentia routing policy still lives as a higher handler on the bus (via
// cogentiaRoutePacket / createCogentiaRouterAgent); the scheduler can react to or
// validate using the same registry without becoming the routing authority.
const defaultJobScheduler = new COPJobScheduler({
  scheduler: defaultScheduler,
  bus: defaultBus,
  capabilityRegistry: defaultCapabilityRegistry,
  routingPolicy: cogentiaRoutePacket, // wire the reusable helper for deeper hybrid policy inside scheduling
  // store is intentionally left undefined for now (in-memory only).
  // When persistence is added to the kernel, it can be injected here.
});

export {
  COPBus,
  defaultBus,
  createFractanetBus,
  COPScheduler,
  defaultScheduler,
  COPJobScheduler,
  defaultJobScheduler,
};

// Helper so scenarios can easily get per-topic buses from the default scheduler
export function getBusForTopic(topicId) {
  return defaultScheduler.getBusForTopic(topicId);
}

export async function callAgentWithContinuationInSandbox(params) {
  const hasEndpoint = params.endpoint || params.baseUrl;

  if (realCall && hasEndpoint) {
    console.log(
      "[ADAPTER] Utilisation de callAgentWithContinuation (vrai cop-kernel + transport réel)"
    );
    return realCall(params);
  }

  if (realCall && !hasEndpoint) {
    console.log(
      "[ADAPTER] Vrai code cop-kernel disponible, mais mode bac-à-sable (pas de endpoint) → création du descriptor seulement via logique interne"
    );
    // On peut quand même créer le descriptor pour tester la convergence
    const { createContinuationDescriptor } =
      await import("../../../packages/cop-kernel/src/continuation.js");
    const cont = createContinuationDescriptor(params);
    return {
      ok: true,
      continuation: cont,
      note: "descriptor créé via vrai cop-kernel (sans envoi réseau)",
    };
  }

  console.log("[ADAPTER] Fallback local complet");
  return {
    ok: true,
    continuation: {
      continuationId: "cont-fallback-" + Date.now(),
      resumeTo: params.resumeTo,
      resumeIntent: params.resumeIntent,
      correlationId: params.correlationId,
      state: params.payload || {},
    },
  };
}

export async function resumeContinuationInSandbox(params) {
  if (realResume) {
    console.log("[ADAPTER] Utilisation de resumeContinuationAndSend (vrai cop-kernel)");
    return realResume(params);
  }

  console.log("[ADAPTER] Fallback local pour reprise");
  return { ok: true };
}

// Re-export the cognitive packet envelope+payload helper and lifecycle functions for bac-à-sable scenarios
// to experiment with "Cognitive Packet Switching" / Reality test round trips
// (see cogentia/research/cognitive_packet_switching.md and inseme#54).
export {
  asCognitivePacket,
  recordPacketHop,
  markPacketSolved,
  markPacketReturned,
  markPacketAssimilated,
  reconstructOdyssey,
} from "../../../packages/cop-kernel/src/Cop-kerneltasks.js";

// Lightweight capability registry stub (for router policy decisions based on
// envelope.requiredCapability). In-memory by default; resettable.
// A future real impl could delegate to agentRegistry + capabilities from cop_agents.
export {
  CapabilityRegistry,
  defaultCapabilityRegistry,
} from "../../../packages/cop-kernel/src/capabilityRegistry.js";

// Reusable Cogentia router helpers (the extracted policy function + agent factory).
// Now first-class so it can be used outside the demo, wired to JobScheduler, etc.
export {
  cogentiaRoutePacket,
  createCogentiaRouterAgent,
} from "../../../packages/cop-kernel/src/cogentiaRouter.js";
