---
canonical_url: https://github.com/virteal/inseme/blob/master/packages/cop-core/Architecture.md
last_stamped_at: 2026-05-13
---

# Cognitive Orchestration Protocol (COP)

# Architecture and Specification – Version 1.0

## 0. Introduction

### 0.1 Purpose of COP

### 0.2 Scope

### 0.3 Non-goals

### 0.4 Terminology and Conventions

### 0.5 Notational Conventions (JSON, JSON-LD, JCS, CloudEvents)

## 1. Core Concepts

### 1.1 Actors and Agents

### 1.2 Human Actors (HITL)

### 1.3 Topics

### 1.4 Tasks

### 1.5 Steps

### 1.6 Artifacts

### 1.7 Events

### 1.8 Continuations

### 1.9 Profiles (COP/Core, COP/HITL, COP/AI)

## 2. Core Data Model

### 2.1 JSON Value Model (JsonValue / JsonObject)

### 2.2 Event Object (canonical structure)

### 2.3 Topic Object

### 2.4 Task Object

### 2.5 Step Object

### 2.6 Artifact Object

### 2.7 Continuation Artifact (cop/continuation)

### 2.8 Identifiers (UUID, URN, IRIs)

### 2.9 Schemas, Versions, Compatibility Rules

## 3. Causality, Ordering, and Time

### 3.1 Event Ordering (topicSeq)

### 3.2 Event Causality (parentEventIds)

### 3.3 Global Causal DAG

### 3.4 Time Semantics

### 3.5 Replay Semantics and Determinism

## 4. Projections and the COP Store

### 4.1 COPReadOnlyStore (agent view)

### 4.2 COPStore (full projection store)

### 4.3 COPResult<T> and Error Semantics

### 4.4 Projection Invariants

### 4.5 Materialized Views, Indexes, and Derived State

### 4.6 Rebuild / Replay Requirements

## 5. Execution Model

### 5.1 Projectors (Event → Projection)

### 5.2 Scheduler

#### 5.2.1 Event Delivery Semantics (at-least-once)

#### 5.2.2 Ordering Guarantees

#### 5.2.3 Ticks and Time-based Execution

### 5.3 Agents

#### 5.3.1 Statelessness Requirements

#### 5.3.2 Idempotence

#### 5.3.3 Agent Context

### 5.4 Human-in-the-loop Execution

### 5.5 Continuation Execution Semantics

## 6. Transport and Interoperability

### 6.1 COP Event → CloudEvents 1.0 Mapping

#### 6.1.1 Core Field Mapping

#### 6.1.2 COP Extensions (`copTopicSeq`, `copCorrelationId`, etc.)

### 6.2 Transport Independence

### 6.3 Event Delivery over HTTP, Kafka, NATS, File Logs

## 7. Semantic Layer (JSON-LD)

### 7.1 COP JSON-LD Context

### 7.2 Mapping Rules (id → @id, type → @type, etc.)

### 7.3 RDF Graph Representation

### 7.4 Extending the COP Ontology

## 8. References and Linking

### 8.1 JSON Reference (`$ref`)

### 8.2 JSON Pointer (for fragments)

### 8.3 Integrity Links (hashlinks)

### 8.4 Linking Artifacts, Tasks, Topics, Steps

## 9. Integrity, Security, and Identity

### 9.1 JCS (JSON Canonicalization Scheme)

### 9.2 Event and Artifact Hashing

### 9.3 Optional Signatures

### 9.4 Identity of Nodes, Agents, Topics

### 9.5 Trust and Auditability

## 10. Profiles

### 10.1 COP/Core (mandatory)

### 10.2 COP/HITL (Human-in-the-loop)

#### 10.2.1 Standard HITL Event Types

#### 10.2.2 HITL-specific Artifacts

### 10.3 COP/AI (Agent-to-Agent Orchestration)

#### 10.3.1 AI Message Types

#### 10.3.2 Tool Invocation Events

#### 10.3.3 Agent Reasoning Continuations

## 11. Conformance

### 11.1 Minimal Conformant COP Implementation

### 11.2 Optional Features

### 11.3 Testability and Determinism Requirements

## 12. Glossary

## 13. References

### 13.1 CloudEvents Specification

### 13.2 JSON-LD 1.1

### 13.3 RFC 8785 (JCS)

### 13.4 JSON Pointer / JSON Reference

### 13.5 Additional References

---

# Cognitive Orchestration Protocol (COP)

Architecture and Specification – Version 1.0

> Draft – This document describes the COP core protocol, its concepts and invariants. It is
> implementation-agnostic and transport-agnostic.

---

## 0. Introduction

### 0.1 Purpose of COP

The Cognitive Orchestration Protocol (COP) defines a common, implementation-independent protocol for
coordinating cognitive agents (including AI systems and human actors) through an event-driven model.

COP focuses on:

- A **canonical event log** as the durable source of truth.
- A **projection model** (store) for derived state.
- A **task/step model** to structure work across agents.
- A **uniform representation** of human and machine actions.
- A **continuation model** to resume reasoning across time and systems.

COP is designed to:

- Support distributed, multi-agent systems (AI agents + humans).
- Enable reliable replay, audit, and reasoning over past interactions.
- Provide a stable semantic layer for higher-level frameworks and runtimes.

COP does **not** mandate a specific programming language, runtime, transport, or storage engine. It
defines data structures, invariants, and execution semantics that multiple implementations can
conform to.

### 0.2 Scope

This specification defines:

- Core concepts: **Event**, **Topic**, **Task**, **Step**, **Artifact**, **Continuation**,
  **Agent**, **Projector**, **Scheduler**, **Store**, **Bus**.
- Core data model:
  - canonical JSON representation of COP objects,
  - identifiers and versioning rules.

- Causality and time semantics:
  - per-topic ordering,
  - cross-topic causal links,
  - replay semantics.

- Projection and storage:
  - responsibilities and invariants of the COP Store,
  - separation between read-only and full stores,
  - result and error semantics.

- Execution model:
  - stateless agents,
  - at-least-once delivery,
  - projectors and schedulers.

- Interoperability:
  - mapping COP Events to CloudEvents 1.0,
  - use of JSON-LD for semantics,
  - JSON Reference and JSON Pointer for linking,
  - JSON Canonicalization Scheme (JCS) for hashing.

- Optional profiles:
  - COP/Core (mandatory),
  - COP/HITL (human-in-the-loop patterns),
  - COP/AI (AI-to-AI orchestration patterns).

- Integrity and audit:
  - hash and (optionally) ledger construction guidelines,
  - minimal security and identity concepts relevant to auditability.

Out of scope (non-goals):

- Specific algorithms for planning, reasoning, or task allocation between agents.
- User interfaces, UX patterns, or presentation details.
- Low-level transport protocols (HTTP, Kafka, NATS, etc.), except for interoperability guidelines.
- Authentication, authorization, or full security architecture (only minimal identity and integrity
  primitives are described).
- Performance guarantees (throughput, latency, scaling strategies).

### 0.3 Non-goals

COP explicitly does **not** attempt to:

- Replace existing agent **frameworks** (LangGraph, AutoGen, Swarm, etc.). COP is a protocol they
  can target, not a competing runtime.
- Standardize any particular **AI model** or inference API. COP treats AI agents as black-box actors
  that emit and consume events.
- Define a universal **business ontology**. COP provides a semantic scaffolding (JSON-LD context,
  patterns) but leaves domain ontologies to profiles or applications.
- Replace existing **workflow engines** or business process tools. COP can be used as a backbone for
  workflows, but does not define BPMN-like diagrams or DSLs.
- Provide strong legal guarantees on its own. COP defines mechanisms (hashes, ledgers, auditability)
  that can support legal procedures, but legal admissibility depends on jurisdiction and operational
  practices, not on COP alone.

### 0.4 Terminology and Conventions

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD
NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as
described in RFC 2119.

Additional conventions:

- “Implementation” means a concrete system (library, service, runtime, cluster) that claims to
  implement COP.
- “Node” means a logical COP participant (process, service, or cluster) that can produce or consume
  events.
- “Profile” means a constrained subset or extension of COP tailored to a use case (e.g.
  human-in-the-loop, AI orchestration).

Unless otherwise stated, examples are **informative** and non-normative.

### 0.5 Notational Conventions (JSON, JSON-LD, JCS, CloudEvents)

- All data structures are expressed in **JSON**. COP defines a strict JSON value model in Section
  2.1.
- “JSON-LD” refers to JSON-LD 1.1. COP defines a standard JSON-LD context to describe COP objects as
  linked data (Section 7).
- “CloudEvents” refers to the CloudEvents 1.0 specification. COP defines a canonical mapping from
  COP Events to CloudEvents (Section 6.1).
- “JCS” refers to the JSON Canonicalization Scheme (RFC 8785), used to compute stable hashes of COP
  objects (Section 9.1).

All timestamps in this specification are expressed in ISO-8601 format in UTC (e.g.
`2025-12-14T10:00:00Z`), unless explicitly stated otherwise.

---

## 1. Core Concepts

This section defines the conceptual entities that COP operates on. Later sections formalize their
data model and runtime behavior.

### 1.1 Actors and Agents

An **Actor** is any entity that can cause Events to appear in COP. There are two broad categories of
actors:

- **Agents**: software components (often AI-based) that receive Events and produce new Events and
  Artifacts.
- **Human actors**: human users interacting with the system (through a UI, API, or other means)
  whose actions are represented as Events and Artifacts.

An **Agent** in COP is a logical, named component that:

- consumes Events related to one or more Topics,
- may query projections via a read-only Store,
- may emit new Events (and thus indirectly produce new Tasks, Steps, Artifacts, or Continuations).

Agents are expected to be:

- **stateless** between invocations (no hidden in-memory state required for correctness),
- **idempotent** with respect to repeated Events,
- somehow determined by the input Event(s), their configuration, and the Store contents.

COP does not prescribe how agents are implemented (LLM calls, classical programs, rule engines,
etc.). It only constrains how they observe and mutate the shared world: via Events and the Store.

