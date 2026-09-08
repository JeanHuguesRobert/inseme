---
title: "COP Terminology — Mandated Cognitive Handling"
subtitle: "Normative vocabulary for COP authority, execution, traceability, and accountability"
author: "Jean Hugues Noël Robert, baron Mariani"
affiliation: "Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica"
date: "2026-08-01"
last_modified_at: "2026-09-08"
version: "1.0"
status: "stable — normative"
license: "CC BY-SA 4.0"
language: "en"
document_role: "source"
document_kind: "protocol-terminology"
document_function: "vocabulary"
visibility: "public"
lifecycle_state: "active"
update_policy: "UP-DEFAULT-REVIEWED"
canonical_url: "https://github.com/JeanHuguesRobert/inseme/blob/main/packages/cop-core/Terminology.md"
classification_source: "cogentia.js"
classification_version: "1"
classification_rule: "explicit-metadata"
classification_confidence: "strong"
provenance:
  origin_type: "repository"
  origin_repository: "JeanHuguesRobert/inseme"
  origin_ref: "https://github.com/JeanHuguesRobert/inseme/issues/31"
  origin_date: "2026-08-01"
  derived_from: []
review:
  status: "verified"
  reviewed_by:
    - "Jean Hugues Noël Robert"
  reviewed_at: "2026-09-08"
---

# COP Terminology — Mandated Cognitive Handling

This document is the normative vocabulary for COP concepts concerning authority, execution, and
accountability. It resolves the previously overloaded use of `agent`.

COP Core is the governance protocol for the evolution of a Reactive Corpus through Traces, Events,
Artifacts, Assertions, EvidenceRelations, Projections, and Continuations. COP/Mandate remains an
additive profile; this terminology integrates the trace-centric substrate of COP 2.x without making
mandate enforcement a universal Core claim.

## 1. Normative chains

### 1.1 Authority and Execution Chain

```text
Principal → Mandate → LogicalAgent → HandlerProfile → HandlerInstance
          → CapabilityInvocation → Act → Trace → Imputation
```

### 1.2 Evidential and Epistemic Chain

```text
Reality → Trace (external or procedural Event)
        → EvidenceRelation (supports | contradicts | contextualizes)
        → Assertion (epistemic status)
        → Projector (deterministic function)
        → Projection (non-authoritative derived view)
        → Continuation / Decision → Act
```

Each relation is explicit when it matters to authorization, replay, accountability, or audit. An
implementation MUST NOT infer authority solely from technical reachability, capability, successful
execution, or the protocol used to communicate with an executor.

## 2. Terms

