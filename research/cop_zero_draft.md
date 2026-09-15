---
title: COP Zero Draft — Mission-Bearing Cognitive Packet Kernel
subtitle: A clean-slate exploratory hypothesis for the Cognitive Orchestration Protocol
version: 0.0.1
status: exploratory-zero-draft
normative: false
date: '2026-07-20'
author: Jean Hugues Noël Robert, baron Mariani
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
license: CC BY-SA 4.0
language: en
canonical_url: https://github.com/JeanHuguesRobert/inseme/blob/main/research/cop_zero_draft.md
issue: https://github.com/JeanHuguesRobert/inseme/issues/20
corpus_role: source
document_role: source
document_kind: architecture-zero-draft
visibility: public
lifecycle_state: working
human_validation_required: true
update_policy: UP-DEFAULT-REVIEWED
ai_assisted_by:
  - OpenAI Codex
provenance:
  origin_type: conversation-checkpoint
  origin_repository: JeanHuguesRobert/inseme
  origin_ref: issue-20
  origin_date: '2026-07-20'
  derived_from:
    - Conversation checkpoints R31-R40 on agents, cognitive packets, Fractanet and COP
    - https://github.com/JeanHuguesRobert/inseme/issues/20
review:
  status: pending-human-validation
  reviewed_by: []
tags:
  - cop
  - cognitive-packet
  - packet-lineage
  - mission
  - mandate
  - continuation
  - control-plane
  - packet-attractor
  - fractanet
classification_source: cogentia.js
classification_version: '1'
classification_rule: explicit-metadata
classification_confidence: medium
---


# COP Zero Draft — Mission-Bearing Cognitive Packet Kernel

## 0. Status and purpose

This document is an **exploratory Zero Draft**. It is not a COP specification, does not supersede
the current COP Architecture or Invariants, and does not authorize implementation changes.

Its purpose is to test one clean-slate hypothesis:

> The central unit of work in COP is not the agent, Task, Step, scheduler, or conversation. It is a
> mission-bearing cognitive packet whose work can continue across replaceable human, software,
> institutional, cyber-physical, or hybrid handlers.

There is currently no installed COP base whose compatibility must constrain this exploration. The
existing documents and implementation are evidence, prototypes, and reservoirs of useful
abstractions, but they are not authorities over this Zero Draft.

This draft deliberately asks whether a smaller kernel can describe three materially different
cases without hidden special machinery:

1. a uniquely identified physical bottle travelling through human custody;
2. a CLI/LLM continuation resumed by a replaceable handler;
3. a cognitive request routed through intermittent Fractanet nodes.

Failure to express any of these cases cleanly is evidence against the hypothesis.

---

## 1. Candidate one-sentence definition

> **The Cognitive Orchestration Protocol specifies how mission-bearing cognitive packets are
> emitted, offered, routed under mandate, accepted by compatible capabilities, processed by
> replaceable handlers, continued or controlled in flight, and returned with traceable results.**

The word *orchestration* does not imply a central orchestrator. Orchestration may emerge through
distributed matching between packet requirements and currently advertised capabilities.

---

## 2. Design target

The candidate kernel should support work that is:

- asynchronous or synchronous;
- short-lived or intergenerational;
- digital, physical, or hybrid;
- transmitted by copy, reference, or custody;
- processed by humans, software, machines, organizations, or combinations of them;
- paused and resumed without inaccessible handler memory;
- redirected or amended under explicit control authority;
- split, replicated, merged, returned, rejected, expired, or abandoned;
- reconstructible enough to explain what happened, under whose authority, and with which result.

The kernel should not require:

- a central scheduler;
- a fixed workflow graph;
- a permanent agent process;
- a globally available database;
- a specific runtime, model, transport, or storage engine;
- deterministic re-execution of human or AI cognition.

---

## 3. Minimal conceptual objects

### 3.1 Packet

A **Packet** is an immutable, bounded unit presented at a processing boundary.

It contains or references enough information for a receiver to:

- identify it;
- determine what kind of packet it is;
- inspect routing and control metadata without opening the full payload;
- decide whether it is capable and authorized to accept it;
- process, refuse, continue, split, merge, return, or otherwise dispose of it explicitly.

A packet instance is immutable. Processing produces observations, Artifacts, effects, and zero or
more successor packets.

