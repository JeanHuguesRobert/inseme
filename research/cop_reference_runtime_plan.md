---
title: COP Reference Runtime Plan
subtitle: Make cop-kernel the executable reference profile for COP
description: Detailed implementation plan for hardening cop-kernel as the reference runtime of COP while keeping cop-core normative and staying in pure JavaScript ESM.
author: OpenAI Codex
affiliation: Codex / OpenAI
version: 0.1-draft
status: implementation plan draft
date: '2026-07-18'
last_modified_at: '2026-07-18'
last_stamped_at: '2026-07-18'
license: CC BY-SA 4.0
language: en
type: source-document
source_or_derived: source-document
document_role: source
document_kind: implementation-plan
visibility: public
lifecycle_state: working
ai_assisted_by:
  - Codex
related_repositories:
  - JeanHuguesRobert/inseme
related_documents:
  - inseme/packages/cop-core/README.md
  - inseme/packages/cop-core/Architecture.md
  - inseme/packages/cop-core/Invariants.md
  - inseme/packages/cop-core/ImplementationProfiles.md
  - inseme/packages/cop-core/ROADMAP.md
  - inseme/packages/cop-kernel/README.md
  - inseme/packages/cop-kernel/PROFILE.md
  - inseme/packages/cop-kernel/src/index.js
tags:
  - cop
  - cop-kernel
  - reference-runtime
  - implementation-plan
  - javascript
  - esm
  - continuations
  - replay
  - idempotence
  - durability
  - traceability
human_validation_required: true
classification_source: cogentia.js
classification_version: '1'
classification_rule: explicit-metadata
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


# COP Reference Runtime Plan

## Make `cop-kernel` the executable reference profile for COP

This document turns the COP architecture notes into a concrete implementation plan for `cop-kernel`.

It is intentionally narrow:

- `cop-core` remains the normative protocol specification.
- `cop-kernel` becomes the executable reference runtime profile.
- the code path stays in plain JavaScript, ESM only;
- no TypeScript migration;
- no schema redesign;
- no platform adapter work;
- no credentials work;
- no external publication work;
- no global Ubikial-to-Ubikia replacement.

The goal is to make the runtime reproducible, restartable, auditable, and suitable as the default
implementation target for future COP work.

## 1. Current baseline

The current `cop-kernel` profile already exposes the main moving parts expected from a runtime:

- event bus;
- scheduler;
- continuation helpers;
- job scheduler;
- capability registry;
- Cogentia routing hooks;
- timing helpers;
- stdio helpers;
- cooperation primitives.

What is still missing is the part that makes this a dependable reference runtime rather than a
collection of useful modules:

- durable state for jobs, turns, and continuations;
- replayable processing;
- idempotent resume behavior;
- stable turn boundaries;
- clear policy for one active request per executing process;
- deterministic handling of queued work;
- test coverage that proves restart safety.

## 2. Target state

The runtime should satisfy these properties:

1. A request enters the runtime as an explicit job/turn record.
2. Exactly one request is actively executed per process instance.
3. Additional requests are queued, not interleaved.
4. Continuations are first-class runtime artifacts, not ad hoc callbacks.
5. Processing can restart after interruption without duplicating committed work.
6. The runtime can reconstruct what happened from persisted state and traces.
7. The executable profile remains small enough that other agents can reason about it.

The target is not “a big framework”. The target is a narrow, deterministic runtime core with thin
façades on the outside.

## 3. Non-goals

Do not do any of the following in this workstream:

- do not introduce TypeScript;
- do not rewrite `cop-core`;
- do not define new protocol primitives unless `cop-core` is provably incomplete;
- do not build platform-specific adapters;
- do not add secrets handling or credential provisioning;
- do not publish externally from this runtime;
- do not replace every existing consumer in one shot;
- do not treat derived convenience helpers as protocol law.

If a change looks useful but does not directly improve runtime correctness, restartability, or
traceability, defer it.

## 4. Work packages

### 4.1 Spec crosswalk

Start by producing a narrow crosswalk between `cop-core` and `cop-kernel`.

Deliverable:

- a short internal map of which `cop-core` concept is implemented by which runtime module;
- a list of gaps where `cop-kernel` is still only partial;
- a list of places where the runtime currently assumes a behavior that is not yet explicit in the
  spec.

Use this crosswalk to avoid accidental spec drift.

### 4.2 Runtime identity and process model

Define the process-level model explicitly:

- one running `codex`/runtime conversation per process;
- one active request at a time per process;
- queued requests are FIFO unless the runtime already has a documented priority rule;
- the active request owns the terminal/session until it completes or yields a continuation.

