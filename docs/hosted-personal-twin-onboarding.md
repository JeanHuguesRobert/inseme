---
title: Hosted Cogentia Personal Twin onboarding
document_role: specification
document_kind: architecture
visibility: public
lifecycle_state: active
language: en
date: '2026-11-21'
---

# Hosted Cogentia Personal Twin onboarding

A hosted Personal Twin models a **human** Subject. It is not a digital-native
original such as a Minesteggio agent, and its host (John / instance JHN)
is not the human Principal of the modeled person.

## General lifecycle

1. **Ensure** the canonical identity in `instances` using an immutable UUID,
   `subject_ref`, `subject_root_ref=twin:<slug>`, and
   `host_instance_id` linked to JHN. The status is `provisional`,
   `principal_id=null`, `is_claimable=true` until an authenticated claim.
   An existing matching identity is enriched, never duplicated or reset.
2. Allocate unique aliases through `instance_aliases`. Reject collisions
   instead of reassigning another person's aliases.
3. Keep per-instance nonsecret resources in `instance_config`:
   - `personal_twin_services`: versioned Gmail, ChatGPT, Unix and hosted-browser
     account references, separately recording declaration/verification
     from delegated access.
   - `personal_twin_maturity`: hosted deployment, Principal-claim status,
     future own-Supabase and own-GitHub-memory states.
   These keys do **not** inherit through `host_instance_id`.
4. Hosted-infrastructure configuration may inherit normally from JHN, but
   identities, subject data, delegated authority, secrets and memory do not.
5. John reads the registry through the private `cogentia_instances_directory`
   MCP tool, or the symmetric `cogentia.js instances` CLI. No Gmail or
   ChatGPT connector is implicitly authorized by the existence of an account.
6. Later promotion preserves canonical semantic identity and aliases while
   moving physical storage and the memory repository. The Principal must be
   separately claimed before representing an actual human mandate.

## Inaugural alpha/beta field validation (2026-11-21)

JHN, Maguy and Frédéric are **real people using, or preparing to use, an
incomplete Cogentia system**. Their everyday work provides the first field
validation of the Personal Twin, not merely a demonstration of database
provisioning. *Alpha/beta tester* here describes a participant in iterative
real-world development; it does **not** mean Maguy or Frédéric has already
completed onboarding, exercised MCP, consented to publication of private
material, or joined an officially released public beta.

For each participant, distinguish these independent milestones, with dated
and attributable evidence when actually observed:

1. **Represented:** provisional Personal Twin and stable identity created.
2. **Interface declared:** ChatGPT child agent recorded as a LogicalAgent.
3. **Principal claimed:** the real person authenticated and bound to their
   own Principal (not to the hosting JHN Principal).
4. **Interface connected:** the participant's ChatGPT account actually
   reaches their own Twin through the appropriate per-Principal MCP/OAuth route.
5. **Reality-tested:** a useful task of that person's choosing is completed,
   interrupted/resumed or fails in an observable way; note what was tested,
   the user's experience, any assistance and appropriate receipts.
6. **Learning assimilated:** a demonstrably useful improvement from the
   observation is reapplied to a comparable later task; provisioning and
   logging alone are not learning.

These are **descriptive checkpoints**, not a mandatory workflow or additional
COP state machine. Their status is per-person, per-capability; no label
implies all previous stages passed unless evidenced. Normal activity should
supply tests wherever possible: no requirement for a user to learn internal
architecture or expend attention manufacturing test cases. A person's
private usage traces remain local by default. Cross-user consolidation
extracts justified, non-identifying lessons; sharing their personal
correspondence or account contents requires their own authority and does not
follow from JHN hosting.

As of this note: JHN's own Twin is autonomous and a real-world working
installation; Maguy and Frédéric have hosted provisional Twins and declared
ChatGPT child agents. Neither latter account has yet passed an authenticated
per-Principal Cogentia MCP and useful-task Reality Test. See
[Hosted Conversational Agents](hosted-conversational-agents.md) and
[FractaCognition's real-user field learning](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/fractacognition_principles.md#9-validated-learning-and-selective-propagation).

## Implementation

- Pure generic reconciliation: `packages/cop-host/src/instances/hostedPersonalTwin.js`.
- Service-role adapter/CLI: `apps/platform/scripts/hosted-personal-twins.js`;
  run `--manifest <private.json>` for a read-only plan, and append `--apply`
  to create/reconcile. No dedicated Supabase project is created here.
- Private manifests contain account addresses and Unix handles; do not commit
  them to public GitHub, and do not store credentials in either manifest or
  database config. The source of truth for user sessions is the actual
  external provider. State labels are observations, not authority.
- Supabase RLS: nonpublic, nonsecret instance configuration is visible only
  to the represented Principal (when claimed) or to the verified human
  Principal of the current hosting instance. Public configuration remains
  publicly readable; secrets remain private to the service-side vault.

## Acceptance test

Provision a new hosted Personal Twin, reconcile an already-provisioned one,
run the same inputs a second time, and verify: stable UUIDs, no duplicate
aliases/config rows, original bot names preserved, Principal unclaimed,
private account bindings accessible to John but not arbitrary authenticated
users, and no new Unix account, browser workspace, Gmail account, ChatGPT
session, GitHub repository, or standalone Supabase database.
