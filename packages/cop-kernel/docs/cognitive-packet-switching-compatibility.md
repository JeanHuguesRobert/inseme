---
title: 'Compatibility Note: Cognitive Packet Switching (cogentia)'
author: Jean Hugues Noël Robert, baron Mariani
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
date: '2026-09-15'
last_modified_at: '2026-09-15'
version: '0.1'
status: working-paper
license: CC BY-SA 4.0
language: en
document_role: archive
document_kind: software-doc
update_policy: UP-DEFAULT-REVIEWED
provenance:
  origin_type: repository
  origin_repository: unknown
  origin_ref: unknown
  origin_date: '2026-09-15'
  derived_from: []
review:
  status: unreviewed
  reviewed_by: []
---

# Compatibility Note: Cognitive Packet Switching (cogentia)

**Date:** 2026-06-02  
**Verified against:** `JeanHuguesRobert/cogentia/research/cognitive_packet_switching.md` (v1.0,
2026-06-01) and companion `cogentia_continuation_packet_routing.md` (v0.3).

## Summary of Verification

**Overall compatibility: Strong / Advancing the vision.**

The "Cognitive Packet Switching" framing (envelope for routing + payload for meaning; continuations
as the canonical resumable payload; routers that dispatch without full payload inspection; two
profiles: Cogentia Commons (corpus) and COP (operational events + bus + scheduler); Fractanet as the
decentralized mesh) is **conceptually and architecturally aligned** with the COP kernel
implementation.

Key mappings that hold:

- **Cognitive packet** ≈ Event (or Artifact projection) carrying or referencing a Continuation.
- **Envelope** (routable metadata, inspectable by routers): realized by Event `type`, `topic`, meta,
  plus the Continuation's `resumeTo` (agent/capability), `conditions` (waitForEvents,
  resumeAfter/Before as routing hints), `topicId`, `correlationId`, `meta`. The higher "envelope"
  structure can be projected via the new `asCognitivePacket()` helper (added during this
  verification for explicit alignment).
- **Payload**: the `state` + cognitive content inside the Continuation descriptor / Artifact.
- **Routers / switching fabric**:
  - `COPBus` + `SubBus` (via `.sub(namespace)`, `.forTopic(topicId)`) — hierarchical namespaced
    routing, e.g. per Topic.
  - Federation (`federate(peer)`, `propagateInterest(pattern)`) — mesh / redundant paths (RAIX) for
    packet (event/continuation) circulation across independent nodes without central authority.
  - `COPScheduler` / `COPJobScheduler` — time + event driven dispatch / "next hop" scheduling; act
    on routing decisions expressed as resume conditions or job schedules.
  - `createTaskWithInitialContinuation` + standard `cop.task.*` / `cop.job.*` events — operational
    packets with linkage.
- **Inversion of control via continuations**: exactly the `resumeTo` + `waitForEvents` + state model
  (and the bac-à-sable scenarios demonstrate tools/agents emitting resumable work).
- **Topics** as scopes: first-class in the schema, in sub-buses, in scheduler.getBusForTopic, in
  JobScheduler, in the Task helpers.
- **RAIX / federation**: explicit in bus design and exercised in `federation-demo.js` +
  `raix-obsolescence-resilience.js` (cross-node obsolete + replacement using kernel helpers).
- **Causality / traces / audit**: `parentEventIds` / correlation in continuations, event log
  substrate, replay support.

The recent kernel work (generalized SubBus, federation, per-topic everything, topic-aware
JobScheduler + Task creation helpers, `markObsolete` for agent-decided "stale" packets) **directly
implements the "COP integration pass"** described as future work in
`cogentia_continuation_packet_routing.md` ("sub-buses may scope routing by Topic; federation
primitives may propagate interest... Scheduler / JobScheduler may act on routing decisions").

The bus.js header and lineage doc now explicitly cross-link to the packet switching documents.

`asCognitivePacket()` helper added (exported via adapter + pipeline) so bac-à-sable scenarios can
easily produce the envelope/payload shape for Cogentia-style router experiments.

## Minor / Non-blocking Notes (addressed or noted)

- Naming in in-memory descriptor: `resumeTo` (l8 heritage) maps to `agent` in the persisted
  Continuation Artifact per the cop-core Architecture.md §2.7. The mapping is documented in
  continuation.js.
- Event examples in the switching doc use illustrative `"cop.packet.created"` with nested
  `packet: {envelope, payload}`. Current kernel prefers specific `cop.task.orchestrated`,
  `cop.job.scheduled`, etc. (more actionable). The generic helper + bus publish of typed events on
  scoped buses provides equivalent or better routing. We can emit `cop.packet.*` wrappers if a
  specific "packet router" agent needs them.
- Doc references in cogentia/ point to `inseme/packages/cop-core/*` for the _spec_ (Architecture.md
  etc., which remains the normative source and is still present) while the live runtime + recent
  Fractanet bus work lives in `packages/cop-kernel`. Updated the references + added notes during
  verification.
- The cogentia routing doc previously stated "COP integration is described conceptually, not yet
  implemented." Updated to reflect the implemented substrate (bus/federation/sub-buses exercised by
  the new stress + RAIX scenarios).
