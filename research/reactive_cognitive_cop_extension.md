---
title: "Reactive Cognitive COP Extension"
subtitle: "From Toubkal Reactive Sets to COP control/data-plane packet circulation"
version: "0.1"
status: "working-paper — source document"
date: "2026-06-01"
author: "Jean Hugues Noël Robert"
affiliation: "Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica"
license: "CC BY-SA 4.0"
language: "en"
intended_path: "research/reactive_cognitive_cop_extension.md"
tags:
  - inseme
  - cop
  - reactive-cognitive
  - cognitive-packets
  - toubkal
  - reactive-sets
  - query-tree
  - control-plane
  - data-plane
  - fractanet
related_projects:
  - "COP"
  - "Inox"
  - "Cogentia"
  - "Fractanet"
  - "Toubkal"
ai_assisted_by:
  - "ChatGPT"
  - "Grok"
canonical_url: https://github.com/JeanHuguesRobert/inseme/blob/main/research/reactive_cognitive_cop_extension.md
last_stamped_at: 2026-06-01
corpus_role: "source"
document_role: "source"
document_kind: "research-paper"
visibility: "public"
lifecycle_state: "working"
classification_source: "cogentia.js"
classification_version: "1"
classification_rule: "research-paper"
classification_confidence: "medium"
---

# Reactive Cognitive COP Extension

## Object and associated documents

### Object of this document

This document stabilizes the COP-side architecture for a reactive cognitive layer inspired by
Toubkal, aligned with Inox, and expressed in the vocabulary of COP.

It is a **source document**, not a coding ticket. Its role is to prevent premature implementation as
a merely JavaScript package and to preserve the correct architectural split:

```text
Toubkal      → reactive sets, reactive queries, query tree, transactions, antistate
Inox         → future language/runtime substrate and native reactive-set implementation
Inseme / COP → protocol-level events, artifacts, continuations, projections, and agent coordination
Cogentia     → cognitive packets, pipeline, continuation discipline, source/derived artifact split
Fractanet    → multi-substrate packet circulation across cognition, compute, energy, matter, governance
```

### Associated documents

This document should be read together with:

- [COP — Cognitive Orchestration Protocol](../packages/cop-core/Architecture.md) — canonical
  protocol specification for Event, Topic, Task, Step, Artifact and Continuation primitives;
- [COP Invariants](../packages/cop-core/Invariants.md) — non-negotiable protocol rules;
- [Cogentia Pipeline](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/pipeline.md) —
  source-to-derived packet workflow used to produce this artifact;
- [Cognitive Packets](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/cognitive_packets.md)
  — envelope/payload distinction used here;
- [cogentia.js Tutorial and Near-Specification](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/cogentia_js_tutorial.md)
  — operational context for continuations, audit and generated artifacts;
