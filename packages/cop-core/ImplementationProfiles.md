---
canonical_url: https://github.com/JeanHuguesRobert/inseme/blob/main/packages/cop-core/ImplementationProfiles.md
author: Jean Hugues Noël Robert, baron Mariani
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
license: CC BY-SA 4.0
status: working-note
last_stamped_at: 2026-06-01T00:00:00.000Z
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


# COP Implementation Profiles

## Purpose

This note defines how concrete implementations of the Cognitive Orchestration Protocol (COP) should
be documented.

`cop-core` defines the protocol-level abstractions, data model, invariants, and interfaces. It
intentionally does not execute workflows, run agents, schedule tasks, manage infrastructure, or
depend on a specific runtime.

An implementation profile describes one concrete way of realizing COP without silently redefining
COP.

```text
COP Core = abstract protocol / invariant level
COP Implementation Profile = concrete runtime, interface, adapter, or integration surface
```

---

## Why profiles are needed

COP needs implementation profiles because two opposite failures are possible:

1. **Theory without implementation** — the protocol remains elegant but untested.
2. **Implementation drift** — a runtime or adapter starts redefining the protocol through
   convenience shortcuts.

A profile is the bridge between the protocol and one concrete realization.

---

## Definition

A COP implementation profile is a documented realization of some COP responsibilities in a specific
technical context.

A profile may be:

- a runtime;
- a kernel;
- a command-line interface;
- a chat interface;
- a hosting layer;
- a workflow adapter;
- a storage backend;
- a platform integration;
- an edge or embedded runtime.

A profile is not automatically COP-compliant. It must show how it preserves the required invariants.

---

## Non-negotiable inheritance from COP Core

A profile claiming COP alignment MUST preserve, or explicitly mark as not yet implemented, the
following invariants:

1. Events and Artifacts are immutable.
2. Events are ordered within Topics.
3. Delivery is assumed at-least-once; projectors and handlers must be idempotent.
4. Meaningful state is durable and reconstructible from Events and Artifacts.
5. Agents are stateless between invocations.
6. Coordination occurs via Events and Artifacts, not hidden direct coupling.
7. Replay reconstructs recorded traces and projections.
8. Events and Artifacts carry explicit schema versions.
9. Transparency takes priority over hidden convenience.

If a profile violates one of these constraints for prototyping reasons, the violation MUST be
explicit and temporary.

---

## What may vary by profile

Implementation profiles may vary in programming language, runtime environment, storage backend,
transport layer, scheduling strategy, UI surface, deployment model, persistence guarantees,
federation mechanism, human-in-the-loop validation flow, and observability tooling.

Variation is acceptable only if the profile documents its consequences for durability, replay,
auditability, and conformance.

---

## Minimal profile template

Each implementation profile SHOULD include:

```markdown
# <Profile Name>

## Status

experimental | prototype | reference | production candidate | deprecated

## Scope

What COP responsibilities this profile implements.

## Non-goals

What this profile deliberately does not implement.

## Mapping to COP Core

How Events, Artifacts, Topics, Tasks, Steps, Continuations, Bus, Store, Scheduler, and Agents are
represented.

## Invariants

Which COP invariants are fully preserved, partially preserved, or not yet implemented.

## Persistence model

Where durable Events and Artifacts live.

## Replay model

How recorded traces and projections can be reconstructed.

## Human validation anchors

Where human decisions are required and how they are recorded.

## Known limitations

What remains experimental, unsafe, incomplete, or non-conformant.

## Tests and conformance

Existing tests, missing tests, replay checks, and validation commands.

## Next steps

Agent-resumable continuation items.
```

---

## Current profile map

### `cop-core`

Status: protocol specification package.

`cop-core` is not itself a runtime profile. It is the reference against which profiles are
evaluated.

### `cop-kernel`

Status: emerging reference runtime profile.

`cop-kernel` should become the first documented implementation profile because it exercises the
async, event-driven, traceable core of COP.

Current priority:

- make Task / Step helpers explicit;
- persist scheduler and job state;
- improve replay-style tests;
- enrich auditability and causal trace exploration.

### `cop-host`

Status: platform and brique integration surface.

It should not redefine COP semantics. It should consume COP services or expose brique-level events
and artifacts.

### `cop-cli`

Status: operational command-line surface.

It is a derived operational interface, not the protocol.

### `cop-chat`

Status: conversational surface.

It should clarify how conversational state becomes durable COP state.

### Future `cop-n8n`

Status: exploratory only.

The feasibility note lives in [`../cop-n8n/README.md`](../cop-n8n/README.md).

It should not be implemented before `cop-kernel` is stable enough to define what a visual adapter
must preserve.

---

## Conformance checklist

Before calling a profile COP-compliant, answer:

- Where are Events persisted?
- Where are Artifacts persisted?
- How is Topic-local ordering enforced?
- How are duplicate Events handled?
- How can projections be rebuilt?
- What state, if any, exists outside Events and Artifacts?
- Are agents stateless?
- Are human decisions recorded as durable artifacts or events?
- Can failures, retries, and obsolescence be audited?
- Which tests demonstrate replay or reconstruction?
- Which invariants are still aspirational?

If these questions cannot be answered, the profile may be useful, but it should not yet be described
as conformant.

---

## Relation to Cogentia

This note applies the broader Cogentia method of separating abstract source documents from concrete
implementation documents.

The abstract level protects coherence. The implementation level protects contact with reality. The
profile is the documented interface between both.

---

## Continuation

Immediate next steps:

1. Link this file from `packages/cop-core/README.md`.
2. Create or update a `cop-kernel` implementation profile document using this template.
3. Add minimal replay/conformance tests for Task / Step / Continuation projections.
4. Keep `cop-n8n` exploratory until `cop-kernel` can provide a stable adapter contract; maintain
   the feasibility note in [`../cop-n8n/README.md`](../cop-n8n/README.md).
