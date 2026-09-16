// File: packages/cop-kernel/src/index.js
// Description: Entry point for COP kernel implementation; re-exports helpers and registries.

export * from "./address.js";
export * from "./message.js";
export * from "./validation.js";
export * from "./nodeRegistry.js";
export * from "./handlerRegistry.js";
export * from "./handlerContext.js";
export * from "./handlers.js";
export * from "./logicalAgentIdentity.js";
export * from "./debugLog.js";
export * from "./env.js";
export * from "./events.js";
export * from "./artifacts.js";
export * from "./runtimeModel.js";

// Task / Step / Continuation orchestration helpers (generic foundation)
// These provide the reusable Task/Step lifecycle + tight integration with
// Continuations and JobScheduler so that apps and briques do not have to
// reinvent coordination logic at their level.
export * from "./Cop-kerneltasks.js";

// New for priority C (minimal bus + scheduler)
export * from "./bus.js";
export * from "./scheduler.js";

// Continuation helpers (restored as part of priority B)
export * from "./continuation.js";
export * from "./call.js";

// Higher-level Job Scheduler (cron-like, with exponential backoff + obsolescence)
// See lineage in jobScheduler.js: l8 Task/Step scheduler → COP → future Inox implementation.
export * from "./jobScheduler.js";

// Capability registry stub for Cogentia-style envelope routing decisions
// (inspects requiredCapability etc. without touching payload).
export * from "./capabilityRegistry.js";

// Reusable Cogentia router policy helpers (envelope-only + capability registry).
// Extracted as first-class reusable helpers (see SESSION_RESUME follow-ups).
export * from "./cogentiaRouter.js";

// Timing & performance measurement helpers (wall time, CPU, human reaction times)
export * from "./timing.js";

// Stdio helpers for emitting/parsing continuation packets from any tool (data plane vs control plane).
// Enables the "any tool can be a COP node" / Cogitor pattern + simple pipeable runners.
// Primary factory: createReadlineCogitor (a Cogitor cogitates on cognitive packets + continuations + control plane).
export * from "./stdio.js";

// Cogitor-level cooperation helpers (fork/join, parent/child flows, merge for multiple subs).
// Extends core with user-friendly APIs matching l8 Task parent/child + join patterns,
// but operating at Cogitor level (using stack-calls + attached continuations for sub-invocations,
// result delivery as closures, control for supervision, waitForEvents, runner orchestration).
// See lineage doc for comparison to l8 Parole/Water/Fluid/Tasks + motivation.
export * from "./cogitorCooperation.js";

// COP/Accounting day-one conformance kernel (v1.0)
// Provides exact quantity arithmetic, event validation, and deterministic projection.
// See accounting/README.md for conformance tests and usage.
export * from "./accounting/index.js";

// FractaBlog projections derived from Cognitive Packet Ground Truth
export * from "./projections/fractaBlog.js";

// Packet-Backed Projection for Interaction Cases (Inseme #77)
export * from "./projections/interactionCase.js";

// Cognitive Packet Composition combinators (copFork, copAll, copRace, copSequence, copCascadeCancel)
export * from "./copComposition.js";