### 1.2 Human Actors (HITL)

A **Human actor** is an actor controlled by a person.

COP treats human interactions as first-class events:

- A human asking a question,
- providing input requested by an agent,
- approving or rejecting a decision,
- annotating or correcting an Artifact.

These interactions are represented as specific Event and Artifact types in the **COP/HITL** profile
(Section 10.2). From the protocol perspective:

- Human actions are captured as Events (e.g. `human.input.provided`).
- Their inputs, decisions, or messages can be represented as Artifacts (e.g. `human/utterance`,
  `human/decision`).

Thus, human and software agents are modeled uniformly at the event level, even if they have
radically different runtimes.

### 1.3 Topics

A **Topic** is the primary unit of isolation and ordering in COP.

A Topic represents a coherent conversation, process, or “case” (for example: one user session, one
legal procedure, one project, one incident, one document workflow). All Events within a Topic:

- share a common `topicId`,
- are totally ordered via a monotonically increasing `topicSeq`,
- can be replayed to reconstruct the history of that Topic.

Topics are long-lived. Over time, a Topic typically accumulates:

- Events describing actions, decisions, and state changes,
- Tasks and Steps representing structured work,
- Artifacts (documents, messages, summaries, models, etc.),
- Continuations that express pending or suspended reasoning.

Topics have a lifecycle represented by a status state machine (Section 2.3 and 3.4). Multiple Topics
can exist concurrently and are causally independent, except where explicit cross-topic links are
declared.

### 1.4 Tasks

A **Task** represents a unit of work within a Topic. Tasks:

- belong to exactly one Topic,
- are usually associated with one or more Agents (or human actors),
- may be hierarchical (a Task may reference a parent Task),
- evolve through a lifecycle (e.g. `pending`, `running`, `needs_input`, `done`, `failed`,
  `cancelled`).

Tasks give structure to complex processes: a Topic may contain many Tasks, each covering a specific
goal such as:

- “Explain concept X to the user,”
- “Draft a legal summary,”
- “Obtain human approval for step Y,”
- “Execute N parallel calls to external tools and aggregate the result.”

Tasks are not the source of truth: they are projections derived from Events. Their lifecycle and
fields MUST always be explainable by replaying the Event log for the Topic (Section 3 and 4).

### 1.5 Steps

A **Step** is a finer-grained unit within a Task, often corresponding to:

- a single agent action (e.g. one response message),
- a single external call or tool invocation,
- a single human interaction,
- a sub-decision or sub-phase in a longer Task.

Steps:

- belong to exactly one Task,
- have their own status (e.g. `pending`, `running`, `done`, `failed`, `skipped`),
- typically reference the Artifacts they read or produced.

Steps are useful to:

- model multi-phase reasoning (e.g. “analyze → plan → act → summarize”),
- align Events and Artifacts with visible actions in a UI or log,
- trace responsibility (which agent or human actor performed which action).

Like Tasks, Steps are derived from Events and are part of the projection maintained by the Store.

### 1.6 Artifacts

An **Artifact** is an immutable piece of data produced or consumed within a Topic.

Examples:

- messages (plain text, structured JSON, multi-turn conversation segments),
- documents (drafts, summaries, reports),
- tool results (API responses, file analyses),
- models or configuration snapshots,
- continuations (serialized reasoning state, see 1.8).

Artifacts have:

- an identifier,
- a `type` (opaque string, often namespaced),
- an optional `format` (typically a MIME type, e.g. `text/plain`, `application/json`),
- a `payload` (a JSON value),
- optional `metadata`.

Artifacts are **immutable**: once created, they are never modified. Corrections or updates are
represented by new Artifacts with their own IDs, linked via Events or metadata.

Artifacts are attached to Topics and may be attached to Tasks or Steps by reference. They are stored
and indexed in the COP Store as part of the projection.

### 1.7 Events

An **Event** is the fundamental unit of change in COP.

Events:

- are the only mutable input to the system,
- are appended to per-Topic logs,
- define the causal and temporal history from which all projections are derived.

Each Event has:

- a globally unique identifier,
- a `topicId` and `topicSeq` (sequence number within that Topic),
- a `type` (opaque string, often namespaced),
- a `createdAt` timestamp,
- an optional schema/version tag,
- an opaque `payload` (JSON),
- optional `metadata`,
- optional causal links to parent events.

COP makes the **event log** the single source of truth. The Store, Tasks, Steps, and Artifacts are
projections that MUST be reconstructable from this log (subject to implementation limits such as
retention). The event model, including ordering, causality, and replay semantics, is defined in
detail in Sections 2 and 3.

### 1.8 Continuations

A **Continuation** in COP is a standardized way to represent suspended or deferred work.

Conceptually, a Continuation encodes:

- which Agent is responsible for resuming work,
- which Topic (and optionally Task/Step) it relates to,
- a JSON-serializable “state” that the Agent can use to resume,
- optional conditions for resuming (events to wait for, time windows, retry hints).

In COP, Continuations are represented as a **special type of Artifact**:

- type reserved by the core (e.g. `cop/continuation`),
- payload conforming to the standard continuation schema.

Continuations enable:

- multi-step reasoning without hidden in-memory state,
- explicit “wait for human input” or “wait for external event” patterns,
- robust resumption after crashes, upgrades, or migrations,
- portable delegation of partially completed work between nodes.

Execution and semantics of Continuations are detailed in Sections 2.7 and 5.5.

### 1.9 Profiles (COP/Core, COP/HITL, COP/AI)

COP is designed to be **extensible** via profiles.

A **Profile** is:

- a constrained subset and/or extension of COP,
- with additional conventions, event types, Artifact types, and invariants,
- tailored to a class of applications.

This specification defines three key profiles:

- **COP/Core** The mandatory base: Events, Topics, Tasks, Steps, Artifacts, Continuations, Store,
  Bus, Projector, Scheduler, causality, and integrity. Any conformant implementation MUST support
  COP/Core.

- **COP/HITL (Human In The Loop)** A profile that standardizes how human interactions are
  represented:
  - specific Event types such as `human.input.requested`, `human.reply`, `human.feedback`,
  - Artifact types for human messages and decisions,
  - patterns for suspending and resuming Tasks based on human input.

- **COP/AI (Agent-to-Agent Orchestration)** A profile that standardizes:
  - message types for AI conversations,
  - tool invocation events,
  - reasoning continuations specific to AI agents,
  - common patterns such as “analyze → plan → act → summarize”.

Profiles MUST NOT contradict COP/Core, but MAY add additional constraints and semantics. Profiles
are described in more detail in Section 10.

---

# 2. Core Data Model

This section defines the normative JSON structure of all COP objects. All COP implementations MUST
be able to produce, consume, and persist these structures, subject to the constraints defined below.

## 2.1 JSON Value Model (JsonValue / JsonObject)

COP uses a strict JSON value model. All payloads and metadata in COP structures **MUST** conform to
the following grammar:

```
JsonValue =
    null |
    boolean |
    number |
    string |
    JsonValue[] |
    JsonObject

JsonObject =
    { string: JsonValue }
```

Rules:

- Implementations MUST NOT rely on non-JSON types (e.g. functions, classes, Map, Set, Date, binary
  blobs).
- Timestamps MUST be ISO-8601 strings in UTC.
- Implementations MAY impose limits on maximum nesting depth or payload size.

This constraint ensures compatibility across runtimes, languages, transports, and storage systems.

## 2.2 Event Object (Canonical Structure)

An **Event** is the only mutable input to COP. All other COP structures (Topics, Tasks, Steps,
Artifacts, Continuations) are derived from Events.

### 2.2.1 JSON Structure

A COP Event MUST have the following form:

```json
{
  "id": "string",
  "topicId": "string",
  "topicSeq": 123,
  "type": "string",
  "schemaVersion": "string",
  "createdAt": "2025-12-14T10:00:00Z",
  "payload": {},
  "metadata": {},
  "correlationId": "string",
  "parentEventIds": ["string"]
}
```

### 2.2.2 Field Semantics

- **id**: globally unique identifier for the Event. Implementations SHOULD use UUIDs or IRIs (e.g.
  `urn:cop:event:...`).
- **topicId**: identifier of the Topic this Event belongs to.
- **topicSeq**: strict monotonic sequence number within the Topic.
  - MUST be assigned at durable append time.
  - MUST be unique per `(topicId, topicSeq)`.
  - Defines the total order of Events in that Topic.

- **type**: opaque string naming the Event type (e.g. `task.created`, `agent.reply`,
  `human.input.provided`).
- **schemaVersion**: version identifier for the payload schema.
- **createdAt**: timestamp for when the Event became durable.
- **payload**: JSON object with Event-specific data.
- **metadata**: auxiliary metadata (optional).
- **correlationId**: optional identifier to correlate Events across Topics.
- **parentEventIds**: optional list of causal dependencies across Topics.

### 2.2.3 Invariants

- Events MUST be immutable.
- Events MUST be canonicalizable via JSON Canonicalization Scheme (JCS).
- Events MUST be the authoritative source of truth: all derived state MUST be explainable by
  replaying Events.

## 2.3 Topic Object

A **Topic** groups a sequence of Events into a coherent process, conversation, or case.

### 2.3.1 JSON Structure

```json
{
  "id": "string",
  "status": "open",
  "title": "optional string",
  "metadata": {}
}
```

### 2.3.2 Status Values (normative)

```
open → in_progress → exhausted → closed
```

- **open**: the Topic exists but no substantial Activity has occurred.
- **in_progress**: Events, Tasks, or Steps are active.
- **exhausted**: the Topic has no pending Tasks or Continuations.
- **closed**: the Topic is explicitly finalized; no further Events SHOULD be appended.

### 2.3.3 Invariants

- Transitions MUST be monotonic (no backward transitions).
- The Topic MUST remain reconstructable from the Events in that Topic.
- Topic metadata is a projection, not a source of truth.

