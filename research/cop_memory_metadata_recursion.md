---
title: COP Memory Metadata and Recursive Trace Layers
subtitle: Practical boundaries for metadata, traces about traces, and agent access
author: Jean Hugues Noël Robert
affiliation: Institut Mariani / C.O.R.S.I.C.A.
date: '2026-06-21'
license: CC BY-SA 4.0
status: seed working note
corpus_role: source
language: en
document_role: source
document_kind: working-note
visibility: public
lifecycle_state: working
classification_source: cogentia.js
classification_version: '1'
classification_rule: working-note
classification_confidence: medium
related:
  - ./cop_memory_profile.md
  - ../packages/cop-core/COP_IDENTITY.md
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


# COP Memory Metadata and Recursive Trace Layers

## 1. Object

This note complements `research/cop_memory_profile.md`.

It addresses a practical problem:

```text
Things have metadata.
Metadata changes.
Metadata changes may themselves need metadata.
If every description becomes another thing to describe, memory becomes recursively unbounded.
```

COP/Memory should accept this recursion while bounding it operationally.

The practical rule is:

```text
Everything critical may be identifiable.
Not everything deserves durable recursive metadata.
```

## 2. Thing, descriptor, metadata, observation

COP/Memory should distinguish four layers:

| Layer | Meaning | Example |
|---|---|---|
| Thing | the content-addressed or otherwise identified thing | `ni:///sha-256;...` |
| Descriptor | stable technical envelope used to retrieve and verify the thing | media type, size, digest, fetch hints |
| Metadata record | claims or descriptions about the thing | title, creator, license, tags, last access |
| Observation event | the act of reading, modifying, validating, indexing or annotating | `memory.trace.retrieved`, `metadata.updated` |

This avoids treating every annotation as a mutation of the original thing.

## 3. Metadata is also a thing, but not always a first-class thing

Metadata can be treated in two modes:

```text
embedded metadata  = ordinary fields inside a descriptor or projection
first-class metadata = separately identified, versioned, auditable record
```

A metadata record should become first-class when it is:

- used for governance;
- used as evidence;
- relied upon by agents;
- shared across systems;
- modified by multiple actors;
- legally, historically or operationally significant;
- expensive to reconstruct;
- likely to be contested.

Otherwise, it may remain local, cached or projection-level metadata.

## 4. Minimal metadata clocks

For practical orchestration, a thing should usually expose at least:

```text
created_at
content_last_seen_at
metadata_updated_at
last_accessed_at
last_verified_at
last_indexed_at
last_reactivated_at
```

These fields should not all have the same meaning.

- `created_at`: when the record or descriptor was created.
- `content_last_seen_at`: when the content was last known to exist at some hint.
- `metadata_updated_at`: when descriptive metadata last changed.
- `last_accessed_at`: when an agent or human last fetched or used the thing.
- `last_verified_at`: when the content hash or signature was last checked.
- `last_indexed_at`: when indexes or projections were last refreshed.
- `last_reactivated_at`: when the trace influenced a new interpretation, decision or continuation.

## 5. Do not confuse metadata with truth

A metadata field is a claim, observation or projection.

It may be:

```text
asserted
observed
derived
inferred
cached
local
stale
contested
superseded
```

COP/Memory should therefore distinguish the value from the status of the value.

Example:

```json
{
  "key": "last_accessed_at",
  "value": "2026-06-21T14:10:00Z",
  "status": "observed",
  "observed_by": "agent:memory-indexer",
  "evidence_event_id": "event:..."
}
```

## 6. Recursion boundary

Metadata can recursively have metadata, but agents need a stopping rule.

Suggested practical boundary:

```text
Describe recursively only when recursion changes trust, action, routing, preservation or accountability.
```

Otherwise, stop at the current layer and record only a lightweight local projection.

This makes the system fractal without making every operation infinitely reflective.

## 7. Fractal, but stratified

The architecture is fractal because the same pattern reappears at several scales:

```text
content -> descriptor -> metadata -> provenance -> audit trace
```

and a metadata record may itself become content with its own descriptor and provenance.

But it must remain stratified:

```text
raw trace
technical descriptor
descriptive metadata
provenance metadata
audit metadata
local application metadata
projection/index metadata
```

Each layer has a different purpose and different durability requirements.

## 8. Agent-facing practical view

An agent should not receive the infinite graph by default.

It should receive a bounded `MemoryView`:

```json
{
  "thing": "ni:///sha-256;...",
  "descriptor": {
    "mediaType": "text/markdown",
    "size": 12345,
    "fetchHints": []
  },
  "coreMetadata": {
    "title": "...",
    "creator": "subj:...",
    "created_at": "...",
    "license": "CC BY-SA 4.0"
  },
  "state": {
    "temperature": "warm",
    "confidence": "medium",
    "probative_value": "weak",
    "staleness": "fresh",
    "access_cost": "low"
  },
  "context": {
    "why_returned": "semantic+causal locality",
    "related_events": [],
    "related_artifacts": []
  },
  "controls": {
    "max_depth": 2,
    "include_private": false,
    "include_audit": false
  }
}
```

The agent may then request deeper layers explicitly.

## 9. Access modes

COP/Memory should support several bounded access modes:

| Mode | Purpose |
|---|---|
| `fetch_exact` | retrieve by content identity, usually `ni:` |
| `fetch_descriptor` | retrieve technical envelope and hints |
| `fetch_metadata` | retrieve descriptions and clocks |
| `fetch_context` | retrieve related topics, events and artifacts |
| `fetch_provenance` | retrieve generation, derivation and attribution chain |
| `fetch_audit` | retrieve signatures, hashes, ledger records |
| `fetch_local` | retrieve application-specific projections |
| `fetch_deep` | controlled recursive expansion |

Default should be shallow, explicit and cheap.

## 10. Known patterns this aligns with

This profile aligns with several established design families:

- content-addressable storage: identify by content, not location;
- descriptor systems: describe how to retrieve and verify content;
- metadata vocabularies: minimal shared fields plus extensions;
- provenance graphs: entities, activities, agents and derivations;
- named graphs and graph quads: metadata about sets of statements;
- CRDTs and local-first systems: local autonomous updates with eventual convergence;
- caches: locality, temperature, eviction and invalidation;
- material conservation: observation records, condition reports and degradation over time.

## 11. Core invariant

```text
COP/Memory should allow metadata to become first-class when it matters, but should not force every metadata field to become an infinite recursive object.
```

Short version:

```text
Fractal when necessary.
Flat when sufficient.
```

## 12. Continuation

Next work:

1. define `cop/memory-view` as an agent-facing bounded projection;
2. define `cop/metadata-record` as an optional first-class artifact;
3. define recursion depth and privacy controls;
4. add provenance mapping to W3C PROV terms;
5. connect `ni:` content identity with descriptor, metadata and audit layers.
