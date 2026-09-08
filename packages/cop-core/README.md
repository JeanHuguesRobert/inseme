---
title: COP Core — Cognitive Orchestration Protocol
author: unknown
date: "2026-07-12"
document_role: source
document_kind: documentation
visibility: public
lifecycle_state: working
update_policy: UP-DEFAULT-REVIEWED
provenance:
  origin_type: repository
  origin_repository: JeanHuguesRobert/inseme
  origin_ref: cb5c9e3
  origin_date: "2026-07-12"
  derived_from: []
review:
  status: unreviewed
  reviewed_by: []
---

# COP Core — Cognitive Orchestration Protocol

`cop-core` is the **reference specification package** for the Cognitive Orchestration Protocol
(COP).

It defines the **canonical data model, invariants, and interfaces** required to build durable,
replayable, and interoperable cognitive systems (handlers, workflows, human-in-the-loop processes).

This package intentionally contains **no executable logic**.

COP is a **protocol**, not a framework, SDK, runtime, or product.

---

## What COP Is

COP standardizes how cognition is:

- **represented** (Events, Artifacts, Tasks, Steps),
- **ordered** (topic-local sequencing and causality),
- **persisted** (immutable event logs),
- **replayed** (deterministic reconstruction),
- **audited** (hashing, optional ledger),
- **shared** (CloudEvents, JSON-LD).

COP treats cognition as a **durable process**, not a transient computation.

Handlers are replaceable. Models evolve. Cognition remains.

---

## What COP Is Not

COP is deliberately minimal. It does **not**:

- execute workflows,
- run agents,
- schedule tasks,
- manage infrastructure,
- depend on any database, broker, or cloud provider.

Those concerns belong to **runtimes** built on top of COP.

See also [`ImplementationProfiles.md`](ImplementationProfiles.md) for the rule separating COP Core
from concrete runtimes, interfaces, adapters, and integration surfaces.

---

## Core Concepts

COP defines a small set of foundational primitives:

- **Event** — immutable record of a cognitive action
- **Topic** — unit of cognitive coherence
- **Task** — structured objective within a Topic
- **Step** — atomic unit of work inside a Task
- **Artifact** — durable cognitive output
- **Continuation** — suspended, resumable execution state

All durable state lives in Events and Artifacts.

Handlers are **stateless**.

---

## Runtime Interfaces

`cop-core` defines pure interfaces that real systems must implement:

- **COPBus** — event publication and replay
- **COPStore** — deterministic projection storage
- **COPScheduler** — event dispatch and coordination
- **COPHandler** — stateless packet/event handler

Any technology stack can implement these interfaces:

- Node / Deno / Bun
- SQL (Postgres, Supabase)
- Kafka / NATS / Redis Streams
- Temporal
- Edge runtimes
- In-memory test harnesses

Concrete realizations should be documented as implementation profiles. See
[`ImplementationProfiles.md`](ImplementationProfiles.md).

---

## Protocol Invariants

COP is defined by a small number of **non-negotiable invariants**:

1. Immutability
2. Topic-local ordering
3. Idempotency
4. Durability
5. Stateless handlers
6. Isolation via events
7. Reconstructible causal attribution

The seventh invariant means that transport trust never replaces identity. Whether an event travels
inside a local process, a controlled Tailscale VPN, a private Fractanet segment, or across the
public Internet, a durable consequential event should retain enough identity and lineage to
reconstruct who or what caused it: the relevant Actor / LogicalAgent, execution HandlerInstance when
material, applicable mandate or authority source, and causal predecessor events.

These invariants are normative and MUST be preserved by all implementations.

See **`invariants.md`** for the formal definition.

---

## Trust Domains, Measured Risk, and Proportionate Security

COP does not require one globally maximal security regime and does not treat **minimum risk** as an
objective in itself. Concrete implementations MAY define **trust domains** in which transport and
endpoint membership are already controlled. A Tailscale VPN is a practical example: inside such a
domain, additional transport authentication or encryption layers may add little value for Acts with
small Exposure, cheap recovery and low uncontrolled propagation because mandates, budgets,
traceability and recovery already bound the plausible consequences.

This is not a relaxation of identity or causal provenance. Trust-domain membership answers a network
question; it does not establish the LogicalAgent, mandate, intent, or causal origin of a COP Act.

