---
title: ActivityPub Edge — Inseme / Fractanet Federation Boundary
subtitle: Derived publication, external interactions, and multi-tenant execution with Fedify
author: Jean Hugues Noël Robert
affiliation: Institut Mariani / C.O.R.S.I.C.A.
license: CC BY-SA 4.0
status: working-paper — source document
date: '2026-07-31'
language: en
canonical_url: https://github.com/JeanHuguesRobert/inseme/blob/main/research/activitypub_edge.md
corpus_role: source
document_role: source
document_kind: architecture-decision
visibility: public
lifecycle_state: working
classification_source: cogentia.js
classification_version: '1'
classification_rule: architecture-decision
classification_confidence: medium
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


# ActivityPub Edge — Inseme / Fractanet Federation Boundary

## 1. Decision

Inseme adopts **ActivityPub** as its federation boundary with the Fediverse, not as the canonical
source of memory, mandates, decisions, or rights.

The reference implementation under consideration is **[Fedify](https://fedify.dev/)** — not
“Fedly” — a TypeScript framework released under the MIT license. The future component is provisionally
named:

```text
inseme/packages/brique-activitypub-edge/
```

It will be an optional brique, multi-tenant by design. The current absence of this package is
explicit: this note records the architectural target; it does not claim that implementation is
complete.

## 2. Role and boundary

ActivityPub is the exchange layer with external servers, comparable to a mail or routing protocol:
useful for publishing, receiving, following, and conversing, but insufficient by itself to carry an
institution or a trustworthy memory.

| Layer | Authority / role |
| --- | --- |
| GitHub and the versioned corpus | sources, history, and publishable provenance |
| Ubikia | readable and verifiable derived publication |
| Cogentia / COP | packets, traces, continuations, mandates, acts, and processing rules |
| Inseme | instances, briques, collective interaction, and policy enforcement |
| ActivityPub Edge | public federated projection and ingestion of external interactions |
| PrivAI | proportionate guarantees: evidence, limits, recourse, expiry, and responsibility |

A federated activity must therefore point to its verifiable source or derived product. Distribution
alone does not make it the corpus’s reference truth.

## 3. Invariants

1. **Projection, never substitution.** An ActivityPub publication is a public, derived, revocable
   projection; its source and history remain identifiable.
2. **Separate identities.** `tenant`, `subject`, `actor`, `persona`, `agent`, `mandate`, and
   `act` are distinct objects. A federated address is not proof of a living person, voting right, or
   mandate.
3. **Explicit agents.** An automated actor is declared as such, linked to a subject or mandate where
   relevant, and never conflated with a human person.
4. **Data minimisation.** Only explicitly public elements needed for the projection leave the
   federation boundary; private corpus data is not exposed by default.
5. **Untrusted inbound by default.** A received activity is an external packet: authentication,
   quotas, content policy, traceability, and human control apply before any institutional effect or
   engaging response.
6. **Real multi-tenancy.** Isolation, keys, quotas, logs, and policies are tenant-scoped from the
   initial schema; the first tenant is not an architectural exception.
7. **Reversibility.** The edge can be disabled or replaced without losing sources, mandates, acts, or
   COP memory.
8. **Trust-domain proportionality.** Security controls strengthen when an interaction crosses a trust
   boundary or when STAKE, irreversibility, exposure, or fraud potential increase. A controlled
   internal trust domain (for example a Tailscale VPN) may use substantially lighter transport
   controls than an Internet-facing edge when mandates, budgets, traceability, and reversibility
   already bound the consequences.
9. **Identity and causality survive trust.** A trusted network path is not an identity or authority
   proof. Even inside a trusted transport domain, consequential events must remain attributable to
   the relevant Actor / LogicalAgent and linked to enough prior events, mandates, and execution
   context to reconstruct the causal chain.
10. **Optimism for reversible acts.** Security mechanisms must not systematically destroy optimistic
    execution. For low-STAKE, readily reversible acts, detectability, attribution, traceability and
    inexpensive recovery may be preferable to expensive preventive locking. Stronger preventive
    guarantees are justified as the plausible recovery cost rises.

## 4. Processing paths

```text
GitHub source → Ubikia derived publication → Cogentia packet / trace
→ tenant-scoped ActivityPub projection → Fediverse

Fediverse → untrusted external activity → verification and policy
→ COP interaction packet → authorised effect, queue, or human checkpoint
```

High-stakes effects — publication on behalf of an organisation, sensitive moderation, decisions,
financial commitments, or civic consequences — are not inferred from a federated message alone.
They require the mandate, evidence, and control level matching their **STAKE**, with a verifiable
**GAGE**: bounded promise, evidence, duration, revocation, and recourse.

Where an interaction is routed through a trusted internal domain, reduced transport friction does not
remove the need for attribution. The system should still preserve a reconstructible chain such as:

```text
Actor / LogicalAgent
→ applicable mandate or authority source
→ Handler / HandlerInstance
→ prior causal event(s)
→ emitted COP Event / Act
→ external projection or delivery
```

Transport trust answers “through which protected path did this arrive?”; it does not answer “who caused
this act, under which authority, and from what prior state?”.

## 5. Minimal model

| Object | Meaning |
| --- | --- |
| `tenant` | operated instance, collective, or surface; policy and isolation boundary |
| `subject` | living person, collective, institution, agent, technical node, or other COP subject |
| `actor` | ActivityPub address and keys exposed for a given context |
| `persona` | public presentation of a subject, distinct from identity or civic capacity |
| `agent` | software actor, with visible automated nature and attributable responsibility |
| `mandate` | bounded authorisation to act, publish, or reply on behalf of a subject |
| `act` | traceable COP act, of which an ActivityPub activity may be a projection or an input |

A person, organisation, or instance may have several personas and actors; none of these aliases may
multiply political rights or bypass representation rules.

## 6. Fedify implementation profile

The intended brique uses Fedify for federation primitives: WebFinger, HTTP signatures, inbox/outbox,
asynchronous delivery, discovery, and ActivityPub activities. It integrates with the brique contract
and COP without making Fedify the internal domain model.

Proposed technical foundation:

- TypeScript and `@fedify/fedify`; hosting adapter selected according to the Inseme application;
- PostgreSQL/Supabase for domain objects, scoped by `tenant_id` and access policies;
- Redis for caching, quotas, deduplication, and lightweight queues;
- a durable queue or AMQP only when volume and delivery guarantees justify it;
- OpenTelemetry and FractaLog/COP for execution traces, without logging private content unnecessarily;
- tenant-separated keys and secrets, with rotation and revocation.

Mastodon API compatibility may become a later adapter; it is not a prerequisite and must not impose
its product model on the core.

## 7. Operational safeguards

- verify signatures and attribution without overinterpreting them as civic identity;
- limit outbound requests and remote-object fetching, including SSRF protection;
- apply quotas, idempotence, retries, and failure queues;
- separate moderation, publication rights, reply mandates, and civic eligibility;
- retain compact provenance: source, derived product, version, tenant, applied policy, actor or
  LogicalAgent, and relevant causal predecessors;
- provide suspension, blocking, review, and authorisation expiry;
- keep a human in the loop when an act becomes consequential or irreversible;
- adapt controls to the applicable trust domain instead of assuming one global security level;
- never treat VPN membership, network location, or possession of a transport credential as a
  substitute for mandate or causal attribution.

## 8. Initial path

1. Create the empty brique and its multi-tenant configuration contract.
2. Build a public outbound projection for the JHN personal tenant, with a link to the versioned source
   and no automatic ingestion.
3. Add inbox handling, signatures, quotas, and translation into COP interaction packets.
4. Add moderation policies, reply mandates, observability, and recourse tools progressively.
5. Add product compatibilities and scale only after these invariants have been validated.

## 9. Related documents

- [Instance map — locked names and regimes](instance_map.md) — founding instances and regimes.
- [COP Identity / Kudocracy Profile](cop_identity_kudocracy_profile.md) — subjects, capacities,
  mandates, and public acts; ActivityPub is only one interface.
- [COP — Cognitive Orchestration Protocol](../packages/cop-core/Architecture.md) — canonical trace
  and continuity primitives.
- [BRIQUE_SPEC](../packages/cop-host/BRIQUE_SPEC.md) — integration contract for the future brique.
- [FractaNet](https://github.com/JeanHuguesRobert/FractaVolta/blob/main/research/fractanet.md) —
  broader distributed substrate to which the edge adds a federated surface.
- [STAKE / GAGE](https://github.com/acorsica/privai/blob/main/stake_gage.md) — proportion between
  consequence, guarantee, and recourse.

---

_Initial decision, to be tested by a first reversible public flow. Any change to the invariants above
must be explicit, versioned, and linked to a decision trace._
