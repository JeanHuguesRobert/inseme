---
title: Concept Index — inseme
description: Typed concept registry for humans and AI agents; structure only, not semantic authority.
layout: default
nav_order: 3
last_modified_at: 2026-05-16T00:00:00.000Z
canonical_url: https://github.com/JeanHuguesRobert/inseme/blob/main/research/concepts.md
last_stamped_at: 2026-06-01T00:00:00.000Z
license: CC BY-SA 4.0
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
date: 2026-05-16T00:00:00.000Z
creator: Jean Hugues Noël Robert, baron Mariani
document_role: index
document_kind: concept-index
visibility: public
lifecycle_state: active
classification_source: cogentia.js
classification_version: '1'
classification_rule: concept-index
classification_confidence: strong
author: unknown
provenance:
  origin_type: unknown
  origin_repository: unknown
  origin_ref: unknown
  origin_date: unknown
  derived_from: []
review:
  status: unreviewed
  reviewed_by: []
update_policy: UP-DEFAULT-REVIEWED
language: en
status: working-paper
---


# Concept Index — inseme

This file maps concepts used across the corpus.

`cogentia.js` maintains structure, links, scopes, status and graphs. It does not infer semantic
truth.

## Status scale

- **Seed** — intuition not yet stabilized.
- **Working** — recurring and usable, but still evolving.
- **Defined** — explicit definition exists.
- **Operational** — connected to implementation, protocol, code, governance or legal use.
- **Canonical** — should be treated as a reference concept unless revised.

---

## Cogentia

**Type:** abstract concept / agentivity class **Scope:** Global **Status:** Working

**Short definition:** Cogentia designates the actual situated agentivity of an entity — physical
person, legal person, or AI agent — combining memory, mandate, capabilities, procedures, acts and
traces.

**Parent concepts:**

- Traceable agency

**Child concepts:**

- Cogentigram
- Operational memory

**Reference documents:**

- `research/concepts.md`

**Used in:**

- digital twin work
- AI agent governance

---

## Cogentigram

**Type:** representation / map **Scope:** Global **Status:** Working

**Short definition:** A cogentigram is a structured, partial, auditable and revisable representation
of a Cogentia.

**Parent concepts:**

- Cogentia

**Related concepts:**

- Map vs territory
- Operational memory
- Traceable agency

---

## COP (Continuous Operation Protocol)

**Type:** protocol / runtime **Scope:** Global **Status:** Canonical

**Short definition:** The base runtime and persistent event log maintaining states and actions
across the Inseme platform.

**Reference documents:**

- [`packages/cop-core/Architecture.md`](../packages/cop-core/Architecture.md)

---

## Briques

**Type:** modular component **Scope:** Global **Status:** Operational

**Short definition:** Modular, composable application modules embedded inside the Inseme platform
for expanding capabilities.

**Reference documents:**

- [`docs/MODULAR_SYSTEM.md`](../docs/MODULAR_SYSTEM.md)

---

## Kudocracy

**Type:** governance system **Scope:** Global **Status:** Defined

**Short definition:** Democratic tooling and reputation-based governance modules built natively on
the Inseme platform.

---

## Agora

**Type:** system model **Scope:** Global **Status:** Defined

**Short definition:** A structured digital space for assembly and deliberation, running on the COP
foundation.

---

## Ophélia

**Type:** agent **Scope:** Global **Status:** Operational

**Short definition:** The trusted, protocol-native AI mediator connecting the ecosystem and
assisting humans in navigating the platform.

---

## COP Invariants

**Type:** protocol constraints / architectural invariants **Scope:** Global **Status:** Canonical

**Short definition:** The 9 non-negotiable invariants of the Cognitive Orchestration Protocol that
any compliant system MUST preserve: Immutability (Events and Artifacts append-only), Topic-Local
Ordering, Idempotency, Durability (all critical state reconstructible from Event log + Artifacts),
Stateless Agents, Isolation via Events, Deterministic Replay of traces and projectors, Schema
Versioning, and Transparency over Convenience.

**Parent concepts:**

- Machine à explorer
- Stabilisateurs (anti-Ubik / procéduraux)

**Reference documents:**

- [`packages/cop-core/Invariants.md`](../packages/cop-core/Invariants.md)
- [`packages/cop-core/Architecture.md`](../packages/cop-core/Architecture.md)

**Used in:**

- cop-kernel implementation
- Evaluation of current gaps (Scheduler, rich causality, audit tooling)
- Phase 2 application of explorer/empêcher grid

---

## Non-deterministic Cognitive Step (Agentic Step)

**Type:** process concept **Scope:** Global **Status:** Working

