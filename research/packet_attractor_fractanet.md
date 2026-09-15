---
title: Packet Attractor — Fractanet Distributed Demand and Capability Routing
subtitle: COP-side crystallization of reactive demand, legitimacy, and intermittent capable nodes
version: '0.1'
status: working-paper — source document
date: '2026-07-03'
author: Jean Hugues Noël Robert, baron Mariani
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
license: CC BY-SA 4.0
language: en
canonical_url: https://github.com/JeanHuguesRobert/inseme/blob/main/research/packet_attractor_fractanet.md
tags:
  - inseme
  - cop
  - fractanet
  - packet-attractor
  - reactive-query
  - cognitive-packets
  - control-plane
  - capability-routing
  - continuation
  - inox
  - cogentia
related_projects:
  - COP
  - Fractanet
  - Inox
  - Cogentia
  - FractaVolta
ai_assisted_by:
  - Grok
last_stamped_at: 2026-07-03T00:00:00.000Z
corpus_role: source
document_role: source
document_kind: research-paper
visibility: public
lifecycle_state: working
classification_source: cogentia.js
classification_version: '1'
classification_rule: research-paper
classification_confidence: medium
human_validation_required: true
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


# Packet Attractor — Fractanet Distributed Demand and Capability Routing

## Object and associated documents

### Object of this document

This document **crystallizes** the **Packet Attractor** as a Fractanet routing primitive.

The idea already appears in seed form across the corpus — Toubkal reactive queries, COP artifact
sketches, Inox runtime notes, and Fractanet language abstractions — but it was not yet gathered as
a single, load-bearing source document.

This note answers one question:

> How does a Fractanet node declare **what packets it is willing and able to attract**, so routing
> can occur by **capability and legitimacy** instead of by fixed host URLs or centralized tables?

It is a **COP-side source document**. Native matching, antistate, and runtime execution belong in
Inox. Network-level doctrine and verb registries belong in FractaVolta. Application routing (Guide,
retrieval) belongs in Cogentia.

### Naming collision

