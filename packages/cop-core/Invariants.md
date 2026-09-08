---
canonical_url: https://github.com/JeanHuguesRobert/inseme/blob/main/packages/cop-core/Invariants.md
author: "Jean Hugues Noël Robert, baron Mariani"
affiliation: "Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica"
license: "CC BY-SA 4.0"
last_modified_at: 2026-09-08
last_stamped_at: 2026-06-01
---

# COP Protocol Invariants

This document defines the **non-negotiable invariants** of the Cognitive Orchestration Protocol
(COP).

Any system claiming COP compliance MUST preserve these invariants.

They are architectural constraints, not implementation suggestions.

---

## 1. Immutability

**Traces, Events, Artifacts, and EvidenceRelations are immutable.**

Once created:

- a TraceRef or TraceDescriptor MUST never be modified or deleted,
- an Event MUST never be modified or deleted,
- an Artifact MUST never be modified or deleted,
- an EvidenceRelation MUST never be modified or deleted.

Corrections, updates, or reversals MUST be expressed as **new Events** or **new EvidenceRelations**.
Assertions can be superseded or marked disputed, but their historical assertion records are never erased.

Immutability guarantees:

- auditability,
- causal reasoning,
- deterministic replay and reconstructibility,
- long-term integrity.

### 1.1 Retention, visibility, and governed erasure

Immutability protects the authoritative causal record. It does not require
unbounded retention or public exposure of every payload that a record may
reference. Privacy, confidentiality, safety, and applicable legal duties
remain independent constraints.

Where an explicitly authorized erasure, redaction, or destruction of sensitive
content is necessary, it MUST NOT silently mutate the retained COP record or
rewrite the historical sequence. The operation MUST leave a proportionate,
non-reconstructive trace of its authority, scope, time, and effect, while
avoiding renewed disclosure of the protected content.

Trace temperature, indexing, caching, visibility, and payload availability are
therefore lifecycle concerns. They do not change the identity, occurrence, or
imputation of a retained Event, Trace, Artifact, or EvidenceRelation.

---

## 2. Topic-Local Ordering

All Events belong to exactly one **Topic**.

Within a Topic:

- Events are totally ordered by a monotonically increasing `topicSeq`,
- ordering MUST be strict and gap-free for persisted Events.

Across Topics:

- no global ordering is assumed,
- causal links MAY exist via explicit references.

Topic-local ordering is the foundation of procedural replay.

---

## 3. Idempotency

Event delivery is **at-least-once**.

Therefore:

- Projectors MUST be idempotent,
- repeated processing of the same Event or Trace observation MUST NOT corrupt state,
- deduplication MUST rely on Event/Trace identity and integrity hash, not transport guarantees.

Idempotency enables:

- retries,
- fault tolerance,
- distributed execution.

---

## 4. Durability & Reconstructibility

COP preserves and governs locally authoritative traces and reconstructible projections over them.
Native COP Events are the canonical procedural traces of COP-mediated activity.

All meaningful system state MUST be derivable from:

- the append-only Event log and the set of Artifacts (for procedural history),
- and authoritative Traces, Assertions, and EvidenceRelations (for corpus knowledge).

No critical state MAY live exclusively in:

- handler-instance memory,
- process-local variables,
- ephemeral caches, local SQLite databases, or vector stores.

Projections, materialized views, indexes, and caches are derived and non-authoritative
(`is_authoritative: false`, `is_derived: true`). If a derived view cannot be reconstructed
from authoritative source traces and policy, it is not valid COP state.

---

## 5. Stateless Handlers

Handlers MUST be stateless.

This means:

- no mutable in-memory state across events,
- no reliance on hidden local caches for correctness,
- all context must be obtained from the Store, EvidenceGraph, or Continuation payloads.

Stateless handlers enable:

- horizontal scalability,
- restartability,
- deterministic replay,
- safe evolution of agent code.

---

## 6. Isolation via Events and Packets

Handlers MUST NOT communicate directly with each other.

All coordination MUST occur via:

- Events published to the Bus,
- Artifacts referenced by Events,
- or Cognitive Packets carrying trace facts and explicit continuations.

This ensures:

- loose coupling,
- clear causality,
- inspectable interactions,
- elimination of hidden dependencies.

---

## 7. Deterministic Replay & Pure Projection

Given:

- the same ordered Event log per Topic,
- the same authoritative Traces, Assertions, and EvidenceRelations,
- the same Artifact set,
- and deterministic Projectors under the same version and policy,

