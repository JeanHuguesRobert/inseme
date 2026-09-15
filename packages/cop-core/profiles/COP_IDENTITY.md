---
title: COP/Identity Profile
subtitle: Subject, capacity and mandate semantics for governance-critical COP events
version: '0.1'
status: operational-note — derived from research/cop_identity_kudocracy_profile.md
date: '2026-06-19'
author: Jean Hugues Noël Robert
affiliation: Institut Mariani / C.O.R.S.I.C.A.
license: CC BY-SA 4.0
language: en
derived_from: ../../research/cop_identity_kudocracy_profile.md
tags:
  - cop
  - identity
  - subject
  - capacity
  - mandate
  - traceability
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


# COP/Identity Profile

## 1. Purpose

`COP/Identity` is a profile for representing subjects, capacities and mandates in COP systems.

It does not replace COP/Core identity primitives. It extends them for governance-critical use cases where a system must know not only which node or agent emitted an event, but also:

- which subject is acting;
- what kind of subject it is;
- whether the subject has capacity in the current scope;
- whether the act is performed for itself or for another subject;
- whether a mandate exists;
- whether the act is public, protected, auditor-only or private;
- how the attribution can be verified.

`COP/Identity` is designed to compose with:

```text
COP/Core
COP/HITL
COP/AI
COP/Ledger
COP/Kudocracy
```

---

## 2. Non-goals

This profile does not define:

- a universal civil registry;
- a state-level identity proofing process;
- wallet implementation details;
- biometric authentication;
- cryptographic key management policy;
- legal admissibility rules for any jurisdiction.

It defines protocol-level shapes and invariants that can carry such information when external systems provide it.

---

## 3. Core distinction

The profile distinguishes:

| Term | Meaning |
|---|---|
| Subject | Entity with a stable identity in the COP system. |
| Actor | Subject that causes or performs an act. |
| Role | Contextual position used when acting. |
| Capacity | Ability to perform a class of acts in a scope. |
| Mandate | Explicit authorization to act for another subject. |
| Agent | Software or AI component that can emit or process COP events. |
| Act | Imputable event such as vote, suggestion, delegation, revocation or correction. |

Normative rule:

> A governance-critical event MUST declare not only who acts, but also in which capacity, in which role, for which principal if any, and under which mandate if any.

---

## 4. Subject kinds

Initial `subject_kind` values:

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

### 4.1 Natural person living

A living physical person. In Kudocracy, only this subject kind can cast a sovereign civic vote.

### 4.2 Natural person deceased

A deceased physical person. It may be associated with archives, legacy corpora or posthumous mandates, but it cannot exercise living civic sovereignty.

### 4.3 Legal entity collective

A non-living juridical construction such as a company, association, foundation or fund.

The traditional legal term "moral person" may be used when quoting positive law, but this profile prefers `legal_entity_collective` to avoid anthropomorphic ambiguity.

### 4.4 AI agent

A software or AI system capable of emitting or processing events. It may operate under a mandate but is not a living civic subject.

### 4.5 Digital twin

A model, corpus-bound agent or interpretive representation of a natural person. A digital twin may represent continuity of interpretation, not living sovereignty.

### 4.6 Fictional persona

A character, mask, pedagogical entity or simulated person. It may be used for explanation, simulation or theatrical representation, but it cannot hold civic capacity unless a profile explicitly defines non-sovereign experimental rules.

---

## 5. `identity/subject` artifact

A subject SHOULD be represented by an immutable artifact of type:

```text
identity/subject
```

Minimum shape:

```json
{
  "artifactType": "identity/subject",
  "subject_id": "subj:...",
  "subject_kind": "natural_person_living",
  "public_name": "Jean Hugues Noël Robert",
  "display_name": "Jean Hugues Robert",
  "existence_status": "living",
  "legal_status": "natural_person",
  "identity_assurance": {
    "level": "self_declared",
    "issuer": "self",
    "evidence_artifact_ids": []
  },
  "public_roots": {
    "dns": [],
    "github": [],
    "other": []
  },
  "metadata": {}
}
```

---

## 6. Identity assurance