## 2.4 Task Object

A **Task** represents a unit of work within a Topic.

### 2.4.1 JSON Structure

```json
{
  "id": "string",
  "topicId": "string",
  "parentTaskId": "string",
  "assignedTo": "string",
  "status": "pending",
  "title": "optional string",
  "metadata": {}
}
```

### 2.4.2 Status Values (normative)

```
pending → running → needs_input → running → done | failed | cancelled
```

Terminal states: `done`, `failed`, `cancelled`.

### 2.4.3 Field Semantics

- **parentTaskId** (optional): hierarchical relationship.
  - MUST NOT introduce cycles.
  - Children are derived by querying `parentTaskId`; they are NOT stored explicitly.

- **assignedTo**: name of the Agent or human role responsible for the Task.

### 2.4.4 Invariants

- A Task MUST belong to exactly one Topic.
- A Task’s lifecycle MUST be explainable by Events in its Topic.
- Tasks are mutable projections, not primary records.

## 2.5 Step Object

A **Step** is a finer-grained subunit inside a Task.

### 2.5.1 JSON Structure

```json
{
  "id": "string",
  "topicId": "string",
  "taskId": "string",
  "status": "pending",
  "artifactIds": ["string"],
  "metadata": {}
}
```

### 2.5.2 Status Values

```
pending → running → done | failed | skipped
```

### 2.5.3 Invariants

- A Step MUST reference exactly one Task.
- A Step MAY reference zero or more Artifacts.
- Like Tasks, Steps MUST be reconstructable by replay.

## 2.6 Artifact Object

An **Artifact** is immutable data produced within a Topic.

### 2.6.1 JSON Structure

```json
{
  "id": "string",
  "topicId": "string",
  "type": "string",
  "format": "string",
  "payload": {},
  "metadata": {}
}
```

### 2.6.2 Field Semantics

- **type**: opaque string describing the Artifact (e.g. `text/plain`, `agent/message`,
  `human/decision`, `cop/continuation`).
- **format**: optional MIME-like descriptor; MAY be omitted.
- **payload**: immutable JSON value.

Artifacts MUST be immutable. Corrections or revisions MUST produce new Artifacts.

## 2.7 Continuation Artifact (Standardized)

A **Continuation** is represented as a reserved Artifact type with a specific payload schema.

### 2.7.1 JSON Structure

```json
{
  "id": "string",
  "topicId": "string",
  "type": "cop/continuation",
  "format": "application/json",
  "payload": {
    "agent": "string",
    "topicId": "string",
    "taskId": "string",
    "stepId": "string",
    "state": {},
    "waitForEvents": ["string"],
    "resumeAfter": "2025-12-14T10:00:00Z",
    "resumeBefore": "2025-12-15T10:00:00Z",
    "retry": {
      "maxAttempts": 3,
      "attempt": 1,
      "retryDelayMs": 1000
    },
    "label": "string",
    "meta": {}
  },
  "metadata": {}
}
```

### 2.7.2 Semantics

A Continuation expresses:

- where to resume work (`agent`, `topicId`, `taskId`, `stepId`),
- how to resume it (`state`),
- under which conditions (`waitForEvents`, `resumeAfter`, `resumeBefore`),
- retry hints (`retry`).

Continuation execution semantics are defined in Section 5.5.

### 2.7.3 Reserved Type Name

COP reserves:

```
type = "cop/continuation"
```

All implementations MUST support this Artifact schema.

## 2.8 Identifiers (IDs, URNs, IRIs)

COP does not impose a specific ID scheme but RECOMMENDS:

- **UUIDv4** (simple, universal),
- or **URNs** (stable, readable), e.g.:

```
urn:cop:event:<uuid>
urn:cop:topic:<uuid>
urn:cop:task:<uuid>
urn:cop:artifact:<uuid>
urn:cop:continuation:<uuid>
```

Rules:

- Identifiers MUST be globally unique.
- Identifiers MUST remain stable for the lifetime of the object.
- Identifiers SHOULD be opaque (not semantic).

## 2.9 Schemas, Versions, Compatibility Rules

Each Event includes a `schemaVersion` field. Its meaning:

- identifies the version of the payload schema for that Event type,
- MUST change whenever the payload structure changes in a non-backward-compatible way,
- SHOULD follow semantic versioning or incremental integers.

Compatibility rules:

- Readers SHOULD tolerate unknown fields (“forward compatibility”).
- Writers SHOULD NOT reuse schemaVersion identifiers for incompatible changes.
- Profiles MAY introduce additional versioning constraints.

---

# 3. Causality, Ordering, and Time

This section defines COP’s formal model of ordering, causality, and temporal semantics. These rules
are _normative_: a system that does not respect them cannot be considered COP-compliant.

## 3.1 Event Ordering (topicSeq)

COP defines ordering at the granularity of **Topics**, not globally across the entire system.

### 3.1.1 Topic-local Total Order

Within a given Topic, Events MUST form a **total order**, identified by the `topicSeq` integer.

Requirements:

- `topicSeq` MUST be a strictly monotonically increasing integer sequence starting at 0 or 1.
- No two Events MAY share the same `(topicId, topicSeq)`.
- Assignment of `topicSeq` MUST occur **at the moment the Event becomes durable**.
- Implementations MUST ensure that replaying Events sorted by `topicSeq` yields a consistent Topic
  history.

### 3.1.2 Append Semantics

Append operations MUST ensure that:

1. The new `topicSeq` equals the previous value + 1.
2. The append is atomic with respect to durability.
3. Appends are linearizable _per Topic_ (per-Topic logs behave as single-writer abstractions, even
   in distributed systems).

### 3.1.3 Non-goals

- COP does **not** require global ordering across Topics.
- COP does **not** require consensus across nodes (although implementations MAY use it).

## 3.2 Event Causality (parentEventIds)

Topic-local ordering captures temporal consistency, but not cross-topic causality. COP therefore
defines a simple but powerful mechanism for expressing causal dependence:

```
parentEventIds: ["event-id-1", "event-id-2", ...]
```

### 3.2.1 Meaning of Causal Links

If Event `E` lists Event `P` in its `parentEventIds`, then:

- `E` is causally dependent on `P`.
- Systems SHOULD NOT deliver `E` to agents before delivering `P`.
- Projectors MUST apply `P` before applying `E`.
- Replaying the system MUST preserve the causal order:
  - replay(P) occurs before replay(E).

### 3.2.2 Cross-topic Causality Graph

Taken together, all `parentEventIds` define a **global partial order** of Events across Topics.

This forms a **Directed Acyclic Graph (DAG)**:

- Cycles MUST NOT occur.
- Implementations SHOULD detect cycles during ingestion (or reject Events that create cycles).
- A DAG allows parallel Topics while preserving causal dependencies where needed.

### 3.2.3 Optionality

Events MAY omit `parentEventIds` if they have no external dependencies.

### 3.2.4 Use Cases

- Human approval:
  - event `approval.received` causally follows a `approval.requested`.

- Multi-agent orchestration:
  - planner output → worker steps → final summary.

- Cross-topic workflows:
  - a reference in Topic B MUST not be processed before the referenced event in Topic A.

## 3.3 Global Causal DAG

The combination of:

1. **topic-local total order** (`topicSeq`), and
2. **cross-topic partial order** (`parentEventIds`)

defines the **COP Global Causal DAG**.

### 3.3.1 Formal Definition

Let:

- `E` be the set of all Events across all Topics,
- `→topic` be the total per-topic order relation,
- `→cause` be the edge relation induced by `parentEventIds`.

Then the global causality relation is:

```
→COP = →topic ∪ →cause
```

This relation MUST be acyclic.

### 3.3.2 Replay Ordering

A COP-compliant implementation MUST be able to produce a replay order that:

- respects all topicSeq intra-topic order,
- respects all parentEventIds causal dependencies.

A topological sort of the global DAG (when needed) satisfies this.

### 3.3.3 Projector Requirements

Projectors MUST:

- Apply events in topicSeq order for each Topic.
- If an Event `E` depends on `P` (via parentEventIds), the projector MUST ensure that:
  - P is applied before E, or
  - E is buffered until P becomes available.

### 3.3.4 Scheduler Requirements

Schedulers SHOULD, when possible, deliver causally necessary Events to agents before dependent
Events, but:

- Agents MUST NOT rely on this for correctness.
- Agents MUST remain idempotent and robust to reordering or delayed delivery.

## 3.4 Time in COP

COP distinguishes **ordering** from **time**. `topicSeq` defines order; `createdAt` provides a
timestamp.

### 3.4.1 Timestamp Semantics

`createdAt`:

- MUST represent the moment when the Event becomes durable,
- MUST be expressed in ISO-8601 UTC,
- SHOULD be monotonic for Events appended by the same node, but global monotonicity is NOT required.

### 3.4.2 Time is Not Ordering

Implementations MUST NOT infer event ordering from timestamps alone. Two Events MAY have the same
timestamp and differ in order, or be out of chronological order due to clock skew.

### 3.4.3 Allowed Uses of Time

Time MAY be used for:

- resuming Continuations (`resumeAfter`, `resumeBefore`),
- scheduling agent execution,
- anchoring ledgers or audits,
- conflict resolution in higher-level profiles,
- user-facing displays.

Time MUST NOT be used for:

- deriving causal order,
- validating replay order,
- determining event application sequences.

### 3.4.4 Time Drift Considerations

COP does not impose clock synchronization requirements. Implementations MAY use NTP, GPS, or trusted
time sources where strong ordering is needed.

## 3.5 Replay Semantics and Determinism

Replay is a foundational COP feature. Any COP-compliant implementation MUST support full or partial
replay as defined below, at least in some auditable way.

### 3.5.1 Auditable Replay (Normative)

Replaying Events in `topicSeq` order MUST reconstruct:

- Topic status and metadata
- Task/Step lifecycles and assignments
- Artifact index and immutability
- Continuation conditions