### 3.2 PacketLineage

A **PacketLineage** is the persistent causal identity connecting packet instances that continue,
revise, fork, merge, or return the same work.

The lineage, not an individual serialization, carries the long-lived journey.

```text
Packet instance = immutable boundary object
Packet lineage  = persistent causal continuity
Journey         = projection of the lineage's observed history
```

### 3.3 Mission

A **Mission** is a versioned statement of intended transformation, completion conditions, return
conditions, and control rules.

A Mission is not a claim that the desired result is possible, desirable, lawful, or guaranteed. A
mission may be exploratory, impossible, open-ended, suspended, revoked, or superseded.

The leading hypothesis is that a Mission should be an immutable, versioned Artifact referenced by
packets. A control operation creates a new Mission version; it does not rewrite an old packet or
Mission Artifact.

### 3.4 Artifact and ContentRef

An **Artifact** is immutable durable content produced, consumed, cited, or preserved during a
packet journey.

A **ContentRef** identifies content without confusing identity with location. Resolution hints may
change while content identity remains stable.

```text
Artifact identity ≠ filesystem path ≠ URL ≠ current storage location
```

### 3.5 Mandate

A **Mandate** is a bounded, traceable, versioned, suspendable, and revocable grant of authority.

It must remain distinct from:

- mission: what is sought;
- capability: what can be done;
- availability: what can be done now;
- custody: who currently holds an object or processing lease;
- responsibility: to whom an act is imputable.

Possessing a packet does not grant authority to perform every act described in it.

### 3.6 Handler, Node, Capability, and Packet Attractor

A **Handler** is any human, software, machine, institution, or hybrid arrangement that accepts a
packet at a processing boundary and produces an Outcome.

A **Node** is an environment exposing one or more handlers or capabilities.

A **Capability** is a potential to observe, judge, transform, communicate, store, transport, or act.

A **Packet Attractor** is a time-bounded declaration that a node or handler is willing, capable,
and potentially legitimate to accept packets matching stated envelope conditions.

### 3.7 Outcome

An **Outcome** is the explicit disposition produced by handling a packet.

Candidate outcome classes are:

```text
delivered(result packet)
continued(successor packet)
suspended(continuation packet)
split(successor packets)
merged(result packet)
rejected(reason packet)
failed(error packet, optional continuation)
```

An Outcome is not necessarily successful. It is successful as a protocol operation when it makes
the packet's disposition explicit and traceable.

---

## 4. Packet, lineage, mission, and journey

The distinction between packet instance and lineage prevents a conflict between immutability and
lifecycle.

```text
Mission M(v1)
    ↓ referenced by
Packet P0 — issued
    ↓ continues
Packet P1 — partially processed
    ├── fork → Packet P2a
    └── fork → Packet P2b
              ↓
         Packet P3 — merged result
              ↓
         Packet P4 — return
```

All packet instances are immutable. The Journey is reconstructed from their causal relations and
recorded observations.

Candidate identity relations:

| Relation | Meaning |
|---|---|
| `continues` | successor resumes substantially the same work |
| `forks` | successor opens an independently processable branch |
| `replicates` | another carrier represents the same logical packet for resilience |
| `revises` | successor applies an authorized Mission or control revision |
| `merges` | successor combines two or more causal branches |
| `returns` | successor carries a result toward a declared return target |

These relations must not be inferred merely from shared payload content.

---

## 5. Envelope, payload, and transmission modes

### 5.1 Envelope/payload separation

The Envelope contains the minimum information needed to offer, match, authorize, route, prioritize,
lease, trace, and return a packet without interpreting its full cognitive content.

The Payload contains or references the content on which the selected handler may work.

The separation is both architectural and protective: a router should not need to read a lost-love
message, medical detail, private document, or confidential deliberation merely to find a legitimate
handler.

### 5.2 Candidate transmission modes

| Mode | Meaning |
|---|---|
| `copy` | the receiver obtains an independently usable copy |
| `reference` | the receiver obtains a resolvable reference to shared or remote content |
| `custody` | the receiver temporarily holds a singular object or exclusive processing lease |

Custody introduces obligations that copy and reference do not necessarily have:

- explicit acceptance;
- identified custodian;
- transfer or return conditions;
- loss, damage, abandonment, and recovery semantics;
- limits on duplication or concurrent action.