Initial levels:

```text
unknown
self_declared
community_attested
organization_attested
state_attested
cryptographically_bound
multi_source_attested
```

Rules:

- `identity_assurance.level` MUST NOT be inferred from `subject_kind` alone.
- A living person may be self-declared only.
- An AI agent may be cryptographically bound but not state-attested as a human.
- Higher assurance SHOULD reference evidence artifacts.

---

## 7. Capacity

Capacity is the right or ability to perform a class of acts in a defined scope.

A capacity may be embedded in a subject artifact for simple systems, or represented as an independent artifact in high-trust systems.

Initial shape:

```json
{
  "can_vote": true,
  "can_delegate": true,
  "can_receive_mandate": true,
  "can_issue_suggestion": true,
  "can_issue_recommendation": true,
  "can_operate_agent": true,
  "can_certify_identity": false,
  "scope": {
    "jurisdiction": "corte",
    "community": "kudocracy:corte",
    "valid_from": "2026-06-19T00:00:00Z",
    "valid_until": null
  }
}
```

Profiles MAY constrain capacity values by domain.

---

## 8. Mandate

A mandate authorizes one subject to act for another subject.

Artifact type:

```text
identity/mandate
```

Minimum semantics:

- `principal_subject_id`: subject for whom action is performed;
- `representative_subject_id`: subject authorized to act;
- `representative_kind`: kind of representative subject;
- `scope`: authorized and forbidden actions;
- `status`: active, suspended, revoked or expired;
- `valid_from`, `valid_until`;
- `revocation_policy`;
- `evidence_artifact_ids`.

Normative rule:

> If a governance-critical act is performed for another subject, the event or artifact MUST reference a mandate.

---

## 9. Governance-critical event metadata

A governance-critical COP event SHOULD carry identity metadata:

```json
{
  "identity": {
    "actor_subject_id": "subj:...",
    "actor_subject_kind": "natural_person_living",
    "acting_as": {
      "mode": "self",
      "role_id": null,
      "mandate_id": null,
      "principal_subject_id": null
    },
    "capacity_basis": {
      "scope": "kudocracy:corte",
      "evidence_artifact_ids": []
    },
    "attribution": {
      "method": "signature",
      "signature_ref": null,
      "identity_assurance_level": "self_declared"
    }
  }
}
```

---

## 10. Event types

Initial event types:

```text
identity.subject.declared
identity.subject.attested
identity.subject.updated
identity.subject.deprecated
identity.capacity.granted
identity.capacity.revoked
identity.mandate.issued
identity.mandate.suspended
identity.mandate.revoked
identity.mandate.expired
identity.attribution.challenged
identity.attribution.confirmed
```

These events are provisional. Profiles MAY constrain them.

---

## 11. Invariants

1. A subject kind MUST be explicit for governance-critical acts.
2. A mandate MUST be explicit when an actor acts for another subject.
3. A digital twin MUST NOT be treated as a living natural person.
4. A legal entity collective MUST NOT be treated as a living civic subject.
5. A role or office MUST NOT act without a current human or organizational holder.
6. A technical node identity MUST NOT be confused with the subject for whom it emits events.
7. Identity assurance MUST be explicit and SHOULD be evidence-linked.
8. Revocations MUST be represented as new events, never as mutation of past artifacts.

---

## 12. Conformance

An implementation may declare:

```text
COP 1.0 — Core + Identity
```

It MUST then support:

- `identity/subject` artifacts;
- `identity/mandate` artifacts;
- subject kind declaration;
- identity metadata for governance-critical events;
- mandate validation for representative acts;
- revocation events for mandates and capacities.

---

## 13. Continuations

Future work:

1. Add TypeScript types in `packages/cop-core/src/types.ts`.
2. Add JSON Schema validation tests.
3. Generalize the existing `agentIdentity` helpers into `subjectIdentity` helpers.
4. Add a `validateSubjectCapacity()` helper.
5. Add a `validateMandatedAct()` helper.
6. Integrate verifiable credentials or EUDI wallet references as external evidence, without coupling COP/Core to any wallet implementation.