| Term                       | Definition                                                                                                                                                                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Subject**                | Any identifiable entity to which COP may relate: a person, legal person, informal collective, digital instance, or other organized entity.                                                                                                      |
| **Principal**              | A Subject from which authority originates for a given Mandate. A Principal is not necessarily the owner of every resource involved.                                                                                                             |
| **Actor**                  | Any entity that may cause, participate in, attest to, or be attributed an Act. This is the generic term.                                                                                                                                        |
| **Mandate**                | A durable, reviewable authorization relation specifying who may do what, for whom, under which scope, limits, delegation rules, trace regime, and revocation conditions.                                                                        |
| **LogicalAgent**           | A durable mandate-bearing identity that may receive, hold, or delegate authority. It is a role of an Actor or Subject, not a process and not necessarily the concrete executor.                                                                 |
| **AuthorityRelation**      | The authority relation applicable between participants for a bounded context. At minimum COP distinguishes hierarchical/delegated execution from peer cooperation. The interaction protocol does not determine this relation.                   |
| **InteractionMode**        | The communicative form used between participants, such as request/response, conversation, negotiation, event stream, call/result, or asynchronous task exchange. Interaction mode does not create or imply authority.                           |
| **ExecutionSurface**       | The concrete technical interface through which a capability is accessed, such as HTTP, OpenAI-compatible API, ACP, A2A, MCP, CLI, stdio, shell, Inox, or a human interface. An execution surface is not an authority source.                    |
| **HandlerProfile**         | A stable declaration of how work may be handled: accepted packet classes, required or offered capabilities, policy constraints, and result contract.                                                                                            |
| **Handler**                | A competent executor of a Cognitive Packet. A Handler may be human, model, script, tool, repository, review queue, publication process, runtime, or governance process. It is not presumed to hold authority.                                   |
| **HandlerInstance**        | A concrete, identifiable incarnation of a Handler Profile executing work in a bounded context. It may be durable, suspended, restarted, substituted, or ephemeral.                                                                              |
| **Capability**             | A declared ability to perform a bounded transformation or effect. Capability proves neither authority nor entitlement to use it.                                                                                                                |
| **CapabilityRequirement**  | A transport- and provider-neutral description of work that requires one or more capabilities, together with relevant constraints such as locality, cost, latency, trust, quality, deadline, or execution class.                                 |
| **CapabilityInvocation**   | One recorded attempt or execution of a Capability by a HandlerInstance.                                                                                                                                                                         |
| **Act**                    | A meaningful operation or effect asserted by COP. An Act MAY be proposed, authorized, attempted, completed, refused, compensated, or observed; these states MUST NOT be conflated.                                                              |
| **FractaLog Document**     | A canonical, versioned JSON document (`fractalog.act-record/v1`) containing the complete durable account of one semantic Act phase (`attempt`, `committed`, `failed`, `refused`, `observed`). Relational database columns are strictly projections of this document. |
| **Trace**                  | The general causal or evidential primitive. Any physical, digital, external, or internal imprint left by an occurrence in reality. A Trace is not itself a truth claim. FractaLog is a governed trace projection, not merely runtime telemetry. |
| **TraceRef**               | A canonical, immutable, content-addressed cryptographic pointer (`cop.trace-ref/v1`) identifying a trace independently of network location (`locator`) and physical custody (`custody`).                                                        |
| **TraceDescriptor**        | Structured observational metadata (`cop.trace-descriptor/v1`) recording trace origin, custody, visibility, valid-time, and classification without embedding subjective confidence scalars.                                                      |
| **Governed Erasure Receipt** | An opaque, non-reconstructive event (`TraceLifecycleErasure` / `GovernedErasureReceipt`) confirming that payload content was removed under a specified governance policy or legal authority without altering prior causal history or event existence. |
| **Event**                  | A COP-native procedural representation of an occurrence within the COP runtime (e.g. `TaskStepExecuted`, `TraceObservation`, `ExecutionBudgetGrant`). An Event is a procedural specialization of Trace (`Event ⊂ Trace`).                       |
| **Artifact**               | An immutable computational object (document, code, data structure, binary blob) identified by content digest (SHA-256). An Artifact may embody a Trace or be referenced by a Trace.                                                             |
| **Assertion**              | A proposition or claim held by the Corpus (`cop.assertion/v1`) with explicit epistemic status (`hypothesized`, `inferred`, `declared`, `verified`, `normative`, `disputed`). An Assertion remains distinct from the Traces that evidence it.    |
| **EvidenceRelation**       | An explicit, typed, directed relational link (`cop.evidence-relation/v1`) connecting a `TraceRef` to an `Assertion` (`supports`, `contradicts`, `contextualizes`). Allows contradictory evidence to coexist without historical deletion.        |
| **Projection**             | A derived, reproducible view (`cop.temporal-projection/v1`) computed over an identified source set under a specified projector version and policy. Projections are non-authoritative (`is_authoritative: false`, `is_derived: true`).           |
| **Projector**              | A pure, deterministic transformation function: `(Authoritative Traces + Assertions, Policy) → Projection`. When projector code changes, cached projections are marked stale (`projector_version_mismatch`).                                     |
| **Store**                  | An authoritative, append-only persistence facility holding immutable Traces, native Events, Artifacts, and Assertions.                                                                                                                          |
| **Index / Cache**          | A disposable, reconstructible performance accelerator (e.g. SQLite database, vector index, in-memory table). Indexes must never become competing sources of truth.                                                                              |
| **Imputation**             | The explicit relation by which responsibility, credit, cost, custody, or consequence is attributed.                                                                                                                                             |
| **Supervisor**             | A runtime component that starts, stops, monitors, or restarts child work. Supervision does not create Mandate authority.                                                                                                                        |
| **Continuation**           | A durable, resumable request or state describing what remains to be handled. A Continuation SHOULD be capability-bound unless identity-bound resumption is explicitly required.                                                                 |
| **Exposure**               | The bounded consequence ceiling of an Act across scope, cost, affected subjects, and external effects. Distinct from Budget (consumption) and Risk (uncertainty).                                                                               |
| **Measured Risk**          | The governance posture authorizing bounded risk for an explicit objective inside an Exposure envelope with defined recovery capacity. Governs authority; cannot create authority.                                                               |
| **Reversibility Envelope** | The declared recovery boundary specifying repair mechanism (`pure_undo`, `compensating_action`, `damage_control`), recovery budget, and expiration.                                                                                             |
| **Damage Control**         | An exceptional containment regime triggered upon exceeding an exposure ceiling or stop condition, prioritizing stabilization over normal execution.                                                                                             |
| **Repair Frontier**        | The threshold where recovery cost exceeds restored value, allowing explicit, authorized residue while strictly preserving hard non-substitutable rights.                                                                                        |

