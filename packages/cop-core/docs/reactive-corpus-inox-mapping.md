---
title: Reactive Corpus & Inox Runtime Mapping
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

# Reactive Corpus & Inox Runtime Mapping

> **Parent Epic:** [Inseme Issue #61](https://github.com/JeanHuguesRobert/inseme/issues/61)  
> **Reactive Slice Implementation:**
> [Inseme Issue #64](https://github.com/JeanHuguesRobert/inseme/issues/64)  
> **Package:** `@inseme/cop-core` / `@inseme/cop-kernel`  
> **Status:** Normative / Architecture Guide

---

## 1. Context & Architectural Split

COP 2.x establishes a Trace-Centric substrate where external and procedural traces form the
immutable ground truth of reality. The **Reactive Corpus** models how new Traces drive bounded
knowledge evolution, update epistemic relations, and invalidate derived projections without
triggering unbounded global recomputations.

As defined in `research/reactive_cognitive_cop_extension.md`, we maintain a strict architectural
split between protocol semantics and runtime execution:

```text
┌─────────────────────────────────────────────────────────────┐
│                 COP Protocol / Semantic Layer               │
│  - Primitives: TraceRef, TraceDescriptor, Assertion,        │
│    EvidenceRelation, TemporalProjection                     │
│  - Time Semantics: occurred_at vs created_at vs ingested_at │
│  - Epistemic status & contradiction coexistence             │
│  - Bounded dependency declarations & invalidation rules      │
└──────────────────────────────┬──────────────────────────────┘
                               │
               Maps to Native Execution Substrate
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     Inox Runtime Layer                      │
│  - Native ReactiveSet<TraceRef>                             │
│  - Query Tree & CogQuery compiled pattern matchers           │
│  - Incremental dataflow, transactions, and antistate        │
│  - Backpressure, lock-free dispatch, memory-mapped storage  │
└─────────────────────────────────────────────────────────────┘
```

The JavaScript implementation in `@inseme/cop-core` (`reactive-corpus.js`) serves as the
**executable reference semantics**. It validates contracts, invalidation boundaries, and fixtures
without premature native binding.

---

## 2. Mapping Reference Primitives to Inox

| Reference JS Primitive (`@inseme/cop-core`)             | Future Inox Runtime Substrate      | Responsibility in Inox                                                                              |
| :------------------------------------------------------ | :--------------------------------- | :-------------------------------------------------------------------------------------------------- |
| **`TraceRef`** (`cop.trace-ref/v1`)                     | `inox:types/TraceRef`              | Immutable content-addressed handle (`trace_id`, `target_type`, `integrity`). Zero-copy referencing. |
| **`TraceDescriptor`** (`cop.trace-descriptor/v1`)       | `inox:types/TraceDescriptor`       | Header metadata for routing and filtering without materializing payload bytes.                      |
| **`Assertion`** (`cop.assertion/v1`)                    | `inox:types/Assertion`             | Epistemic proposition with monotonic revision tracking and subject anchoring.                       |
| **`EvidenceRelation`** (`cop.evidence-relation/v1`)     | `inox:types/EvidenceRelation`      | Typed directed edge (`supports`, `contradicts`, `contextualizes`).                                  |
| **`EvidenceGraph`**                                     | `inox:epistemic/EvidenceGraph`     | Lock-free in-memory graph preserving contradictory edges simultaneously.                            |
| **`ReactiveDependencyGraph`**                           | `inox:reactive/QueryTree`          | Compiled dependency tree mapping source keys (`trace:*`, `assertion:*`, `subject:*`) to dependents. |
| **`TemporalProjector`**                                 | `inox:projector/TemporalProjector` | Deterministic projection worker compiling chronological timeline views.                             |
| **`TemporalProjection`** (`cop.temporal-projection/v1`) | `inox:views/TemporalProjection`    | Materialized view / accelerator with explicit provenance (`is_authoritative: false`).               |
| **`invalidateAffected(...)`**                           | `inox:reactive/PropagateDelta`     | Push-based incremental delta propagation through pipelets.                                          |

---

## 3. Strict Semantic Invariants to Preserve in Inox

Any optimized Inox engine implementing the Reactive Corpus must enforce the following non-negotiable
invariants:

### 3.1 Non-Destructive Contradiction

When a new trace contradicts an existing assertion (e.g. an audit report disproving an academic
credential):

- The existing trace and assertion are **never overwritten or deleted**.
- An `EvidenceRelation` of type `contradicts` is recorded.
- Epistemic status reflects the tension (`has_contradiction: true`, `epistemic_status: "disputed"`).
- The projection policy decides whether to include or flag the contradiction at query time, not at
  storage time.

### 3.2 Distinct Time Semantics

Three temporal coordinates must remain strictly distinct:

1. **`occurred_at` (Valid-Time)**: When the real-world event claimed to have happened. Supports
   imprecise time (`year`, `month`, `day`, `interval`, `approximate`, `unknown`).
2. **`trace_created_at` (Authoring Time)**: When the recording medium or external witness authored
   the trace bytes.
3. **`observed_or_ingested_at` (Transaction Time)**: When the Corpus first observed, verified, or
   spooled the trace.

Inox must **never collapse these into a single monotonic timestamp**. A document found today about
an event in 1848 has an `occurred_at` in 1848, a creation date in 1850, and an ingestion timestamp
in 2026.

### 3.3 Pure Reconstructibility

Projections and indexes are accelerators, **never the source of authority**:

```text
TraceRefs + Assertions + EvidenceRelations ──(Projector)──> TemporalProjection
```

- Discarding all projections or clearing the index must allow **100% equivalent rebuild** from the
  underlying store.
- Every projection artifact must set `is_authoritative: false` and `is_derived: true`.
- Every projection artifact must record its `source_commitments` (source reference list and
  cryptographic SHA-256 digest).

### 3.4 Projector Version Staleness

A projection's validity depends on both data freshness and algorithm version:

- If a projector algorithm is upgraded (e.g. `1.0.0` $\to$ `2.0.0`), cached projections generated
  under `1.0.0` must be immediately detectable as stale (`projector_version_mismatch`).
- They must not silently pass as current truth.

---

## 4. Execution Pipeline & Invalidation Flow

The reference invalidation loop implemented in COP 2.x and targeted for Inox native execution:

```text
1. Ingest Trace / Relation
         │
         ▼
2. Locate direct & transitive dependents in QueryTree
   (Trace -> Assertion -> Continuations & Projections)
         │
         ▼
3. Flag affected Projections as STALE (record invalidation_cause)
   Notify affected Continuations for reconsideration
         │
         ▼
4. Lazy Rebuild on Demand
   Re-query authoritative store only for matching scope
   Emit new projection with fresh built_at and reset stale: false
```