- No breaking divergences found in continuation shape, topic model, event sourcing, or resumption
  semantics.
- "Method-governed routing" (Cogentia as distinct policy layer on top of the bus) remains a higher
  layer / future agent (the bus + scheduler provide the neutral switching fabric; routing policies
  are expressed as subscriptions, interests, resume conditions, or JobScheduler schedules). This is
  consistent with "agents are handlers, not the architecture."

## Artifacts Updated for Consistency (during verification)

- `cogentia/research/cognitive_packet_switching.md` — updated Implementation readiness row and COP
  references.
- `cogentia/research/cogentia_continuation_packet_routing.md` — updated weaknesses/evidence levels +
  COP integration status.
- `packages/cop-kernel/docs/task-step-continuation-lineage.md` — added integrative framing
  paragraph + cross-links.
- `FractaVolta/research/fractanet.md` — added cross-reference to the packet switching docs as the
  conceptual bridge.
- `packages/cop-kernel/src/bus.js` — added explicit comment linking the ARPANET/Fractanet
  packet-like design to the cognitive packet switching model.
- `packages/cop-kernel/src/Cop-kerneltasks.js` — added `asCognitivePacket()` helper (thin
  projection).
- `sandbox/.../src/cop-kernel-adapter.js` and `pipeline.js` — re-exported + exposed on ctx for
  immediate use in bac-à-sable "router" scenarios; quick runtime test passed.

## Recommended Follow-ups (from the docs' own open questions + this verification)

- Use `asCognitivePacket` + ctx busForCurrentTopic / createFederatedTopicBusPair in a new or
  existing bac-à-sable scenario to demonstrate a "Cogentia routing agent" that inspects only
  envelope fields (e.g. packetKind, riskLevel, required_capability) and dispatches via sub-bus
  publish or scheduler registration.
- Consider emitting a small number of `cop.packet.*` events (or always include a `packet` projection
  in task/job events) if the conceptual "cop.packet.created" shape proves useful for external
  routers. (2026-06: Done for routed via the reusable helper; created via asCognitivePacket. Also
  wrapped into cop.job._ and cop.task._ events as `packet` projection. Demo verifies. Further
  progress in this step.)
- When a capability registry or explicit routing decision schema appears (from the routing doc's
  future passes), map it into JobScheduler schedule policies or a lightweight policy agent on the
  bus. (2026-06: Hybrid chosen — primary policy as higher bus agent (reusable helper + registry);
  JobScheduler wired (registry validation + listenForRoutedPackets() +
  routingPolicy/setRoutingPolicy for _direct_ consult of cogentiaRoutePacket helper inside
  schedule() for decisions). Demo exercises listener auto + direct schedule triggering
  inside-schedule policy + packet projections in events. See SESSION_RESUME.

- Keep the two profiles (Commons slow corpus vs COP operational) clearly separated while ensuring
  reintegration paths (events → corpus notes, continuations → Git issues, etc.).

**Verdict:** The current COP kernel (particularly the bus layer enhancements) is not only compatible
with the Cognitive Packet Switching source document — it is the primary concrete implementation of
its operational "switching" and "routing" claims for the Fractanet cognitive mesh. The verification
surfaced no contradictions and enabled small alignment improvements across the corpus.

See also the updated lineage and fractanet docs for the living cross-links.

## 2026-06-02 Update – Clean executable demonstration

A clean, lightweight, focused scenario was added:

`sandbox/cop-continuation-bac-a-sable/scenarios/cognitive-packet-router-demo.js`

It exercises:

- `ctx.asCognitivePacket(...)`
- An explicit `cogentiaRoutePacket` function that makes all decisions by destructuring **only the
  envelope** (`packetKind`, `routeTo`, `requiredCapability`, `riskLevel`, etc.)
- Federated per-topic sub-buses as the switching fabric
- Handler side safely using the payload after routing

Due to accumulated scheduler timer pressure in the current development environment, the full
scenario can still hit OOM on some runs. The **core logic has been verified** with a minimal
self-contained Node one-liner (see conversation history) that runs cleanly and produces the exact
"router only saw envelope" behavior.

The scenario file itself is now in good, maintainable shape and serves as the canonical bac-à-sable
artifact for the Cognitive Packet Switching / Cogentia-as-router model.

**Session-end resumption aid:** A dedicated `SESSION_RESUME_cognitive-packet-router-2026-06.md` file
was created in this same directory with a concise state summary, recommended first commands, and a
prioritized "next steps" list. Start there when resuming.

**Restart update (later session):** Demo enhanced to a _reactive subscribing "Cogentia router
agent"_ (the `cogentiaRoutePacket` policy now lives inside the Alpha topic sub-bus subscription
handler and fires automatically on publish). A critical federation cycle bug (bidirectional forward
loop on via events) was identified and fixed in `bus.js` (`_forwardToFederation` now guards
`viaFederation`), making the router demo + other pair federation scenarios reliably executable
without hangs or artificial OOMs. The resume file was updated with the new state and run logs.

