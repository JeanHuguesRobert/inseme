---
title: COP State of Play — Asynchronous Orchestration & Traceability
author: Jean Hugues Noël Robert, baron Mariani
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
date: 2026-05
license: CC BY-SA 4.0
status: working-note
corpus_role: source
canonical_url: https://github.com/JeanHuguesRobert/inseme/blob/main/research/COP_STATE_OF_PLAY.md
last_stamped_at: '2026-06-01'
language: en
document_role: source
document_kind: working-note
visibility: public
lifecycle_state: working
classification_source: cogentia.js
classification_version: '1'
classification_rule: working-note
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


# COP State of Play – Asynchronous Orchestration & Traceability

**Living document.**  
Last major update: 2026-05 (shift to async COP priority)  
Maintained for agents and humans working on the Cognitive Orchestration Protocol.

**Scope of this document**: Focus exclusively on the **asynchronous**, **event-driven**, **strongly
traceable** aspects of COP.  
Synchronous applications (Cyrnea "bar" real-time experience and assemblée/democracy voting sessions)
are temporarily deprioritized.

---

## 1. Verified Definition (Corpus Check)

**COP = Cognitive Orchestration Protocol**

Confirmed across the entire corpus (no other legitimate expansion of the acronym exists in
authoritative documents):

- `packages/cop-core/Architecture.md` (canonical specification)
- `packages/cop-core/Manifesto.md`
- `packages/cop-core/Invariants.md`
- `packages/cop-core/FAQ.md`
- `packages/cop-core/ROADMAP.md`
- `docs/MODULAR_SYSTEM.md`
- `research/concepts.md`, `research/index.md`, `research/corpus-status.md`
- `README.md` and multiple package descriptions

**Core nature of COP** (from Manifesto + Architecture):

- A **vendor-neutral, implementation-independent protocol** and data model.
- Built on five fundamental concepts: **Event** (immutable), **Artifact** (durable), **Topic**,
  **Task**, **Step**.
- Designed for **durable cognition**: immutability, durability, idempotency, deterministic replay.
- Primary interfaces: `COPBus` (event transport), `COPStore` (projections), `COPAgent` (stateless
  logic), `COPScheduler`.
- Explicit support for **continuations** as first-class citizens for long-running, resumable,
  cross-system reasoning.
- Strong emphasis on **causality** (`parentEventIds`, `topicSeq`, `correlationId`) and
  **auditability**.

COP is the **asynchronous substrate** ("nervous system") intended to make multi-agent cognitive
processes reproducible, explainable, and distributed over time.

---

## 2. Current Strategic Context (May 2026)

After a period of work on synchronous experiences (real-time bar vibe in Cyrnea, assembly voting),
the decision was made to temporarily deprioritize synchronous UIs and return focus to the
**asynchronous core** with **strong traceability**.

Goal: Make COP a real, usable foundation for orchestrated async cognitive work before layering more
synchronous experiences on top.

---

## 3. Implementation Status (as of now)

### 3.1 cop-core (Specification & Types)

- **Status**: Most advanced part.
- Core data model, Event structure, Continuation schema, CloudEvents mapping, JSON-LD context, and
  invariants are well documented.
- `src/types.ts` provides TypeScript definitions.
- **Gap**: No official conformance test suite yet (roadmap item).

### 3.2 cop-kernel (Reference Runtime)

This is the most substantial body of **implementation** code.

**Existing pieces relevant to async + traceability**:

- `events.js` + `emitCopEvent` helper (emitting COP_EVENTs).
- `continuation.js` + `call.js`: `callAgentWithContinuation` and `resumeContinuationAndSend`. Real
  support for creating, attaching, and resuming continuations.
- `artifacts.js`: Durable artifact management.
- Multiple storage backends (`storage-implementations/`):
  - File-based, SQLite (browser + Deno + Node), Supabase, in-memory.
  - Shared storage contract tests.
- `auditLogger.js`: Basic append-only JSONL logger (`audit_logs.jsonl` contains real examples of
  AgentIdentity, Task, Step events).
- `transport.js`: `postCopMessage`.
- Agent and node registries.

**Maturity assessment**:

- Continuation mechanism exists at the call/resume level.
- Storage layer is plural and reasonably tested.
- Audit/traceability is present but **minimal** (simple append, no rich querying, limited causality
  indexing).
- Scheduler is mentioned in the spec but has **no mature implementation** yet.
- The kernel is not yet used as the central orchestration engine outside the cop-\* packages.

### 3.3 cop-host, cop-prolog, cop-cli, cop-chat

- `cop-host`: Primarily the brique hosting and compilation system. Some COP vocabulary in config,
  but not a deep COP protocol implementation.
