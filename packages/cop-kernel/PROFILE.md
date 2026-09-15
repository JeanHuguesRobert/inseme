---
canonical_url: https://github.com/JeanHuguesRobert/inseme/blob/main/packages/cop-kernel/PROFILE.md
author: Jean Hugues Noël Robert, baron Mariani
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
license: CC BY-SA 4.0
status: implementation-profile — prototype
last_stamped_at: 2026-05-31T00:00:00.000Z
related:
  - ../cop-core/ImplementationProfiles.md
  - ../cop-core/Architecture.md
  - ../cop-core/Invariants.md
  - ./docs/task-step-continuation-lineage.md
language: en
date: '2026-09-15'
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


# `cop-kernel` Implementation Profile

## Status

`cop-kernel` is the emerging reference runtime profile for the Cognitive Orchestration Protocol (COP) inside the Inseme monorepo.

Current status:

```text
prototype / reference-runtime candidate
```

It is useful enough to guide implementation work, but not yet mature enough to be called a fully conformant COP runtime.

---

## Scope

`cop-kernel` implements or experiments with the runtime side of COP:

- handler and node helpers;
- event helpers;
- artifact helpers;
- continuation creation and resumption;
- handler calls with continuation support;
- Task / Step / Continuation helpers;
- `COPBus`;
- `COPScheduler`;
- `COPJobScheduler`;
- timing and performance helpers.

It is the first concrete place where COP moves from protocol specification to executable orchestration.

---

## Non-goals

`cop-kernel` should not:

- redefine COP Core semantics;
- become a UI framework;
- hard-code one storage vendor;
- hide meaningful state in process memory as if it were durable;
- replace human validation where COP/HITL anchors are required;
- become a general-purpose workflow engine disconnected from COP invariants.

---

## Mapping to COP Core

| COP Core concept | Current `cop-kernel` mapping |
|---|---|
| Event | event helpers, `COPBus`, emitted runtime messages |
| Artifact | artifact helpers, Continuation artifacts |
| Topic | topic identifiers, per-topic sub-buses via `bus.forTopic(topicId)` |
| Task | Task helpers in `Cop-kerneltasks.js`, still maturing |
| Step | Step helpers in `Cop-kerneltasks.js`, still maturing |
| Continuation | `continuation.js`, `call.js`, scheduler registration and resumption |
| COPBus | `src/bus.js` |
| COPScheduler | `src/scheduler.js` |
| COPHandler | handler registry and stateless call conventions, still partial |
| Store / projections | not yet sufficiently integrated at kernel level |

---

## Invariants assessment

| Invariant | Status | Notes |
|---|---|---|
| Immutability | partial | Continuation resumption model aims to emit new state rather than mutate original Continuations, but broader enforcement still needs tests. |
| Topic-local ordering | partial | Per-topic sub-buses exist; strict persisted `topicSeq` enforcement remains to be completed. |
| Idempotency | partial | At-least-once assumptions are present in the protocol; handler/projector idempotency needs conformance tests. |
| Durability | incomplete | Some runtime state is still in memory; persistence through Store remains a priority. |
| Stateless handlers | partial | Handler model assumes statelessness, but enforcement is not yet systematic. |
| Isolation via Events | partial | Bus-based coordination exists, but some higher-level packages may still use direct calls. |
| Deterministic replay of traces | incomplete | Replay is specified conceptually but not yet exercised at scale through tests. |
| Schema versioning | partial | Core types exist; runtime messages need consistent versioning discipline. |
| Transparency over convenience | good direction | Documents and comments make limitations visible, but tooling must enforce more of it. |

---

## Persistence model

Current state:

- `COPBus` keeps a local in-memory `eventLog`.
- `COPScheduler` keeps pending continuations in memory.
- `COPJobScheduler` keeps jobs in memory.
- `COP_STATE_OF_PLAY.md` and lineage documents identify persistence as a major gap.

Required direction:

- connect scheduler and job state to a real Store;
- start with in-memory Store for tests;
- then support SQLite or Supabase backend;
- ensure all meaningful state can be reconstructed from Events and Artifacts.

Until this is done, `cop-kernel` is not fully COP-conformant.

---

## Replay model

Target replay model:

```text
ordered Events per Topic
+ immutable Artifacts
+ deterministic projectors
= reconstructed Task / Step / Continuation state
```

Current state:

- the protocol describes replay;
- kernel documents identify replay/conformance tests as a priority;
- Task / Step / Continuation projections are not yet fully validated by replay tests.

Minimum next validation:

1. create a small event log with Task / Step / Continuation transitions;
2. replay it into projections;
3. assert stable reconstructed state;
4. verify duplicate events do not corrupt state.

---

## Human validation anchors

`cop-kernel` must support processes where humans remain accountable decision anchors.

Required runtime behavior:

- human decisions should be represented as Events or Artifacts;
- validation, rejection, override, and obsolescence should be traceable;
- AI-generated outputs should not be treated as enacted decisions unless a human or authorized process validates them.

This is especially important for civic, legal, institutional, or public-facing workflows.

---

## Known limitations

Current limitations:

- scheduler and job state are not yet durably persisted;
- strict topic-local sequence enforcement is not complete;
- conformance tests are still missing;
- replay is not yet a routinely executed validation path;
- some Task / Step lifecycle concepts remain implicit or under-documented;
- external packages may not yet use `cop-kernel` as their default orchestration substrate;
- failure, retry, obsolescence, and compensation need richer audit tooling.

---

## Tests and conformance

A `cop-kernel` conformance path should include:

- unit tests for `COPBus` publish / subscribe / federation behavior;
- tests for per-topic sub-bus isolation;
- tests for `COPScheduler` time-based and event-based resumption;
- tests for `COPJobScheduler` scheduling, retry, and obsolescence;
- replay tests for Task / Step / Continuation projections;
- idempotency tests with repeated event delivery;
- persistence tests across process restart once Store integration exists.

A profile should not claim full conformance before these tests exist.

---

## Relation to other packages

### `cop-core`

`cop-core` remains normative. `cop-kernel` must conform to it.

### `cop-host`

`cop-host` should consume kernel capabilities and expose them to briques without redefining COP semantics.

### `cop-cli`

`cop-cli` can become an inspection and manual-operation surface over `cop-kernel`.

### `cop-chat`

`cop-chat` can become a conversational HITL or handler interface, provided conversations become durable COP Events or Artifacts where necessary.

### future `cop-n8n`

A visual workflow adapter should wait until `cop-kernel` exposes a stable contract for ingress, egress, persistence, replay, and human validation anchors.

---

## Next steps

Priority order:

1. Make Task / Step lifecycle helpers explicit and event-driven.
2. Wire `COPJobScheduler` to a real Store.
3. Add replay tests for Task / Step / Continuation projections.
4. Add idempotency tests for duplicate event delivery.
5. Clarify which runtime messages need schema versions.
6. Update this profile after each significant kernel stabilization step.

---

## Minimal completion report format

Substantial future work on `cop-kernel` should end with:

```text
Issue:
Files changed:
COP invariant impact:
Tests run:
Known risks:
Replay/conformance impact:
Human validation needed: yes/no
Next step:
```

This keeps kernel work compatible with the repository-level `AGENTS.md` and the broader Cogentia / COP traceability doctrine.
