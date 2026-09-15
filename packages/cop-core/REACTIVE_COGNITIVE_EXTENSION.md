---
title: COP Reactive Cognitive Extension
subtitle: Protocol surface for Packet Attractors, CogQueries and pressure strategies
version: '0.1'
status: operational-note — derived from research/reactive_cognitive_cop_extension.md
date: '2026-06-01'
author: Jean Hugues Noël Robert
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
license: CC BY-SA 4.0
language: en
derived_from: research/reactive_cognitive_cop_extension.md
tags:
  - cop
  - reactive-cognitive
  - packet-attractor
  - pressure-strategy
  - cognitive-packet
  - control-plane
  - data-plane
canonical_url: https://github.com/JeanHuguesRobert/inseme/blob/main/packages/cop-core/REACTIVE_COGNITIVE_EXTENSION.md
last_stamped_at: 2026-06-01T00:00:00.000Z
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


# COP Reactive Cognitive Extension

## Object and associated documents

### Object of this document

This document is the COP-core operational note derived from
[`research/reactive_cognitive_cop_extension.md`](../../research/reactive_cognitive_cop_extension.md).

It defines the protocol-facing surface for a future reactive cognitive layer without implementing
the low-level runtime. Native implementation is delegated to Inox.

### Associated documents

- [COP Trace Model](../../research/cop_trace_model.md) — canonical trace-centric architecture;
- [Reactive Cognitive COP Extension](../../research/reactive_cognitive_cop_extension.md) — source
  document;
- [Packet Attractor — Fractanet Distributed Demand and Capability Routing](../../research/packet_attractor_fractanet.md)
  — canonical crystallization of `cop/packet-attractor`;
- [COP — Cognitive Orchestration Protocol](Architecture.md) — canonical COP specification;
- [COP Invariants](Invariants.md) — protocol invariants;
- [Cognitive Packets](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/cognitive_packets.md)
  — envelope/payload specification;
- [Reactive Sets in Inox — Native Implementation Path](https://github.com/JeanHuguesRobert/Inox/blob/master/research/reactive_sets_inox_cop_implementation.md)
  — native runtime continuation.

---

## Status

This is a protocol extension note, not a final schema.

The extension is intentionally small. It introduces names and JSON sketches sufficient to guide
future code and schema work.

---

## Normative split

COP owns:

- trace, event, and assertion representation;
- artifact representation;
- causality links and evidence relations;
- continuation boundaries;
- projection contracts and bounded invalidation (`ReactiveDependencyGraph`);
- protocol-level metadata.

Inox owns:

- native Reactive Set implementation;
- native CogQuery evaluation;
- native Query Tree / dispatch optimization;
- runtime backpressure and pressure strategy execution;
- stack/actor execution semantics.

COP MAY expose reactive-cognitive structures as events and artifacts. COP MUST NOT require any
specific runtime implementation.

---

## Control Plane fields

A COP event or artifact participating in this extension MAY carry a `control` object.

```json
{
  "control": {
    "query": [],
    "attractor": null,
    "pressure": {
      "strategy": "best-effort"
    },
    "ttlMs": null,
    "durable": false,
    "authorization": null,
    "coherence": "eventual",
    "continuation": null
  }
}
```

The `control` object is inspectable without interpreting the full data-plane payload.

---

## Data Plane payload

A COP event or artifact participating in this extension MAY carry a `packet` object.

```json
{
  "packet": {
    "envelope": {
      "packetKind": "operation",
      "source": "cognode://example",
      "trace": {
        "cause": "event:...",
        "transaction": "tx:...",
        "forks": []
      }
    },
    "payload": {
      "operation": "add",
      "value": {
        "flow": "votes",
        "id": "vote:example"
      }
    }
  }
}
```

Large payloads SHOULD be referenced rather than embedded when durable storage already exists
elsewhere.

---

## Artifact types

### `cop/cognitive-packet`

Carries a Cogentia-compatible cognitive packet.

Required fields:

- `artifactType = "cop/cognitive-packet"`
- `packet.envelope`
- `packet.payload`

### `cop/reactive-query`

Carries a query as protocol-level data.

Initial grammar:

```json
[
  { "flow": "votes", "commune": "Corte" },
  { "flow": "mandates", "status": "active" }
]
```

The grammar intentionally starts from the Toubkal OR-of-ANDs model.

### `cop/packet-attractor`

Declares demand or interest.

```json
{
  "artifactType": "cop/packet-attractor",
  "id": "attractor:corte:mandates",
  "matches": {
    "packetKind": ["operation", "event", "continuation"],
    "query": [{ "flow": "mandates", "commune": "Corte" }]
  },
  "pressure": {
    "accepted": ["best-effort", "ttl", "durable"]
  }
}
```

### `cop/pressure-policy`

Declares how circulation is constrained.

```json
{
  "artifactType": "cop/pressure-policy",
  "strategy": "bounded",
  "ttlMs": 5000,
  "maxQueue": 100,
  "maxFanout": 8,
  "maxRetries": 3,
  "durable": false
}
```

---

## Pressure strategies

Allowed initial values:

```text
best-effort
ttl
bounded
demand
durable
```

Semantics:

- `best-effort`: propagate when possible; loss acceptable.
- `ttl`: do not propagate after expiry.
- `bounded`: enforce explicit limits.
- `demand`: propagate only if active demand exists.
- `durable`: preserve for replay / audit / later synchronization.

Default:

```text
strategy = best-effort
durable = false
coherence = eventual
```

Governance-critical operations SHOULD request `durable` explicitly.

---

## Events

Possible future event types:

```text
reactive.query.declared
reactive.query.revoked
packet.attractor.registered
packet.attractor.revoked
packet.emitted
packet.attracted
packet.expired
packet.dropped
packet.durable.logged
reactive.operation.added
reactive.operation.removed
reactive.operation.updated
reactive.antistate.created
reactive.antistate.resolved
```

These event names are provisional.

---

## Minimal conformance sketch

A minimal COP implementation of this extension should be able to:

1. store a `cop/reactive-query` artifact;
2. store a `cop/packet-attractor` artifact;
3. emit a `packet.emitted` event;
4. emit a `packet.attracted` or `packet.dropped` event;
5. preserve pressure metadata;
6. distinguish best-effort from durable circulation;
7. expose enough projection state for an Inox or JavaScript implementation to consume.

---

## Non-goals

This extension does not define:

- a full JavaScript package;
- a complete Query Tree implementation;
- a full Toubkal clone;
- a complete backpressure runtime;
- a native Inox syntax;
- legal-grade durability rules.

---

## Continuation

Next actions:

1. Create the Inox-native implementation path document.
2. Create an Inox coding continuation for a minimal Reactive Set / CogQuery seed.
3. Only after that, decide whether Inseme needs a small JS adapter for tests, demos or COP
   projections.