- `cop-prolog`: Early integration experiments (Prolog as an agent type?).
- `cop-cli` and `cop-chat`: Thin tooling layers.
- Overall: These packages use some COP concepts in naming and structure but are not yet heavy
  consumers or providers of the full async COP protocol.

### 3.4 Integration in the Wider Platform

- Very limited real usage of COP as an orchestration backbone today.
- Most current orchestration in the monorepo (especially in room/, brique-\*, platform/) is still
  ad-hoc or uses other mechanisms (Supabase realtime, direct function calls, Magistral routing,
  etc.).
- COP remains mostly self-contained in its own packages + referenced in research and specs.

---

## 4. Async Orchestration Capabilities (Current)

**Strengths**:

- Continuation descriptors and resumption messages are implemented at the message level.
- `callAgentWithContinuation` + `resumeContinuationAndSend` provide a usable high-level API.
- Correlation IDs and task/step context are passed through.

**Weaknesses / Gaps** (directly relevant to priority B):

- Resumption logic is mostly manual (caller has to decide when and how to resume).
- No robust, production-grade **COPScheduler** that can wake continuations based on time, events, or
  external conditions.
- Limited handling of failure, retry, and compensation in continuation flows.
- No standardized "suspended" state projection or continuation index that agents can reliably query.

---

## 5. Traceability & Audit (Current)

**Strengths**:

- Event emission path exists.
- Basic `auditLogger` + real `audit_logs.jsonl` examples (Task, Step, AgentIdentity lifecycle
  events).
- Storage backends can serve as durable event sources.

**Weaknesses / Gaps** (priority A later):

- Audit logger is a simple helper, not a first-class, queryable, causally-indexed audit trail.
- No systematic enforcement or projection of full causal DAG.
- Replay/determinism story is specified but not exercised at scale.
- No rich tooling to explore "why did this decision happen?" across agents and time.

**Note on determinism boundary (added during Phase 2 analysis, May 2026)**:  
The determinism COP guarantees applies to the protocol mechanics (event ordering, projectors,
continuation resumption conditions, causal DAG reconstruction) and to the replay of _recorded traces
and Artifacts_. It does not extend to the generation of outputs inside agentic steps (human judgment
or AI reasoning). The same context can legitimately produce different outputs — this is often a
source of useful diversity rather than a defect.

Consequently, post-hoc audit is always a causal reconstruction from the immutable Event log and
Artifacts, never a perfect deterministic re-simulation of the thinking that produced those
Artifacts. This makes explicit human-enacted decision Artifacts (see COP/HITL profile) structurally
necessary for imputability, skin in the game, and resistance to harmful capture. Future rich audit
tooling should make this boundary visible instead of implying full deterministic replay of
cognition.

---

## 6. Major Gaps for "Réelle Mise en Place"

1. **COP is not yet the default orchestration substrate** for async work in the monorepo.
2. The **Scheduler** (core to async + continuation) is the weakest implemented area relative to the
   spec.
3. **Traceability** is present in spirit (events + audit log) but not yet "strong" in practice
   (queryable, complete causality, easy replay).
4. Adoption is low outside the cop-\* packages themselves.

---

## 7. Prioritized Next Work (User-Defined Order)

Per explicit request (May 2026):

1. **D (this document)** — Done. Living, focused reference for async + traceability.
2. **B** — Advance **Continuations + Resumption** (make them more robust, testable, and actually
   usable for real async flows).
3. **C** — Introduce a **minimal Event Bus + Scheduler** compliant with COP concepts.
4. **A** — Harden and enrich the **Audit / Traceability** layer (make it first-class and powerful).

This order deliberately builds the async execution model before pouring massive effort into
observability.

---

## 8. How to Evolve This Document

- Update the "Current Implementation Status" section after any significant work on B, C, or A.
- Keep a "Recent Changes" subsection at the top when progress is made.
- Maintain separation from synchronous application work (Cyrnea, assemblée, etc.).
- Reference only verified corpus sources for definitions.

---

**Next action**: Proceed to priority **B** (Continuations + Resumption).

Ready when you are. What is the first concrete task inside B? (e.g., harden the continuation
descriptor, improve resumption reliability, add tests, design a resumption API, etc.)
<!-- BEGIN_AUTO: backlinks -->
### Backlinks

*These documents link to this file:*
- [Cognitive Packet Switching](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/cognitive_packet_switching.md)
- [Concept Index — inseme](concepts.md)
- [COOP — Tutorial and Near-Specification](coop_tutorial.md)
- [Inseme](../README.md)
- [Research Index — Inseme](index.md)
<!-- END_AUTO: backlinks -->