FractaVolta also hosts
[`packet_attractor.md`](https://github.com/JeanHuguesRobert/FractaVolta/blob/main/research/packet_attractor.md),
which discusses the **packet as evolutionary attractor** across complex networks (physics, energy,
engineering transitions). That paper is related in spirit but **not the same concept**.

| Name | Domain | Meaning |
|------|--------|---------|
| Evolutionary packet attractor | FractaVolta / complexity | Convergent discretization in mature networks |
| **Packet Attractor (this document)** | Fractanet / COP / Inox | Declarative demand + capability routing primitive |

When the corpus says **Packet Attractor** without qualification, the Fractanet routing primitive is
usually intended.

### Associated documents

Read together with:

- [Reactive Cognitive COP Extension](reactive_cognitive_cop_extension.md) — parent extension; first
  `cop/packet-attractor` sketch;
- [COP Reactive Cognitive Extension](../packages/cop-core/REACTIVE_COGNITIVE_EXTENSION.md) —
  protocol-facing operational note;
- [COP — Cognitive Orchestration Protocol](../packages/cop-core/Architecture.md);
- [COP Invariants](../packages/cop-core/Invariants.md);
- [Reactive Sets in Inox — Native Implementation Path](https://github.com/JeanHuguesRobert/Inox/blob/master/research/reactive_sets_inox_cop_implementation.md)
  — native `PacketAttractor` runtime;
- [Inox as the Fractanet Language](https://github.com/JeanHuguesRobert/Inox/blob/master/research/fractanet_language_abstractions.md)
  — graduation ladder and dialect roadmap;
- [Inox serve — session cognitive packets](https://github.com/JeanHuguesRobert/Inox/blob/master/research/inox-session-packets.md)
  — `inox.session.v1` packet loop;
- [Cogentia as a Cognitive Continuation Packet Router](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/cogentia_continuation_packet_routing.md);
- [Cognitive Packets](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/cognitive_packets.md);
- [Fractanet — Generalized Control Planes](https://github.com/JeanHuguesRobert/FractaVolta/blob/main/research/fractanet.md)
  — verb registry, control/data plane, RAIX.

---

## Abstract

Fractanet is not a centralized blackboard and not a static service mesh. It is a **network of
governed packets** circulating across heterogeneous substrates. Routing must therefore answer:

```text
Who can honor this envelope now?
```

A **Packet Attractor** is the COP-visible declaration of **structured demand** on a node, agent,
gateway, or human-facing process:

```text
I attract packets that match this query / capability / mandate context,
under this pressure and legitimacy regime,
and I will handle or continue them accordingly.
```

This is stronger than pub/sub and more operational than a passive reactive query alone.

The attractor is the Fractanet answer to the **distributed blackboard** problem: specialists do not
write into one shared table; they **declare what they are ready to receive**, and packets find them
through **control-plane matching** with explicit traces.

---

## 1. Three circulation models

| Model | Mechanism | Fractanet limit |
|-------|-----------|-----------------|
| **Pub/sub** | receive everything on a channel | channel capture; no structured demand |
| **Reactive query** | receive what matches a query | passive subscription; may lack legitimacy/capacity binding |
| **Packet attractor** | attract packets one is **capable and legitimate** to handle | target primitive for Fractanet routing |

Canonical compression from Inox language abstractions:

```text
pub/sub        = receive what is published on a channel
reactive query = receive what matches a structured demand
packet attractor = attract packets one is capable and legitimate to handle
```

A Packet Attractor **contains** a reactive query (or query tree), but adds:

- capability binding;
- legitimacy / mandate context;
- pressure acceptance;
- regime and degradation policy;
- optional endpoint hints for transport only;
- COP trace obligations.

---

## 2. Architectural placement

```text
FractaVolta / Fractanet doctrine
  → why packets, verbs, RAIX, regimes, exergy routing

Inseme / COP (this document)
  → artifact types, events, legitimacy fields, trace contracts

Inox
  → native PacketAttractor, ReactiveQuery, antistate, pressure execution

Cogentia
  → cognitive packets, Guide routing, continuation discipline

Operium (private registry)
  → slow node profiles, secret references, operational memory — not live matching
```

**Rule:** Operium catalogs **who exists** and **what they may declare**. The Packet Attractor
expresses **what is actively offered now**. Do not collapse the two.

---

## 3. Packet Attractor vs fixed endpoint

Today's weak-node bootstrap still uses fixed URLs (`COGENTIA_INOX_RETRIEVAL_URL`). That is an
**L0/L1 adapter**, not Fractanet routing.

| Fixed endpoint | Packet attractor |
|----------------|------------------|
| `https://host:8792` | `capability: retrieval.inline@v1` |
| fails when host sleeps | attractor expires via TTL / antistate |
| restart to change route | router consults current attractor set |
| hides legitimacy | mandate + attractor match is traceable |

Target flow:

```text
Guide emits cognitive packet envelope
  required_capabilities: [retrieval.inline, openai.embeddings]
  regime: normal
        ↓
COP router / gateway queries active attractors
        ↓
match on capability + query + legitimacy + pressure
        ↓
selected node receives inox.session.v1 turn
        ↓
if local capacity missing → continuation (cop/continuation)
        ↓
another attractor or local fulfiller closes the loop
```

---

## 4. Intermittent capable nodes

A laptop or domestic capable host is a **first-class Fractanet node**, not an ops afterthought.

Properties:

- **intermittent availability** — online only part of the time;
- **rich capabilities** — `inox-serve`, embeddings, Supabase, local corpus tools;
- **legitimate for private or heavy work** — secrets stay there, not on fracta;
- **must degrade gracefully** — network continues under `degraded` regime.

The attractor model handles intermittence naturally:

```yaml
status: online | draining | offline_declared
last_seen: 2026-07-03T15:04:00Z
ttl_seconds: 300
regime: normal | degraded | crisis
```

When `last_seen + ttl` is exceeded, the attractor is **not matched** unless policy explicitly
allows stale attractors (usually not for retrieval fulfillers).

This is preferable to a central heartbeat table that becomes a single capture surface.

---

## 5. COP artifact: `cop/packet-attractor`

Minimum artifact (extends the seed in
[`reactive_cognitive_cop_extension.md`](reactive_cognitive_cop_extension.md)):

```json
{
  "artifactType": "cop/packet-attractor",
  "id": "attractor:jhr-laptop:retrieval-inline",
  "node": {
    "resource_id": "resource://jhr-laptop",
    "trust_perimeter": "owner-operated"
  },
  "matches": {
    "packetKind": ["continuation", "cognitive-packet", "mandate"],
    "capabilities": [
      "retrieval.inline",
      "openai.embeddings",
      "supabase.rpc"
    ],
    "query": [
      { "corpus_key": "cogentia-public", "mode": "hybrid" }
    ],
    "verbs": ["retrieval.batch@v1"]
  },
  "legitimacy": {
    "mandate_surfaces": ["web-guide", "owner-cli"],
    "forbidden": ["private-view", "unbounded-provider-spend"]
  },
  "pressure": {
    "accepted": ["best-effort", "ttl", "bounded"],
    "default": "ttl"
  },
  "regime": {
    "current": "normal",
    "accepts": ["normal", "degraded"]
  },
  "availability": {
    "status": "online",
    "last_seen": "2026-07-03T15:04:00Z",
    "ttl_seconds": 300
  },
  "transport": {
    "profile": "inox.session.v1",
    "endpoint_ref": "secret://inox-serve-jhr-laptop"
  },
  "trace": {
    "advertised_event_required": true,
    "matched_event_required": true
  }
}
```

**Important:** `endpoint_ref` is a **reference**, never a secret value in git. The attractor may
exist without an endpoint when the node is only declaring **future** willingness under a durable
policy (cold standby).

### Control-plane inspectability

Matching must be possible from `matches`, `legitimacy`, `pressure`, `regime`, and `availability`
without decoding the full cognitive payload. This follows the envelope/payload split in
[`cognitive_packets.md`](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/cognitive_packets.md).

---

## 6. COP events (proposed)

| Event | Role |
|-------|------|
| `cop/attractor.advertised` | node publishes or refreshes an attractor |
| `cop/attractor.withdrawn` | explicit drain or shutdown |
| `cop/attractor.matched` | router selected this attractor for a packet |
| `cop/attractor.rejected` | match failed; reason coded (capability, legitimacy, ttl, regime) |
| `cop/attractor.degraded` | node still present but only under degraded policy |

These events make the **distributed blackboard observable**. Presence is not a silent K/V entry.

---

## 7. Relation to continuations

A Packet Attractor is not only for "happy path" delivery.

When a node receives a packet it **partially** satisfies, it may emit a
[`cop/continuation`](https://github.com/JeanHuguesRobert/inseme/blob/main/packages/cop-core/Architecture.md).
Another attractor — or the same node after fulfillment reinjection — may close the loop.

This is already visible in the proto stack:

```text
Guide → POST /session/turn (retrieval.batch)
     ← continuation (missing embedding / RPC)
     → fulfillment (local or remote)
     ← result packs
```

The attractor declares **entry points** into that loop. Continuations declare **suspension points**
inside it. Together they replace opaque RPC failure.

---

## 8. Fractanet blackboard reframed

Classic blackboard architecture:

```text
problem posted on board → specialists read → specialists write solutions
```

Fractanet equivalent:

```text
cognitive packet emitted → attractors match → capable node accepts → COP trace records match
                         → continuation if incomplete → another attractor or fulfiller
```

There is **no single board**. There is:

- a **verb registry** (slow, RAIX-mirrored);
- many **advertised attractors** (fast, TTL-bounded);
- **routers** that match envelopes to attractors under regime policy.

Fracta's role in MVP: **weak gateway** that routes envelopes and may **aggregate attractor
advertisements** — bootstrap only, not the long-term authority (see Fractanet RAIX constraints in
[`fractanet.md`](https://github.com/JeanHuguesRobert/FractaVolta/blob/main/research/fractanet.md)).

---

## 9. Worked example — `retrieval.batch`

**Nodes:**

| Node | Role | Attractor |
|------|------|-----------|
| fracta | public Guide gateway | none for heavy retrieval in Phase 4 target |
| jhr-laptop | capable retrieval host | `retrieval.inline`, intermittent |
| supabase region | data plane | not an attractor; reached via fulfiller |

**Sequence:**

1. Visitor asks Guide on fracta.
2. Guide builds envelope requiring `retrieval.batch@v1` with `corpus_key=cogentia-public`.
3. Router queries active attractors; `jhr-laptop` matches if `last_seen` fresh.
4. `inox.session.v1` turn executes on laptop.
5. If laptop offline → `cop/attractor.rejected` with reason `ttl_expired`; router applies verb
   fallback policy (`supabase` on fracta, `daemon-batch`, or explicit degraded response).
6. All steps traced.

This replaces the current startup-time backend selection in `cogentia-mcp-http.js`.

---

## 10. Graduation ladder (Inox)

From [`fractanet_language_abstractions.md`](https://github.com/JeanHuguesRobert/Inox/blob/master/research/fractanet_language_abstractions.md):

| Level | Form | Packet Attractor |
|-------|------|------------------|
| L0 | foreign broker (Redis, MQTT) | anti-pattern as authority |
| L1 | HTTP wrapper | fixed URL + bearer token |
| L2 | traced wrapper | logged session/turn |
| L3 | Fractanet capability verb | `retrieval.batch` with routing metadata |
| L4 | dialect | `inox-fractanet{}` attractor declarations |
| L5 | native primitive | `PacketAttractor` in Inox runtime |

The corpus is between **L1 and L3** today. This document defines the **L3 COP contract** so L5 can
be implemented without redesign.

---

## 11. MVP bootstrap vs target

| Stage | Routing | Acceptable? |
|-------|---------|-----------|
| **Now** | `COGENTIA_INOX_RETRIEVAL_URL` env var | yes as L1 bootstrap |
| **Next** | attractor advertised from capable host; fracta aggregates | proto Fractanet |
| **Target** | RAIX-mirrored attractor advertisements; multi-gateway routers | Fractanet invariant |

Do not mistake the bootstrap for the architecture.

---

## 12. Objections and safeguards

### Objection 1 — Attractors recentralize on fracta

Valid risk. Mitigation: advertisements are **signed, TTL-bounded, forkable mirrors**; fracta is one
aggregator, not the sole authority.

### Objection 2 — Matching is expensive

Start with tiny attractor sets (2–10 nodes), coarse capability keys, no global optimization. Exergy
scoring comes **after** hard constraints, per Fractanet MVP.

### Objection 3 — Duplicate COP and Inox semantics

Safeguard unchanged: COP defines artifacts/events; Inox executes matching and antistate.

### Objection 4 — Legitimacy is hard

Start with coarse mandate surfaces (`web-guide`, `owner-cli`) and explicit `forbidden` lists from
existing Guide mandates.

---

## 13. Levels of evidence

### Level A — Established in corpus

- Reactive Cognitive COP Extension proposes `cop/packet-attractor`.
- Inox implementation path names native `PacketAttractor`.
- `inox.session.v1` demonstrates continuation loop closure.
- Fractanet requires verb registry and programmable routing.

### Level B — Defensible interpretation

- Intermittent capable nodes should advertise attractors, not fixed URLs.
- Fractanet "blackboard" = attractor matching + COP traces, not centralized K/V.
- Operium holds slow node profiles; attractors hold fast availability.

### Level C — Hypothesis to implement

- Guide can select retrieval backend from attractor snapshot without service restart.
- RAIX-mirrored attractor advertisements reduce capture vs single aggregator.

### Level D — Inspiration only

- Classical AI blackboard and pub/sub brokers as ancestors, not authorities.

---

## 14. Continuation

1. Add a short derived section to
   [`REACTIVE_COGNITIVE_EXTENSION.md`](../packages/cop-core/REACTIVE_COGNITIVE_EXTENSION.md)
   pointing here for the canonical definition.
2. Add an Inox sibling note or section in
   [`reactive_sets_inox_cop_implementation.md`](https://github.com/JeanHuguesRobert/Inox/blob/master/research/reactive_sets_inox_cop_implementation.md)
   for native matching semantics.
3. Update FractaVolta [`concepts.md`](https://github.com/JeanHuguesRobert/FractaVolta/blob/main/research/concepts.md)
   to distinguish evolutionary vs Fractanet Packet Attractor.
4. Prototype: laptop publishes `cop/attractor.advertised` on wake; fracta Guide reads snapshot before
   `session/turn`.
5. Track implementation as GitHub continuation packets when coding begins.

---

## Cognitive packets YAML

```yaml
cognitive_packet:
  id: packet_attractor_fractanet.v0.1
  title: "Packet Attractor — Fractanet routing primitive"
  type: "source document"
  definition: >
    COP-visible declarative demand structure by which a Fractanet node attracts governed packets
    matching capability, query, legitimacy, pressure and regime — enabling distributed routing
    without fixed endpoints or a centralized blackboard.
  status: "working source artifact"
  repository: "JeanHuguesRobert/inseme"
```

```yaml
cognitive_packet:
  id: fractanet_blackboard_as_attractor_matching.v0.1
  title: "Fractanet blackboard as attractor matching"
  type: "architectural invariant"
  definition: >
    The Fractanet distributed blackboard is not a shared mutable table; it is the union of
    advertised packet attractors, router matching under envelope constraints, and COP-traced
    selection events.
  origin: "Jean Hugues Robert continuation — 2026-07-03"
  status: "load-bearing concept"
```