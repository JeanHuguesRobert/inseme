---
title: "COP Memory Profile"
subtitle: "Trace memory, content addressing, locality and cognitive orchestration"
author: "Jean Hugues Noël Robert"
affiliation: "Institut Mariani / C.O.R.S.I.C.A."
date: "2026-06-21"
license: "CC BY-SA 4.0"
status: "seed working note"
corpus_role: "source"
language: "en"
document_role: "source"
document_kind: "working-note"
visibility: "public"
lifecycle_state: "working"
classification_source: "cogentia.js"
classification_version: "1"
classification_rule: "working-note"
classification_confidence: "medium"
last_modified_at: "2026-09-08"
---

# COP Memory Profile

## 1. Object

This document seeds a COP memory profile.

It treats memory not as a simple store but as an ecology of accessible traces useful for distributed cognitive orchestration.

The guiding intuition is:

```text
Memory is not storage.
Memory is organized access to traces under constraints of locality, salience, decay, consolidation and retrieval cost.
```

The profile is inspired by three families of memory:

- living memory: episodic, semantic, procedural, affective, spatial, reconstructive;
- material memory: patina, wear, repair, deformation, sedimentation, place-bound traces;
- computational memory: caches, locality, temperature, capacity limits, invalidation, persistence tiers.

## 2. COP starting point

COP already contains memory primitives:

- immutable Events;
- immutable Artifacts;
- Topics as episodic containers;
- Tasks and Steps as procedural structure;
- Continuations as prospective memory;
- causal links through parentEventIds;
- hashes, signatures and ledgers for probative memory.

The missing layer is not storage. The missing layer is governed remembrance:

```text
encoding -> indexing -> retrieval -> reactivation -> reinterpretation -> consolidation -> decay/archive
```

## 3. Strong analogy with computer memory

Human and living memory can be read through an analogy with computer memory, provided the analogy remains disciplined.

Useful correspondences:

| Computer memory concept | COP memory interpretation |
|---|---|
| cache | rapidly accessible trace projection |
| locality | traces recently or contextually near an active task are cheaper to recall |
| temperature | traces become hot, warm, cold or frozen depending on use and salience |
| limited capacity | attention, storage, compute and review bandwidth are bounded |
| eviction | traces may leave fast memory without being destroyed |
| invalidation | a trace or projection becomes obsolete when the source changes |
| write-through | immediate durable inscription of governance-critical acts |
| write-back | temporary local accumulation before durable consolidation |
| hierarchy | registers/cache/RAM/disk/archive mirror attention/working memory/corpus/archive |
| garbage collection | controlled forgetting, compaction or archival |
| snapshot | consolidated projection at a given time |
| log-structured storage | Events as append-only durable memory |
| content addressing | ni: or hash identifies the exact content rather than its current location |

## 4. Locality

Locality is essential for cognitive orchestration.

A trace should be easier to retrieve when it is near the current activity along at least one axis:

- temporal locality: recently used or recently created;
- topical locality: same Topic, Task, Step or continuation;
- causal locality: parent, child or sibling event in the causal DAG;
- semantic locality: same concept, tag, embedding cluster or ontology branch;
- social locality: same subject, role, mandate or group;
- spatial locality: same place, object, device or territory;
- procedural locality: same workflow, checklist, agent pattern or recurring operation;
- affective/salience locality: high-risk, high-value, traumatic, strategic or foundational trace.

COP/Memory should therefore not provide a single flat lookup model. It should provide poly-indexed retrieval.

Locality also has an operational dimension. When compatible with mandate,
durability, privacy and resilience requirements, a COP implementation should
keep execution, working state and the traces needed by that execution close to
the activity that uses them. Remote calls, replication and global publication
remain deliberate boundary crossings: they should serve a needed capability,
coordination or preservation purpose rather than be the default placement.

## 5. Temperature

Trace temperature expresses expected usefulness under bounded attention and bounded resources.

Initial states:

```text
hot      = immediately relevant to active orchestration
warm     = likely reusable soon
cold     = stable but rarely accessed
frozen   = archival / heritage / probative preservation
volatile = short-lived signal, useful only if consumed quickly
decayed  = degraded, superseded or low-confidence trace
```

Temperature is not truth. It is retrieval priority.

A false trace may be hot. A true trace may be cold. COP must keep temperature separate from confidence and probative value.

Temperature is also not authority or imputation. Cooling a trace may reduce its
default influence on routing and attention; it does not erase the occurrence,
responsibility, or evidential history it records. Reheating a cold or frozen
trace for operational use should be explainable by current context, freshness,
or a new observation, and remains subject to the active mandate.