This model must be represented in code and in documentation.

Required output:

- a visible process/session identifier;
- a request identifier;
- a turn identifier;
- a continuation identifier;
- a parent/child relation when a continuation resumes earlier work.

### 4.3 Continuation processor

This is the central piece.

The runtime needs a continuation processor that:

- accepts a continuation artifact;
- decides whether it can be executed immediately or must be queued;
- records why a continuation was emitted;
- records who is responsible for resolving it;
- rehydrates the correct context when resuming;
- preserves the link between the original request and the follow-up work.

Treat continuations as durable workflow objects, not as one-off textual notes.

The continuation processor should support at least these states:

- `open`
- `queued`
- `running`
- `waiting_for_authorization`
- `waiting_for_external_judgment`
- `resolved`
- `failed`
- `abandoned`

If the existing runtime uses different words, do not rename casually. First map the current words to
these states, then decide whether a vocabulary change is actually justified.

### 4.4 Job and turn ledger

Create a durable ledger for runtime work.

Each entry should capture:

- request payload hash;
- input source;
- request timestamp;
- execution start/end;
- emitted continuations;
- consumed continuations;
- result status;
- replay status;
- failure reason, if any;
- trace identifiers.

The ledger should support:

- append-only recording where possible;
- idempotent reprocessing of the same request;
- detection of duplicate submission;
- detection of partially completed turns;
- reconciliation after crash or restart.

### 4.5 Persistence and replay

Implement durable persistence for the minimum state needed to restart safely.

The plan is:

1. persist the work ledger;
2. persist queue state;
3. persist continuation state;
4. persist the active execution marker;
5. on restart, rebuild in-memory state from persisted state;
6. resume only from a validated checkpoint;
7. refuse to silently replay ambiguous work.

The replay contract should answer three questions:

- Was this request already committed?
- Was it only partially processed?
- Can it be safely resumed?

If the answer is not stable, prefer explicit continuation emission over speculative recovery.

### 4.6 Deterministic façades

Keep façades thin and deterministic.

The runtime should expose a small number of entry points:

- CLI façade for interactive or transactional invocation;
- MCP façade when an agent tool boundary is needed;
- HTTP façade if and only if the runtime already has a validated server boundary.

The façades should not contain business logic. They should only:

- parse input;
- validate it;
- call the runtime core;
- emit the resulting turn, continuation, or error;
- pass through traces.

### 4.7 Traceability and audit output

Make traceability a first-class property of the runtime.

Every meaningful action should leave a trace that answers:

- what was invoked;
- by whom or by what process;
- on which input;
- at what time;
- with which result;
- under which continuation chain.

This is especially important for restartable processing, because the runtime must be inspectable
after a failure.

Do not rely on implicit state hidden in memory if the same fact can be serialized in a durable
trace.

### 4.8 Tests and verification

The test plan should be stronger than the implementation plan.

Required test categories:

- unit tests for queue/ledger/continuation state transitions;
- idempotence tests for repeated submission of the same request;
- restart tests that simulate process interruption;
- replay tests for committed and partially committed work;
- concurrency tests proving one active request per process;
- trace format tests;
- smoke tests for the CLI façade;
- integration tests for the runtime core against the selected persistence layer.

For every non-trivial runtime change, add one regression test that would have caught the same bug.

## 5. Suggested implementation order

Use this order unless a local dependency forces a different one.

1. Stabilize the vocabulary: request, turn, continuation, queue, replay, ledger.
2. Make the runtime model explicit in documentation and code comments.
3. Add the durable work ledger.
4. Add the continuation state machine.
5. Add FIFO queueing and single-active-request enforcement.
6. Add restart and replay handling.
7. Add trace emission and audit output.
8. Wire CLI façade to the runtime core.
9. Wire MCP façade if needed.
10. Run the full test ladder and close the remaining gaps.

## 6. Acceptance criteria

The plan is complete when the following are all true:

- `cop-core` remains the normative spec;
- `cop-kernel` is documented as the reference runtime profile;
- the runtime can process one active request at a time;
- queued work survives restart;
- continuations survive restart;
- idempotent replay is verified;
- trace output is stable enough for debugging and audit;
- the implementation remains pure JavaScript ESM;
- tests prove the restartable behavior rather than merely describing it.

## 7. Open decisions

These items may need explicit approval before implementation:

- which persistence primitive is the first supported durable store;
- whether the queue is persisted in the same store as the ledger;
- whether the CLI façade should be the first executable boundary or whether MCP should come first;
- whether failure states should be recoverable automatically or always require explicit
  continuation.

If one of these decisions blocks implementation, stop and ask rather than guessing.
