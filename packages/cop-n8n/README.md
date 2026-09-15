---
canonical_url: https://github.com/JeanHuguesRobert/inseme/blob/main/packages/cop-n8n/README.md
author: Jean Hugues Noel Robert, baron Mariani
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
license: MIT
status: feasibility-note
last_stamped_at: 2026-06-17T00:00:00.000Z
related:
  - ../cop-core/ImplementationProfiles.md
  - ../cop-core/Invariants.md
  - ../cop-kernel/PROFILE.md
title: '`cop-n8n` Feasibility Note'
date: null
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
---


# `cop-n8n` Feasibility Note

## Status

`cop-n8n` is an exploratory implementation-profile sketch for connecting the Cognitive
Orchestration Protocol (COP) to n8n workflows.

MVP decision:

```text
defer implementation until cop-kernel exposes a stable adapter contract
```

The useful work now is to define the boundary. A visual workflow can be a COP surface, but it must
not become the protocol.

---

## Scope

An eventual `cop-n8n` package could:

- receive COP Events from a durable COP runtime;
- trigger n8n workflows from selected Events;
- turn workflow outputs into COP Events or Artifacts;
- expose human approval or correction steps through n8n forms or webhooks;
- provide operational visibility for non-developer users.

It should be treated as an adapter profile over `cop-kernel`, not as an independent COP runtime.

---

## Non-goals

`cop-n8n` must not:

- redefine COP Core semantics;
- store meaningful state only inside n8n execution state;
- rely on n8n workflow history as the authoritative event log;
- claim COP conformance without durable Events, Artifacts, replay, and idempotency checks;
- bypass human validation anchors for civic, legal, institutional, or public-facing workflows.

---

## Candidate Mapping To COP Core

| COP Core concept | Possible n8n role | Required boundary |
|---|---|---|
| Event | webhook input or workflow trigger | Event must already be durable before n8n acts. |
| Artifact | workflow input/output payload | Durable Artifact is created by COP runtime, not hidden in n8n state. |
| Topic | workflow correlation key | Topic ordering remains enforced outside n8n. |
| Task / Step | workflow stage or execution segment | Lifecycle remains reconstructible from COP Events. |
| Continuation | waiting workflow or human approval | Wait state must be represented as a COP Continuation Artifact. |
| Bus | event ingress/egress bridge | n8n is a consumer/producer, not the authoritative Bus. |
| Store | durable projection and artifact store | n8n may query it, but must not replace it. |
| Agent | workflow action or external service call | Agent identity and effects must be explicit in emitted Events. |

---

## Invariants Assessment

| COP invariant | Feasibility | Notes |
|---|---|---|
| Immutability | feasible | Requires append-only COP Event and Artifact persistence outside n8n. |
| Topic-local ordering | feasible outside n8n | n8n should not assign authoritative `topicSeq`. |
| Idempotency | risky | Webhook retries and repeated workflow executions require explicit event IDs and dedupe. |
| Durability | risky if n8n-local | Meaningful state must live in COP Store / Event log. |
| Stateless agents | feasible | Workflow nodes should be treated as stateless handlers over durable inputs. |
| Isolation via Events | feasible | Direct service calls are acceptable only if their effects return as Events or Artifacts. |
| Replay | limited | Replay must re-drive COP projections; re-running side-effectful n8n workflows is not replay. |
| Schema versioning | feasible | Adapter payloads need explicit schema versions. |
| Transparency | feasible | Workflow definitions can help inspection, if boundaries are documented. |

---

## Minimum Useful MVP

A first MVP is justified only after `cop-kernel` can provide:

1. a stable Event ingress contract;
2. a stable Event egress contract;
3. durable Artifact creation;
4. idempotent event handling;
5. a replay test proving that n8n side effects are represented in COP traces.

The smallest useful MVP would contain:

- one n8n webhook receiving a COP Event;
- one deterministic workflow branch;
- one emitted COP Event or Artifact;
- one duplicate-delivery test;
- one replay note explaining what is and is not replayed.

---

## Risks

- Treating a workflow diagram as protocol compliance.
- Losing durable traces inside n8n execution history.
- Making COP depend on n8n-specific behavior.
- Replaying side effects instead of replaying recorded traces.
- Hiding human approval in workflow state instead of recording it as COP/HITL Events or Artifacts.

---

## Current Decision

`cop-n8n` remains a candidate adapter profile.

Do not implement it before `cop-kernel` has a stable adapter contract for ingress, egress,
persistence, replay, and human validation anchors.

---

## Next Steps

1. Stabilize the `cop-kernel` adapter boundary.
2. Add replay and idempotency tests around Task / Step / Continuation state.
3. Revisit this note when a real n8n workflow has a concrete operational use case.
4. If implementation starts, create an implementation profile using
   [`../cop-core/ImplementationProfiles.md`](../cop-core/ImplementationProfiles.md).