## 6. Capacity limits

Every memory system has limits:

- attention capacity;
- storage capacity;
- retrieval cost;
- indexing cost;
- privacy budget;
- review bandwidth;
- legal retention constraints;
- energy and network costs;
- human interpretability.

COP/Memory should therefore make retention and access policies explicit.

Examples:

```text
volatile signal -> expire unless attached to a durable event
working trace -> keep while task is active
source document -> preserve with content address and metadata
public decision -> write-through, signed, ledger-capable
material trace -> preserve observation and evidence, not the object itself
```

## 7. Obsolescence and invalidation

Obsolescence must be explicit.

A trace can remain intact while its interpretation becomes obsolete.

COP should distinguish:

- content invalidation: the bytes were wrong or corrupted;
- reference invalidation: a pointer broke;
- semantic obsolescence: the meaning changed;
- legal obsolescence: the rule or mandate expired;
- contextual obsolescence: the trace no longer applies to the current situation;
- projection obsolescence: an index or summary must be rebuilt;
- confidence decay: the trace remains accessible but lower-trust.

Correction should create new traces rather than mutate old ones.

## 8. Mutable resources, immutable states, temporal views

Some memory objects are not simple immutable things.

A journal, registry, corpus, law code, public feed, sensor stream or official gazette is a named resource that evolves over time.

COP/Memory should therefore distinguish:

```text
NamedResource      = stable identity for an evolving resource
ResourceState      = immutable observed state of that resource at a given time or range
ChangeEvent        = append-only event that changes or extends the resource
TemporalView       = query result such as latest known state or state at date T
MaterializedView   = cached projection of a TemporalView
```

The named resource is mutable by nature. The states and change events should be immutable.

Examples:

```text
journal-officiel              -> NamedResource
journal-officiel@2026-06-21   -> ResourceState or TemporalView
article/version hash          -> immutable content object
publication event             -> ChangeEvent
latest-known                  -> TemporalView query, not a stored truth by itself
```

The practical rule is:

```text
Do not store every full version by default.
Store immutable change units, periodic checkpoints, and enough indexes to answer temporal queries.
```

## 9. Temporal query modes

COP/Memory should support at least three temporal access modes:

```text
latest_known(resource_id)
state_at(resource_id, time)
changes_between(resource_id, t1, t2)
```

Additional modes may be useful:

```text
state_known_at(resource_id, transaction_time)
state_valid_at(resource_id, valid_time)
state_decided_at(resource_id, decision_time)
```

This introduces bitemporal or tritemporal distinctions:

```text
valid_time       = when the fact is true in the world or target domain
transaction_time = when COP recorded or accepted the fact
decision_time    = when a human or institution decided the interpretation
```

For legal, civic and governance memory, these timelines must not be collapsed.

Example:

```text
A law may be published on date P,
become valid on date V,
be recorded by COP on date T,
and later be reinterpreted by a decision on date D.
```

A query must state which time axis it uses.

## 10. Memento-like access pattern

For evolving resources, COP/Memory can borrow the pattern of time-based access:

```text
Original Resource -> stable identity
TimeGate          -> resolver able to answer temporal access
Memento           -> frozen prior state
TimeMap           -> index of known prior states
```

COP equivalent:

```text
NamedResource   -> stable evolving thing
TemporalResolver -> component that answers state_at/latest_known
ResourceState   -> immutable state or checkpoint
StateMap        -> index of known states/checkpoints/change ranges
```

The resolver may reconstruct a state from:

- append-only events;
- deltas;
- checkpoints;
- external archives;
- cached materialized views.

The result must indicate whether it is exact, reconstructed, partial, stale or best-effort.

## 11. Pragmatic memory layer

A complete memory model may be too expensive or too complex to manipulate directly.

COP/Memory therefore needs an intermediate pragmatic layer between the absolute model and actual agent work.

```text
absolute memory model -> bounded MemoryView -> agent action
```

The absolute model preserves distinctions: Events, Artifacts, traces, descriptors, metadata, provenance, temporal states, caches, views and audit records.

The pragmatic layer exposes only what is useful for a given task, budget, risk level and time horizon.

### 11.1 MemoryView

A `MemoryView` is a bounded projection of memory prepared for a human or AI agent.

It is not the memory itself.

It is a task-relative, cost-aware, confidence-aware and privacy-aware window into memory.

A useful `MemoryView` should declare:

