---
title: '**CHANGELOG.md**'
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

# **CHANGELOG.md**

All notable changes to **cop-core** will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). Versioning follows
**SemVer**, with the reminder that major breaking revisions may still occur before 1.0.

---

# CHANGELOG — Cognitive Orchestration Protocol (COP)

This changelog documents **semantic and structural changes** to the COP specification and its
reference materials.

COP is a protocol. This changelog tracks **conceptual evolution**, not feature velocity.

---

## [Unreleased]

### Breaking pre-operational terminology clean break

- Added `Terminology.md` as the normative vocabulary for authority, execution, and accountability.
- Replaced the overloaded Core contract names `COPAgent` and `AgentContext` with `COPHandler` and `HandlerContext`.
- Replaced Continuation `agent` routing with distinct `handlerProfile`, `requiredCapabilities`, and optional `logicalAgentRef` fields.
- Reframed the statelessness invariant as applying to Handlers and HandlerInstances.
- No compatibility alias, adapter, or legacy schema is provided for early prototypes. This is intentional: COP has no installed base at this stage.

- Ongoing hardening of the reference implementation (`cop-kernel`)
- Feedback-driven clarification of edge cases

---

## v0.x — Specification Consolidation (Current)

This release marks a **major consolidation phase**: COP transitions from an exploratory project to a
**coherent, complete protocol specification**.

### Added

- Full `Architecture.md` specification covering:
  - data model
  - causality and ordering
  - execution model
  - continuations
  - transport (CloudEvents)
  - semantic layer (JSON-LD)
  - references and linking
  - integrity, hashing, and ledger
  - profiles and conformance levels

- `invariants.md` formally defining COP’s non-negotiable protocol invariants
- Clear definition of **COP/Core**, **COP/HITL**, **COP/AI**, and optional capabilities

### Changed

- **README.md rewritten** as a stable, protocol-level overview (not a library README)
- **FAQ.md rewritten**:
  - integrates the conceptual rationale ("Why COP exists")
  - removes marketing-oriented answers
  - aligns all explanations with the formal specification

- **COMPARISON.md rewritten** with explicit, structural positioning against:
  - agent frameworks,
  - workflow engines,
  - event specifications

- **ROADMAP.md rewritten** as a protocol and ecosystem roadmap, not a product plan

### Clarified

- COP is a **protocol**, not a framework, runtime, or platform
- The reference kernel (`cop-kernel`) is **non-normative**
- Agents are **stateless by design**
- Replay reconstructs **state**, not execution
- Durability and auditability take precedence over convenience

### Removed

- Implicit or ambiguous claims suggesting COP is an execution framework
- Roadmap items implying short-term feature delivery pressure

---

## Compatibility Notes

- The current handler terminology revision is an intentional breaking pre-operational change.
- Early prototypes are preserved by Git history and are not a compatibility target.
- A future operational release MUST declare its supported schema and compatibility boundary explicitly.

---

## Philosophy

COP evolves by **subtraction and clarification**, not accumulation.

If a change does not improve durability, replayability, or interpretability, it does not belong in
the protocol.

## **[Unreleased]**

### **Added**

#### **Documentation**

- Added `Architecture.md`: Comprehensive "Version 1.0" specification covering:
  - Core Concepts (Actors, Agents, HITL, Continuations).
  - Data Model (JSON-LD semantics, JCS integrity, CloudEvents mapping).
  - Execution Model (Projectors, Scheduler, Continuations).
  - Profiles (COP/Core, COP/HITL, COP/AI).
- Added `Manifesto.md`: High-level philosophy and vision for durable cognitive systems.
- Added `FAQ.md`: Answers to common questions about COP's positioning and value proposition.
- Added `COMPARISON.md`: Detailed technical comparison with LangGraph, Temporal, Swarm, and
  CloudEvents.

## **[0.2.0] – 2025-12-09**

### **Added**

#### **Core model**

- Introduced versioned specification of the COP core (`Event`, `Topic`, `Task`, `Step`, `Artifact`).
- Added `topicSeq` to `Event` to guarantee strict per-topic ordering and replay.
- Added `schemaVersion` to `Event` and `Artifact`.
- Added causal metadata fields: `correlationId`, `parentEventIds`.

#### **Runtime interfaces**

- Added `COPBus` interface with:
  - `publish(event)`
  - `fetchSince({ since })` (time-based convenience API)
  - **`fetchFromSeq({ fromSeq })`** (canonical replay API)
  - `subscribe?`

- Added `COPStore` interface with:
  - Topic operations: `getTopic`, `saveTopic`
  - Task operations: `getTask`, `saveTask`, `listTasks`
  - **`listTasksByTopic`**
  - Step operations: `getSteps`, `saveStep`
  - Artifact operations: `saveArtifact`, `getArtifact`, `listArtifacts`

- Added `AgentContext` interface with:
  - `bus`, `store`, `now()`
  - **`emit(event)` helper**

- Added `COPAgent` interface:
  - Mandatory `onEvent`
  - Optional `onTick`

- Added `COPScheduler` as a **pure interface**, with:
  - `start()`, `stop()`
  - **`dispatchEvent(event)`**
  - optional `getContext()`

- Ensured the entire runtime is **interface-only**, no executable logic in `cop-core`.

#### **Chat profile**

- Added `ChatEvent`, `ChatEventType`, and structured payload types:
  - `UserMessagePayload`
  - `AssistantReflexPayload`
  - `AssistantUpdatePayload`
  - `TopicUpdatePayload`
  - `TaskStateChangedPayload`
  - `ArtifactCreatedPayload`

- Added `ChatMessageArtifact` and `LlmCallArtifact`.
- Added `ChatArtifact` union type.
- Added type guards: `isChatEvent`, `isChatMessageArtifact`.
- Added `DeliveryMode` (`sync` | `stream` | `background`) and exported it via the profile index.

#### **Documentation**

- Added `invariants.md` describing the protocol’s invariants:
  - Immutability
  - Topic-local ordering
  - Idempotency
  - Durability
  - Stateless agents
  - Isolation via events

- Rewrote README into a stable specification overview.

---

## **[0.1.0] – 2025-12-05**

### **Initial Release**

- Added minimal experimental core types.
- Added initial scheduler class implementation (removed in 0.2 in favor of interfaces).
- Added first-pass chat profile.

---

## **Unreleased**

### Possible upcoming additions

- Dedicated `InMemoryBus` and `InMemoryStore` reference implementations (in a different package).
- Optional `EventFactory` utilities to standardize construction of COP events.
- Optional supervisor API for hierarchical agent control.
- Extraction of Chat profile into its own package (`cop-profile-chat`).
