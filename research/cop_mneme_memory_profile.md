---
title: COP Mneme Memory Profile
author: Jean Hugues Noël Robert
date: '2026-07-31'
document_role: source
document_kind: architecture
visibility: public
lifecycle_state: working
update_policy: UP-DEFAULT-REVIEWED
provenance:
  origin_type: conversation
  origin_repository: JeanHuguesRobert/inseme
  origin_ref: main
  origin_date: '2026-07-31'
  derived_from:
    - JeanHuguesRobert/cogentia/research/mneme_memory_architecture.md
review:
  status: unreviewed
  reviewed_by: []
classification_source: cogentia.js
classification_version: '1'
classification_rule: explicit-metadata
classification_confidence: medium
license: CC BY-SA 4.0
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
language: en
status: working-paper
---


# COP Mneme Memory Profile

## Status

Working architecture note. This document proposes a memory-profile extension for COP
implementations. It does not modify COP core invariants or create a protocol requirement until those
changes are separately specified and tested.

## Problem

COP needs memory that is durable enough for replay, audit, continuation and governed delegation,
while remaining portable across repositories, relational stores, local nodes and object stores.

A single database record, blob or vector index is insufficient. Each has a different role and
failure mode.

## Mneme

A **mneme** is an addressable, durable and governed unit of external memory. It links content to
provenance, epistemic status, relations, versions and access capabilities.

A mneme is not a source asset, a working context, an engram, or a Cogentigram.

## COP object mapping

| COP-facing object          | Memory role                                                   |
| -------------------------- | ------------------------------------------------------------- |
| Source Asset               | immutable original or capture                                 |
| Locator                    | precise reference inside an asset                             |
| Mneme                      | governed memory artifact or assertion                         |
| Memory View                | mandate-filtered projection for a task                        |
| Working Context            | ephemeral invocation-local context                            |
| Cogentigraphic Observation | measured behavioural or structural observation                |
| Cogentigram                | versioned structural model, separate from biographical memory |
| Recovery Exercise          | evidence-producing test of restoration or migration           |

Meaningful state must remain durable and replayable. Working context remains ephemeral unless an
explicit promotion produces an Artifact or Event.

## Storage capability profile

A COP implementation should describe storage through capabilities, not vendor names:

```text
versioned_repository
relational_registry
local_node
object_store
source_adapter
search_projection
inference_engine
```

A provider adapter may implement one or several capabilities. Its identity is
not part of the memory model.

## Invariants preserved

This profile preserves COP’s existing invariants:

- immutable Events and Artifacts;
- topic-local ordering;
- idempotency under at-least-once delivery;
- durability of meaningful state;
- stateless agents;
- deterministic replay of recorded traces and projections;
- explicit schema versioning;
- transparency over convenience.

A Memory View or working context must record whether it is exact,
reconstructed, partial, stale or best-effort.

## Portability and recovery evidence

Portability is not established by the existence of an export button. A profile
should be able to produce a manifest stating:

- authoritative representation for each memory object;
- schemas and format versions;
- checksums for source assets where applicable;
- access and custody dependencies;
- reconstruction procedure;
- last successful recovery or migration exercise;
- measured recovery time, data loss and known limits.

A recovery exercise creates traceable evidence; it does not silently grant
permanent exceptional authority. Activation, migration and restoration actions
remain subject to the relevant mandate and its expiry, revocation and audit
rules.

## Initial conformance scenarios

1. reconstruct a local node from a repository, manifest and object-store copy;
2. restore a relational registry without treating an index as the authority;
3. continue in a local degraded mode after network loss;
4. replace an unavailable provider adapter while preserving mneme identity and
   provenance;
5. prove that an expired working context was not silently retained;
6. reconstruct a Memory View under an equivalent mandate and disclose any
   missing source or capability.

## Implementation boundary

The first implementation should remain a profile and test harness. It should
not force a specific database, object store, cloud, model provider or vector
index on COP users.
