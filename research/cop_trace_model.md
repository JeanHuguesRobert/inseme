---
title: COP Trace Model — Trace as Unified Epistemic and Computational Substrate
subtitle: Normative trace-centric architecture for COP 2.x and the Reactive Corpus
description: Normative specification of the COP 2.x Trace-centric substrate, defining the distinction between raw evidence (Trace), procedural history (Event), propositions (Assertion), evidence linkages (EvidenceRelation), and derived views (Projection).
author: Jean Hugues Noël Robert, baron Mariani
affiliation: Institut Mariani / C.O.R.S.I.C.A. / Inseme
canonical_url: https://github.com/JeanHuguesRobert/inseme/blob/main/research/cop_trace_model.md
version: '1.0'
status: 'normative architecture — approved under Epic #61 and Issue #62'
date: '2026-09-06'
last_modified_at: '2026-09-06'
last_stamped_at: '2026-09-06'
license: CC BY-SA 4.0
language: en
type: source-document
source_or_derived: source-document
related_repositories:
  - JeanHuguesRobert/inseme
  - JeanHuguesRobert/FractaVolta
  - JeanHuguesRobert/barons-Mariani
  - JeanHuguesRobert/cogentia
related_documents:
  - inseme/packages/cop-core/Architecture.md
  - inseme/packages/cop-core/Invariants.md
  - inseme/packages/cop-core/Terminology.md
  - inseme/packages/cop-core/docs/trace-contradiction-review.md
  - inseme/packages/cop-core/docs/reactive-corpus-inox-mapping.md
  - inseme/research/cop_fractalog_profile.md
  - inseme/research/cop_memory_profile.md
  - inseme/research/cop_memory_map_territory.md
tags:
  - cop
  - cop-2.x
  - trace-model
  - reactive-corpus
  - evidence-graph
  - temporal-projection
  - normative-architecture
document_role: source
document_kind: architecture
visibility: public
lifecycle_state: active
classification_source: cogentia.js
classification_version: '1'
classification_rule: architecture
classification_confidence: medium
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


# COP Trace Model — Trace as Unified Epistemic and Computational Substrate

## 1. Executive & Doctrinal Decision