- [The Inox Programming Language — Specification](https://github.com/JeanHuguesRobert/Inox/blob/master/research/inox-spec.md)
  — runtime/language substrate where reactive sets already belong conceptually;
- [Toubkal](https://github.com/ReactiveSets/toubkal) — original Reactive Sets / Pipelets dataflow
  framework;
- [Reactive Sets in Inox — Native Implementation Path](https://github.com/JeanHuguesRobert/Inox/blob/master/research/reactive_sets_inox_cop_implementation.md)
  — sibling Inox-side artifact;
- [Packet Attractor — Fractanet Distributed Demand and Capability Routing](packet_attractor_fractanet.md)
  — canonical crystallization of `cop/packet-attractor` for Fractanet routing.

---

## Assisted genesis note

This document emerged from a multi-agent conversation involving ChatGPT and Grok around the
modernization of Toubkal inside the Jean Hugues Robert multi-repository corpus.

A first direction proposed a JavaScript package `@inseme/reactive-cognitive`. That direction was
then corrected: Reactive Sets are already present in the Inox design, and the deep implementation
should therefore be Inox-native, not a competing pure JavaScript package inside Inseme.

The present document records the corrected position.

---

## Abstract

Toubkal provides an early and powerful architecture for distributed reactive dataflow: Reactive
Sets, Reactive Queries, Query Tree, Pipelets, transactions, `add/remove/update` operations,
fetch/subscribe, distribution, and antistate. These ideas are directly relevant to COP, but COP
should not absorb them as a monolithic JavaScript framework.

The correct integration is layered. Inox should carry the native runtime implementation of reactive
sets and query-driven dataflow. Inseme/COP should define how reactive cognitive circulation appears
at the protocol layer: events, artifacts, continuations, projections, attractors, pressure
strategies, and control/data-plane boundaries.

This document defines the COP extension side of that integration. It treats Cognitive Packets as COP
artifacts and/or event payloads, introduces Packet Attractors as declarative demand/interest
structures, and adds explicit pressure strategies — `best-effort`, `ttl`, `bounded`, `demand`,
`durable` — as control-plane metadata. The default model is best-effort and eventually consistent
when possible; durable guarantees must be explicitly requested.

---

## Transformation map

```text
Toubkal analysis
→ identification of Reactive Queries / Query Tree / transactions as core primitives
→ Grok continuation proposing a pure JavaScript @inseme/reactive-cognitive package
→ verification that Reactive Sets are already a design primitive in Inox
→ correction: Inox should host native implementation, Inseme should host COP protocol artifacts
→ addition by Jean Hugues Robert of pressure strategies and control/data-plane separation
→ present COP-side source document
→ sibling Inox implementation-path document
→ future coding continuations
```

---

## Main hypothesis

The reactive cognitive layer should be represented in COP as a **protocol extension**, not as the
primary implementation substrate.

COP should define:

- how Cognitive Packets are represented as artifacts or event payloads;
- how Packet Attractors are declared;
- how CogQueries are expressed at the protocol boundary;
- how pressure strategies are carried in control-plane metadata;
- how durable vs best-effort circulation is distinguished;
- how Inox-native reactive sets can later project into COP event logs and stores.

COP should not define:

- the low-level reactive-set runtime;
- the native query-tree algorithm;
- the stack VM execution model;
- the Inox implementation details.

Those belong in Inox.

---

## Control Plane / Data Plane split

The separation between Control Plane and Data Plane is a load-bearing addition by Jean Hugues
Robert. It is not merely a naming convention.

### Control Plane

The Control Plane carries the rules of circulation:

- queries;
- subscriptions;
- attractors;
- routing policies;
- pressure strategies;
- TTL;
- durability requirements;
- authorization constraints;
- coherence requirements;
- transaction metadata;
- continuation rules;
- projection policies.

The Control Plane decides what should be attracted, routed, bounded, delayed, discarded, retried,
durably logged, or synchronized.

### Data Plane

The Data Plane carries what actually circulates:

- Cognitive Packets;
- payloads;
- set values;
- `add/remove/update` operations;
- emitted events;
- transaction fragments;
- observable state changes;
- projected artifacts.

### Rule

```text
The Control Plane decides how packets circulate.
The Data Plane carries the packets and state changes.
```

In COP terms, Control Plane metadata should remain inspectable without interpreting the full
cognitive payload.

---

## COP mapping

| Toubkal / Inox concept | COP-side representation                                         |
| ---------------------- | --------------------------------------------------------------- |
| Reactive Set           | projected state or artifact collection                          |
| Reactive Query         | `cop/reactive-query` artifact or control-plane field            |
| Query Tree             | projection/index maintained by implementation                   |
| Pipelet                | agent, projector, scheduler step, or future Cognode             |
| Transaction            | causal event group / continuation boundary                      |
| `add/remove/update`    | COP events with operation semantics                             |
| Antistate              | pending negative state / unresolved compensation projection     |
| Fetch / subscribe      | demand declaration / attractor registration                     |
| Socket synchronization | transport-specific event delivery profile                       |
| CogSet                 | COP-visible reactive collection, implemented natively elsewhere |
| Packet Attractor       | declarative demand/interest artifact                            |

---

## Proposed COP artifact types

### `cop/cognitive-packet`

A COP artifact carrying a Cogentia-compatible cognitive packet.

Minimum fields:

```json
{
  "artifactType": "cop/cognitive-packet",
  "packet": {
    "envelope": {},
    "payload": {}
  }
}
```

### `cop/packet-attractor`

A declarative structure expressing what a node, agent, projector, or human-facing process is willing
to attract.

```json
{
  "artifactType": "cop/packet-attractor",
  "id": "attractor:corte:mandates",
  "matches": {
    "packetKind": ["event", "operation", "continuation"],
    "query": [
      { "flow": "mandates", "commune": "Corte" },
      { "flow": "votes", "commune": "Corte" }
    ]
  },
  "pressure": {
    "accepted": ["best-effort", "ttl", "durable"]
  }
}
```

### `cop/reactive-query`

A query expressed as protocol-level data, using the Toubkal-style OR-of-ANDs grammar as the initial
seed.

```json
{
  "artifactType": "cop/reactive-query",
  "query": [
    { "flow": "votes", "commune": "Corte" },
    { "flow": "mandates", "status": "active" }
  ]
}
```

### `cop/pressure-policy`

A policy artifact defining propagation pressure.

```json
{
  "artifactType": "cop/pressure-policy",
  "strategy": "ttl",
  "ttlMs": 5000,
  "maxFanout": 8,
  "durable": false
}
```

---

## Pressure strategies

This layer is a continuation by Jean Hugues Robert, not a direct Toubkal primitive.

### `best-effort`

Propagate when possible. Failure is acceptable. No strong guarantee.

Useful for weak signals, exploratory cognition, presence, ambient awareness and low-cost
coordination.

### `ttl`

The packet expires after a time-to-live. Expired packets must not be propagated further.

Useful for ephemeral state, sensors, UI hints, temporary intentions and attention-limited signals.

### `bounded`

Propagation is allowed only within explicit limits: queue size, retries, fan-out, memory, depth,
cost or time.

Useful for browsers, edge nodes, low-power devices and overload protection.

### `demand`

Propagation occurs only if there is active demand: query, subscription, attractor, continuation
request or authorization rule.

Useful for bandwidth reduction, privacy, sparse synchronization and COP projections.

### `durable`

The packet or operation should survive disconnection and be replayed or synchronized later.

Useful for votes, mandates, signed decisions, financial/legal events, audit logs and governance
traces.

Durability is not the default. It must be requested explicitly by the Control Plane.

---

## Default consistency model

The default model is:

```text
best-effort, eventually consistent when possible, explicitly durable only when required
```

This is an architectural and anthropological choice:

- human coordination is incomplete;
- perception is partial;
- memory is lossy;
- attention is bounded;
- networks fail;
- small nodes must survive overload;
- not every signal deserves durable storage.

Strong guarantees should be explicit, scoped, justified and traceable.

---

## Cognitive packets YAML

```yaml
cognitive_packet:
  id: reactive_cognitive_cop_extension.v0.1
  title: "Reactive Cognitive COP Extension"
  type: "source document"
  definition: >
    COP-side protocol extension that maps Toubkal/Inox reactive dataflow concepts into COP
    artifacts, events, continuations, attractors and pressure policies.
  status: "working source artifact"
  repository: "JeanHuguesRobert/inseme"
```

```yaml
cognitive_packet:
  id: control_data_plane_reactive_cognitive.v0.1
  title: "Control Plane / Data Plane split for reactive cognition"
  type: "architectural invariant"
  definition: >
    The Control Plane carries queries, attractors, policies, pressure, TTL, durability and
    continuation rules; the Data Plane carries packets, payloads, operations, events and state
    changes.
  origin: "Jean Hugues Robert continuation"
  status: "load-bearing concept"
```

```yaml
cognitive_packet:
  id: pressure_strategies.v0.1
  title: "Pressure strategies"
  type: "protocol design packet"
  definition: >
    Explicit propagation strategies for cognitive packets and reactive flows: best-effort, ttl,
    bounded, demand and durable.
  contrast:
    toubkal: "reactive sets, queries, transactions"
    continuation: "explicit pressure and durability semantics"
  status: "seed protocol grammar"
```

```yaml
cognitive_packet:
  id: packet_attractor.v0.1
  title: "Packet Attractor"
  type: "routing concept"
  definition: >
    Declarative demand structure that attracts packets by kind, query, metadata, trace, pressure
    policy or authorization context instead of relying on fixed addressing.
  related:
    - "Reactive Query"
    - "CogQuery"
    - "CogQueryTree"
    - "COP Artifact"
  status: "working concept"
```

---

## Objections and safeguards

### Objection 1 — This may duplicate Inox

Valid risk. The safeguard is explicit layering: Inseme/COP defines protocol surfaces; Inox carries
the native runtime implementation.

### Objection 2 — This may become a speculative framework instead of usable code

Valid risk. The next step must be a small, testable Inox-native seed, not a giant framework.

### Objection 3 — Best-effort may be mistaken for unreliability

Response: best-effort is the default for cheap circulation, not for governance-critical acts.
Durable circulation remains available and explicit.

### Objection 4 — Control/data-plane separation may become too abstract

Response: each COP artifact must indicate which fields are control-plane metadata and which fields
belong to the data-plane payload.

### Objection 5 — Toubkal may be overinterpreted

Response: Toubkal is an ancestor and source of primitives, not an authority to clone. Claims about
complexity, performance or backpressure require independent audit.

---

## Levels of evidence

### Level A — Established from repositories

- COP is an event-driven protocol with Event, Topic, Task, Step, Artifact and Continuation
  primitives.
- Inox already names Reactive Sets as part of its design.
- Toubkal documents Reactive Sets, Reactive Queries, Pipelets and transactions.
- Cogentia defines Cognitive Packets and the source/derived pipeline.

### Level B — Defensible interpretation

- Toubkal's query model can seed CogQuery and Packet Attractor semantics.
- COP can represent reactive-cognitive structures as artifacts and events without owning the
  runtime.
- Inox is the proper location for native implementation.

### Level C — Corpus-specific hypothesis

- A Fractanet-compatible reactive cognitive layer can emerge by combining Toubkal primitives, Inox
  runtime, COP event semantics and Cogentia packets.
- Best-effort by default better matches human and edge coordination than durable-by-default design.

### Level D — Source of inspiration

- Packet switching is used as an analogy for cognitive and protocol circulation.
- Toubkal acts as a historical and technical inspiration, not as a mandatory dependency.

---

## Self-evaluation according to the second method

| Criterion                | Evaluation v0.1 | Comment                                                                      |
| ------------------------ | --------------- | ---------------------------------------------------------------------------- |
| Hypothesis clarity       | Strong          | The COP/Inox split is explicit.                                              |
| Contestability           | Strong          | Main risks are stated.                                                       |
| Evidence separation      | Strong          | Repository facts, interpretations and hypotheses are separated.              |
| Machine-readability      | Strong          | Artifact types and YAML packets are included.                                |
| Corpus integration       | Strong          | Links Cogentia, COP, Inox and Toubkal.                                       |
| Anti-duplication         | Strong          | Explicitly avoids a competing Inseme runtime.                                |
| Implementation readiness | Medium          | Requires sibling Inox implementation artifact and later coding continuation. |

### Internal bullshit meter

Provisional score: **1.0/10**.

Reason: the document is architectural and therefore at risk of abstraction, but it states the
layering constraint clearly and produces concrete artifact types.

---

## Continuation

1. Add a derived operational document in `packages/cop-core/REACTIVE_COGNITIVE_EXTENSION.md`.
2. Add a sibling Inox source document describing the native implementation path.
3. Create a coding continuation for Inox, not for a pure JavaScript `@inseme/reactive-cognitive`
   package.
4. Later, update COP schemas only after the Inox seed clarifies the minimal runtime semantics.
5. Track unresolved issues through GitHub Issues as continuation packets when implementation begins.
<!-- BEGIN_AUTO: backlinks -->
### Backlinks

*These documents link to this file:*
- [Rendre capable — noyau doctrinal provisoire](https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/noyau_doctrinal_rendre_capable.md)
- [Concept Index — FractaVolta](https://github.com/JeanHuguesRobert/FractaVolta/blob/main/research/concepts.md)
- [Fractanet — Generalized Control Planes for Heterogeneous Packet Networks](https://github.com/JeanHuguesRobert/FractaVolta/blob/main/research/fractanet.md)
- [Reactive Sets in Inox — Native Implementation Path](https://github.com/JeanHuguesRobert/Inox/blob/master/research/reactive_sets_inox_cop_implementation.md)
- [Research Index — Inox](https://github.com/JeanHuguesRobert/Inox/blob/master/research/index.md)
- [COP Reactive Cognitive Extension](../packages/cop-core/REACTIVE_COGNITIVE_EXTENSION.md)
- [Packet Attractor — Fractanet Distributed Demand and Capability Routing](packet_attractor_fractanet.md)
- [Research Index — Inseme](index.md)
<!-- END_AUTO: backlinks -->