Digital processing may also use custody semantics through a time-bounded processing lease when an
effect must not be performed concurrently by multiple handlers.

### 5.3 Exploratory packet shape

The following is a discussion object, not a normative schema:

```json
{
  "packetId": "packet:uuid",
  "lineageId": "lineage:uuid",
  "kind": "work",
  "schemaVersion": "cop.packet.exploratory.v0",
  "envelope": {
    "mission": {
      "ref": "artifact:mission:uuid",
      "version": 1
    },
    "mandateRefs": ["artifact:mandate:uuid"],
    "phase": "outbound",
    "requiredCapabilities": ["capability:example"],
    "handlingMode": "copy",
    "return": {
      "to": "subject:principal",
      "when": "mission-terminal"
    },
    "parentPacketIds": [],
    "tracePolicy": "durable",
    "disclosure": "envelope-only"
  },
  "payload": {
    "mode": "reference",
    "contentRef": {
      "algorithm": "sha256",
      "digest": "...",
      "mediaType": "application/json"
    }
  }
}
```

Fields remain candidates. In particular, Mission placement, mandate representation, phase, return
stacks, disclosure, and trace policy remain open.

---

## 6. Processing algebra

The candidate kernel is one abstract transformation:

```text
handle(packet, context) → outcome
```

The context may provide:

- currently valid Mandates and control policies;
- available capabilities;
- resolved Artifacts or ContentRefs;
- local time and regime;
- prior causal observations;
- privacy and disclosure constraints;
- a means to append traces and emit successor packets.

Conceptually:

```text
P ── Handler H under Mandate M ──▶ Outcome O
O = observations + artifacts + effects + successor packets
```

For every successor `Q` of `P`:

```text
P.packetId ∈ Q.envelope.parentPacketIds
```

Consequential external effects require an explicit authorization reference and an effect receipt.
A proposed effect, an authorized effect, an attempted effect, and an observed effect are distinct.

### 6.1 Exploratory Outcome shape

```json
{
  "outcomeId": "outcome:uuid",
  "consumedPacketId": "packet:uuid",
  "disposition": "continued",
  "handlerRef": "handler:uuid",
  "mandateRef": "artifact:mandate:uuid",
  "successorPacketIds": ["packet:successor-uuid"],
  "artifactRefs": ["artifact:partial-result-uuid"],
  "observationRefs": ["event:packet-continued-uuid"],
  "effectReceipts": []
}
```

This shape must remain subordinate to scenarios and invariants. It should not become a schema until
the Zero Draft is accepted as an experimental kernel hypothesis.

---

## 7. Mission versioning and control packets

A Mission may change while its packet lineage remains alive. Changes must affect the future without
rewriting the past.

Candidate transition:

```text
Mission(v2) = apply(Mission(v1), authorized ControlPacket)
```

A control packet should identify at least:

- target lineage or Mission;
- expected Mission version;
- requested control operation;
- control authority or Mandate;
- effective conditions;
- reason and provenance;
- return target for acknowledgement, refusal, or required judgment.

Candidate operations include:

```text
amend-mission
retarget
change-return
suspend
resume
revoke
extend
authorize-fork
merge
close
resurrect
```

Optimistic concurrency is a candidate requirement:

```text
control.expectedMissionVersion == currentMissionVersion
```

If the target has advanced, the control packet must be rejected, rebased, merged under policy, or
turned into a continuation requiring judgment. It must not silently overwrite concurrent control.

The control plane uses the same packet grammar and may itself require routing, handling,
continuation, return, and trace. Its authority terminates in an explicit principal, constitution,
or other recognized authority boundary rather than in a technically privileged central process.

---

## 8. Outbound travel, continuation, and return

The packet journey has at least two logical directions:

```text
outbound: toward capabilities capable and authorized to advance the Mission
return:   toward the declared recipient of results, accounts, or the physical carrier
```

The return route need not reverse the outbound route.

```text
outbound route ≠ return route
```

A terminal result is not merely an absence of more work. It must have an explicit disposition:

- delivered to a declared target;
- waiting for acknowledgement;
- rejected by the target;
- expired;
- lost or unreachable;
- archived under an explicit terminal policy;
- converted into a new Mission.

A Continuation is the normal non-terminal result of processing when more work, capacity, time,
information, authorization, or judgment is required.

