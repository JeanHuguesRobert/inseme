---
title: COP Store — Minimal Persistence Model
subtitle: Occam consolidation of Events, Artifacts, Views, and adapters
author: Jean Hugues Noël Robert, baron Mariani
affiliation: Institut Mariani / C.O.R.S.I.C.A.
license: CC BY-SA 4.0
date: '2026-07-14'
version: '0.2'
status: working-source — human validation required
document_role: source
document_kind: protocol-architecture-note
visibility: public
lifecycle_state: working
human_validation_required: true
issue: 16
related_documents:
  - packages/cop-core/Architecture.md
  - packages/cop-core/Invariants.md
  - packages/cop-core/COP_PERSISTENCE.md
  - packages/cop-core/src/types.ts
  - packages/cop-kernel/src/storage.js
tags:
  - cop
  - store
  - persistence
  - occam
  - lean
  - event-sourcing
language: en
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


# COP Store — Minimal Persistence Model

## 1. Decision

COP should start from the smallest model that preserves its invariants.

Earlier drafts multiplied stores, services, registries and layers before evidence showed that they were independent protocol entities. That direction is superseded by this note.

The rule is:

> Do not turn a useful function into a protocol entity until an invariant requires it.

COP begins with two durable primitives and one derived form:

```text
Event
Artifact
View
```

Only the first two are durable core objects.

A `View` is a derived answer. It is not authoritative truth and is not necessarily persisted.

---

## 2. The two durable primitives

### 2.1 Event

An `Event` is an immutable record that something was asserted, observed, requested, decided or changed.

Minimum properties:

```ts
interface COPEvent {
  id: string;
  streamId: string;
  streamSeq: number;
  type: string;
  schemaVersion: string;
  createdAt: string;
  payload: JsonValue;
  artifactIds?: string[];
  parentEventIds?: string[];
  metadata?: Record<string, JsonValue>;
}
```

`streamId` is an ordering scope. It does not imply the existence of a separate stored `Topic` entity.

Required properties:

```text
immutable after append
strictly ordered within one stream
idempotently appendable
explicitly versioned
causally linkable
```

### 2.2 Artifact

An `Artifact` is immutable content that is too large, reusable, independently addressable or independently verifiable to live only inside an Event payload.

Minimum properties:

```ts
interface COPArtifact {
  id: string;
  type: string;
  schemaVersion: string;
  createdAt: string;
  contentName?: string;
  payload?: JsonValue;
  mediaType?: string;
  size?: number;
  metadata?: Record<string, JsonValue>;
}
```

The exact bytes may be local, remote or content-addressed. Backend locations are retrieval details, not semantic identities.

Corrections create a new Event or Artifact. They do not mutate durable history.

---

## 3. View

A `View` is any representation derived from Events and Artifacts for a situated purpose.

Examples:

```text
current task state
mission summary
map of a terrain
continuation queue
search result
historical state at a date
bounded memory supplied to an agent
human-readable dashboard
```

A View may be computed, cached or materialized. These are implementation choices.

A useful generic form is:

```ts
interface COPView<T = JsonValue> {
  kind: string;
  value: T;
  asOf?: string;
  sourceEventIds?: string[];
  sourceArtifactIds?: string[];
  partial?: boolean;
  stale?: boolean;
  confidence?: number;
  metadata?: Record<string, JsonValue>;
}
```

The core distinction is:

```text
Event and Artifact = durable traces
View               = disposable map
```

---

## 4. Minimal COPStore

`COPStore` is the persistence boundary for the two durable primitives.

```ts
interface COPStore {
  append(event: COPEventDraft): Promise<COPEvent>;

  events(input: {
    streamId: string;
    fromSeq?: number;
    toSeq?: number;
    limit?: number;
  }): Promise<COPEvent[]>;

  put(artifact: COPArtifactDraft): Promise<COPArtifact>;

  getArtifact(artifactId: string): Promise<COPArtifact | null>;
}
```

This is the required conceptual interface.

Implementations may add queries, subscriptions, enumeration, export, import, replication, indexes, caches, snapshots or transactions. Those capabilities do not become mandatory core entities merely because an implementation offers them.

