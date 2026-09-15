---
title: COOP — Tutorial and Near-Specification
subtitle: Cognitive Orchestration Protocol (COP) kernel, cognitive packet router, reusable policy helpers, hybrid layer, and bac-à-sable usage — sufficient for extension, integration, or re-implementation
version: '0.1'
status: working-paper — tutorial / near-functional specification
date: '2026-06-04'
author: Jean Hugues Noël Robert, baron Mariani
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
license: CC BY-SA 4.0
language: en
target_implementation: inseme/packages/cop-kernel (post 2026-06 cognitive packet router work)
derived_by: agent
derived_from: inseme/packages/cop-kernel/src/* (cogentiaRouter.js, capabilityRegistry.js, jobScheduler.js, bus.js, Cop-kerneltasks.js, scheduler.js, etc.); inseme/sandbox/cop-continuation-bac-a-sable/* (cognitive-packet-router-demo.js, pipeline.js, cop-kernel-adapter.js, index.js); inseme/packages/cop-kernel/docs/SESSION_RESUME_cognitive-packet-router-2026-06.md and related docs (cognitive-packet-switching-compatibility.md); the cognitive packet router, hybrid policy, emission, and reusable helper work
tags:
  - cop
  - coop
  - cognitive-orchestration-protocol
  - packet-router
  - tutorial
  - specification
  - reusable-helper
  - hybrid-policy
  - capability-registry
  - bac-a-sable
  - cogentia
related_projects:
  - Inseme
  - COP
  - Cogentia Commons
  - Cognitive Packets
  - Continuation Protocol
ai_assisted_by:
  - Grok
canonical_url: https://github.com/JeanHuguesRobert/inseme/blob/main/research/coop_tutorial.md
last_stamped_at: 2026-06-04T00:00:00.000Z
corpus_role: derived
derived_product_type: tutorial
document_role: derived
document_kind: derived-product
visibility: public
lifecycle_state: working
classification_source: cogentia.js
classification_version: '1'
classification_rule: derived-product
classification_confidence: strong
update_policy: UP-DEFAULT-REVIEWED
review:
  status: unreviewed
  reviewed_by: []
provenance:
  origin_type: unknown
  origin_repository: unknown
  origin_ref: unknown
  origin_date: unknown
  derived_from: []
---


> **Auto-generated tutorial.** This document was produced from the live COP kernel sources
> (inseme/packages/cop-kernel), the bac-à-sable scenarios/pipeline/adapter (post 2026-06 restart
> work on the cognitive packet router), the SESSION_RESUME, the implemented helpers
> (cogentiaRoutePacket, createCogentiaRouterAgent, CapabilityRegistry), the hybrid policy layer, the
> event emissions, and the corpus doctrinal papers (see _Associated documents_ below). It is
> _descriptive of the current implementation_ and _prescriptive enough_ to seed extensions,
> integrations, or faithful re-implementations in another runtime. Treat observed behaviour in the
> reference (the demo + kernel) as authoritative where prose is ambiguous; treat documented
> invariants as load-bearing.

---

## Object and associated documents

### Object of this document

This tutorial combines three roles:

- A **tour** of the COP (Cognitive Orchestration Protocol) kernel implementation in
  inseme/packages/cop-kernel, with focus on the cognitive packet router work.
- A **workflow handbook** for practical use in the bac-à-sable and in your own code (running the
  router demo, building custom routers, using the hybrid layer, reliable execution).
- A **near-functional specification** sufficient for someone to extend the kernel, wire additional
  policies, or re-implement key pieces (the router helper, the registry, the JobScheduler
  integration) in another language or runtime.

It is _not_ the canonical protocol spec (see cop-core/Architecture.md). This tutorial is the
operational gloss on top of the reference implementation after the 2026-06 cognitive packet router +
hybrid work.

The document follows the corpus convention for derived products (see
[`derived_products.md`](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/derived_products.md)).

### Associated documents

This tutorial should be read together with:

- [SESSION_RESUME_cognitive-packet-router-2026-06.md](../packages/cop-kernel/docs/SESSION_RESUME_cognitive-packet-router-2026-06.md)
  — the living resumption note and source of the work described here.
- [COP — Cognitive Orchestration Protocol (Architecture)](../packages/cop-core/Architecture.md) —
  the canonical protocol spec.
- [cognitive-packet-switching-compatibility.md](../packages/cop-kernel/docs/cognitive-packet-switching-compatibility.md)
  — how the kernel implements parts of the cognitive packet switching model.
- The bac-à-sable demo:
  [cognitive-packet-router-demo.js](../sandbox/cop-continuation-bac-a-sable/scenarios/cognitive-packet-router-demo.js)
  — the canonical executable example.
- [cogentia/research/cognitive_packet_switching.md](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/cognitive_packet_switching.md)
  and
  [cogentia_continuation_packet_routing.md](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/cogentia_continuation_packet_routing.md)
  — the conceptual source documents.
- [Pipeline](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/pipeline.md) and
  [Derived Products](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/derived_products.md)
  — the method by which this tutorial itself is produced and refreshed.
- [COP_STATE_OF_PLAY.md](COP_STATE_OF_PLAY.md) — broader context for the kernel.

---

## 0. What COOP / COP is

COP (Cognitive Orchestration Protocol) is the **operational/event profile** for durable, traceable,
agent-orchestrated cognitive work. It provides primitives for events as packets, topics as scopes,
continuations for resumption, schedulers for time+event driven dispatch, and jobs for higher-level
backoff/obsolescence.

"COOP" here refers to the practical, cooperative usage of COP — the kernel implementation, the
bac-à-sable for experimentation, the cognitive packet router as a policy layer, and the hybrid
integration with scheduling.

The reference implementation lives in `inseme/packages/cop-kernel`. It is deliberately minimal and
substrate-agnostic so that it can be ported (e.g. to Inox actors).

Key invariants (from the work):

- Routers (policy) see **only the envelope**.
- Competent handlers see the **payload**.
- The bus (with sub-buses + federation) is the neutral switching fabric.
- Policy can live as higher agents on the bus and/or be consulted inside operational components
  (hybrid).

The soundness test (inherited from the corpus): _can the current policy / agent be replaced by a
human or another agent without modifying the kernel?_

---

## 1. Core ideas

### 1.1 Packets on the bus

Events on the COPBus (or per-topic SubBus, or federated buses) are treated as cognitive packets.

A packet has:

- **envelope** (routable metadata: packetKind, requiredCapability, riskLevel, routeTo, provenance,
  trace, etc.)
- **payload** (the cognitive content: continuation descriptor, state, etc.)

See `asCognitivePacket` in `Cop-kerneltasks.js` and the wrapper in the bac-à-sable pipeline.

### 1.2 The router as policy layer (envelope-only)

A Cogentia router inspects only the envelope and applies method-governed policy (via
CapabilityRegistry) to decide the next hop.

The reusable helper extracted in this work:

```js
import {
  cogentiaRoutePacket,
  createCogentiaRouterAgent,
  CapabilityRegistry,
} from "@inseme/cop-kernel";

// pure decision
const decision = await cogentiaRoutePacket(somePacket, { registry });

// reactive agent
const agent = createCogentiaRouterAgent({ registry, forwardToBus: myBus });
const unsub = topicBus.subscribe("cognitive-packet", agent.handler);
```

See `src/cogentiaRouter.js` for the full implementation (envelope-only, registry consult, dual
emission of custom + cop.packet.\* events).

### 1.3 CapabilityRegistry

A simple in-memory (resettable) registry for capabilities.

```js
registry.register("source-critique", {
  providers: ["technical-critic"],
  metadata: { risk: "medium" },
});

const ok = registry.canSatisfy("source-critique");
```

Used by both the bus agent and (in hybrid) by JobScheduler.

See `src/capabilityRegistry.js`.

### 1.4 Hybrid policy placement

Policy lives **primarily** as higher agent(s) on the bus (composable, reactive, mesh-friendly).

Operational components (JobScheduler) can **react** to policy decisions (via
`listenForRoutedPackets(bus)`) **or consult the same registry/policy directly** inside scheduling
(`routingPolicy` option).

This is the hybrid chosen after pros/cons discussion (see resume).

See the small example in the router demo (wiring + direct schedule) and the implementation in
jobScheduler.js (listenForRoutedPackets + routingPolicy consult in schedule).

---

## 2. The cognitive packet router demo (canonical example)

The main executable artifact is:

`sandbox/cop-continuation-bac-a-sable/scenarios/cognitive-packet-router-demo.js`

Run it with:

```bash
cd inseme/sandbox/cop-continuation-bac-a-sable
node --max-old-space-size=4096 index.js run cognitive-packet-router-demo
```

What it demonstrates (post all the work):

- `ctx.asCognitivePacket(...)` with emission of `cop.packet.created`.
- Reactive Cogentia router agent on federated topic sub-buses (using the reusable helper).
- Envelope-only inspection + capability registry consultation.
- Dual emission: custom + `cop.packet.routed`.
- Hybrid: `listenForRoutedPackets` on the topic bus (JobScheduler reacts to policy decision and
  auto-schedules) + direct `schedule()` that triggers `routingPolicy` consult _inside_ the
  scheduler.
- Full hygiene (resets for scheduler, jobScheduler, registry, isolated schedulers, SubBus
  listeners).

The demo is intentionally lightweight (no extra schedulers by default) but uses the factory for
dedicated cases in other scenarios.

See the design notes at the top of the file for reliability invariants.

---

## 3. Reusable helpers (first-class API)

### 3.1 cogentiaRoutePacket

The core policy function.

```js
const decision = await cogentiaRoutePacket(packet, {
  registry, // CapabilityRegistry (defaults to module default)
  forwardToBus, // optional bus to publish the routed event on
  source: "my-agent",
});

// decision = { action: 'forwarded-to-handler' | 'no-match', capabilitySatisfied: bool }
```

It always stays envelope-only. When forwarding, it emits both the custom type and
`cop.packet.routed`.

### 3.2 createCogentiaRouterAgent

For the reactive subscription pattern.

```js
const agent = createCogentiaRouterAgent({ registry, forwardToBus });
bus.subscribe("cognitive-packet", agent.handler);
```

Also exposes `.route(pkt, opts)` for direct calls.

### 3.3 CapabilityRegistry

```js
import { CapabilityRegistry, defaultCapabilityRegistry } from '@inseme/cop-kernel';

const reg = new CapabilityRegistry(); // or use the default (resettable)
reg.register("my-capability", { providers: [...], metadata: {...} });
reg.canSatisfy("my-capability");
reg.resetForTest();
```

Exposed on `ctx.capabilityRegistry` in the bac-à-sable (auto-reset after every scenario).

### 3.4 asCognitivePacket (enhanced)

```js
const pkt = ctx.asCognitivePacket({
  envelope: { packetKind: 'continuation', requiredCapability: 'foo', ... },
  payload: myContinuation,
  kind: 'continuation',
  bus: optionalBusForEmission
});
// also emits cop.packet.created on the bus (if provided or default)
```

See the wrapper in `pipeline.js` that auto-supplies the current topic bus.

---

## 4. Hybrid policy layer (bus + scheduler)

The recommended model:

- **Bus agent side** (Cogentia): use `cogentiaRoutePacket` / the agent factory + registry. Publish
  decisions as `cop.packet.routed` (and custom if you want).

- **Scheduler side**:
  - `listenForRoutedPackets(bus)` — JobScheduler subscribes and auto-schedules continuations from
    the packet when the bus agent publishes a routed decision.
  - `routingPolicy` (or `setRoutingPolicy`) — the scheduler directly calls the helper during
    `schedule()` for validation/decision, even for direct calls that didn't come through the bus.

See:

- `src/jobScheduler.js` : `listenForRoutedPackets`, `routingPolicy` handling in `schedule()`, the
  packet projections in events.
- `sandbox/.../cop-kernel-adapter.js` : how the defaults are wired.
- The router demo setup and handler step for the concrete example.

This keeps policy evolvable on the bus while letting the scheduler be "policy-aware" without
duplicating logic.

---

## 5. Reliable execution (bac-à-sable hygiene)

Heavy multi-scheduler + federation scenarios used to OOM because of accumulating `setInterval`
(global 5s timer per COPScheduler) + pending + listeners.

Mitigations (all resettable):

- `resetForTest()` on COPScheduler, COPJobScheduler, CapabilityRegistry.
- `ctx.createIsolatedScheduler(bus?)` in the bac-à-sable — creates fresh ones that are auto-reset at
  end of every `runScenario`.
- Pipeline auto-calls resets for defaults + isolated + registry after every scenario.
- SubBus listener hygiene (proper unsub on last handler, async delivery support).
- The router demo is deliberately lightweight (reuses ctx.scheduler); other scenarios
  (federation-demo, etc.) use the factory.

Usage in your own scenario:

```js
const sched = ctx.createIsolatedScheduler(myTopicBus);
sched.start();
...
// no need to stop — pipeline resets it
```

See `pipeline.js` (the factory + post-run hygiene) and the updated scenarios for patterns.

---

## 6. Event model and cop.packet.\* emission

In addition to `cop.task.*` / `cop.job.*`, we emit `cop.packet.*` :

- `cop.packet.created` — from `asCognitivePacket` (when you wrap a continuation/task).
- `cop.packet.routed` — from the router helper (when a policy decision forwards a packet).

Task/job events now also carry a `packet` projection (envelope + payload) for consumers that want
the cognitive view.

This gives routers a uniform subscription surface (`cop.packet.*`) while custom types
(`cognitive-packet.*`) remain useful inside a specific demo or app.

See the helper, the pipeline wrapper, the jobScheduler emits, and the emitTaskEvent enhancement in
Cop-kerneltasks.js.

---

## 7. Workflows & API surface (practical)

### Running experiments

```bash
cd inseme/sandbox/cop-continuation-bac-a-sable
node index.js run cognitive-packet-router-demo
node index.js run federation-demo
# etc.
```

All scenarios benefit from auto-reset hygiene.

### Building a custom router agent

```js
import { createCogentiaRouterAgent, CapabilityRegistry } from "@inseme/cop-kernel";

const reg = new CapabilityRegistry();
reg.register("my-cap", { providers: ["my-agent"] });

const bus = myTopicBus;
const forward = otherBus;

const agent = createCogentiaRouterAgent({
  registry: reg,
  forwardToBus: forward,
  source: "my-policy",
});
bus.subscribe("cognitive-packet", agent.handler);
```

### Using the policy inside your own scheduler

```js
import { COPJobScheduler, cogentiaRoutePacket } from '@inseme/cop-kernel';

const js = new COPJobScheduler({
  scheduler: mySched,
  bus: myBus,
  capabilityRegistry: myReg,
  routingPolicy: cogentiaRoutePacket   // or your own wrapper
});

await js.schedule({ ... requiredCapability: 'foo' ... });
// inside: the policy is consulted, routingDecision recorded
```

Or use the listener:

```js
js.listenForRoutedPackets(someBus); // auto-schedule when policy publishes
```

### In the bac-à-sable (recommended for experiments)

Use `ctx.cogentiaRoutePacket(...)`, `ctx.capabilityRegistry`, `ctx.createIsolatedScheduler(...)`,
`ctx.jobScheduler` (already hybrid-wired).

See the router demo source for the full pattern (including how the listener + direct paths coexist).

---

## 8. Relation to the broader corpus

This work directly advances the "COP integration pass" described in the cogentia routing papers:

- SubBus + federation + per-topic as the decentralized switching fabric.
- Scheduler / JobScheduler acting on (and now directly consulting) routing decisions.
- Capability registry as the shared policy substrate.
- Envelope/payload separation + cop.packet.\* as the uniform observation surface.

See the updated `cognitive-packet-switching-compatibility.md` and the sibling cogentia docs for the
status matrix.

The bac-à-sable (especially the router demo + federation/raix scenarios) is the living executable
evidence.

---

## 9. Invariants & soundness

- Routers see **only envelope** (the helper and demo enforce this strictly).
- Payload is only unpacked by competent handlers.
- Everything is resettable (no hidden global timer/pending accumulation in repeated runs).
- The policy helper is pure decision + optional side-effect (forward); the scheduler can use it
  without the bus.
- Soundness test: the current policy (the helper + registry rules in the demo) can be replaced by
  another agent or human without touching the kernel primitives.

---

### Real-world adoption example: the Ophelia agent

The primary higher-level policy/agent in the inseme platform (`@inseme/brique-ophelia`, the civic
neutral-mirror / assembly facilitator "Ophélia") now uses COP "from now on" for its own
orchestration (per the 2026-06 directive).

- Its core loop (`packages/brique-ophelia/edge/lib/operator.js:runOperator`) creates a COP Task for
  the session (`createTask({taskType:"ophelia-reasoning", ...})`).
- Populates a `CapabilityRegistry` from its existing ROLES (mediator, analyst, scribe, guardian,
  cyrnea-\* become capabilities with providers/metadata).
- For _each_ reasoning iteration: builds a turn packet (envelope with `requiredCapability`,
  `packetKind:"ophelia-turn"`, provenance, iteration), consults
  `cogentiaRoutePacket(turnPacket, {registry})` (envelope-only), streams
  `<Think>COOP policy...</Think>` on switch, emits via `asCognitivePacket(..., {emit:true})` for
  `cop.packet.created`, tracks the turn with `startStep`/`completeStep`, and completes the task on
  exit.
- Hybrid: direct consult in the agent (like routingPolicy inside scheduler) while the same
  helper/registry/bus events enable full reactive bus-driven policy agents + listenForRoutedPackets.
- Preserves all prior hygiene (resets, SubBus, envelope contract, dual emissions, no debt).

See `packages/cop-kernel/docs/SESSION_RESUME_cognitive-packet-router-2026-06.md` (the "Picked:
Ophelia..." section) for the exact changes, cleans performed first, and verification. This is the
canonical live example of a Cogentia "higher true router" agent consuming the COP substrate
(Tasks/Steps + packets + router + registry + hybrid JobScheduler paths).

Future refreshes of this tutorial via cogentia derived/refresh will incorporate excerpts from the
operator.js + resume when the declared sources are re-scanned.

_End of tutorial. This document is a derived product (frontmatter `derived_by: agent`). Per the
pipeline and derived_products doctrine, treat it as source for further derivatives (blog posts,
slide decks, other tutorials). Future refreshes will be done via `cogentia.js derived` (or refresh),
which emits a grouped continuation to an agent to regenerate it faithfully from the declared
sources._

_Generated as part of the 2026-06 cognitive packet router + hybrid work in the inseme COP kernel.
Updated for Ophelia COP adoption._
<!-- BEGIN_AUTO: backlinks -->
### Backlinks

*These documents link to this file:*
- [Research Index — Inseme](index.md)
<!-- END_AUTO: backlinks -->