**External effects** (LLM outputs, API results, human decisions) are recorded as immutable Artifacts
at execution time. Replay reuses these recorded outcomes rather than re-executing external systems.

Projectors MUST be **pure functions** over Events → Projections. Given identical Event sequences,
projectors MUST produce identical projection state (excluding external timestamps, random seeds, or
implementation-specific optimizations).

### 3.5.2 Replay of Cross-Topic Dependencies

Global replay MUST also respect causal dependencies:

- If replaying Event `E` requires Event `P`, and P belongs to another Topic, the implementation MUST
  be able to load and apply P before E.

Full DAG replay MAY be costly, but is required for correctness. Optimizations (e.g. partial replay
or snapshotting) are allowed but SHOULD not break determinism.

### 3.5.3 Snapshotting

Implementations MAY:

- snapshot Topic projections to speed up replay,
- checkpoint projector state,
- garbage-collect old intermediate states.

Snapshots MUST NOT change the logical meaning of replay.

### 3.5.4 Reprocessing After Code Changes

If the projection logic changes (e.g. code upgrade):

- Implementations SHOULD support full replay from the event log.
- If a full replay is impractical, implementations SHOULD provide compatibility layers.

### 3.5.5 Impact on Agents

Replay feeds only the Store, not the Agents.

Agents SHOULD NOT be invoked during replay. Their behavior is driven by Event delivery, not by
replay semantics.

---

# 4. Projections and the COP Store

The COP Store is the _derived state_ layer of COP. Unlike Events, which are immutable and
append-only, the Store holds mutable projections rebuilt from Events.

This section defines:

- the Store model,
- the read-only vs full Store distinction,
- the standard result container (`COPResult<T>`),
- projection invariants,
- replay and rebuild requirements.

## 4.1 Projections Overview

A **projection** is any derived structure computed from Events. Projections exist to:

- index data for fast lookup,
- maintain Task/Step/Topic state,
- provide the view that Agents rely on for decision-making,
- support UI queries and audit tools,
- track mutable but replayable information.

Projections are _not_ authoritative. The Event log is the single source of truth.

### 4.1.1 Projection Families

A COP implementation usually maintains projections such as:

- **Topic projection**: topic ID, title, status, last sequence number.

- **Task projection**: status, assigned agent, parent-child relationships.

- **Step projection**: execution status, artifact references.

- **Artifact index**: immutable artifacts indexed by topic, type, and metadata.

- **Continuation index**: pending continuations, grouped by agent or by resume conditions.

Implementations MAY maintain additional projections (e.g. conversation summaries, search indexes).
All projections MUST remain _reconstructable_ by replay.

## 4.2 COPReadOnlyStore (Agent-Facing Store)

Agents interact only with the **read-only** view of the Store.

A `COPReadOnlyStore` MUST support queries such as:

- retrieving a Topic, Task, Step, Artifact,
- listing Tasks by status or topic,
- listing Artifacts by type or topic,
- retrieving Steps for a given Task.

This store MUST:

- expose projection state only,
- never allow mutation via agent APIs,
- return results wrapped in `COPResult<T>` structures,
- behave reasonnably deterministically during replay.

### 4.2.1 Reason for Read-Only Constraint

Agents (especially AI agents) MUST NOT:

- modify shared state directly,
- bypass Event production,
- introduce hidden state mutations.

Agents influence the world **only** through Events.

This guarantees:

- best effort determinism under replay,
- isolation between agents,
- reproducibility,
- auditability.

## 4.3 COPStore (Full Projection Store)

The full Store extends the read-only Store with mutation operations intended for:

- **Projectors**,
- **administrative tools**,
- **migration utilities**,
- **maintenance processes**.

A `COPStore` MUST support:

- writing Topics, Tasks, Steps, Artifacts,
- updating their fields according to replay logic,
- maintaining indexes.

Agents MUST **never** receive a `COPStore`. They receive only a `COPReadOnlyStore`.

### 4.3.1 Mutation Semantics

Mutations MUST only occur in response to Events:

- When the Projector processes Event `E`, it updates projections accordingly.
- Projections MUST NOT be mutated outside projector logic.

### 4.3.2 Atomicity

Store updates MUST be atomic with respect to each Event application:

- If applying Event `E` produces multiple projection changes, they MUST commit atomically.
- Partial updates MUST NOT be visible.

This ensures replay consistency.

## 4.4 COPResult<T> – Standard Result Container

All asynchronous Store operations MUST return a `COPResult<T>`.

### 4.4.1 Structure

```json
// Success case:
{
  "ok": true,
  "data": <JSON value>
}

// Error case:
{
  "ok": false,
  "error": {
    "code": "string",
    "message": "string",
    "details": { }
  }
}
```

### 4.4.2 Success Case

- `ok = true`
- `data` MAY be:
  - a value of type `T`,
  - `null` (e.g. not found),
  - an empty array.

These are considered normal outcomes, not errors.

### 4.4.3 Error Case

- `ok = false`
- `error.code` MUST be a stable symbolic string (e.g. `"not_found"`, `"invalid_query"`,
  `"internal_error"`).
- `error.message` SHOULD be human-readable.
- `error.details` MAY contain arbitrary structured JSON.

### 4.4.4 Error Taxonomy

COP defines three high-level error categories:

1. **Business errors** (expected, non-fatal)
   - not found
   - inconsistent request
   - precondition failure
   - invalid parameters

2. **Temporary/runtime errors** (retry recommended)
   - network failure
   - lock timeout
   - unavailable resource

3. **Internal errors / bugs** (fatal)
   - unexpected exception
   - projector inconsistency
   - invalid state violation

Only categories (1) and (2) should reach agents. Category (3) SHOULD be considered fatal to the
implementation and MAY trigger safeguards.

### 4.4.5 Helper: unwrap

Implementations SHOULD provide a helper function:

```
unwrap(result: COPResult<T>) => T
```

- If `ok = true`, return `data`.
- If `ok = false`, throw an exception containing `error.*`.

Agents MAY or MAY NOT use `unwrap`, depending on language constraints.

## 4.5 Projection Invariants

The Store MUST uphold the following invariants.

### 4.5.1 Replay Consistency

Replaying all Events in a Topic MUST produce:

- the exact same Topic state,
- the same set of Tasks and Steps with identical fields,
- the same Artifact index,
- the same Continuation index.

### 4.5.2 Pure Projection Functions

Projector logic MUST be pure:

- Same Events → same Projections (modulo external time/randomness)
- No side effects outside the Store
- Idempotent application

### 4.5.3 Idempotent Application

Applying the same Event twice MUST NOT change the projection.

This is crucial for at-least-once delivery semantics.

### 4.5.4 Monotonic TopicSeq Processing

For each Topic, Events MUST be applied in ascending `topicSeq` order.

Out-of-order processing MUST NOT occur.

### 4.5.5 Isolation Between Topics

Applying Events of Topic A MUST NOT modify projection state of Topic B, except for shared indexes
(e.g. cross-topic references).

### 4.5.6 Immutable Artifacts

Projection state MUST reflect the immutability of Artifacts:

- An Artifact MUST NOT be modified after creation.
- Updating an Artifact MUST create a new Artifact with a new ID.

### 4.5.7 Consistency of Task and Step Lifecycles

Transitions MUST obey the normative lifecycle diagrams in Section 2.

Illegal transitions (e.g. `done` → `running`) MUST raise projection errors.

These errors MUST NOT reach agents; they indicate internal bugs.

## 4.6 Rebuild / Replay Requirements

Implementations MUST support rebuilding the entire projection state from Events.

### 4.6.1 Full Rebuild

A full rebuild consists of:

1. Clearing all projection state.
2. Replaying all Events in order.
3. Reconstructing Topics, Tasks, Steps, and Artifact indexes.

This MUST produce a projection consistent with the pre-rebuild store.

### 4.6.2 Partial Rebuild

Implementations MAY provide:

- replay from snapshot,
- replay from checkpoint,
- selective replay for affected Topics.

However:

- Snapshots MUST NOT violate replay semantics.
- Rebuild from snapshot MUST yield identical projection state to full replay.

### 4.6.3 Incremental Replay

After a crash:

- The projector MUST detect which Events were last applied.
- Replay MUST resume from the next event in topicSeq order.

### 4.6.4 Concurrency and Parallelism

Implementations MAY:

- process multiple Topics in parallel,
- maintain per-topic projector instances.

But MUST ensure:

- per-topic sequentiality,
- integrity of cross-topic causal references (parentEventIds).

### 4.6.5 Impact on Agents

Replay MUST NOT trigger agent execution.

Agents respond only to new durable Events, not to effects of replay.

---

# 5. Execution Model

This section defines the normative execution semantics of COP. It specifies the roles and
responsibilities of **Projectors**, **Schedulers**, **Agents**, and **Continuations**, and how they
interact through Events and the Store.

COP enforces a strict separation between:

- **state evolution** (driven exclusively by Events), and
- **execution** (driven by schedulers and agents reacting to Events).

## 5.1 Projectors

A **Projector** is the component responsible for applying Events to projections in the COP Store.

### 5.1.1 Responsibilities

A Projector MUST:

- read Events in the order defined by Section 3,
- apply each Event exactly once to the Store (idempotently),
- update all relevant projections (Topics, Tasks, Steps, Artifacts, Continuations),
- maintain per-Topic progress (e.g. last applied `topicSeq`).

### 5.1.2 Determinism

Projectors SHOULD be deterministic:

- Given the same sequence of Events, a Projector MAY produce the same Store state.
- Projectors MUST NOT depend on:
  - wall-clock time,
  - random values,
  - external services,
  - mutable global state.

Any non-deterministic behavior MUST be encoded explicitly as Events.

### 5.1.3 Purity

Projectors MUST be pure with respect to COP state:

- They MUST NOT emit Events.
- They MUST NOT invoke Agents.
- They MUST NOT perform side effects outside the Store.

Projectors exist solely to transform Events into projections.

## 5.2 Scheduler