A projector is simply a function over Store reads:

```ts
type COPProjector<T> = (
  events: COPEvent[],
  artifacts: ReadonlyMap<string, COPArtifact>
) => COPView<T>;
```

Agents normally:

```text
read a View
emit an Event
produce an Artifact
```

They do not mutate projected state directly.

---

## 5. What is removed from the core

The following names may remain useful in applications, schemas or documentation, but they are not independent COP Store primitives by default:

```text
Topic
Task
Step
Mission
Map
Continuation
NamedResource
ResourceState
Policy
Descriptor
ProjectionStore
MemoryViewService
TemporalResolver
ReplicationService
ExportImportService
CapabilityService
IndexStore
CacheStore
ResourceStore
PolicyStore
```

Their lean interpretation is:

| Former entity | Lean interpretation |
|---|---|
| Topic | stream identifier and optional View |
| Task / Step / Mission | event and artifact schemas plus derived Views |
| Map | a View; stabilized snapshots may be Artifacts |
| Continuation | an Artifact schema plus lifecycle Events |
| Policy | configuration or versioned Artifact |
| Descriptor | Artifact metadata or a descriptor Artifact when independently useful |
| Projection | a View |
| MemoryView | a bounded View |
| temporal resolution | a projector/query producing a View |
| index / cache | adapter implementation detail |
| export / import | procedure built over Store reads and writes |
| replication | Store-to-Store synchronization procedure |
| capability discovery | adapter metadata |

No name is forbidden. It simply receives no core ontological status without proof.

---

## 6. Entity admission test

A new core entity is admitted only when all four conditions hold:

1. It cannot be represented faithfully as an Event, Artifact, View, schema or metadata.
2. It carries an invariant required across conformant implementations.
3. It has an independent identity and lifecycle that affect interoperability.
4. Removing it would break replay, integrity, auditability or exchange — not merely convenience.

Otherwise it remains outside the core.

Compact rule:

> Every new core noun carries the burden of proof.

---

## 7. Adapters and physical storage

SQLite, Postgres, Supabase, filesystems, object stores, Git, IPFS, peer nodes and future Fractanet mechanisms are adapters or deployment choices.

A single adapter may implement all four Store methods. Several adapters may cooperate behind one Store.

The protocol does not require one service per function.

```text
one interface
≠ one process
≠ one database
≠ one provider
≠ one machine
```

The adapter must report failures honestly. A request for durable storage must not silently fall back to volatile memory and still claim equivalent success.

---

## 8. Fractanet without premature ontology

Fractanet may later add locality, federation, replication, discovery and governed domains.

For now these should be explored as capabilities over the same primitives:

```text
Store A Events/Artifacts
        ↕
verified incremental exchange
        ↕
Store B Events/Artifacts
```

A separate `MemoryDomain`, `Replica`, `Custodian` or `ReplicationService` should be introduced only when concrete experiments reveal an invariant that cannot be expressed through identifiers, metadata, policy Artifacts and synchronization procedures.

---

## 9. Smallest implementation experiment

The next implementation should not begin by refactoring every existing package.

Build one minimal reference Store with:

```text
append Event
read ordered Events by stream
put Artifact
get Artifact
restart without data loss
replay one projector into one View
```

Suggested first adapter:

```text
SQLite
```

Suggested first demonstration:

```text
one Mission represented only by Events and Artifacts
→ replay
→ current Mission View
→ bounded agent context
```

Only after this experiment should another interface or entity be added.

---

## 10. Supersession

This version supersedes version 0.1 of this document.

In particular, it withdraws the proposal to establish a large umbrella composed of separately named Store and Service ports before implementation evidence exists.

It also withdraws the claim that `COPStore` should mean only `ProjectionStore`.

The simpler meaning is now:

> `COPStore` durably stores Events and Artifacts. Projectors derive Views.

Existing specifications and code remain evidence of exploration, not compatibility obligations.

---

## 11. Consolidated formula

```text
Events record change.
Artifacts preserve content.
The Store keeps both durable.
Projectors derive Views.
Views guide situated action.
Adapters remain replaceable.
Everything else must earn its place.
```