## 3. Rules for `agent`

The bare term **Agent** is NOT normative in new COP schemas, API names, or specification prose.

Permitted uses are limited to:

- the compound term `LogicalAgent`;
- an exact external protocol, product, historical name, or quoted source;
- a clearly marked historical compatibility note while this clean-slate migration is incomplete.

The former `COPAgent` runtime interface is to be replaced by a handler-oriented name in Issue #31
Phase 2. No compatibility alias is intended.

## 4. Public metaphors

Terms such as _Father Christmas_, _elves_, _workshop_, or equivalent localized metaphors are
informative public communication only. They have no protocol, authorization, identity, schema, or
runtime meaning.

## 5. Execution and authority

A HandlerInstance MAY execute an Act only within the applicable protocol and policy conditions. For
consequential effects, the record MUST be capable of distinguishing, where applicable:

```text
Principal / authorizing Subject
Mandate / authority reference
LogicalAgent / mandated continuity
AuthorityRelation
HandlerProfile and HandlerInstance / concrete execution
CapabilityRequirement and CapabilityInvocation
InteractionMode and ExecutionSurface
Act and effect receipt
Trace and Imputation
```

A successful capability invocation does not itself prove a valid mandate. A delivered message does
not itself prove representation or authorization.

The following invariants apply:

> **Capability is not authority.**
>
> **Communication is not authority.**
>
> **Execution is not identity.**

A conversational request/response exchange MAY occur under a hierarchical mandate, between peers, or
with a service-like capability. Conversely, peer cooperation MAY use a task protocol, event stream,
conversation, or other interaction mode. Protocol semantics MUST NOT silently manufacture an
authority relation that is absent from the applicable Mandate or peer agreement.

## 6. Lifecycle, substitution, and anti-capture

A HandlerInstance can be created, paused, resumed, replaced, or terminated without changing the
identity of a LogicalAgent or the causal history of the work. Correct continuation state MUST NOT
exist solely in inaccessible HandlerInstance memory.

A vendor session MAY accelerate continuation, but it MUST NOT be the only representation from which
useful continuation can be recovered when portability is required. Durable work state SHOULD be
externalized through Events, Artifacts, Continuations, or other reconstructible COP state so that a
compatible HandlerInstance can resume the work on another runtime, machine, or provider.

A Supervisor may manage many ephemeral HandlerInstances, including homogeneous instances created on
demand. Their lifecycle events and relevant outcomes remain traceable even after their runtime
processes cease to exist.

## 7. Capability resolution boundary

COP specifies what work requires and what must remain causally reconstructible; it does not require
COP Core itself to discover providers or bind directly to vendor runtimes.

A runtime MAY submit a `CapabilityRequirement` to an external capability-resolution layer. Such a
layer may select among local or remote services, coding agents, models, human handlers, Inox
runtimes, or other available capabilities according to policy and constraints.

For the Fractanet implementation family, **Magistral is the intended capability-resolution and
access boundary** between COP orchestration and concrete work capabilities. ACP, A2A, MCP,
OpenAI-compatible HTTP, CLI/stdio, Inox, and future protocols are candidate execution surfaces or
adapters below that boundary; none is normative for COP Core.

Compact formulation:

```text
COP orchestrates work.
Magistral resolves and presents capabilities.
Fractanet makes capabilities present.
```

## 8. Migration status

This terminology is a **pre-operational clean break**. COP has no compatibility obligation to early
prototypes. Existing terms and identifiers are to be removed rather than preserved through aliases,
unless a later documented operational boundary creates a genuine third-party reliance.

See [Issue #31](https://github.com/JeanHuguesRobert/inseme/issues/31) for the bounded migration
phases and resumption checkpoints.