Nested delegation may form a continuation return stack:

```text
A delegates to B
B delegates to C
C returns to B
B transforms the result
B returns to A
```

Whether this stack belongs in the Envelope, in a referenced Artifact, or in a causal projection
remains open.

---

## 9. Packet Attractors and mandate-aware matching

A Packet Attractor declares structured, time-bounded willingness and capability to accept certain
packets. It is not itself proof of authority.

Candidate matching condition:

```text
match(packet, attractor, context)
= capability-compatible
∩ mandate-compatible
∩ regime-compatible
∩ disclosure-compatible
∩ availability-valid
∩ pressure-compatible
```

Hard constraints should be evaluated before soft preferences such as cost, latency, locality,
energy, exergy, reputation, kudos, or path diversity.

Payload disclosure should normally follow a two-stage exchange:

```text
1. offer inspectable Envelope
2. discover candidate Attractors
3. candidate accepts or proposes handling conditions
4. validate Mandate, policy, custody, and lease
5. disclose or resolve Payload
6. process
```

The packet attracts capacity by expressing demand. The node attracts packets by advertising
capacity. Attraction is therefore a relation, not a substance owned exclusively by either side.

No Packet Attractor, router, scheduler, registry, or gateway becomes authoritative merely because
it is technically reachable or operationally convenient.

---

## 10. Candidate conservation laws

These are hypotheses to test, not accepted COP invariants.

### 10.1 Conservation of causality

> No non-genesis packet appears without explicit causal parentage.

### 10.2 Conservation of accepted work

> Every accepted packet produces a result, continuation, refusal, failure, transfer, or explicit
> pending disposition. A handler must not silently swallow accepted work.

### 10.3 Conservation of authority

> A handler cannot delegate or exercise more authority than it validly received.

```text
delegated authority ≤ received and delegable authority
```

### 10.4 Conservation of Mission history

> Mission changes are new, authorized, causally linked versions. Past Mission versions and the acts
> performed under them remain visible according to their retention and disclosure policies.

### 10.5 Conservation of identity

> Continuation, revision, fork, replica, merge, and custody transfer are explicit relations, not
> accidental consequences of copying similar bytes.

### 10.6 Conservation of return

> A terminal result identifies the Mission and return disposition to which it responds.

### 10.7 Conservation of resumability

> No state required for correct continuation remains exclusively in inaccessible handler memory.

### 10.8 Conservation of accountability

> Every consequential act is attributable to a handler, an authority or Mandate, and a traceable
> effect receipt. Capability alone never establishes legitimacy.

---

## 11. Relationship to Event, Artifact, and View

The leading layered hypothesis is:

```text
Packet   = unit crossing a processing boundary
Event    = immutable observation that something happened
Artifact = immutable durable content
View     = reconstructible projection of recorded history
```

Everything crossing a COP processing boundary should use packet form. Not everything stored or
represented by COP must therefore be ontologically reduced to a packet.

An Event may be carried inside a packet when it must circulate. An Artifact may be embedded or
referenced by a packet. A View may project a packet lineage into familiar structures such as a
Task, Step list, conversation, mission dashboard, custody history, accounts, or audit trail.

This avoids the current ambiguity:

```text
packet ≈ Event or Artifact projection carrying a Continuation
```

The exact Event/Packet boundary remains open and must be tested against replay, federation, privacy,
and physical custody. The Zero Draft does not yet decide whether every persisted Event should also
be representable as a packet kind.

---

## 12. Existing COP concepts under this hypothesis

### 12.1 Retained at or near the kernel

- immutable observations and durable Artifacts;
- explicit causality;
- idempotent processing where duplicate delivery is possible;
- continuation as a first-class, normal Outcome;
- envelope/payload separation;
- schema versioning;
- reconstructible projections;
- explicit human or institutional anchors for consequential acts;
- transport and runtime independence.

### 12.2 Demoted from primitive to View, profile, or implementation role

| Existing concept | Candidate new status |
|---|---|
| `Topic` | ordering/coherence profile or View |
| `Task` | Mission or packet-lineage View |
| `Step` | handling-episode View |
| `Scheduler` | optional matching/wake implementation role |
| `Agent` | identity capable of holding a Handler role |
| `COPAgent.onEvent` | one possible packet Handler profile |
| `Job` | runtime scheduling profile |