COP migrates from an Event-Centric architecture to a **Trace-Centric architecture** (COP 2.x,
[Epic #61](https://github.com/JeanHuguesRobert/inseme/issues/61)).

This is a **conceptual elevation**, not a mechanical rename or an exercise in backward
compatibility. In legacy COP 1.x, the procedural Event log was treated as the universal and
exclusive source of truth. In reality, external events, historical documents, scientific
observations, legal instruments, and physical occurrences exist prior to, outside of, and
independent from any COP instance.

### Core Architectural Principle

> **Reality leaves Traces. COP governs the transformations between Traces, Knowledge, Projections,
> Decisions, Acts, and new Traces.**
>
> Global knowledge is reconstructed from locally authoritative traces; native COP Events are the
> canonical procedural traces of COP-mediated activity.

```text
Reality
  ↓
Trace (external or procedural)
  ↓
Assertion / Interpretation
  ↓
Continuation / Projection
  ↓
Decision
  ↓
Act
  ↓
new Trace
```

---

## 2. Definitive Typology & Relationships

COP 2.x establishes non-overlapping, strictly typed boundaries between evidential, propositional,
operational, and derived constructs:

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     EVIDENTIAL LAYER                                        │
│  Trace (General causal/evidential primitive)                                               │
│    ├── TraceRef: Cryptographic handle (URI, sha256 integrity, target_type, locator)        │
│    └── TraceDescriptor: Observational metadata (kind, origin, custody, visibility, times)   │
│         ▲                                                                                   │
│         ├── Event: COP-native procedural trace of system activity (Event ⊂ Trace)           │
│         └── Artifact: Immutable content-addressed computational object (bytes, sha256)      │
└──────────────────────────────────────┬──────────────────────────────────────────────────────┘
                                       │ EvidenceRelation (supports | contradicts | contextualizes)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    EPISTEMIC LAYER                                          │
│  Assertion: Proposition held by the Corpus with explicit epistemic status                   │
│             (asserted_by, subject, predicate, object, confidence, status, valid-time)       │
└──────────────────────────────────────┬──────────────────────────────────────────────────────┘
                                       │ Reactive Dependency / Invalidation
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     DERIVED LAYER                                           │
│  Projection: Derived view over an identified source set, projector version, and policy       │
│              (is_authoritative: false, is_derived: true, source_commitments, stale)         │
│  Index / Cache: Disposable, reconstructible performance accelerator                         │
└──────────────────────────────────────┬──────────────────────────────────────────────────────┘
                                       │ Continues / Triggers
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   OPERATIONAL LAYER                                         │
│  Continuation: Durable, resumable request or state describing what remains to be handled    │
│  Act: Meaningful operation or effect asserted/executed by a mandated HandlerInstance        │
│       (CapabilityInvocation → Act → COP Event / new Trace)                                  │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Detailed Definitions

| Primitive              | Role                                                                                                                                                                          | Authority & Mutability                                                             | Key Invariants                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **`Trace`**            | The general causal or evidential primitive. Any physical, digital, external, or internal imprint left by an occurrence in reality.                                            | Immutable once referenced. Does NOT make a truth claim by itself.                  | A trace is an imprint, not a proposition.                                                    |
| **`TraceRef`**         | Canonical JSON pointer (`cop.trace-ref/v1`) identifying a trace cryptographically (`trace_id`, `target_type`, `integrity`, `locator`, `resolution_hints`).                    | Immutable handle. Content-addressed.                                               | Identity is decoupled from network location (`locator`) and byte possession (`custody`).     |
| **`TraceDescriptor`**  | Structured metadata (`cop.trace-descriptor/v1`) describing origin, observation, custody, valid-time, and classification.                                                      | Immutable record.                                                                  | Does NOT embed subjective interpretation or confidence scalars.                              |
| **`Event`**            | COP-native procedural representation of an occurrence within the COP runtime (e.g. `TaskStepExecuted`, `TraceObservation`, `ExecutionBudgetGrant`).                           | Append-only, totally ordered per Topic (`topicSeq`). Procedural authority.         | `Event ⊂ Trace`. An Event is a native procedural trace. Not all Traces are Events.           |
| **`Artifact`**         | Immutable, content-addressed computational payload (document, code, JSON object, image, snapshot).                                                                            | Immutable. Integrity guaranteed by SHA-256 digest.                                 | May embody a Trace or be referenced by a Trace.                                              |
| **`Assertion`**        | A claim or proposition held by the Corpus (`cop.assertion/v1`), with explicit epistemic status (`hypothesized`, `inferred`, `declared`, `verified`, `normative`, `disputed`). | Governed proposition. Updatable only via explicit supersede or epistemic revision. | Must cite `asserted_by` and authority/mandate reference. Distinct from supporting evidence.  |
| **`EvidenceRelation`** | Explicit typed directed link (`cop.evidence-relation/v1`) connecting a `TraceRef` to an `Assertion` (`supports`, `contradicts`, `contextualizes`).                            | Immutable relational claim.                                                        | Supports N:M bipartite graph. Contradictory evidence coexists non-destructively.             |
| **`Projection`**       | Deterministic derived view (`cop.temporal-projection/v1`) calculated over an identified source set under a specific projector version and policy.                             | Non-authoritative (`is_authoritative: false`, `is_derived: true`).                 | Fully reconstructible: `delete cache → replay sources → identical view`.                     |
| **`Projector`**        | Pure, deterministic function: `(Authoritative Traces + Assertions, Policy) → Projection`.                                                                                     | Algorithmic code. Versioned (`projector_id`, `projector_version`).                 | Version change immediately marks cached projections as stale (`projector_version_mismatch`). |
| **`Index / Cache`**    | Accelerating data structures (e.g. SQLite, Redis, memory maps, inverted indexes).                                                                                             | Non-authoritative, disposable.                                                     | Must never become a competing source of truth.                                               |
| **`Continuation`**     | Durable, resumable state describing remaining cognitive or procedural work.                                                                                                   | Bounded execution state.                                                           | Replayable and portable across handler instances.                                            |
| **`Act`**              | Meaningful operation or consequential effect performed by an authorized HandlerInstance under an active Mandate.                                                              | Generates new procedural Events and consequential Traces.                          | `Reachable ≠ Admissible ≠ Authorized`. Closed failure on missing mandate.                    |

---

## 3. The Three Temporal Coordinates

Legacy systems conflate valid-time, registration time, and discovery time into a single timestamp
(`created_at`). COP 2.x enforces a three-axis temporal model for every trace and assertion:

1. **`occurred_at` (Valid-Time / Reality Time):**
   - When the physical or historical event actually occurred in reality.
   - Handled with explicit precision: `exact`, `day`, `month`, `year`, `interval`, `approximate`,
     `unknown`.
   - Produces a deterministic numeric sort key (`sort_key_ms`) for temporal projection timelines
     without inventing false millisecond certainty.
2. **`trace_created_at` (Physical Registration Time):**
   - When the original record, artifact, or external document was physically written or stamped by
     its author or producing system.
3. **`observed_or_ingested_at` (Corpus Ingestion Time / Transaction Time):**
   - When the COP instance observed, acquired, or registered the trace.
   - Recorded canonically in a native COP `TraceObservation` event.

---

## 4. Normative Invariants of COP 2.x

Any COP 2.x compliant system MUST satisfy the following core invariants:

### Invariant 1: Trace Primacy & Epistemic Separation

A Trace is an evidential imprint, not a truth claim. Assertions represent propositions held by the
Corpus and MUST remain distinct from the Traces that support, contradict, or contextualize them.

### Invariant 2: Non-Amplification of Authority

Projection, summarization, consolidation, caching, or LLM synthesis MUST NOT silently elevate the
epistemic status or authority of source material.

- An ungrounded or low-trust trace summarized into memory remains `hypothesized` or `inferred`.
- Only an authorized Principal with active Mandate authority can designate an assertion as
  `normative`.

### Invariant 3: Reconstructibility of Derived Views

All Projections, indexes, and caches are derived artifacts (`is_authoritative: false`,
`is_derived: true`). Given the same authoritative source set + projector version + applicable
policy, any derived view MUST be deterministically reconstructible:
$$\text{Delete Cache} \longrightarrow \text{Re-evaluate Sources} \equiv \text{Identical View}$$

### Invariant 4: Non-Destructive Contradiction Coexistence

Incompatible or conflicting traces do not cause historical deletion, silent overwriting, or
last-write-wins corruption. Contradictory evidence relations (`supports` and `contradicts`) coexist
within the `EvidenceGraph`, causing the affected assertion to transition transparently to `disputed`
status while triggering bounded reactive invalidation.

### Invariant 5: Clean Ingestion of External Reality

External traces entering COP governance do not become "COP-originated" by fiction. COP records a
native `TraceObservation` procedural event that explicitly references the external `origin_ref` and
flags `cop_originated: false`.

### Invariant 6: Strict Decoupling of Security Dimensions

Technical reachability, operational admissibility, and principal authority are orthogonal:
$$\text{Reachable} \neq \text{Admissible} \neq \text{Authorized}$$ Neither technical protocol
accessibility, healthy ping responses, nor ambient presence confers authorization. Every
consequential act requires an active, unrevoked Mandate.

---

## 7. Canonical Examples

### Example 1: Native COP Act

```text
1. Principal delegates capability to LogicalAgent via Mandate M-123.
2. HandlerInstance receives Cognitive Packet with CapabilityRequirement.
3. Verification: Admissible (in policy) AND Authorized (M-123 active, budget unexhausted).
4. CapabilityInvocation executed: Act performed.
5. Emits COP Event (e.g. `ExecutionBudgetSettled`, `TaskStepExecuted`).
6. Zero-copy TraceRef computed: `cop:event:<event-id>`.
7. Projection updated deterministically.
```

### Example 2: External Historical Trace Ingestion

```text
1. Historical artifact: An email authored in 2008 (Message-ID: `<abc@example.com>`, occurred_at: "2008-04-12").
2. Ingested into COP in 2026:
   - System registers `TraceRef` (`trace_id: "urn:email:2008:abc"`, `target_type: "external"`, `integrity: "sha256:..."`).
   - System records COP Event: `TraceObservation` (`observed_at: "2026-09-06"`, `cop_originated: false`, `origin_ref: "urn:email:2008:abc"`).
3. Epistemic registration:
   - Assertion A-1: "Recipient accepted terms on April 12, 2008" (`valid_time: "2008-04-12"`, `epistemic_status: "declared"`).
   - EvidenceRelation ER-1: `supports(TraceRef, A-1)`.
4. Result: Valid-time (2008) is preserved; COP's procedural event records truth of ingestion (2026) without claiming COP authored the 2008 email.
```

### Example 3: Contradiction & Reactive Invalidation

```text
1. Existing state:
   - Assertion X: "Server S was decommissioned on 2026-01-15".
   - Trace A (Decommission Ticket): `supports(Trace A, X)`.
   - Projection P-1 displays: "Server S: Inactive".
2. New evidence arrives:
   - Trace B: Netflow log showing server S routing active traffic on 2026-01-20.
   - EvidenceRelation ER-2: `contradicts(Trace B, X)`.
3. Invalidation & Epistemic Revision:
   - `EvidenceGraph` stores both ER-1 and ER-2 without deleting Trace A.
   - Assertion X shifts to `epistemic_status: "disputed"`, `has_contradiction: true`.
   - `ReactiveDependencyGraph` identifies all projections dependent on Assertion X.
   - Projection P-1 is marked `stale: true` (`invalidation_cause: "evidence_contradiction"`).
   - Projector rebuilds derived view: P-1 reflects dispute and alerts operator for cognitive adjudication.
```

---

## 8. State of the Art & Interoperability

COP 2.x deliberately interoperates with industry standards while supplying the missing governance
and epistemic layers:

| Standard / Paradigm                                         | How COP 2.x Interoperates                                                                                                                                    | What COP 2.x Adds                                                                                                                   |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| **W3C PROV** (`prov:Entity`, `prov:Activity`, `prov:Agent`) | Direct structural alignment: `TraceRef` aligns with `prov:Entity`, `Act` / `Event` with `prov:Activity`, and `LogicalAgent` / `Principal` with `prov:Agent`. | Native JSON Draft 2020-12 schemas, executable state machines, active mandate enforcement, and non-destructive contradiction graphs. |
| **Event Sourcing & CQRS**                                   | Procedural COP history remains an append-only, totally ordered event log replayable by deterministic projectors.                                             | Eliminates the false assumption that all reality originates as events. Distinguishes raw traces from procedural events.             |
| **Bitemporal Modeling** (Fowler / SQL:2011)                 | Systematic separation of `occurred_at` (valid-time) from `observed_at` (transaction-time).                                                                   | Multi-granularity valid-time (`year` to `exact`) with deterministic ordering keys and epistemic status tracking.                    |
| **OpenTelemetry**                                           | APM traces and spans can be encapsulated directly into `TraceRef` with `target_type: "external"` and `locator: "otel://..."`.                                | Durability, content-addressed integrity, cryptographic binding to mandates, and legal accountability.                               |
| **C2PA (Content Authenticity)**                             | Content credentials and asset manifests can be verified and referenced via `TraceRef.integrity` and `TraceDescriptor.custody`.                               | Epistemic assertion linking, contradiction management, and automated bounded invalidation of derived assets.                        |

---

## 9. Migration of Normative Invariants

The following statements in legacy COP 1.x documentation are formally declared **obsolete** and
replaced:

| Obsolete Legacy Formulation                                                           | New Normative COP 2.x Invariant                                                                                                                                                                       | Rationale                                                                                                          |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| _"The canonical Event Log is the universal durable source of truth for all reality."_ | **"COP preserves and governs locally authoritative traces and reconstructible projections over them. Native COP Events are the canonical procedural traces of COP-mediated activity."**               | Reality is external and distributed; COP witnesses and participates in reality but does not monopolize its origin. |
| _"All meaningful system state consists exclusively of Events + Artifacts."_           | **"All authoritative procedural history consists of Events + Artifacts; all authoritative knowledge consists of Traces + Assertions + EvidenceRelations. Projections are disposable derived state."** | Separates raw facts from interpretive claims and ephemeral caches.                                                 |
| _"Projectors transform Events into Projections (`Event → Projection`)."_              | **"Projectors transform authoritative Traces, Events, and Assertions into derived Projections (`(Traces, Assertions, Policy) → Projection`)."**                                                       | Projections synthesize epistemic evidence graphs rather than merely replaying procedural events.                   |
| _"A local SQLite database or snapshot is an authoritative state tier."_               | **"A local SQLite database, snapshot, or vector index is strictly a disposable performance cache. Authoritative state resides in content-addressed Traces and append-only stores."**                  | Prevents state capture, snapshot illusion, and split-brain authority.                                              |

---

## 10. Follow-up Impacts on Related Documents

### 10.1 Impact on `packages/cop-core/REACTIVE_COGNITIVE_EXTENSION.md`

- **Current State:** Defined reactive cognitive dispatch, cogqueries, and packet attractors with
  loose references to global event streaming.
- **COP 2.x Impact:** Must use `ReactiveDependencyGraph` and bounded invalidation chains
  (`Trace → Assertion → Continuation / Projection`) rather than unbounded global event broadcasts.
  Attractors route queries based on epistemic status and trace availability.

### 10.2 Impact on `research/cop_fractalog_profile.md`

- **Current State:** Clarified that Cognitive Packets are the primary source location for
  packet-borne traces, while FractaLog is a projection.
- **COP 2.x Impact:** Fully harmonious. Cognitive Packets emit native `TraceRef` handles
  (`cop:event:...`, `cop:artifact:...`). FractaLog is codified as a governed
  `cop.temporal-projection/v1` over packet traces.

### 10.3 Impact on `research/cop_memory_profile.md` & `research/cop_memory_map_territory.md`

- **Current State:** Memory treated as organized access to traces under locality and salience
  constraints. "The MemoryView is a map, not the territory."
- **COP 2.x Impact:** Reinforced normatively. `MemoryView` MUST NOT store plain unstructured text as
  ground truth. It must distinguish between recalled raw `TraceRef`s (territory) and recalled
  `Assertion`s (map). Epistemic status prevents hallucinated or ungrounded memories from acquiring
  normative authority.

### 10.4 Impact on Issue #17 (Personal Inseme Instance & Hibernation)

- **Current State:** Issue #17 assumes that agent memory is restored from SQLite snapshots and
  replayed via legacy events.
- **COP 2.x Impact:** SQLite snapshots are classified as disposable accelerators. Hibernated agents
  restore identity and mandate from immutable `TraceRef`s and verify their cached working memory
  against the `ReactiveCorpus` before executing any consequential act.

---

## 11. Verification & Acceptance Criteria (Issue #62)

- [x] **Trace and Event have non-overlapping, useful definitions:** Defined in Section 2
      (`Event ⊂ Trace`).
- [x] **External Trace ingestion does not fictionalize COP as its origin:** Governed by
      `cop_originated: false` and `origin_ref` in `TraceObservation` (Section 3 & 7).
- [x] **Assertion and EvidenceRelation are first-class in the architecture:** Fully specified with
      schemas (`cop.assertion/v1`, `cop.evidence-relation/v1`) and bipartite graph semantics
      (Section 2).
- [x] **Source/projection/index roles are unambiguous:** Strict `is_authoritative: false` on
      projections; disposable caches (Section 2 & 4).
- [x] **Procedural replay remains well specified:** Replay preserved identically across `topicSeq`
      (Section 2 & 8).
- [x] **Current Event-centric invariants are revised or explicitly scoped:** Addressed in Section 9.
- [x] **FractaLog packet-local trace semantics fit without contradiction:** Addressed in Section
      10.2.
- [x] **Architecture explains how COP governs a Reactive Corpus:** Codified in Section 1, 2, and 4.
