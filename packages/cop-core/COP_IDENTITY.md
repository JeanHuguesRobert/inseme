---
title: COP/Identity Profile
author: Jean Hugues Noël Robert, baron Mariani
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
date: '2026-09-15'
last_modified_at: '2026-09-15'
version: '0.1'
status: working profile, v0.2.
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

# COP/Identity Profile

Status: working profile, v0.2.

This profile extends COP/Core with the vocabulary and boundaries needed to identify
subjects, accounts, actors, credentials, endpoints, memberships, capacities and
mandates without confusing them.

It keeps COP/Core transport- and backend-independent.

## Governing separation

```text
authentication credential
→ local account/profile
→ subject
→ situated membership / qualification
→ role, eligibility claim, capacity or mandate
→ proposed or executed act
```

Identity does not grant a right. A right does not authorize an act. An engaging act
requires an active, scoped mandate and any required human authorization.

COP MUST NOT create a universal identity registry for living persons. Implementations
MUST support local, privacy-minimizing claims and evidence. Verified email, OAuth,
OpenID4VP, France Identité, a signature key, or another credential are evidence of
control or qualification; none is automatically the identity of a living person.

## Subject kinds

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

A **Subject** can bear rights, roles, capacities and mandates. A **TwinRoot** is a
declared cognitive continuity of a subject, never the living subject itself.
A **TwinInstance** is a situated manifestation of that TwinRoot in one
DeploymentInstance. An **AgentInstance** is an identifiable actor under a mandate;
it is never thereby a citizen, voter, officer, legal representative or new tenant.

## Accounts, credentials and endpoints

A local account/profile is an implementation-level access record. It MAY be
controlled by several verified credentials. An email address is a credential/contact
route, not the identity of the person who controls it.

An **Endpoint** is a reachable surface with an explicit operator and policy:

```yaml
endpoint:
  endpoint_ref: endpoint:...
  principal_subject_id: subject:...
  account_custodian_id: account:...
  operator_id: actor:...
  visible_actor_id: actor:...
  endpoint_role: cop | matrix | whatsapp | smtp | activitypub | github | internal_mailbox
  visibility: private | restricted | public
  mandate_id: mandate:... # required when the endpoint may produce consequential acts
  usage_grant_id: grant:...
```

Matrix user ≠ principal; Matrix room or Space ≠ TwinRoot; homeserver ≠ Cogentia
instance. The same rule applies to WhatsApp, SMTP, ActivityPub, GitHub and other
surfaces. Internal sub-agent mail is a COP/Mailbox projection and MUST NOT require
SMTP or Internet routing; human externalization produces a distinct external act.

## Membership, eligibility and authority

An **InstanceMembership** records a subject/account's situated relation to one
DeploymentInstance. It is not a global identity or a global political status.

```yaml
instance_membership:
  membership_ref: membership:...
  instance_ref: instance:...
  subject_ref: subject:...
  account_ref: account:...
  status: visitor | pseudonymous_visitor | registered_member | suspended | revoked
  evidence_refs: []
  effective_from: RFC3339
  effective_until: RFC3339 | null
```

A **Role** is an institutional function. An **EligibilityClaim** is a scoped,
time-bounded qualification, for example voter eligibility for a specific ballot.
“Citizen” MUST NOT be a global field on `users`. Political voting remains reserved
to natural persons under the relevant constitutional and legal rules; a collective,
legal entity, agent or twin has no political vote merely by holding an account,
endpoint, resource or membership.

A **Mandate** is versioned, bounded and revocable. It identifies the mandant,
mandatary, permitted and prohibited acts, purpose, duration, resource limits,
evidence and reporting rules. Child authority MUST NOT exceed the parent mandate.

A `principal_user_id` is a revocable local access relation declared by an
InstanceConstitution. It MUST NOT be a magic database uid such as `0`, and MUST
NOT be confused with the human subject, TwinRoot, office, mandate or legal owner.
A collective instance derives authority from its constitution, memberships, offices,
decisions and mandates; it has no automatic equivalent of a personal principal.

## Peer instances and message boundary

A **PeerInstance** is a reciprocal, revocable relation between DeploymentInstances:

```yaml
peer_instance:
  instance_ref: cogentia:...
  protocol_versions: ["cop/…"]
  endpoint_refs: []
  public_keys: []
  trust_state: pending | active | suspended | revoked
  allowed_topics: []
  allowed_message_classes: [observe, request, propose, acknowledge]
  visibility_ceiling: restricted
  reciprocal_agreement_ref: agreement:...
```

The receiver MUST distinguish:

```text
transport received
→ immutable delivery persisted
→ technical sender identity verified
→ local peer policy evaluated
→ COP packet accepted or refused
→ local mandate and human gate checked
→ resulting act/event/projection recorded
```

Receipt MUST NOT mean acceptance, agreement, representation or authority to act.
An external agent or twin gains no local rights merely by being reachable or by
holding a credential.

## Identified things

Identity is not limited to subjects. COP also needs stable references for things
that may be routed, versioned, audited, replayed or challenged:

```text
cop_event
cop_artifact
cop_topic
cop_task
cop_step
cop_continuation
proposal
proposal_version
public_decision
vote_session
mandate_record
capacity_record
role_record
membership_record
eligibility_claim
credential
endpoint
peer_instance
instance_constitution
signature_key
proof_or_evidence
ledger_record
influence_trace
civic_protection_report
dns_root
repository
corpus
source_document
derived_artifact
software_package
runtime_node
physical_place
physical_object
sensor_or_device
resource_stream
external_reference
```

A thing MUST NOT be treated as a subject unless a profile explicitly grants it
subject status.

## Core fields for governance-sensitive events

```text
actor_subject_id
actor_subject_kind
acting_as
capacity_basis
principal_subject_id
mandate_id
membership_ref
eligibility_claim_ref
endpoint_ref
peer_instance_ref
scope
publicity_rule
attribution_evidence
```

A governance-sensitive event MUST identify the actor, subject kind, role/capacity,
possible principal, mandate, attribution evidence and publicity rule. Where it
crosses an instance boundary, it MUST also identify the endpoint, peer relation,
delivery and acceptance/refusal outcome.

## Initial artifacts

```text
identity/subject
identity/account
identity/credential
identity/endpoint
identity/membership
identity/eligibility-claim
identity/capacity
identity/mandate
identity/role
identity/peer-instance
identity/instance-constitution
identity/attribution-evidence
identity/identified-thing
identity/object-reference
```

## Implementation consequences

- `auth.users`, local profiles, subjects, memberships, eligibility claims, roles
  and mandates MUST remain distinct.
- Public profile projections MUST NOT expose email or private profile data by
  default.
- Self-service profile changes MUST NOT permit role escalation.
- Privilege, eligibility and mandate changes MUST use controlled, audited service
  paths or database functions.
- Access decisions MUST remain reproducible from the relevant constitution,
  evidence, membership, mandate and policy version.

## Continuation

#17 implements the first JHN personal deployment, TwinRoot, AgentInstance and
COP/Mandate slice. #30 implements peer identity, membership, mandate enforcement
and inter-instance COP messaging. This profile must next gain JSON schemas,
TypeScript types, validators, migrations and conformance tests.