- why the trace is returned;
- which locality axes were used;
- which time horizon applies;
- how much recursion depth is allowed;
- whether provenance and audit are included;
- whether private or sensitive traces were excluded;
- what the approximate retrieval and interpretation cost is;
- what confidence, freshness and temperature signals are available.

### 11.2 Practical access levels

Initial levels:

```text
L0 pointer        = id, kind, title, temperature, confidence
L1 descriptor     = content address, media type, size, fetch hints
L2 summary        = task-specific summary and relevance reason
L3 context        = related events, artifacts, subjects, topics and temporal scope
L4 provenance     = generated-by, attributed-to, derived-from, verification state
L5 audit          = hashes, signatures, ledger records, challengeable evidence
L6 deep expansion = recursive metadata and linked traces, explicitly requested
```

Default agent access should usually be L0-L2 or L0-L3.

L4-L6 should be requested explicitly or triggered by risk, governance, legal, historical or probative use.

### 11.3 Cost classes

Memory access should expose rough cost classes:

```text
cheap       = local projection or hot cache
moderate    = indexed retrieval or shallow reconstruction
expensive   = deep traversal, external fetch, temporal reconstruction
critical    = audit/probative reconstruction requiring stronger guarantees
```

The agent should be able to ask:

```text
get me the cheapest sufficient memory view
get me the strongest probative view
get me the latest known state
get me the state at date T, with confidence and gaps
expand one level deeper
```

### 11.4 Relative sufficiency

The pragmatic layer should not ask whether the returned memory is complete in the absolute sense.

It should ask whether it is sufficient for the current action.

```text
sufficient_for_reading
sufficient_for_drafting
sufficient_for_private_reasoning
sufficient_for_public_claim
sufficient_for_commit
sufficient_for_vote
sufficient_for_legal_or_probative_use
```

A memory view can be acceptable for private reasoning while insufficient for a public claim.

A memory view can be acceptable for drafting while insufficient for a signed act.

A memory view can be acceptable for a cheap suggestion while insufficient for a recommendation or mandate.

### 11.5 Stop rules

To avoid infinite fractal expansion, every MemoryView must have stop rules.

Examples:

```text
max_depth
max_items
max_tokens
max_cost
max_latency
privacy_boundary
probative_threshold
freshness_threshold
confidence_threshold
human_review_required
```

The practical invariant is:

```text
The agent should never manipulate the whole memory graph by default. It should manipulate a bounded MemoryView whose limits are explicit.
```

## 12. Suggested artifacts

Initial artifact types:

```text
cop/content-descriptor
cop/memory-trace
cop/memory-cue
cop/memory-index
cop/consolidation-record
cop/trace-temperature
cop/retention-policy
cop/invalidation-record
cop/named-resource
cop/resource-state
cop/change-event-descriptor
cop/temporal-view
cop/state-map
cop/memory-view
cop/access-policy
cop/cost-policy
```

## 13. Suggested events

Initial event types:

```text
memory.trace.encoded
memory.trace.indexed
memory.trace.retrieved
memory.trace.reactivated
memory.trace.reinterpreted
memory.trace.consolidated
memory.trace.temperature_changed
memory.trace.invalidated
memory.trace.archived
memory.trace.decayed
resource.state.observed
resource.change.appended
resource.view.materialized
resource.view.invalidated
resource.checkpoint.created
memory.view.requested
memory.view.materialized
memory.view.expanded
memory.view.rejected_as_insufficient
```

## 14. Core invariant

```text
A memory trace may become easier or harder to retrieve, more or less salient, more or less trusted, and more or less consolidated; but its original durable inscription must remain distinguishable from every later interpretation, projection or summary.
```

Additional invariant for evolving resources:

```text
A mutable resource is not itself a mutable content object. It is a stable identity whose immutable states, change events and temporal views must remain distinguishable.
```

Additional invariant for pragmatic memory:

```text
An agent should not consume the absolute memory graph by default. It should consume a bounded, task-relative MemoryView with explicit limits, sufficiency criteria and expansion rules.
```

## 15. Continuation

Next work:

1. define JSON schemas for content descriptors, memory traces and retention policies;
2. connect ni: content addressing to COP artifacts;
3. define hot/warm/cold/frozen projection policies;
4. specify invalidation and consolidation events;
5. integrate with existing COP audit and continuation mechanisms;
6. define schemas for NamedResource, ResourceState, TemporalView and StateMap;
7. specify bitemporal access policies for civic and legal memory;
8. define schemas for MemoryView, access policy, cost policy and sufficiency profiles.
