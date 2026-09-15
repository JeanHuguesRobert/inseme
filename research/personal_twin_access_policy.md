---
title: Personal Twin access policy — visitors, members, owner, agent
date: '2026-08-08'
version: '0.1'
license: CC BY-SA 4.0
document_role: operational
document_kind: design-note
visibility: public
status: planned — partial runtime only
github_issue: https://github.com/JeanHuguesRobert/inseme/issues/35
related:
  - research/user_personal_twin_link.md
  - research/instance_map.md
  - research/personal_instance_democracy_and_non_capturable_match.md
  - research/cop_identity_kudocracy_profile.md
  - apps/platform/docs/RUNBOOK_JHN_PERSONAL_INSTANCE.md
  - JeanHuguesRobert/inseme#17
  - JeanHuguesRobert/inseme#33
  - JeanHuguesRobert/inseme#34
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


# Personal Twin access policy — visitors, members, owner, agent

**Tracking:** [inseme#35](https://github.com/JeanHuguesRobert/inseme/issues/35)

**Audience:** all agents. Canonical host for the first Personal Twin:
**`https://jhn.baronsmariani.org`** (`instance_id: jhn`, TwinRoot `twin:jhn`). Do not invent
alternate apex names (`jhr.*`) unless the Principal renames the instance in `instance_map.md`.

**Invariant (Principal, 2026-08-08):**  
**one living human person = one Cogentia Personal Digital Twin** (one TwinRoot per natural person).
The human is the **owner / principal** of that twin. Full access belongs to the owner (and to agents
acting under explicit mandate from the owner), not to arbitrary visitors.

This note is **design + implementation plan**. Runtime today only has coarse `users.role` /
`is_admin`-style flags — not a full visitor-class policy for chat.

---

## 1. Why the conversational agent must know this

The platform’s conversational surface (Agent John / Ophelia chat on `/john`) is not a generic
chatbot. It is a **gateway into a personal twin**. What it may:

- say (public vs private knowledge),
- do (read vault, mutate COP, send mail, invoke tools),
- remember about the interlocutor,

depends on **who is speaking**. The agent must receive an explicit **access class** (and
capabilities) in context — not guess from tone.

```text
HTTP session / auth
  → resolve access_class + subject_ref + capability_set
  → inject into agent system/context pack
  → every tool call re-checks capability_set (server-side, not only prompt)
```

Prompt-only policy is insufficient. Server-side enforcement is mandatory for mutates and secrets.

---

## 2. Access classes (categories)

Order from least to most privileged. Names are stable tokens for code and COP.

| Class                              | Token                 | Who                                                                  | Auth                             | Default stance                               |
| ---------------------------------- | --------------------- | -------------------------------------------------------------------- | -------------------------------- | -------------------------------------------- |
| **Anonymous visitor**              | `visitor_anonymous`   | Anyone, no account                                                   | None                             | Public façade only                           |
| **Registered visitor**             | `visitor_registered`  | Has an account on _this_ personal instance, not the owner            | Local auth                       | Limited member of _this_ twin’s “front desk” |
| **Linked peer**                    | `visitor_linked_peer` | Authenticated; optional claim of _their own_ personal twin (see #34) | Local auth + optional twin claim | Peer-to-peer politeness; no owner powers     |
| **Delegate / mandated agent-user** | `delegate`            | Human or service acting under a **published mandate** from the owner | Auth + valid mandate             | Scoped powers only                           |
| **Owner (principal)**              | `owner`               | The single living person this TwinRoot represents                    | Auth + **owner proof**           | Full access (with safety rails)              |
| **Platform / system**              | `system`              | Runtime, health, edge functions                                      | Service role / internal          | Ops only; not a chat persona                 |

### 2.1 Owner proof (how “me” is recognized)

Owner is **not** merely `role=admin` forever. Prefer layered proof:

1. **Account binding** — owner’s email (authoritative on the personal twin — same rule as #34)
   matches configured `owner_email` / principal subject.
2. **Optional second factor** later (WebAuthn, magic link only to that email).
3. **Subject ref** — `subject:jhn` / TwinRoot `twin:jhn` only when binding is verified.

Until a dedicated `owner_subject_id` field exists, document transitional rule:  
`users.role = admin` **and** email ∈ owner allowlist on personal deploy = provisional `owner`.

### 2.2 What each class may do (policy matrix v0)

| Capability                                  | anonymous          | registered | linked_peer | delegate     | owner |
| ------------------------------------------- | ------------------ | ---------- | ----------- | ------------ | ----- |
| Read public landing / about                 | yes                | yes        | yes         | yes          | yes   |
| Chat (public persona, non-secret)           | yes (rate-limited) | yes        | yes         | yes          | yes   |
| See private memory / vault / private COP    | no                 | no         | no          | mandate-only | yes   |
| Mutate twin state (settings, agents, vault) | no                 | no         | no          | mandate-only | yes   |
| Act _as_ the twin externally (mail, posts)  | no                 | no         | no          | mandate-only | yes   |
| Admin UI / instance config                  | no                 | no         | no          | rare         | yes   |
| Impersonate owner                           | no                 | no         | no          | no           | n/a   |

**Delegates** never get a silent superset of owner; each capability is **mandate-scoped** and
traceable (COP Event / CapabilityInvocation).

### 2.2bis Measured Risk → Exposure, recovery envelopes, and pre-act mandate (general rule)

This is **not** a special “extra confirm for email” product quirk. It is the same regime as COP /
second-method / skills contracts under the **Measured Risk doctrine**
(`cogentia/research/measured_risk.md`), restated for the twin surface.

```text
The greater the external Exposure or the costlier the recovery path,
the more the associated Acts must be:
  (1) checked against a well-identified Mandate BEFORE execution
  (2) checked against applicable Budget / Exposure ceiling BEFORE execution
  (3) recorded under a proportional Trace / Imputation regime
  (4) executed with clear recovery paths (reversal, compensation, rectification, repair, residue)
```

| Regime                                         | When                                                                | What agents/tools must do                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Bounded Exposure, within recovery envelope** | Local UI, drafts, dry-runs, reversible code, internal tests         | **Act under standing mandate without approval theater**; preserve human attention budget; light trace OK        |
| **Consequential / external Exposure**          | Send mail, public post, spend quota, external write                 | **Pre-act:** valid mandate + Exposure/budget ceiling; **then** Act; **then** proportional trace + recovery path |
| **Hard boundary / irreversible externalities** | Destructive deletion, external legal commitments, one-way publishes | **Filter before action** (escalate via Continuation to human principal); full governed chain                    |

Canonical pointers (already in corpus — this subsection only makes them **hard to miss** on the twin
access path):

| Source                                        | Statement                                                                                                                               |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `cogentia/research/measured_risk.md`          | Govern for bounded value creation, learning, and recovery rather than risk minimization (#120)                                          |
| `inseme/AGENTS.md`                            | Governed chain Principal→…→Act→Trace→Imputation; Measured Risk rule; consequential caps need budget + proportional trace                |
| `cogentia/docs/digital-twin-agile-roadmap.md` | _When exposure crosses hard boundaries, filter before action. When exposure is bounded, learn by traceable action under Measured Risk._ |
| `barons-Mariani/research/agile.md`            | Measured Risk: bounded exposure, recovery envelopes (compensation/repair), and human attention preservation                             |
| `cogentia/docs/agent-skills-contract.md`      | Skills must not widen mandate, budget, disclosure, or effect ceiling (#79)                                                              |
| COP `governed-act` / Identity profile         | Mandate explicit; capability ≠ authorization; authorization ≠ execution                                                                 |

**UI “extra confirm”** (e.g. before external mail) is only an **affordance** when it helps enforce
pre-act checks — not a substitute for mandate/budget/trace, and not required for every reversible
owner click.

The conversational agent must **refuse or gate** tools that would skip pre-act checks on
consequential/irreversible classes, even for `owner`.

### 2.3 Conversational agent behavior by class

| Class                 | Agent should                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `visitor_anonymous`   | Greet as public face of the twin; refuse private topics; offer register/sign-in if useful; no tool that touches secrets. |
| `visitor_registered`  | Can personalize lightly (name); still no owner vault; may leave messages / public interactions if product allows.        |
| `visitor_linked_peer` | May acknowledge peer twin address; federation-friendly language; no owner powers.                                        |
| `delegate`            | State mandate scope explicitly (“I can X for Y until Z”); refuse out-of-scope asks.                                      |
| `owner`               | Full personal assistant mode under safety rails; may use private tools; still log consequential acts.                    |

The agent must **state or silently apply** the class when it changes answers (“as a public visitor I
can’t open your private notes”).

---

## 3. Relation to other planes

| Topic                                 | Relation                                                                                                                                        |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Collective instances (Pertitellu)** | Membership on Corte ≠ ownership of personal twin. #34 links accounts across planes; **this** policy is _inside_ the personal instance.          |
| **Instance registry**                 | Discovers instances; does not grant chat rights on jhn.                                                                                         |
| **One person = one twin**             | Multiple _agents_ under one TwinRoot are OK; multiple TwinRoots per living person are **out of policy** unless Principal revises the invariant. |
| **COP Identity**                      | Map classes to subject kinds + capacities; owner = principal living person for this TwinRoot.                                                   |

---

## 4. Implementation plan

### Phase 0 — Doctrine (this doc + issue)

- [x] Categories + matrix drafted
- [ ] Issue #35 open; link from AGENTS / instance_map
- [ ] Principal review of matrix (especially public chat vs registered)

### Phase 1 — Resolve access class (server)

1. Single function `resolveAccessContext(session)` →  
   `{ access_class, subject_ref, twin_root_ref, email, capability_set[], mandate_ref? }`.
2. Owner allowlist from instance_config / vault (not hard-coded only in frontend).
3. Anonymous session id for rate limits (cookie / fingerprint optional later).

### Phase 2 — Enforce on tools / APIs

1. Edge/functions and MCP-style tools check `capability_set` before execute.
2. Chat completion path injects class into system prompt **and** filters tool list.
3. Deny by default for private tools.

### Phase 3 — UI honesty

1. `/john` header shows mode: Public / Signed in / Owner.
2. Auth modal for upgrade path anonymous → registered → owner.
3. Bob already branches on `is_admin` for moderation text — replace with access_class.

### Phase 4 — Mandates / delegates

1. Reuse COP mandate objects when ready (#17 / #31 / #33).
2. Delegate class only if mandate unexpired and audience includes chat tools.

### Phase 5 — Tests & smoke

1. Unit: matrix rows → allowed tools.
2. Smoke: anonymous cannot hit vault endpoints; owner can.
3. Agent smoke: same prompt under two classes → different tool offers.

### Explicit non-goals (v1)

- Full RBAC product for teams inside a personal twin
- Cross-instance SSO
- Multiple owners per personal twin
- Treating “registered on lepp.fr” as owner of jhn

---

## 5. Suggested code touch points (when implementing)

| Area                   | Notes                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `resolveAccessContext` | New module under `packages/cop-host` or `apps/platform/src/lib/`                         |
| Chat                   | `useOpheliaChat` / edge rag or COP turn — receive context, filter tools                  |
| Auth                   | `CurrentUserContext`, owner allowlist in `instance_config`                               |
| Config keys            | `owner_email`, `owner_subject_ref`, `twin_root_ref` (partially exist on personal deploy) |

---

## 6. Open questions for Principal

1. May **registered** users leave **private messages** for the owner (inbox) without reading vault?
2. Is **public** chat allowed to use **public** Cogentia corpus tools only, or also light personal
   public bio?
3. ~~Should owner mode require re-auth for high-risk tools (send external mail)?~~  
   **Resolved (2026-08-08):** not a special re-auth product rule. Apply the general
   **irreversibility → pre-act Mandate + Budget + proportional Trace** rule (§2.2bis). UI confirm is
   optional affordance only.
4. Rename tokens if French UI labels needed (`visiteur`, `propriétaire`)?

---

## 7. See also

- [User ↔ Personal Twin link (#34)](user_personal_twin_link.md)
- [Instance map](instance_map.md)
- [Personal instance democracy](personal_instance_democracy_and_non_capturable_match.md)
- [COP Identity profile](cop_identity_kudocracy_profile.md)
- `inseme/AGENTS.md` (governed chain + irreversibility rule)
- `cogentia/docs/digital-twin-agile-roadmap.md` (filter before irreversible action)
- `barons-Mariani/research/agile.md` (second method)
- `cogentia/docs/agent-skills-contract.md` (mandate/budget ceiling) )