replay and reconstruction MUST reconstruct the same observable state and derived views.

> **The same authoritative source set + projector version + applicable policy MUST be sufficient to reconstruct an equivalent derived view where determinism is claimed.**

Non-determinism MUST be externalized as Events, Artifacts, or explicit Assertions.

---

## 8. Epistemic Separation & Non-Amplification of Authority

A Trace is an evidential imprint, not a truth claim. Assertions represent propositions held by the
Corpus and MUST remain distinct from the Traces that support, contradict, or contextualize them.

> **Projection, summarization, consolidation, caching, or LLM synthesis MUST NOT silently amplify epistemic status or authority relative to their sources.**

- An ungrounded or low-trust trace summarized into memory remains `hypothesized` or `inferred`.
- Only an authorized Principal with active Mandate authority can designate an assertion as `normative`.
- Conflicting evidence coexists non-destructively in the `EvidenceGraph`; contradiction does not cause historical deletion.

---

## 9. The Three Temporal Coordinates

Time semantics MUST distinguish:

1. **`occurred_at` (Valid-Time / Reality Time):** When the occurrence took place in reality, handled across multiple precisions (`exact`, `day`, `month`, `year`, `interval`, `approximate`, `unknown`).
2. **`trace_created_at` (Physical Registration Time):** When the external artifact or record was created.
3. **`observed_or_ingested_at` (Corpus Ingestion Time):** When COP observed or registered the trace.

External trace ingestion MUST NOT fictionalize COP as the origin of pre-existing realities. External traces enter via `TraceObservation` events with `cop_originated: false`.

---

## 10. Schema Versioning

Events, Artifacts, Traces, Assertions, and Projections MUST carry explicit schema version identifiers.

Rules:

- new versions MUST be backward-readable,
- old versions MUST remain interpretable,
- breaking changes require explicit major versioning.

Versioning protects long-term interpretability.

---

## 11. Transparency over Convenience

COP favors:

- explicitness over hidden magic,
- durability over short-term performance,
- inspectability over opaque abstractions.

If an optimization violates an invariant, it is invalid.

### 11.1 Scope of Determinism and the Role of Human Anchors

The invariants guarantee deterministic replay of the _trace_ (Events, causal ordering, Artifacts
produced, continuation states). They do not require or promise deterministic re-execution of the
cognitive processes that generated those Artifacts.

When a handler step (human judgment or AI reasoning) is involved, the same inputs and context may
produce different outputs. This non-determinism is often valuable for exploration. What matters for
auditability and imputability is that the _trace_ — including the specific output chosen and, when
relevant, the human decision that enacted or validated it — is immutably recorded.

Consequently, for processes that carry real consequences, the presence of explicit human-enacted
decision Artifacts (see COP/HITL profile) is not optional decoration: it is the necessary anchor
that preserves imputability, skin in the game, and resistance to diffuse or hidden capture. Without
such anchors, traceability of the log remains, but accountability dissolves.

---

## 12. Governed Delegation Profiles

COP Core distinguishes protocol invariants from governance profiles. Systems in which an actor exercises consequential capabilities for a principal SHOULD additionally declare conformance with [`COP_MANDATED_AGENT_SECURITY.md`](COP_MANDATED_AGENT_SECURITY.md).

That profile formalizes the Corpus rule:

```text
operational autonomy != autonomous authority
```

and specifies mandate-version pinning, non-self-elevation, revocation/recovery semantics and capacity portability. These rules are deliberately profiled first rather than silently promoted to universal COP Core invariants before implementation experience exists.

---

## Final Note

These invariants are what make COP different.

Violating any of them may produce a working system — but not a COP system.
<!-- BEGIN_AUTO: backlinks -->
### Backlinks

*These documents link to this file:*
- [Rendre capable — noyau doctrinal provisoire](https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/noyau_doctrinal_rendre_capable.md)
- [Fractanet — Generalized Control Planes for Heterogeneous Packet Networks](https://github.com/JeanHuguesRobert/FractaVolta/blob/main/research/fractanet.md)
- [Concept Index — inseme](../../research/concepts.md)
- [COP Reactive Cognitive Extension](REACTIVE_COGNITIVE_EXTENSION.md)
- [Reactive Cognitive COP Extension](../../research/reactive_cognitive_cop_extension.md)
- [Research Index — Inseme](../../research/index.md)
<!-- END_AUTO: backlinks -->
