---
title: Discord Edge — BYOC Reality Test for Personal and Collective Twins
author: Jean Hugues Noël Robert
date: '2026-09-06'
license: CC BY-SA 4.0
language: en
status: working-paper — implementation note
document_role: operational
document_kind: architecture-decision
visibility: public
lifecycle_state: working
canonical_url: https://github.com/JeanHuguesRobert/inseme/blob/main/research/discord_edge.md
related:
  - https://github.com/JeanHuguesRobert/cogentia/blob/main/research/byoc_external_interaction_edges.md
  - research/interactions_registry_and_multichannel_messaging.md
  - research/activitypub_edge.md
  - https://github.com/JeanHuguesRobert/cogentia/issues/84
  - https://github.com/JeanHuguesRobert/inseme/issues/36
classification_source: cogentia.js
classification_version: '1'
classification_rule: explicit-metadata
classification_confidence: medium
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
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


# Discord Edge — BYOC Reality Test for Personal and Collective Twins

## 1. Purpose

Discord is the first concrete BYOC Reality Test for the generic Cogentia **External Interaction Edge** doctrine.

The target is deliberately not "a Discord bot" as an isolated feature. The target is one reusable Discord edge that supports two regimes:

```text
A. external
   Twin participates in a Discord space governed by others

B. twin_governed
   Twin exposes or participates in a Discord space substantially governed for/by the Twin
```

The same mechanism should serve Personal and Collective Digital Twins.

## 2. Why Discord

Discord is useful because one platform exposes several interaction primitives at once:

- guilds / servers;
- channels;
- threads;
- direct messages;
- roles and permissions;
- mentions and reactions;
- events;
- bots / applications;
- voice and stage metadata.

These primitives make Discord a good test of the distinction between **platform affordance** and **Cogentia semantics**.

## 3. Invariants

The Discord Edge inherits the generic BYOC doctrine:

```text
Presence != Capability != Permission != Mandate != Authority != Act
```

and:

```text
Discord user/guild/channel/thread/message IDs
    = external bindings
    != canonical Cogentia identity/space/continuation/act IDs
```

Consequences:

- being present in a guild does not imply authority to speak;
- a Discord role does not create a Cogentia mandate;
- Discord administrator status does not by itself create institutional authority;
- a Discord poll does not become an institutional decision merely because it exists;
- an inbound Discord message is external evidence/input, not automatically a trusted corpus fact;
- an outbound Discord message is a projection of an authorized act, not the sole canonical act record.

## 4. Minimal edge boundary

```text
Discord Gateway / API
   ↓
Discord Edge
   ├─ tenant / Twin binding
   ├─ subject/account binding
   ├─ guild/channel/thread bindings
   ├─ dedupe / rate limiting
   ├─ provenance
   ├─ external permission observation
   ├─ Cogentia admissibility / mandate checks
   └─ Interaction Packet / COP translation
   ↓
Inseme / Cogentia / COP
```

The edge should not own durable Twin identity, memory, mandates or continuations.

## 5. Presence model

A Discord Presence may concern a human, software agent, Personal Twin, Collective Twin or institution in a Discord socio-digital space.

Conceptually:

```yaml
presence:
  subject_ref: twin:...
  space_kind: discord
  guild_ref: external:discord:guild:...
  channel_ref: external:discord:channel:...
  thread_ref: external:discord:thread:... | null
  valid_from: ...
  valid_until: ... | null
  modality: observed | declared | inferred | expected
  control_regime: external | delegated | twin_governed
  source: discord-edge
```

This is a semantic example, not a frozen storage schema.

## 6. Interaction handling

Inbound:

```text
Discord event
→ authenticate / identify platform source
→ bind external actor and space
→ preserve provenance
→ classify relevance/consequentiality
→ ephemeral context OR Interaction Packet
→ optional COP Event / continuation wake-up
```

Outbound:

```text
Twin intent / continuation
→ select target Discord binding
→ re-check mandate / disclosure / budget / consequence
→ verify platform capability
→ emit COP Act
→ project through Discord Edge
→ record delivery/result
```

Platform permission and Cogentia authority are both required where applicable; neither substitutes for the other.

## 7. Reality Test A — external Discord

Demonstrate a Twin participating in a Discord server controlled by others.

Acceptance:

- join/configure one external guild binding;
- observe permitted channels without treating discoverability as authority;
- ingest a mention/message with provenance;
- keep low-value chatter ephemeral;
- create or update one Interaction Packet for a consequential exchange;
- resume a continuation independently of Discord thread identity;
- reply only when an applicable Cogentia mandate exists;
- trace external permission and internal authorization separately.

## 8. Reality Test B — Twin-governed Discord

Demonstrate a Discord space offered for users who want it, preferably first for a Collective Twin because the social affordances are more directly useful there.

Acceptance:

- bind one guild to one Twin/tenant;
- map selected Twin groups/projects/conversations to Discord channels or threads without making Discord canonical;
- allow humans and agents to interact there under access policy;
- preserve the distinction between Discord membership/roles and institutional membership/roles;
- disable or replace the Discord edge without losing canonical Twin state.

## 9. Personal vs Collective Twin

Personal Twin use is optional and should remain lightweight: DM, working channel, invited collaborators, notifications or selected conversations.

Collective Twin use is likely the stronger primary case because Discord already offers group-oriented affordances. A Collective Twin may use Discord as an optional community surface while retaining institutional semantics, governance, mandates, decisions and durable history in Cogentia/Inseme/COP.

## 10. First implementation slice

Prefer the smallest reversible path:

1. create/configure one Discord application/bot identity;
2. implement tenant + guild/channel/thread bindings;
3. ingest mentions/messages into a normalized edge event;
4. translate one consequential interaction into the existing Interaction Packet path;
5. implement one governed outbound reply with separate Discord-permission and COP-mandate checks;
6. exercise once in `external` and once in `twin_governed` regime;
7. compare with ActivityPub Edge before extracting any generic adapter package.

Do not start with voice, moderation automation, rich role synchronization, broad archival ingestion or a generalized adapter framework.

## 11. Non-goals for first slice

- full Discord clone or community product;
- automatic mirroring of all channels;
- treating every message as durable memory;
- synchronization of Discord roles into institutional authority;
- autonomous moderation without explicit policy/mandate;
- voice transcription/analysis;
- generic cross-platform adapter abstraction before evidence from at least two implementations.

## 12. Expected learning

The first useful result is architectural evidence about whether one External Interaction Edge model can support both:

```text
presence in someone else's space
and
presence in a space substantially governed by the Twin
```

If it can, Discord becomes a strong Reality Test for BYOC rather than a special-case integration.