**Short definition:** A step in a cognitive process (within a Task/Step or Continuation) whose
output depends on agentic reasoning (human judgment or AI model) and is not guaranteed to be
reproducible from the same inputs. This non-determinism is often a source of useful diversity for
exploration, objection, and serendipity. The protocol captures the actual output as an immutable
Artifact at execution time rather than requiring re-computation.

**Parent concepts:**

- Machine à explorer

**Related concepts:**

- Human Enacted Decision Artifact
- Causal Trace Replay

**Reference documents:**

- `packages/cop-core/Architecture.md` (§3.5 Replay Semantics and Determinism, updated Phase 2)
- `packages/cop-core/Invariants.md` (§9.1, updated Phase 2)
- `cogentia/research/cognitive_packets.md`

---

## Human Enacted Decision Artifact

**Type:** artifact type / imputability anchor **Scope:** Global **Status:** Working

**Short definition:** An explicit Artifact (in the COP/HITL profile) representing a decision
actively taken or validated by a living human person. It serves as a structural anchor for
imputability, skin in the game, and resistance to harmful capture. Without such anchors,
traceability of the log remains but accountability diffuses, increasing the risk of Machine à
empêcher dynamics.

**Parent concepts:**

- Machine à explorer
- COP/HITL Profile

**Related concepts:**

- Non-deterministic Cognitive Step
- Rule 0 (seconde méthode)
- DHITL Layer 5

**Reference documents:**

- `packages/cop-core/Architecture.md` (COP/HITL profile and human decision handling, updated
  Phase 2)
- `barons-Mariani/research/second_method.md` (Rule 0)
- `marenostrum/DHITL.md`

**Used in:**

- Processes carrying real consequences
- Justification of human anchor points in continuation flows

---

## Causal Trace Replay (Auditable Causal Reconstruction)

**Type:** audit / replay mechanism **Scope:** Global **Status:** Working

**Short definition:** The form of replay guaranteed by COP: faithful reconstruction of the causal
history, Events, and recorded Artifacts (including outputs of non-deterministic agentic steps). It
does not promise deterministic re-execution of the internal reasoning processes of agents. This
distinction preserves honest auditability while acknowledging the boundary between protocol
mechanics and agentic cognition.

**Parent concepts:**

- COP Invariants
- Machine à explorer

**Related concepts:**

- Deterministic Replay (protocol layer only)
- Non-deterministic Cognitive Step

**Reference documents:**

- `packages/cop-core/Architecture.md` (§3.5, updated Phase 2)
- `packages/cop-core/Invariants.md` (§9.1, updated Phase 2)

---

## COP (Cognitive Orchestration Protocol)

**Type:** protocol / runtime **Scope:** Global **Status:** Canonical

**Short definition:** The vendor-neutral, implementation-independent protocol for coordinating
cognitive agents (human and artificial) through an event-driven model with strong causality,
immutability, and continuation support. It provides the asynchronous substrate for durable,
traceable, multi-agent cognition (the "nervous system" of the explorer machines).

**Reference documents:**

- [`packages/cop-core/Architecture.md`](../packages/cop-core/Architecture.md)
- [`packages/cop-core/Invariants.md`](../packages/cop-core/Invariants.md)
- [`packages/cop-core/Manifesto.md`](../packages/cop-core/Manifesto.md)
- [`research/COP_STATE_OF_PLAY.md`](../research/COP_STATE_OF_PLAY.md)

**Used in:**

- cop-kernel (bus, store, scheduler, continuations)
- Phase 1 and Phase 2 of the explorer/empêcher grid application
- Sandbox validation work

---

## Brique Spec / Multi-Instance

**Type:** technical specification **Scope:** project-specific **Status:** Defined

**Short definition:** The technical specification dictating how Briques are instantiated, isolated,
and operated across different rooms and groups.

**Reference documents:**

- [`packages/cop-host/BRIQUE_SPEC.md`](../packages/cop-host/BRIQUE_SPEC.md)
- [`packages/cop-host/docs/MULTI_INSTANCE.md`](../packages/cop-host/docs/MULTI_INSTANCE.md)

---

## Modular System

**Type:** frontend architecture **Scope:** repository-specific **Status:** Working

**Short definition:** The architecture permitting dynamic loading, unloading, and routing of Briques
within the React and Vite frontend ecosystems.

**Reference documents:**

- [`docs/MODULAR_SYSTEM.md`](../docs/MODULAR_SYSTEM.md)
<!-- BEGIN_AUTO: backlinks -->
### Backlinks

*These documents link to this file:*
- [Inseme](../README.md)
- [Research Index — Inseme](index.md)
<!-- END_AUTO: backlinks -->