Implementations SHOULD apply the Corpus **Measured Risk** doctrine: strengthen controls when the
consequence profile warrants them, considering materially relevant dimensions such as:

```text
Exposure / blast radius
uncertainty and tail risk
possible propagation
OptionLoss
third-party / protected-interest impact
Reversibility Envelope
compensation / restitution / repair paths
recovery cost and possible residue
```

Reversibility is not Boolean. A locally hard-to-undo Act can be acceptable when Exposure is tiny and
repair cheap; a technically revertible Act can require strong ex-ante control when it propagates,
discloses protected information, affects third parties, or closes important options.

Low-Exposure, cheaply recoverable Acts SHOULD remain compatible with optimistic execution rather
than being burdened by preventive controls whose cost exceeds their plausible benefit. Conversely,
positive expected value MUST NOT create authority or justify exporting loss across Principal
boundaries.

A useful implementation principle is:

> **Keep security friction proportional to the measured consequence profile; keep identity, mandate
> and causal lineage durable.**

And for experimentation:

> **Take the smallest sufficient risk for useful progress, not the smallest attainable risk
> regardless of usefulness.**

See:

- [`COP_MEASURED_RISK.md`](COP_MEASURED_RISK.md) for the normative protocol profile, schema
  definitions, and gating evaluation functions (`evaluateMeasuredRisk`, `attenuateMeasuredRisk`);
- [`docs/measured-risk-and-exposure.md`](docs/measured-risk-and-exposure.md) for architecture notes,
  state machines, and implementation guidance;
- [`COP_MANDATED_AGENT_SECURITY.md`](COP_MANDATED_AGENT_SECURITY.md) for normative authority,
  Measured Risk conformance criteria (AC13/AC14), and recovery semantics;
- [Cogentia Measured Risk](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/measured_risk.md)
  for the source doctrine;
- [Inseme issue #51](https://github.com/JeanHuguesRobert/inseme/issues/51) for the parent tracking
  issue.

---

## Profiles

Profiles extend COP without modifying the core.

Normative authority and execution terminology is defined in [`Terminology.md`](Terminology.md). In
particular, COP distinguishes a `LogicalAgent` that holds a mandate from a `Handler` and its
potentially ephemeral `HandlerInstance` that execute work.

Examples:

- Chat / conversational agents
- RAG pipelines
- Planning and workflow orchestration
- Tool invocation
- Human-in-the-loop governance

Profiles define **additional semantics**, not new execution rules.

Implementation profiles document concrete runtimes or surfaces that realize COP responsibilities.
They must not silently redefine COP. See [`ImplementationProfiles.md`](ImplementationProfiles.md).

---

## Interoperability

COP is designed to interoperate cleanly with existing standards:

- **CloudEvents** — transport and envelope
- **JSON-LD** — semantic layer
- **JCS (RFC 8785)** — canonical hashing

COP Events can be transported anywhere while preserving meaning.

---

## Who COP Is For

COP is intended for:

- system architects designing long-lived AI systems,
- framework authors seeking interoperability,
- institutions requiring auditability and traceability,
- researchers focused on reproducibility,
- regulated or safety-critical domains.

---

## Status

COP is currently in **v0.3**:

- the core model is stable,
- schemas are versioned,
- additive evolution only,
- breaking changes require explicit major versions.

COP is designed for **multi-decade persistence**.

---

## Philosophy

Frameworks come and go.

Cognition should not.

COP exists to ensure that reasoning, decisions, and coordination outlive any single model, vendor,
or runtime.

---

### Applied Possibilism: The Spirit Behind COP

COP is not merely a technical specification — it embodies a practice-oriented philosophy called
**Applied Possibilism: The Joyful Exploration of the Possible.**

Where frameworks control, COP enables exploration. Where optimization demands efficiency,
possibilism values discovery. The protocol provides:

- **Deterministic replay** → Exploration is documented and learnable
- **Stateless agents** → Cognition externalized, exploration shared
- **Stigmergic attractors** → Exploration is guided, not prescribed
- **Continuations** → Exploration can pause and resume

> COP is not a framework for control. It is a protocol for joyful, systematic exploration of what's
> possible.

For the full philosophical and practice framework, see
[Applied Possibilism](https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/applied_possibilism.md).