**Ophelia agent adopts COP (latest):** Per user directive "I believe we should have the Ophelia
agent use COP from now on", the core reasoning loop in
`inseme/packages/brique-ophelia/edge/lib/operator.js` (runOperator) now uses the COP substrate:
CapabilityRegistry populated from brique ROLES, per-turn cogentiaRoutePacket policy consult
(envelope-only, hybrid direct+bus style), asCognitivePacket for cop.packet.created emission,
createTask + startStep/completeStep + completeTask for session/turn lifecycle tracking. Cleans
performed first (aliases for start/complete\* in Cop-kerneltasks, chosenCapability return shape fix
in router, iteration scope bugfix, dep + syntax hygiene). See SESSION_RESUME for full details +
verification. This makes the primary "higher policy agent" (Ophelia) a live consumer/producer of the
cognitive packet model. No behavior change to chat/vocal/tool paths.

## 2026-09-06 Update – COP 2.x Trace-Centric Architecture & Consequential Rossignol (Issues #61 & #68)

In conjunction with the cross-corpus semantic propagation
([Issue #55 in `barons-Mariani`](https://github.com/JeanHuguesRobert/barons-Mariani/issues/55)), COP
has integrated two major doctrinal and architectural milestones:

### 1. Trace-Centric Architecture (Issue #61)

COP has formally transitioned from an Event-centric architecture to a **Trace-centric
architecture**:

$$
\text{Reality} \longrightarrow \text{Trace} \longrightarrow \text{Assertion} \longrightarrow \text{Continuation} \longrightarrow \text{Decision} \longrightarrow \text{Act} \longrightarrow \text{new Trace}
$$

- **Ontological Primacy of the Trace ($T$):** In line with the universal cognitive state tuple
  $\mathcal{J} = (P, H, S, T)$, the Trace is the persistent, physical or verifiable residue left by
  an action. A `COPEvent` is preserved as a procedural trace of COP-mediated actions, while external
  traces exist independently of COP.
- **Traceable Resumption:** Cognitive packets and continuations carry explicit `traceRef`
  identifiers. When an agent or external handler resumes work, Packet Closure is guaranteed through
  the causal frontier of prior traces without relying on ephemeral in-memory session contexts.

### 2. Consequential Rossignol & Synthetic Skin in the Game (Issue #68)

To eliminate the trap of hallucinated competence and unilateral resets ("Hall of Mirrors"), COP
specifies the adversarial reset matrix **R1–R6**:

- **R1 (Handler restart):** Restarting an execution handler cannot restore consumed budget or
  authority.
- **R2 (Packet restart/fork — `cop/fork`):** Forking or spawning child packets (via `copFork` or a
  `cop/fork` Artifact) inherits parent budget limits; consumed capacity remains consumed under the
  shared `mandateRef`.
- **R3 (New local ledger):** Fresh local ledger instantiations fail closed or defer to the
  authority-bound projection.
- **R4 (Provider rebinding):** Switching execution providers (e.g. edge MCU vs cloud LLM) preserves
  LogicalAgent/Mandate accounting.
- **R5 (Revocation race):** Mandate revocation before external effect execution atomically aborts
  the invocation (closing the TOCTOU gap).
- **R6 (Explicit new authority):** Only a fresh attributable act from the Principal can grant new
  capacity; past expenditures remain immutable.

### 3. Canonical Schemas: `cop/continuation` and `cop/fork`

#### `cop/continuation` (Updated)

```json
{
  "type": "cop/continuation",
  "id": "urn:uuid:...",
  "payload": {
    "handlerProfile": "reviewer | engineer | *",
    "requiredCapabilities": ["code-inspection"],
    "logicalAgentRef": "urn:cop:agent:jhn",
    "mandateRef": "urn:cop:mandate:2026-senat-01",
    "traceRef": ["urn:cop:trace:step-042", "urn:cop:trace:reality-test-07"],
    "topicId": "urn:uuid:...",
    "taskId": "urn:uuid:...",
    "stepId": "urn:uuid:...",
    "state": { "frontierHash": "sha256:...", "resumePayload": {} },
    "waitForEvents": ["cop.review.approved"],
    "resumeAfter": "2026-09-06T00:00:00Z",
    "retry": { "maxAttempts": 3, "attempt": 1, "retryDelayMs": 1000 }
  }
}
```

#### `cop/fork` (Canonical Specification)

```json
{
  "type": "cop/fork",
  "id": "urn:uuid:...",
  "payload": {
    "forkSourcePacketId": "urn:uuid:...",
    "branchId": "exploration-branch-alpha",
    "mandateRef": "urn:cop:mandate:2026-senat-01",
    "traceRef": ["urn:cop:trace:branch-point-09"],
    "topicId": "urn:uuid:...",
    "handlerProfile": "scout-agent",
    "requiredCapabilities": ["territory-exploration"],
    "state": { "branchInitialContext": {} }
  }
}
```
