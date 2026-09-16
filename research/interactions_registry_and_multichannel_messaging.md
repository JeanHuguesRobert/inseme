---
title: Interactions Registry & multichannel messaging (Personal Twin service)
date: '2026-08-08'
version: '0.2'
license: CC BY-SA 4.0
document_role: operational
document_kind: design-note
visibility: public
status: planned
github_issues:
  platform: https://github.com/JeanHuguesRobert/inseme/issues/36
  personal_public: https://github.com/JeanHuguesRobert/JeanHuguesRobert/issues/2
  method: https://github.com/JeanHuguesRobert/cogentia/issues/84
related:
  - research/personal_twin_access_policy.md
  - research/user_personal_twin_link.md
  - research/instance_map.md
  - research/activitypub_edge.md
  - https://github.com/JeanHuguesRobert/cogentia/tree/main/interaction_packets
  - https://github.com/JeanHuguesRobert/JeanHuguesRobert/tree/main/interaction_packets
  - https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/presencology.md
  - https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/presencology_digital_social_presence_twins.md
  - JeanHuguesRobert/inseme#35
  - JeanHuguesRobert/inseme#34
  - JeanHuguesRobert/inseme#36
  - JeanHuguesRobert/JeanHuguesRobert#2
  - JeanHuguesRobert/cogentia#84
lifecycle_state: active
classification_source: cogentia.js
classification_version: '1'
classification_rule: explicit-metadata
classification_confidence: medium
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
language: en
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


# Interactions Registry & multichannel messaging

**Tracking (cross-repo):**