### 12.3 Candidate assumptions to remove

- every meaningful process has exactly one Topic;
- every Topic requires strict, gap-free total ordering;
- every continuation targets a named agent;
- every Task requires a preassigned worker agent;
- at-least-once delivery is universal across all physical and digital substrates;
- handler statelessness means handlers cannot retain any local memory;
- a central scheduler is conceptually primary.

The replacement hypothesis is narrower: no correctness-critical continuation state may remain
hidden, and ordering guarantees should be no stronger than the Mission, effect, or replay semantics
actually require.

### 12.4 Explicitly open

- whether Mission is always an Artifact or may be copied inline;
- whether PacketLineage is itself a protocol object or only a causal projection;
- whether Event is a packet kind or a distinct persistence concept;
- whether return uses one target, a stack, a graph, or a policy;
- how exclusive custody and digital processing leases interact;
- which ordering constraints apply to a lineage with concurrent forks;
- how control authority chains terminate and remain verifiable;
- how selective disclosure and encrypted payload negotiation work;
- how privacy, erasure, retention, and immutable traces coexist;
- how a long-lived or impossible Mission remains alive without creating immortal operational debt.

---

## 13. Falsification scenarios

### 13.1 Immortelle bottle

#### Situation

A Casa Mariani perfume bottle has a unique engraved identifier and an attached or embedded
machine-readable carrier. Its buyer defines a Mission. The bottle travels through successive human
custodians, may collect testimonies, may seek a destination or class of people, and may eventually
return to its source. An authorized control rule may change the Mission during the journey.

#### Candidate COP expression

```text
physical bottle identity
→ referenced by genesis Packet P0
→ Mission M(v1)
→ handlingMode: custody
→ public or bounded handling Mandate
→ successive acceptance and custody-transfer Outcomes
→ testimony Artifacts
→ ControlPacket creates M(v2)
→ completion condition triggers return Packet
→ custody returns physically or result returns logically
→ acknowledgement closes or continues the lineage
```

The bottle is a physical carrier of packet identity and Mission reference. It is passive between
encounters. Human or machine handlers actualize its latent agency.

#### What this scenario tests

- singular physical identity;
- custody rather than mere copy/reference;
- long latency;
- human handlers without permanent accounts or software processes;
- authorized Mission change;
- testimonies as Artifacts;
- return distinct from completion;
- loss, abandonment, damage, and resurrection.

#### Falsifiers

The kernel hypothesis is weakened if physical custody requires an unrelated bespoke workflow, if
Mission change cannot be represented without rewriting history, or if return cannot distinguish the
physical carrier from its digital result and testimony lineage.

### 13.2 CLI/LLM continuation

#### Situation

A CLI tool receives a cognitive packet, performs partial work, and cannot proceed without external
judgment or a missing capability. It emits a continuation. A different human, model, process, or
machine later resumes the work and returns a result to the caller.

#### Candidate COP expression

```text
Packet P0 transmitted by copy or reference
→ Handler A accepts under Mandate
→ partial Artifact + continuation Packet P1
→ P1 advertises required capability or judgment
→ Handler B accepts
→ Packet P2 continues the lineage
→ result Packet P3 returns to declared caller
→ caller acknowledges or emits another continuation
```

#### What this scenario tests

- transport neutrality;
- handler replaceability;
- complete externalized resume state;
- partial results;
- capability-bound rather than identity-bound resumption;
- nested return addresses;
- idempotence under retry.

#### Falsifiers

The kernel hypothesis is weakened if the resumed handler needs inaccessible conversation memory, if
the continuation must name one permanent agent, or if partial results and return require an external
workflow graph not expressible through packet relations.

### 13.3 Intermittent Fractanet node

#### Situation

A packet requires a retrieval or transformation capability. Nodes are intermittently available.
They advertise Packet Attractors with TTL, regime, legitimacy, pressure, and capability metadata. A
selected node may disappear, refuse, partially process, or return through another path.

#### Candidate COP expression

```text
Packet P0 declares requiredCapabilities
→ router inspects Envelope only
→ active Attractors are matched
→ candidate accepts under Mandate and processing lease
→ Payload is disclosed or resolved
→ node processes, refuses, or emits continuation P1
→ expired Attractor becomes ineligible
→ fallback Attractor accepts P1
→ result Packet returns through a different route
→ causal projection explains every selection and refusal
```