A **Scheduler** orchestrates the execution of Agents in response to Events and time.

### 5.2.1 Responsibilities

A Scheduler MAY:

- deliver Events to Agents,
- trigger Agent execution based on time (ticks),
- resume Continuations,
- retry Agent execution after failures.

A Scheduler MUST:

- preserve at-least-once delivery semantics,
- avoid violating per-Topic ordering guarantees,
- ensure that Agents see a Store state consistent with applied Events.

### 5.2.2 Delivery Semantics

Event delivery to Agents is **at-least-once**.

Implications:

- Agents MUST be idempotent.
- Duplicate delivery MUST NOT cause incorrect behavior.
- Schedulers MAY redeliver Events after crashes or timeouts.

Schedulers SHOULD attempt best-effort ordering but MUST NOT rely on it for correctness.

### 5.2.3 Ordering Guarantees

Schedulers MUST ensure that:

- For a given Topic, Events are delivered to Agents in non-decreasing `topicSeq` order, whenever
  feasible.

Schedulers MAY:

- deliver Events from different Topics in parallel,
- interleave delivery across Topics.

Schedulers MUST NOT:

- reorder Events within a Topic in a way that violates `topicSeq`.

### 5.2.4 Tick-Based Execution

Schedulers MAY implement periodic “ticks”:

- Ticks are synthetic triggers, not Events.
- Ticks MAY cause:
  - scanning for resumable Continuations,
  - housekeeping tasks,
  - retries.

Ticks MUST NOT mutate COP state directly. Any durable effect MUST be expressed via Events.

## 5.3 Agents

An **Agent** is an active component that reacts to Events and may emit new Events.

### 5.3.1 Agent Interface (Conceptual)

Conceptually, an Agent behaves like:

```
onEvent(event, context) → zero or more new Events
```

Where `context` provides access to:

- a COPReadOnlyStore,
- configuration parameters,
- execution metadata (e.g. attempt number).

### 5.3.2 Statelessness Requirement

Agents MUST be stateless between invocations.

This means:

- An Agent MUST NOT rely on in-memory state from previous invocations.
- All durable state MUST be:
  - read from the Store, or
  - encoded in Events or Artifacts.

This requirement ensures:

- fault tolerance,
- scalability,
- replay safety,
- migration across nodes.

### 5.3.3 Idempotence Requirement

Agents MUST be idempotent.

Given the same Event and the same Store state:

- repeated invocations MUST produce the same emitted Events, or
- no Events at all.

Agents SHOULD:

- detect whether their intended effects have already occurred,
- avoid emitting duplicate Events.

### 5.3.4 Isolation

Agents MUST NOT:

- directly mutate the Store,
- bypass the Event log,
- coordinate through hidden channels.

All coordination occurs via Events and projections.

## 5.4 Human-in-the-loop Execution

Human actors participate in COP through the same execution model, with one distinction: their
actions originate outside the Scheduler.

### 5.4.1 Human Actions as Events

Human actions (messages, approvals, decisions) MUST be represented as Events:

- produced by an external interface (UI, API, etc.),
- appended to the Event log like any other Event,
- projected into the Store by Projectors.

From the perspective of Agents and Schedulers, human-generated Events are indistinguishable from
agent-generated Events.

### 5.4.2 Interaction Patterns

Typical patterns include:

- An Agent emits an Event requesting human input.
- A Continuation is created waiting for a human response.
- A human submits input, producing a new Event.
- The Scheduler resumes the waiting Continuation.

These patterns are standardized in the COP/HITL profile.

## 5.5 Continuation Execution Semantics

Continuations enable deferred execution and long-lived reasoning.

### 5.5.1 Continuation Lifecycle

A Continuation exists as long as:

- its conditions have not been satisfied, and
- it has not expired or been cancelled.

A Continuation MAY be:

- active (waiting),
- resumed (triggered),
- expired,
- abandoned (after max retries).

### 5.5.2 Resumption Conditions

A Scheduler MAY attempt to resume a Continuation when:

- an Event matching `waitForEvents` occurs in the same Topic, or
- the current time passes `resumeAfter`, or
- a periodic tick evaluates it as eligible.

If `resumeBefore` is set and the current time exceeds it, the Continuation SHOULD be considered
expired.

### 5.5.3 Execution

When resuming a Continuation:

1. The Scheduler invokes the designated Agent.
2. The Agent receives:
   - the Continuation state,
   - the triggering Event (if any),
   - access to the COPReadOnlyStore.

3. The Agent MAY:
   - emit new Events,
   - create new Artifacts,
   - create a new Continuation (to replace or extend the current one).

The original Continuation MUST NOT be mutated; replacement is expressed via new Artifacts.

### 5.5.4 Retry Semantics

Retry hints in a Continuation (`retry.*`) are advisory.

Schedulers MAY:

- retry execution up to `maxAttempts`,
- apply `retryDelayMs` between attempts,
- abandon the Continuation after exceeding limits.

Schedulers MUST ensure retries do not violate idempotence or ordering constraints.

### 5.5.5 Failure Handling

If a Continuation cannot be resumed successfully:

- The Scheduler MAY emit an Event indicating failure.
- Tasks or Steps associated with the Continuation MAY transition to `failed`.
- No silent failure is permitted; failures MUST be observable via Events or projection state.

## 5.6 Separation of Concerns (Normative)

The following separations are **mandatory**:

| Component | May Emit Events | May Mutate Store | May Invoke Agents |
| --------- | --------------- | ---------------- | ----------------- |
| Projector | No              | Yes              | No                |
| Scheduler | No              | No               | Yes               |
| Agent     | Yes             | No               | No                |
| Human UI  | Yes             | No               | No                |

This separation is fundamental to COP’s correctness, replayability, and auditability.

---

# 6. Transport and Interoperability

COP is transport-agnostic. It defines _what_ an Event is and _how_ it behaves, but not _how_ it is
physically transmitted.

This section defines the normative mapping between **COP Events** and **CloudEvents 1.0**, and the
constraints that preserve COP semantics across transports.

---

## 6.1 COP Event → CloudEvents 1.0 Mapping

COP adopts **CloudEvents 1.0** as its canonical interoperability format for Events exchanged outside
a COP kernel.

A COP Event MUST be representable as a valid CloudEvent 1.0 object.

### 6.1.1 Mapping Principles

- The COP Event remains the **authoritative internal representation**.
- The CloudEvent representation is a **projection** intended for transport and interoperation.
- No semantic information required for COP correctness may be lost in the mapping.

### 6.1.2 Core Field Mapping (Normative)

| COP Event Field | CloudEvent Field  | Notes                         |
| --------------- | ----------------- | ----------------------------- |
| `id`            | `id`              | Direct mapping                |
| `type`          | `type`            | Event type string             |
| `createdAt`     | `time`            | ISO-8601 UTC                  |
| `payload`       | `data`            | JSON value                    |
| `schemaVersion` | `dataschema`      | URI or version identifier     |
| `topicId`       | `subject`         | Identifies the Topic          |
| _(constant)_    | `specversion`     | MUST be `"1.0"`               |
| _(optional)_    | `datacontenttype` | Default: `"application/json"` |

### 6.1.3 CloudEvent `source`

The CloudEvent `source` field identifies the **originating node or service**, not the Topic.

Normative rule:

- `source` MUST identify the COP node, service, or cluster that emitted the Event.
- Recommended formats:
  - `urn:cop:node:<node-id>`
  - a stable service URL

This distinction preserves CloudEvents semantics while allowing Topics to be represented
independently via `subject`.

---

## 6.2 COP CloudEvents Extensions

COP defines a set of **reserved CloudEvents extension attributes**.

These extensions MUST be prefixed with `cop` to avoid collisions.

### 6.2.1 Reserved Extensions (Normative)

| Extension Name      | Type             | Description                        |
| ------------------- | ---------------- | ---------------------------------- |
| `copTopicSeq`       | integer          | Per-Topic sequence number          |
| `copCorrelationId`  | string           | Cross-topic correlation identifier |
| `copParentEventIds` | array of strings | Causal dependencies                |
| `copHash`           | object           | JCS-based hash metadata            |
| `copMetadata`       | object           | COP Event metadata                 |

### 6.2.2 Extension Semantics

- Extensions MUST preserve the exact semantics of their COP counterparts.
- Extensions MUST NOT redefine CloudEvents core fields.
- Unknown extensions MUST be ignored by consumers.

### 6.2.3 Example CloudEvent (Informative)

```json
{
  "specversion": "1.0",
  "id": "urn:cop:event:123",
  "source": "urn:cop:node:alpha",
  "type": "task.created",
  "subject": "urn:cop:topic:456",
  "time": "2025-12-14T10:00:00Z",
  "datacontenttype": "application/json",
  "dataschema": "cop.task.v1",
  "data": {
    "taskId": "urn:cop:task:789",
    "title": "Explain COP execution model"
  },
  "copTopicSeq": 42,
  "copCorrelationId": "urn:cop:correlation:abc",
  "copParentEventIds": ["urn:cop:event:122"],
  "copMetadata": {
    "initiator": "agent:explainer"
  }
}
```

## 6.3 Transport Independence

COP imposes **no mandatory transport**.

Any transport capable of delivering CloudEvents MAY be used, including:

- HTTP / REST
- WebSockets
- Kafka
- NATS
- AMQP
- File-based append-only logs
- Object storage (e.g. S3-compatible systems)

### 6.3.1 Required Transport Properties

Regardless of transport, implementations MUST ensure:

- At-least-once delivery semantics
- Preservation of CloudEvent payload and extensions
- No mutation of Event contents in transit

### 6.3.2 Ordering Guarantees

Transports:

- MAY reorder Events across Topics,
- MUST NOT reorder Events within the same Topic in a way that violates `copTopicSeq`.

If a transport cannot guarantee per-Topic ordering, the Scheduler MUST buffer or reorder Events
before delivery to Agents and Projectors.

## 6.4 Ingesting External CloudEvents

COP implementations MAY ingest CloudEvents produced by external systems.