| Layer                         | Issue                                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| Platform / Twin desk (Inseme) | **[inseme#36](https://github.com/JeanHuguesRobert/inseme/issues/36)**                   |
| Public personal traces (JHR)  | **[JeanHuguesRobert#2](https://github.com/JeanHuguesRobert/JeanHuguesRobert/issues/2)** |
| Generic method (Cogentia)     | **[cogentia#84](https://github.com/JeanHuguesRobert/cogentia/issues/84)**               |

Private overlay stays in **`registre-mariani`** (no public secrets in issues or public packs).

**Audience:** all agents (Inseme, Cogentia, personal Twin, Operium). Do not invent a second packet
format without reading the generic method first.

## 1. Problem (Principal, 2026-08-08)

- Prefer **traceable** interactions; **SMTP email** is a strong default spine (durable, addressable,
  archival).
- Reality is **fragmented**: email, chat apps, social DMs, GitHub issues, WhatsApp, Discord, forms,
  ActivityPub surfaces, etc. — a “mess” for many people.
- Cogentia Personal and Collective Twins should help **manage that mess**, not replace every channel.
- Starting point already exists: the **Interactions Registry** (Interaction Packets), maintained
  with AI agents.
- The same Twin may be present simultaneously in spaces it governs and in spaces governed by third
  parties. This is a Presencology question as well as a messaging question.

## 2. What already exists (do not reinvent)

| Layer                            | Repo / path                                                                | Role                                                                 |
| -------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Method (generic)**             | `JeanHuguesRobert/cogentia` → `interaction_packets/`                       | Schema, prompts, architecture, extract/update pipeline               |
| **Public personal traces**       | `JeanHuguesRobert/JeanHuguesRobert` → `interaction_packets/`               | Live packets, readable/raw copies, dashboard, archive policy (D0–D4) |
| **Private / restricted overlay** | `JeanHuguesRobert/registre-mariani` → `interaction_packets/` (and related) | Non-public cases, credentials never in public packs                  |
| **Archive policy**               | JHR `interaction_packets/archive_policy.md`                                | YAML + readable + redacted raw; disclosure levels; follow-ups        |
| **Presence abstraction**         | `barons-Mariani/research/presencology.md`                                  | Presence across physical, technical, institutional and other spaces  |
| **Digital/social Presence addendum** | `barons-Mariani/research/presencology_digital_social_presence_twins.md` | Applies Presence explicitly to agents, Personal Twins and Collectives |
| **Federated edge precedent**     | `inseme/research/activitypub_edge.md`                                      | External surface is projection/ingress, not canonical authority      |

Principle already stated in archive policy:

```text
Method lives in cogentia.
Traces live with the subject (personal / org repo), not only in the method repo.
```

Packet sketch today: id, dates, `canal`, interlocutor, subject, status, disclosure level, public
summary, copies (readable / redacted raw), follow-ups.

## 3. Product vision

```text
Many channels / spaces in the wild
        │
        ▼
  Channel / Presence adapters (ingress / egress)
        │
        ├── external space governed by others
        └── Twin-hosted / Twin-governed space
        │
        ▼
  Interaction Packets + Presence bindings
        │
        ├── public pack (JHR or other twin public repo)
        ├── private pack (registre / twin private store)
        └── optional COP Event link (Inseme runtime)
        │
        ▼
  Personal / Collective Twin interaction desk
  (owner / members / visitors according to access policy)
```

**SMTP / email:** preferred **traceable** path and archival spine — not the only UI people use.
Other channels are first-class _ingress/egress_ surfaces. Durable state, identity, mandate and
conversation continuity must not depend on any one platform.

**Discord:** first explicit non-territorial Presence case with two principal regimes:

1. participation by a Twin in existing Discord spaces governed by others;
2. an optional Discord space offered to users of a Personal Twin or, more commonly, a Collective
   Twin.

The mechanics should be shared as far as possible. The important variation is the governance/control
relation to the external space, not a separate packet model.

**Service for others later:** any Personal or Collective Twin can run the same registry/presence
pattern (method = cogentia; traces = that subject’s repos / twin store).

## 4. Relation to access policy (#35), twin link (#34), Presencology and COP

| Topic                  | Role                                                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **#35 access classes** | Who may **read/write** which interactions (anonymous cannot see private packs; owner sees all; agent writes under mandate). |
| **#34 user↔twin**      | Cross-instance identity; not the message store.                                                                             |
| **Presencology**       | Where/when a human, agent, Twin or collective is present; platform binding is not sovereign identity.                       |
| **COP / mandate**      | What an agent/Twin is authorised to do; Presence and technical permission do not imply mandate.                            |
| **This plan**          | What is recorded, on which channel/space, with what disclosure and follow-up.                                               |

Constitutive distinction:

```text
Presence != membership
Presence != capability
Presence != platform permission
Presence != mandate
Presence != authority
Presence != activity
```

A Discord role is therefore not a Cogentia role; a Discord permission is not a mandate; a Discord
poll is not an institutional decision; a Discord member is not automatically a member of the
corresponding collective.

Conversational agent on `jhn.baronsmariani.org` or another Twin surface must:

1. Know `access_class` (#35).
2. Prefer creating/updating **Interaction Packets** for consequential exchanges (not only chat
   ephemera).
3. Never dump private registry content to anonymous visitors.
4. Preserve the distinction between Twin identity and platform account/handle.
5. Check applicable mandate before consequential egress, even when the external platform technically
   permits the action.

## 5. Implementation plan

### Phase 0 — Doctrine & inventory

- [x] This note
- [x] Cross-link Presencology and digital/social Presence
- [ ] Short inventory table of current packets / channels in use
- [ ] Confirm D0–D4 still fit multichannel (chat vs email)

### Phase 1 — Stabilize packet fields for multichannel

Extend (generically in **cogentia** method) without breaking existing YAML:

```text
canal / channel_kind     email | github | web_chat | discord | activitypub | whatsapp | x | other
channel_message_ids[]    external ids when available
participants[]           subject refs + display labels
twin_root_ref            e.g. twin:jhn
access_context           who initiated (owner | visitor | member | agent)
space_ref?               external or Twin-governed digital/social space
presence_ref?            optional qualified Presence/binding reference
control_regime?          external | delegated | twin_governed
cop_event_ref?           optional link to COP runtime
```

These values are intentionally extensible. Do not freeze a closed channel taxonomy into the generic
method.

Keep **disclosure level** and **three copy forms** (YAML / readable / redacted raw).

### Phase 2 — Agent workflow (already partially real)

1. Document “when to open a packet” vs “chat only.”
2. Reuse cogentia prompts: `extract_interaction_packet`, `update_registry`, `followup_generation`.
3. Public vs private: route by disclosure; private never to public GitHub.
4. Treat external platform state/messages as evidence/input, not as canonical Twin memory.
5. Preserve conversation/continuation identity across provider, account, device and channel changes.

### Phase 3 — Personal / Collective Twin product surface (Inseme)

1. Owner/member “desk”: list open cases, follow-ups due, channel mix and relevant Presences.
2. Optional visitor leaves a **message** → creates claimed packet (public or private per policy) +
   optional SMTP notify owner.
3. Enforce #35 on all desk APIs.
4. Allow Collective Twins to expose optional community surfaces without making those surfaces the
   source of institutional membership, mandate or decision truth.

### Phase 4 — Channel adapters (incremental)

| Order | Channel                    | Notes                                                                 |
| ----- | -------------------------- | --------------------------------------------------------------------- |
| 1     | Email / SMTP               | Spine; mail_trace pipeline already sketched in cogentia               |
| 2     | GitHub issues / comments   | Already agent-native                                                  |
| 3     | Web chat on personal twin  | Maps to packets when consequential                                   |
| 4     | Discord                    | Shared edge for external participation + Twin-hosted community space |
| 5     | ActivityPub                | Federated edge; reuse existing architectural invariants               |
| 6     | Others (WhatsApp, X, etc.) | Experimental; preserve provenance and durable packet/continuation     |

For Discord specifically, avoid two independent implementations. One adapter should support at least:

```text
external participation
  Twin -> Presence in third-party guild/channel/thread

Twin-governed space
  Personal/Collective Twin -> optional Discord surface for users
```

The control regime changes; identity, Presence, ingress/egress, Interaction Packet, provenance,
disclosure and COP mandate mechanics remain shared.

### Phase 5 — Multi-user / multi-collective service

- Package method + desk UI so other Personal and Collective Twins adopt the same registry pattern.
- Hosting: git-backed packs first; optional Supabase projection later (like wiki story).
- Keep external providers replaceable; no provider becomes the sole residence of identity, memory,
  mandate or canonical conversation state.

**Reality update (2026-09-16 / #77):** Agent JHN already has a first Packet-Backed SQL
projection of public Interaction Packets:

```text
JeanHuguesRobert/interaction_packets/packets/**/*.yaml
        ↓ refresh (inseme script)
JHN Supabase interaction_cases + interaction_cases_desk
```

This is an **operational projection**, not a migration of authority away from subject-owned
Git/YAML traces. Private overlays remain in `registre-mariani`. See
`interactions_registry_and_multichannel_messaging.registry.yaml` and issue #77.

## 6. Non-goals (v1)

- Replacing WhatsApp / Telegram / Discord for users
- Single global social graph
- Storing private mail/chat bodies in public JHR without redaction
- Making Inseme instance registry own interaction traces
- Treating external platform roles, polls or permissions as institutional authority
- Making Discord or another provider the canonical memory of a Twin

## 7. Repo ownership

| Work                                     | Home                                        |
| ---------------------------------------- | ------------------------------------------- |
| Packet method, prompts, schema evolution | **cogentia** `interaction_packets/`         |
| Generic Presence research               | **barons-Mariani** `research/presencology*.md` |
| Public JHN traces                        | **JeanHuguesRobert** `interaction_packets/` |
| Private traces                           | **registre-mariani**                        |
| Twin UI / access / chat integration      | **inseme** (this note + #36)                |
| Channel edge implementation              | **inseme** reusable brique/package when justified |
| Ops / deploy                             | **operium** only if production plumbing     |

## 8. Open questions for Principal

1. Should **every** web/chat turn become a packet, or only “consequential” ones (default:
   consequential + explicit “record this”)?
2. Default disclosure for visitor→owner messages on jhn (D2 private desk vs D3 public)?
3. Is **email notify** mandatory when a visitor leaves a desk message?
4. How much of an externally observed Discord space should become a Presence/context projection by
   default, given privacy, terms of service and relevance constraints?

## 9. See also

- Cogentia method: https://github.com/JeanHuguesRobert/cogentia/tree/main/interaction_packets
- JHR register: https://github.com/JeanHuguesRobert/JeanHuguesRobert/tree/main/interaction_packets
- Presencology: https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/presencology.md
- Digital/social Presence addendum: https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/presencology_digital_social_presence_twins.md
- [ActivityPub Edge](activitypub_edge.md)
- [Personal Twin access policy](personal_twin_access_policy.md) (#35)
- [User ↔ personal twin link](user_personal_twin_link.md) (#34)
