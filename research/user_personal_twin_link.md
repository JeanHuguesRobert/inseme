---
title: User ↔ Personal Twin link on collective instances
date: '2026-08-08'
version: '0.1'
license: CC BY-SA 4.0
document_role: operational
document_kind: design-note
visibility: public
status: planned — not in schema yet
github_issue: https://github.com/JeanHuguesRobert/inseme/issues/34
related:
  - research/instance_map.md
  - research/personal_instance_democracy_and_non_capturable_match.md
  - research/cop_identity_kudocracy_profile.md
  - apps/platform/docs/ARCHITECTURE_MULTI_INSTANCE.md
  - apps/platform/docs/RUNBOOK_JHN_PERSONAL_INSTANCE.md
  - JeanHuguesRobert/inseme#34
  - JeanHuguesRobert/inseme#17
  - JeanHuguesRobert/inseme#30
  - JeanHuguesRobert/inseme#33
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


# User ↔ Personal Twin link on collective instances

**Tracking:** [inseme#34](https://github.com/JeanHuguesRobert/inseme/issues/34) (FixBugsFirst
backlog / planned enhancement).

**Audience:** all coding / research / review agents working in the Inseme corpus (and siblings that
federate with it). This note is the shared memory for a planned feature; **do not invent schema
columns or migrations from this alone until an explicit implement task.**

## 1. Intent

On a **collective** instance (e.g. Pertitellu Corte / lepp.fr), an **authenticated user** may
**optionally** associate the **address / name of a Cogentia Personal Twin instance** with their
local membership account.

Canonical story:

- As an inhabitant of Corte, a person is a natural **member** of the Corte Pertitellu collective
  instance (and may also be founder, administrator, etc.).
- Separately, the same person may run a **personal TwinRoot** (e.g. `jhn` at
  `https://jhn.baronsmariani.org`, `twin:jhn`, `subject:jhn`).
- The link says: _this collective account points at that personal twin_ — not that the collective
  owns the twin, and not that a personal twin is required for civic membership.

## 2. Federation context (do not confuse layers)

| Layer                                | Role                                                                                                                                                                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Pertitellu**                       | Informal (not a formal _personne morale_) future **federation** of **citizen-managed collective digital twin instances**. Historically rooted in Corte.                                                                                                            |
| **`pertitellu-corte` (lepp.fr)**     | First (and currently only) collective node: **city twin for Corte** and, by history + uniqueness, legitimate **bootstrap hub** for future city peers (e.g. Bastia).                                                                                                |
| **Central / instance registry**      | Federation **discovery** of _instances_ (subdomain → Supabase URL, metadata). Dual-role on the hub instance when enabled. **Not** person↔twin binding. Design default was a master `instance_registry`; live registry API is not required for mono-instance day-1. |
| **Personal TwinRoot (`jhn`)**        | Founding **personal** instance. Must **not** be the steady-state Pertitellu hub/registry.                                                                                                                                                                          |
| **Agent JHN / John**                 | COP logical agent **inside** a personal instance — not a DNS tenant and not the registry.                                                                                                                                                                          |
| **This link (user ↔ personal twin)** | Membership plane on a **collective** DB: optional claim that a **local user** corresponds to a **personal twin address**.                                                                                                                                          |

Instance registry answers: _where is instance X?_  
This link answers: _which personal twin (if any) does this collective member claim?_

## 3. What to store (when schema is added)

Prefer stable **addresses**, not credentials:

```text
personal_instance_id     e.g. jhn
canonical_url            e.g. https://jhn.baronsmariani.org
twin_root_ref            e.g. twin:jhn
represented_subject_ref  e.g. subject:jhn   (optional)
status                   claimed | verified | revoked | disputed
verification_method      email_match | dns | well-known | signed_claim | admin_attested | …
verified_at / claimed_at
metadata jsonb
```

**v0 (acceptable before migration):** same fields under `users.metadata.personal_twin` or
`civic_user_profile.metadata`.

**v1 table sketch (collective instance only):**

```text
user_personal_twin_link
  id
  user_id → local public.users / auth.users
  personal_instance_id
  canonical_url
  twin_root_ref
  status
  verification_method
  verified_at
  claimed_at
  metadata
  -- v1: UNIQUE(user_id) for one primary twin per member
  -- optional: UNIQUE(twin_root_ref) WHERE status = verified
```

Do **not**:

- merge `auth.users` across Supabase projects;
- store personal service_role / vault secrets on the collective;
- require a personal twin to vote or consult on the collective;
- treat Agent JHN as infrastructure for the registry or the link table.

## 4. Verification — email correlation (Principal decision 2026-08-08)

**Primary easy check for claim security:** correlate the **email** of the authenticated user on the
**collective** instance with the **email** associated with the **personal twin** instance.

```text
collective auth email  ≈  personal twin account email
→ claim can be treated as verified (or strongly attested) by email_match
```

### Authoritative email (follow changes later)

When emails diverge or change over time:

- The **email address of the Personal Twin** is the **authoritative** one for the natural person in
  this binding model.
- Collective-side email may lag; long-term we will need to **follow** personal-twin email changes
  (re-sync / re-verify). **Not implemented yet** — only design intent.
- Do not invent a full email-lifecycle system until a dedicated task; when implementing, prefer
  “personal twin email wins” over “last edit on collective wins.”

Other verification methods (well-known URL, DNS, COP-signed claim, admin attestation) remain
optional complements, not replacements for the email story above unless product changes.

## 5. Semantics

| Rule                            | Why                                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------------- |
| Optional                        | Many collective members have no personal twin                                       |
| Claim ≠ control                 | Collective membership stays local; twin stays sovereign                             |
| Verification levels             | Self-asserted vs email-matched vs stronger proofs                                   |
| One person, many agents         | Still one political person on the collective; agents live under mandate on the twin |
| Not party ownership of the twin | Link is address association, not capture of TwinRoot                                |

## 6. Flows (planned, not built)

1. **Claim** — authenticated collective user asserts personal twin id/URL.
2. **Verify** — email match (primary); optional stronger proofs later.
3. **Display** — profile badge / public pointer to personal twin (respect visibility).
4. **I2I later** — collective → personal under mandate (notify, request, never free write).
5. **Revoke** — user or admin clears link; history remains in COP traces if any.
6. **Email follow** (later) — when personal twin email changes, re-bind or re-verify per §4.

## 7. Pilot

First natural pilot member: **JHN** on **Pertitellu Corte** (inhabitant + admin/founder of the
collective instance) linking to personal TwinRoot **`jhn`**.

## 8. Implementation status

| Item                              | Status                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| Doctrine / agent-shared plan      | **This document (2026-08-08)**                                                        |
| Schema migration                  | **Not started**                                                                       |
| UI claim/verify                   | **Not started**                                                                       |
| Email follow / authority sync     | **Deferred** (design only)                                                            |
| Live instance registry on lepp.fr | **Not serving** `/api/instance/*` as of 2026-08-08 probes; site itself is operational |

## 9. See also

- [Instance map](instance_map.md)
- [Personal instance democracy & non-capturable match](personal_instance_democracy_and_non_capturable_match.md)
- [COP Identity / Kudocracy Profile](cop_identity_kudocracy_profile.md)
- [Multi-instance architecture](../apps/platform/docs/ARCHITECTURE_MULTI_INSTANCE.md)
- [JHN personal instance runbook](../apps/platform/docs/RUNBOOK_JHN_PERSONAL_INSTANCE.md)
- [JHN go-live](../docs/JHN_GO_LIVE.md)  
  )