### 6.4.1 Ingestion Requirements

To ingest an external CloudEvent as a COP Event:

- The CloudEvent MUST be valid per CloudEvents 1.0.
- Required COP fields MUST be derivable:
  - `id`, `type`, `time`, `data`.

- A `topicId` MUST be determined:
  - via `subject`, or
  - via implementation-specific mapping.

If mandatory information cannot be derived, the Event MUST be rejected.

### 6.4.2 Provenance

Externally ingested Events SHOULD:

- preserve original `source`,
- record ingestion details in metadata,
- optionally record the original CloudEvent unchanged as an Artifact.

This supports auditability and traceability.

## 6.5 COP Event as the Source of Truth

Normative rule:

> Even when transported as CloudEvents, the **COP Event** remains the authoritative semantic unit.

Implications:

- CloudEvents are projections for transport, not the canonical store format.
- Hashing, replay, and audit semantics are defined on the COP Event object, not on its CloudEvent
  representation.
- Implementations MUST NOT rely on transport-level guarantees (e.g. Kafka offsets) as a substitute
  for COP invariants.

## 6.6 Compatibility with JSON-LD and JCS

CloudEvents interoperability is compatible with:

- **JSON-LD**:
  - `data` MAY be JSON-LD objects using the COP context.
  - CloudEvents envelopes MAY be further annotated in JSON-LD contexts if required.

- **JSON Canonicalization Scheme (JCS)**:
  - JCS hashing MUST apply to the COP Event representation, not to the CloudEvent envelope.
  - The resulting hash MAY be exposed via the `copHash` extension.

---

# 7. Semantic Layer (JSON-LD)

COP defines a semantic layer based on **JSON-LD 1.1** to provide explicit meaning, global
identifiers, and graph representations for COP objects.

This semantic layer is **optional but normative** for interoperability: implementations MAY ignore
it internally, but MUST follow these rules when exposing or consuming semantic representations.

## 7.1 Purpose of the Semantic Layer

The COP semantic layer exists to:

- provide unambiguous meaning to COP concepts across implementations,
- enable graph-based reasoning and inspection,
- allow external systems (including knowledge graphs and AI agents) to interpret COP data
  consistently,
- support long-term archival, audit, and analysis.

The semantic layer does **not** change COP execution semantics. It is a **projection** over the core
data model.

## 7.2 COP JSON-LD Context

COP defines a canonical JSON-LD context that maps COP fields to globally identified terms.

### 7.2.1 Context Identifier

The COP JSON-LD context MUST be identified by a stable IRI, for example:

```
https://cop.dev/spec/v1/context.jsonld
```

The exact URL is implementation-defined but MUST be stable and versioned.

### 7.2.2 Vocabulary Namespace

COP terms SHOULD use a dedicated namespace, for example:

```
cop: https://cop.dev/ns#
```

The following terms are RESERVED by the COP specification:

| Term               | Meaning          |
| ------------------ | ---------------- |
| `cop:Event`        | COP Event        |
| `cop:Topic`        | COP Topic        |
| `cop:Task`         | COP Task         |
| `cop:Step`         | COP Step         |
| `cop:Artifact`     | COP Artifact     |
| `cop:Continuation` | COP Continuation |
| `cop:Agent`        | Software agent   |
| `cop:HumanActor`   | Human actor      |

## 7.3 Mapping Rules (Normative)

The following mapping rules MUST be applied when representing COP objects as JSON-LD.

### 7.3.1 Identifier Mapping

- The COP field `id` MUST map to JSON-LD `@id`.
- COP identifiers SHOULD be IRIs (e.g. URNs).
- If a COP identifier is not an IRI, implementations MUST transform it into an IRI when producing
  JSON-LD.

Example:

```json
{
  "@id": "urn:cop:event:1234"
}
```

### 7.3.2 Type Mapping

- COP object types MUST map to JSON-LD `@type`.

| COP Object   | JSON-LD `@type`    |
| ------------ | ------------------ |
| Event        | `cop:Event`        |
| Topic        | `cop:Topic`        |
| Task         | `cop:Task`         |
| Step         | `cop:Step`         |
| Artifact     | `cop:Artifact`     |
| Continuation | `cop:Continuation` |

### 7.3.3 Field Mapping

COP fields MUST be mapped using the COP vocabulary.

Examples:

| COP Field   | JSON-LD Property |
| ----------- | ---------------- |
| `topicId`   | `cop:topic`      |
| `taskId`    | `cop:task`       |
| `stepId`    | `cop:step`       |
| `type`      | `cop:eventType`  |
| `topicSeq`  | `cop:topicSeq`   |
| `createdAt` | `cop:createdAt`  |
| `status`    | `cop:status`     |
| `payload`   | `cop:payload`    |
| `metadata`  | `cop:metadata`   |

## 7.4 JSON-LD Representation of Core Objects

### 7.4.1 Event Representation (Informative)

```json
{
  "@context": "https://cop.dev/spec/v1/context.jsonld",
  "@id": "urn:cop:event:7f854a9b",
  "@type": "cop:Event",
  "cop:topic": { "@id": "urn:cop:topic:abcd" },
  "cop:eventType": "task.created",
  "cop:topicSeq": 12,
  "cop:createdAt": "2025-12-14T10:00:00Z",
  "cop:payload": {
    "title": "Explain COP semantic layer"
  }
}
```

This representation:

- preserves the COP event semantics,
- introduces no additional execution meaning,
- enables graph-based traversal.

### 7.4.2 Artifact Representation

Artifacts MAY include semantic typing of their payload.

Example:

```json
{
  "@context": "https://cop.dev/spec/v1/context.jsonld",
  "@id": "urn:cop:artifact:42",
  "@type": ["cop:Artifact", "schema:Text"],
  "cop:payload": "This is a human-readable explanation of COP."
}
```

## 7.5 RDF Graph Semantics

When expanded, COP JSON-LD representations form an RDF graph with the following properties:

- Events are nodes linked to Topics via `cop:topic`.
- Tasks and Steps form hierarchical subgraphs.
- Artifacts are immutable leaf nodes referenced by Events and Steps.
- Continuations encode suspended execution paths as first-class graph entities.

This enables:

- graph traversal queries (e.g. SPARQL),
- reasoning about agent behavior,
- temporal and causal analysis at the semantic level.

## 7.6 Extending the COP Ontology

COP explicitly allows extension of its semantic vocabulary.

### 7.6.1 Extension Rules

- Extensions MUST NOT redefine COP core terms.
- Extensions SHOULD use their own namespace (e.g. `ai:`, `legal:`, `ui:`).
- Extensions MAY define:
  - new Event types,
  - new Artifact types,
  - domain-specific properties.

Example:

```json
{
  "@context": {
    "cop": "https://cop.dev/ns#",
    "legal": "https://example.org/legal#"
  },
  "@type": ["cop:Event", "legal:EvidenceSubmission"]
}
```

## 7.7 Semantics and Execution Independence

Normative rule:

> JSON-LD semantics MUST NOT affect COP execution behavior.

Implications:

- Projectors and Schedulers MUST ignore semantic annotations for execution.
- Semantic processing is strictly an inspection, interoperability, and analysis layer.
- Removing JSON-LD annotations MUST NOT change replay results.

## 7.8 Relationship to AI Reasoning

The COP semantic layer is intentionally compatible with AI systems:

- JSON-LD graphs can be ingested by knowledge-based agents.
- Semantic typing enables reasoning over Tasks, Steps, and Artifacts.
- Human-in-the-loop interactions can be interpreted uniformly alongside agent actions.

However:

- COP does not impose reasoning algorithms.
- COP defines _what_ is represented, not _how_ it is interpreted.

---

# 8. References and Linking

COP defines explicit rules for referencing and linking between objects, both **internally** (within
COP data) and **externally** (to resources outside the system).

References are purely **declarative**. They do not alter execution semantics and MUST NOT introduce
hidden state.

## 8.1 Design Principles

References in COP are governed by the following principles:

1. **Single source of truth**
   - Core relationships (e.g. parent-child, ownership) are expressed explicitly via identifiers in
     Events and projections.
   - No redundant “children” or back-references are stored in core objects.

2. **Immutability preservation**
   - Artifacts are immutable; references to Artifacts MUST NOT imply mutation.

3. **Replay safety**
   - All references MUST remain valid or explicitly broken during replay.
   - Reference resolution MUST NOT affect replay optimisitic determinism.

4. **Transport and format neutrality**
   - References are expressed using JSON-native mechanisms compatible with JSON-LD, CloudEvents, and
     JCS.

## 8.2 JSON Reference (`$ref`)

COP adopts **JSON Reference** as the standard mechanism for generic references inside JSON payloads
and metadata.

### 8.2.1 Syntax

A reference is expressed using the `$ref` key:

```json
{
  "$ref": "<IRI-or-URI-with-optional-fragment>"
}
```

### 8.2.2 Scope of Use

`$ref` MAY be used in:

- Artifact payloads,
- Artifact metadata,
- Event payloads,
- Event metadata.

`$ref` MUST NOT be used to redefine COP core fields (e.g. `topicId`, `taskId`, `id`).

### 8.2.3 Resolution

- Reference resolution is **contextual** and **implementation-defined**.
- Failure to resolve a `$ref` MUST NOT cause undefined behavior.
- Unresolvable references SHOULD be treated as opaque links.

## 8.3 JSON Pointer (Fragments)

When a `$ref` contains a fragment identifier (`#...`), the fragment MUST conform to **JSON Pointer
(RFC 6901)**.

### 8.3.1 Internal References

References within the same JSON document MAY use a fragment-only form:

```json
{
  "$ref": "#/sections/3/content"
}
```

This indicates a pointer to a substructure within the same document.

### 8.3.2 External References with Fragments

References MAY point to an external document and a substructure within it:

```json
{
  "$ref": "urn:cop:artifact:abcd#/payload/summary"
}
```

This form combines:

- a globally identified resource, and
- a precise pointer to a JSON sub-tree.

## 8.4 Referencing COP Objects

COP objects are primarily linked via explicit identifier fields (e.g. `topicId`, `taskId`,
`artifactIds`). JSON References are **supplementary**, not replacements.

### 8.4.1 Canonical Relationships (Normative)

The following relationships MUST be expressed via explicit fields, not `$ref`:

| Relationship         | Mechanism       |
| -------------------- | --------------- |
| Event → Topic        | `topicId`       |
| Task → Topic         | `topicId`       |
| Step → Task          | `taskId`        |
| Task → Parent Task   | `parentTaskId`  |
| Step → Artifacts     | `artifactIds[]` |
| Continuation → Agent | `payload.agent` |

### 8.4.2 Informative Linking

JSON References MAY be used to:

- embed documentation links,
- reference explanatory material,
- point to previous versions of Artifacts,
- link to external evidence or sources.

Such references are informative and MUST NOT be relied upon for execution correctness.

## 8.5 External References

COP explicitly supports references to resources outside the COP system.

Examples include:

- external documents (PDFs, web pages),
- external APIs,
- public datasets,
- archived evidence repositories.

### 8.5.1 URI and IRI Usage

- External references SHOULD be expressed as IRIs or URLs.
- Implementations SHOULD prefer stable identifiers over ephemeral URLs.

Example:

```json
{
  "$ref": "https://example.org/legal/case/12345"
}
```

## 8.6 Integrity Links (Hashlinks)

To support integrity and auditability, COP defines an optional convention for **integrity links**
(“hashlinks”).

### 8.6.1 Hashlink Structure (Recommended)

```json
{
  "href": "https://example.org/resource.json",
  "hash": {
    "alg": "sha-256",
    "value": "e3b0c44298fc1c149afbf4c8996fb924..."
  }
}
```

### 8.6.2 Semantics

- `href` identifies the referenced resource.
- `hash` identifies the expected content hash of that resource.
- Implementations MAY verify the hash when resolving the reference.
- Hash verification failure MUST NOT alter COP execution semantics but SHOULD be observable.

### 8.6.3 Relationship to JCS

- When referencing COP Events or Artifacts, the hash SHOULD be computed using JCS.
- The referenced object’s hash MUST ignore its own `copHash` metadata to avoid recursion.

## 8.7 Linking and Replay

Normative rules:

- Reference resolution MUST NOT be required for replay.
- Replay MUST operate solely on Events and their projections.
- Missing or broken references MUST NOT prevent replay.

This ensures long-term durability even when external resources disappear.

## 8.8 JSON-LD Compatibility

JSON Reference and JSON Pointer are compatible with JSON-LD:

- `$ref` links can coexist with `@id` references.
- Semantic tools MAY choose to interpret `$ref` as graph edges.
- COP does not mandate such interpretation.

JSON-LD remains a semantic overlay; JSON Reference remains a structural linking mechanism.

## 8.9 Summary of Reference Mechanisms

| Mechanism                             | Purpose                 | Normative Role |
| ------------------------------------- | ----------------------- | -------------- |
| Explicit IDs (`topicId`, `taskId`, …) | Core relationships      | **Mandatory**  |
| JSON Reference (`$ref`)               | Informative linking     | Optional       |
| JSON Pointer                          | Sub-document addressing | Optional       |
| Hashlinks                             | Integrity verification  | Recommended    |
| JSON-LD `@id`                         | Semantic identity       | Optional       |

---

# 9. Integrity, Security, and Identity

This section defines the integrity and identity mechanisms required to make COP systems **auditable,
tamper-evident, and legally defensible**, without imposing unnecessary operational complexity.

COP intentionally avoids heavyweight security or blockchain requirements. Instead, it defines
**minimal, composable primitives** that implementations can strengthen as needed.

## 9.1 Canonicalization and Hashing (JCS)

COP uses the **JSON Canonicalization Scheme (JCS, RFC 8785)** to compute stable hashes over JSON
objects.

### 9.1.1 Purpose

Canonical hashing is required to:

- detect tampering,
- enable deterministic audit verification,
- support append-only ledgers,
- allow cross-system verification of Events and Artifacts.

### 9.1.2 Canonicalization Rules (Normative)

When computing a COP hash:

1. The object MUST be serialized using JCS.
2. UTF-8 encoding MUST be used.
3. No whitespace, formatting, or key-order variation is permitted.

### 9.1.3 Hash Algorithm

- The default algorithm is **SHA-256**.
- Implementations MAY support stronger algorithms, but MUST clearly identify them.

## 9.2 copHash Metadata

COP defines a standard metadata structure to attach canonical hashes to Events and Artifacts.

### 9.2.1 Structure

```json
{
  "copHash": {
    "alg": "sha-256",
    "value": "hex-encoded-hash"
  }
}
```

### 9.2.2 Hash Scope (Normative)

- The hash MUST be computed over the **canonical JCS representation** of the object.
- The hash MUST be computed **excluding** the `copHash` field itself.
- Any other metadata MAY be included unless explicitly excluded by profile.

### 9.2.3 Usage

- Events SHOULD include `copHash` once durable.
- Artifacts SHOULD include `copHash` at creation time.
- Projectors and audit tools MAY recompute and verify hashes at any time.

A hash mismatch indicates tampering or corruption.

## 9.3 Identity Model

COP defines a minimal identity model sufficient for audit and attribution.

### 9.3.1 Node Identity

A **Node** is any logical COP participant that emits Events.

Each Node MUST have a stable identifier:

```
urn:cop:node:<node-id>
```

Node identifiers MUST:

- be globally unique,
- be stable over time,
- appear in Event metadata or CloudEvents `source`.

### 9.3.2 Agent Identity

Agents are identified by opaque strings:

```
agent:<name>
```

Agent identity is **logical**, not cryptographic.

Agent identifiers are used for:

- attribution,
- debugging,
- audit trails,
- continuation routing.

### 9.3.3 Human Identity

Human actors MAY be identified using:

- pseudonymous IDs,
- user account IDs,
- external identity references.

COP does not mandate authentication mechanisms. Identity verification is out of scope.

## 9.4 Signatures (Optional but Recommended)

COP supports optional **digital signatures** to strengthen integrity and non-repudiation.

### 9.4.1 Signature Scope

Signatures MAY be applied to:

- Events,
- Artifacts,
- Ledger records.

### 9.4.2 Signature Structure (Recommended)

```json
{
  "signature": {
    "alg": "ed25519",
    "keyId": "urn:cop:key:node-alpha",
    "value": "base64-signature"
  }
}
```

### 9.4.3 Signing Rules

- The signature MUST cover the canonical JCS representation of the object.
- The signature MUST be verifiable using the identified key.
- Signature verification failure MUST be observable.

Signatures are **orthogonal** to COP semantics: they strengthen trust but do not alter execution.

## 9.5 COP Ledger (Append-Only Audit Log)

To support strong auditability and legal evidence use cases, COP defines an optional **append-only
ledger**.

### 9.5.1 Purpose

The COP Ledger provides:

- tamper-evident ordering,
- durable proof of existence,
- verifiable history of Events (and optionally Artifacts).

A ledger is **not required** for COP correctness, but is **recommended** for high-trust deployments.

## 9.6 Ledger Record Structure (Normative)

A ledger consists of a sequence of records.

### 9.6.1 Record Schema

```json
{
  "index": 12345,
  "eventId": "urn:cop:event:abcd",
  "eventHash": {
    "alg": "sha-256",
    "value": "hex-hash"
  },
  "prevHash": {
    "alg": "sha-256",
    "value": "hex-hash"
  },
  "topicId": "urn:cop:topic:xyz",
  "createdAt": "2025-12-14T10:00:00Z",
  "nodeId": "urn:cop:node:alpha",
  "signature": {}
}
```

### 9.6.2 Semantics

- **index**
  - Strictly increasing integer.
  - Defines total ledger order.

- **eventHash**
  - MUST match the Event’s `copHash`.

- **prevHash**
  - MUST match the hash of the previous ledger record.
  - Creates a hash chain.

- **signature**
  - Optional.
  - Strengthens non-repudiation.

## 9.7 Ledger Invariants (Normative)

A COP Ledger MUST satisfy:

1. **Append-only**
   - Records MUST never be modified or deleted.

2. **Hash chaining**
   - Any modification of a past record MUST break the chain.

3. **Deterministic reconstruction**
   - The ledger MUST be verifiable by replaying records and recomputing hashes.

4. **Stable ordering**
   - Ledger order MUST be immutable once assigned.

### 9.7.1 Detection of Tampering

Any of the following indicates tampering:

- hash mismatch,
- broken `prevHash` chain,
- signature verification failure.

## 9.8 Ledger Scope and Variants

COP does not impose a single ledger topology.

Allowed variants include:

- a single global ledger,
- one ledger per Topic,
- one ledger per Node.

Regardless of topology:

- Record format and invariants MUST be preserved.
- Cross-ledger consistency MUST be explicitly documented.

## 9.9 External Anchoring (Optional)

For stronger guarantees, implementations MAY periodically anchor ledger hashes into external
systems:

- public blockchains,
- trusted timestamping authorities,
- notarization services.

External anchoring:

- strengthens long-term proof,
- is NOT required for COP compliance.

## 9.10 Legal and Probative Considerations (Informative)

COP provides **technical primitives**, not legal guarantees.

A COP system MAY provide strong probative value if:

- Events and Artifacts are hashed and logged,
- the ledger is append-only and verifiable,
- node identities and signatures are managed responsibly,
- operational procedures are documented.

Actual legal admissibility depends on jurisdiction and procedure.

## 9.11 Summary

COP integrity rests on:

- canonical hashing (JCS),
- immutable Events and Artifacts,
- optional cryptographic signatures,
- an optional append-only ledger.

These mechanisms are sufficient to support:

- audit,
- replay verification,
- forensic analysis,
- long-term archival,
- legal procedures.

---

# 10. Profiles

