---
title: COP Identity Schema Sketch
author: Jean Hugues Noël Robert, baron Mariani
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
date: '2026-09-15'
last_modified_at: '2026-09-15'
version: '0.1'
status: sketch, v0.1.
license: CC BY-SA 4.0
language: en
document_role: archive
document_kind: software-doc
update_policy: UP-DEFAULT-REVIEWED
provenance:
  origin_type: repository
  origin_repository: unknown
  origin_ref: unknown
  origin_date: '2026-09-15'
  derived_from: []
review:
  status: unreviewed
  reviewed_by: []
---

# COP Identity Schema Sketch

Status: sketch, v0.1.

This note records the minimal future schema surface for COP/Identity.

## identity/subject

Required fields:

```text
artifactType
subject_id
subject_kind
existence_status
```

Subject kinds:

```text
natural_person_living
natural_person_deceased
legal_entity_collective
public_institution
unincorporated_collective
role_or_office
ai_agent
digital_twin
fictional_persona
technical_node
estate_or_legacy_corpus
unknown_or_unverified
```

## identity/mandate

Required fields:

```text
artifactType
mandate_id
principal_subject_id
representative_subject_id
representative_kind
scope
status
```

Recommended scope fields:

```text
domain
community
allowed_actions
valid_from
valid_until
evidence_artifact_ids
```

## kudocracy/public-decision

Required fields:

```text
artifactType
decision_id
actor_subject_id
actor_subject_kind
proposal_id
proposal_version_hash
value
capacity_basis
publicity_rule
```

## Continuation

Convert this sketch into JSON Schema and TypeScript types after review.