#### What this scenario tests

- no central scheduler requirement;
- intermittent availability and TTL;
- capability and legitimacy as separate filters;
- envelope-only routing;
- fallback and degradation;
- processing leases;
- route diversity;
- continuation across nodes;
- reconstructible selection explanations.

#### Falsifiers

The kernel hypothesis is weakened if routing requires payload inspection, if Attractors silently
become authorities, if node disappearance loses indispensable state, or if fallback breaks causal
identity or return correlation.

### 13.4 Preliminary scenario verdict

The same candidate vocabulary appears sufficient for all three scenarios:

```text
Packet
PacketLineage
Mission
Mandate
Artifact / ContentRef
Capability / Packet Attractor
Handler
Outcome
Event / View
```

This is encouraging evidence, not validation. The scenarios remain prose models and must later
become executable conformance vectors before the kernel can be considered operationally credible.

---

## 14. Open questions and research pressure

### Identity

- Does a lineage need a stable issued identifier, or can it be derived from a causal root?
- How are accidental duplicates distinguished from intentional replicas?
- Can two lineages merge without losing independent provenance?

### Mission

- Is a Mission always a separate Artifact?
- What is the minimum Mission content: objective, completion predicate, return policy, control
  policy, expiry, disclosure, and failure policy?
- Can a Mission be intentionally impossible or indefinite without leaking resources forever?

### Mandate and control

- Which operations require an explicit Mandate, and which may be performed under public protocol
  rules?
- How is control authority proved offline or across weakly connected nodes?
- Can a ControlPacket amend the control policy that governs its own validity?

### Processing

- Is `handle(packet, context) → outcome` sufficient for streams, repeated observations, and
  long-lived human custody?
- Must acceptance always create a lease or custody receipt?
- How are irreversible effects reserved, authorized, executed, compensated, and evidenced?

### Ordering and replay

- Is causal partial order sufficient for the kernel?
- Which profiles require strict local sequencing?
- What does deterministic replay mean when custody observations arrive late or conflict?

### Privacy and retention

- How much Mission information may appear in a routable Envelope?
- How are selective disclosure, encrypted payloads, consent, revocation, and erasure represented?
- Can immutable causal integrity coexist with legally or ethically necessary content deletion through
  tombstones, redaction proofs, or cryptographic erasure?

### Return

- Is return a packet kind, a causal relation, a phase, or all three at different layers?
- How are multiple beneficiaries, partial returns, acknowledgements, and failed delivery represented?
- When does a returned result close a Mission, and when does it seed a new Mission?

---

## 15. Human validation checkpoint

This document stops before schemas, code, package changes, or normative edits.

The requested human decision is exactly one of:

```text
reject
revise
accept as the experimental COP kernel hypothesis
```

Acceptance would mean only:

- the packet-centered kernel is a sufficiently coherent hypothesis to formalize;
- a separate bounded issue may define experimental JSON Schemas;
- the three scenarios may be converted into executable conformance vectors.

Acceptance would not yet:

- replace the current COP Architecture or Invariants;
- authorize implementation or database changes;
- stabilize names as public doctrine;
- require compatibility or migration work;
- authorize changes in Cogentia, Inox, FractaVolta, or other repositories.

### Continuation if accepted

Create a new bounded issue for:

```text
COP Experimental Packet Kernel
→ JSON Schemas
→ generated language types
→ three executable conformance vectors
→ no runtime beyond validation and pure projection
```

Until that decision, this Zero Draft remains an exploratory source document and a falsifiable packet
in the corpus rather than a normative COP specification.

---

## Associated sources

- [COP Architecture and Specification](../packages/cop-core/Architecture.md)
- [COP Protocol Invariants](../packages/cop-core/Invariants.md)
- [COP Reactive Cognitive Extension](../packages/cop-core/REACTIVE_COGNITIVE_EXTENSION.md)
- [Packet Attractor — Fractanet Distributed Demand and Capability Routing](packet_attractor_fractanet.md)
- [Cognitive Packets](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/cognitive_packets.md)
- [Cognitive Packet Switching](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/cognitive_packet_switching.md)
- [Fractanet — Generalized Control Planes for Heterogeneous Packet Networks](https://github.com/JeanHuguesRobert/FractaVolta/blob/main/research/fractanet.md)