COP is designed as a **layered protocol**. The core defines universal invariants; profiles constrain
and specialize behavior for concrete classes of systems.

A **Profile** is a normative specification that:

- builds on COP/Core,
- MAY add new Event types, Artifact types, and constraints,
- MUST NOT violate COP/Core invariants.

Profiles allow COP to remain minimal while supporting real-world use cases.

## 10.1 COP/Core Profile (Mandatory)

**COP/Core** is the minimal profile that all COP implementations MUST support.

### 10.1.1 Scope

COP/Core defines:

- Events, Topics, Tasks, Steps, Artifacts, Continuations,
- causality and ordering rules,
- projection and Store semantics,
- execution model (Projector / Scheduler / Agent separation),
- transport interoperability (CloudEvents),
- integrity primitives (JCS hashing, optional ledger).

Any implementation claiming COP compatibility MUST implement COP/Core fully.

### 10.1.2 Guarantees

COP/Core guarantees:

- autitable replay and sometimes deterministic replay,
- auditability,
- stateless agent execution,
- transport independence,
- extensibility via profiles.

### 10.1.3 What COP/Core Does _Not_ Define

COP/Core deliberately does NOT define:

- domain semantics,
- UI behavior,
- AI reasoning strategies,
- human interaction UX,
- authorization or authentication.

These belong in profiles or external systems.

## 10.2 COP/HITL Profile (Human-In-The-Loop)

The **COP/HITL** profile standardizes how human participation is modeled.

### 10.2.1 Design Goals

COP/HITL aims to:

- treat humans as first-class actors,
- preserve full auditability of human actions,
- integrate humans into agent workflows without special cases,
- support pauses, approvals, and corrections.

### 10.2.2 Standard Event Types (Normative)

The following Event types are RECOMMENDED by COP/HITL:

| Event Type                 | Meaning                              |
| -------------------------- | ------------------------------------ |
| `human.input.requested`    | An agent requests input from a human |
| `human.input.provided`     | A human provides input               |
| `human.decision.requested` | An agent requests a decision         |
| `human.decision.provided`  | A human provides a decision          |
| `human.feedback`           | Human feedback or correction         |

Payload schemas are profile-defined but MUST be JSON.

### 10.2.3 Standard Artifact Types

Recommended Artifact types include:

- `human/utterance`
- `human/decision`
- `human/annotation`

These Artifacts:

- MUST be immutable,
- MUST be hashable,
- SHOULD be signed or attributed where appropriate.

### 10.2.4 Continuation Patterns

COP/HITL defines standard patterns such as:

- Agent emits `human.input.requested`
- Agent creates a `cop/continuation` waiting for `human.input.provided`
- Scheduler resumes Agent upon human response

This pattern ensures:

- explicit waiting,
- no hidden blocking,
- full traceability.

## 10.3 COP/AI Profile (Agent-Oriented Orchestration)

The **COP/AI** profile standardizes patterns common in AI agent systems.

### 10.3.1 Design Goals

COP/AI aims to:

- support multi-agent reasoning,
- support long-running, interruptible cognition,
- make AI behavior auditable and inspectable,
- integrate seamlessly with HITL workflows.

### 10.3.2 Common Event Types (Recommended)

| Event Type           | Meaning                      |
| -------------------- | ---------------------------- |
| `agent.started`      | Agent begins work            |
| `agent.message`      | Agent emits a message        |
| `agent.tool.invoked` | Agent calls an external tool |
| `agent.tool.result`  | Tool returns a result        |
| `agent.completed`    | Agent completes work         |
| `agent.failed`       | Agent fails                  |

These Events:

- MUST reference the relevant Task or Step,
- SHOULD reference produced Artifacts.

### 10.3.3 Reasoning Artifacts

COP/AI commonly uses Artifacts such as:

- `agent/thought` (internal reasoning, optional),
- `agent/plan`,
- `agent/result`,
- `agent/summary`.

The profile explicitly allows **private reasoning artifacts** to be omitted, redacted, or
summarized, without breaking COP semantics.

### 10.3.4 Continuations as First-Class Cognition

In COP/AI:

- Continuations are the _primary_ mechanism for multi-step reasoning.
- Agents SHOULD externalize state into Continuations rather than memory.
- Long chains of reasoning become explicit, resumable, and auditable.

This is a key differentiator from most existing agent frameworks.

## 10.4 Custom and Domain-Specific Profiles

Implementations MAY define additional profiles, such as:

- `COP/Legal`
- `COP/Education`
- `COP/Research`
- `COP/Operations`

### 10.4.1 Rules for Custom Profiles

Custom profiles:

- MUST declare which COP version they target,
- MUST document added Event and Artifact types,
- MUST NOT weaken COP/Core invariants,
- SHOULD provide migration guidance.

### 10.4.2 Profile Composition

Profiles MAY be composed:

```
COP/Core
  + COP/HITL
  + COP/AI
  + COP/Legal
```

Composition MUST be conflict-free.

## 10.5 Profiles and Interoperability

Profiles enable interoperability at multiple levels:

- two systems sharing COP/Core can exchange Events safely,
- systems sharing COP/HITL can interoperate on human workflows,
- systems sharing COP/AI can exchange agent behavior traces.

Unknown profiles MUST be ignored safely.

---

# 11. Conformance Levels and Compliance

This section defines the conformance requirements for implementations of the Cognitive Orchestration
Protocol (COP).

An implementation that claims COP compliance MUST clearly state:

- which COP version it targets,
- which conformance level it satisfies,
- which optional capabilities it supports.

## 11.1 Terminology

- **Implementation**: a software system, library, service, or cluster that implements COP concepts.
- **COP Version**: the version of this specification (e.g. `1.0`).
- **Conformance Level**: a set of mandatory capabilities defined below.
- **Capability**: an optional, well-defined extension to the core protocol.

## 11.2 Mandatory Conformance: COP/Core

All COP implementations MUST conform to **COP/Core**.

### 11.2.1 COP/Core Requirements (Normative)

A COP/Core–compliant implementation MUST:

1. Implement the **core data model** (Section 2):
   - Events, Topics, Tasks, Steps, Artifacts, Continuations.

2. Enforce **causality and ordering** rules (Section 3):
   - per-Topic total ordering via `topicSeq`,
   - cross-topic causal dependencies via `parentEventIds`.

3. Implement **projection semantics** (Section 4):
   - auditable, sometimes replayable Store,
   - read-only store for Agents,
   - mutation only via Projectors.

4. Implement the **execution model** (Section 5):
   - separation of Projector, Scheduler, and Agent roles,
   - stateless and idempotent Agents.

5. Support **CloudEvents interoperability** (Section 6):
   - valid CloudEvents 1.0 mapping.

6. Support **canonical hashing (JCS)** (Section 9.1).

Failure to satisfy any of the above disqualifies an implementation from claiming COP compliance.

## 11.3 Optional Capability: HITL-Capable

An implementation MAY claim **HITL-capable** compliance if it supports the COP/HITL profile.

### 11.3.1 HITL Requirements

A HITL-capable implementation MUST:

- Represent human actions as Events.
- Support human-generated Artifacts.
- Support Continuation patterns that wait for human input.
- Preserve full auditability of human interactions.

### 11.3.2 Declaration

Example declaration:

```
COP 1.0 — Core + HITL
```

## 11.4 Optional Capability: AI-Capable

An implementation MAY claim **AI-capable** compliance if it supports the COP/AI profile.

### 11.4.1 AI Requirements

An AI-capable implementation MUST:

- Support agent lifecycle Events.
- Support agent-produced Artifacts.
- Support multi-step reasoning via Continuations.
- Allow agents to resume execution, hopefully deterministically.

Private reasoning MAY be redacted or summarized without violating compliance.

### 11.4.2 Declaration

Example declaration:

```
COP 1.0 — Core + AI
```

## 11.5 Optional Capability: Ledger-Capable

An implementation MAY claim **Ledger-capable** compliance if it implements the COP Ledger.

### 11.5.1 Ledger Requirements

A Ledger-capable implementation MUST:

- Maintain an append-only ledger of Events.
- Use JCS hashes and hash chaining.
- Detect and expose any ledger tampering.
- Provide verification tooling or APIs.

### 11.5.2 Declaration

Example declaration:

```
COP 1.0 — Core + Ledger
```

## 11.6 Capability Composition

Capabilities MAY be composed.

Examples:

```
COP 1.0 — Core + HITL + AI
COP 1.0 — Core + AI + Ledger
COP 1.0 — Core + HITL + AI + Ledger
```

Each claimed capability MUST meet its normative requirements.

## 11.7 Versioning and Backward Compatibility

### 11.7.1 Specification Versioning

COP versions are identified by a major.minor scheme:

- **Major** version changes MAY break compatibility.
- **Minor** version changes MUST be backward-compatible.

### 11.7.2 Forward Compatibility

Implementations SHOULD:

- ignore unknown fields,
- tolerate unknown Event types,
- preserve unknown metadata.

### 11.7.3 Claiming Compatibility

An implementation MUST NOT claim compatibility with a COP version it does not fully support.

## 11.8 Compliance Statements

Implementations SHOULD publish a compliance statement including:

- COP version,
- conformance level(s),
- supported profiles,
- known limitations.

Example:

> “This system implements COP 1.0 Core, HITL-capable, AI-capable, Ledger-capable. JSON-LD semantic
> layer is supported for Events and Artifacts.”

## 11.9 Testability and Verification (Informative)

COP compliance is testable via:

- auditable replay tests,
- hash verification tests,
- causal ordering tests,
- idempotence tests,
- ledger integrity checks.

A reference test suite MAY be published separately.

## 11.10 Final Notes

COP is intentionally strict where correctness, replayability, and auditability matter, and
intentionally flexible everywhere else.

If an implementation:

- produces immutable Events,
- derives all state from those Events,
- treats Agents as stateless,
- makes reasoning resumable and inspectable,

then it is aligned with the spirit and the letter of COP.
