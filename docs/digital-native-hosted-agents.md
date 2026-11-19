---
title: Digital-native agents: durable identity, hosting and authority
document_role: specification
document_kind: architecture
visibility: public
lifecycle_state: active
language: en
date: '2026-11-19'
---

# Digital-native agents hosted by a Principal's agent

A **Digital Subject** is a persistent digital identity, not necessarily a
representation of a different physical subject. A **Digital Agent** is a digital
subject capable of governed work. A **Digital Twin** is a *relationship*
to a distinct modeled referent, not the universal class of all agents.

Thus Vulcain and Mercure are **digital-native agents**, not simulated
doubles of nonexistent originals and not additional human Principals.

## Canonical records

- `public.instances`: one semantic instance UUID per agent, each with its
  own `subject_ref` and `subject_root_ref` (both equal to `agent:…` for
  digital-native agents), `subject_kind='digital_native'`,
  `host_instance_id` pointing to JHN and `principal_id` bound to the
  verified human Principal of the host. Hosting is movable without losing ID.
- `public.cop_logical_agents`: an operational projection of COP identity,
  joined to `instances.id` through `instance_id`. It is **not** a second
  issuer of authority or memory and never mints a child mandate.
- COP append-only journal: authority, declaration, activity, causal receipts,
  and lifecycle provenance. `twin_root_ref='twin:jhn'` in existing **immutable
  COP events** denotes the original supervising composite; it is **not** the
  agent's own subject root. Preserve event history, not legacy DB columns.
- `public.instance_config`: per-instance *configuration* overrides
  inherited from host where permitted. Subject identity is no longer
  duplicated as `twin_root_ref`/`represented_subject_ref` configuration keys.
  Memory and identity-bound settings must not inherit accidentally.

An organizational membership (`organization:minesteggio`), physical hosting
(JHN Supabase), human Principal binding (JHN owner), and COP delegation
(John's mandate) are four separate relations.

## Source and deployment

Initial canonical COP events for Vulcain/Mercure are on Fracta2 in John's
existing COP journal. Migration
`apps/platform/supabase/migrations/20261119230000_digital_native_hosted_agents.sql`
projects both identities to JHN Supabase, adds `instance_id` FK, replaces
`instances.twin_root_ref` with `instances.subject_root_ref`, removes the
redundant identity config rows, and restricts public RLS on native agents.

The Cogentia MCP/CLI source uses the **new** `agent members` interface and
projects new identity/transition events through a retriable idempotent Supabase
projection. No permanent alias for the removed Twin API is retained.

Native agents are *supervised* until a real, separately authorized independent
mandate is issued. Hosting, memory references, role titles, or credentials
do **not** independently confer action authority.
