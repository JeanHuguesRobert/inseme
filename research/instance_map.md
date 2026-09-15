---
title: Instance map — locked names and regimes
date: '2026-07-29'
version: '0.1'
license: CC BY-SA 4.0
document_role: operational
document_kind: operational-note
visibility: public
lifecycle_state: active
classification_source: cogentia.js
classification_version: '1'
classification_rule: operational-note
classification_confidence: medium
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
language: en
update_policy: UP-DEFAULT-REVIEWED
status: working-paper
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


# Instance map — locked names and regimes

**Locked order of founding instances & hosted twins:**

1. **`pertitellu-corte`** (Pertitellu / LePP / lepp.fr) — first **collective / civic** instance
2. **`jhn`** (`00000000-0000-0000-0000-000000000001`, jhn.baronsmariani.org) — founding **personal**
   TwinRoot & root host
3. **`frederic-lecourtois`** (`00000000-0000-0000-0000-000000000002`, bot _Aréopage_) — **hosted
   provisional** Personal Twin on JHN
4. **`marie-cornelie-lenglet`** (`00000000-0000-0000-0000-000000000003`) — **hosted provisional**
   Personal Twin on JHN
5. **`marie-louise-robert`** (`00000000-0000-0000-0000-000000000004`) — **hosted provisional**
   Personal Twin (posthume / mémoriel) on JHN
6. **`fractavolta-public-guide`** — public **infant** corpus Guide surface (Cogentia, not Inseme
   tenant)

| `canonical_slug` / `instance_id` | UUID                                   | Kind                  | Host  | Primary URL / Domain                         | Bot / Persona | Codebase             |
| -------------------------------- | -------------------------------------- | --------------------- | ----- | -------------------------------------------- | ------------- | -------------------- |
| `pertitellu-corte`               | -                                      | civic                 | -     | lepp.fr                                      | Ophélia       | survey → inseme      |
| `jhn`                            | `00000000-0000-0000-0000-000000000001` | personal (root host)  | -     | jhn.baronsmariani.org                        | John          | inseme apps/platform |
| `frederic-lecourtois`            | `00000000-0000-0000-0000-000000000002` | personal (hosted)     | `jhn` | frederic-lecourtois.jhn.baronsmariani.org    | Aréopage      | inseme apps/platform |
| `marie-cornelie-lenglet`         | `00000000-0000-0000-0000-000000000003` | personal (hosted)     | `jhn` | marie-cornelie-lenglet.jhn.baronsmariani.org | Ophélia       | inseme apps/platform |
| `marie-louise-robert`            | `00000000-0000-0000-0000-000000000004` | personal (posthumous) | `jhn` | marie-louise.jhn.baronsmariani.org           | Marie-Louise  | inseme apps/platform |
| `fractavolta-public-guide`       | -                                      | service surface       | -     | fractavolta.com / Guide                      | Guide         | cogentia             |
| `cogentia-public-mcp`            | -                                      | service               | -     | cogentia.fractavolta.com                     | -             | cogentia             |

**Règle de gestion des collisions :**

- _First come, first served_ (Premier arrivé, premier enregistré dans `instance_aliases` avec
  timestamp `allocated_at`).

**Table d'alias des instances enregistrées :**

- `jhn` (Root host) $\rightarrow$ `john`, `jean`, `jean-hugues`, `jean-hugues-noel`,
  `jean-hugues-noël`, `jean-hugues-noel-robert`, `jean-hugues-noël-robert`, `jhr` (ancre historique
  précoce Twitter/X `@jhr`), `baron-mariani`, `barons-mariani`, `mariani`, `robert`
- `frederic-lecourtois` $\rightarrow$ `areopage`, `aréopage`, `frederic`, `frédéric`, `lecourtois`,
  `f-lecourtois`
- `marie-cornelie-lenglet` $\rightarrow$ `marie-cornelie`, `marie-cornélie`, `cornelie`, `cornélie`,
  `mc-lenglet`, `lenglet`
- `marie-louise-robert` $\rightarrow$ `marie-louise`, `marie`, `mary`, `mlr`, `ml-robert`,
  `marie-robert`

Agents/personas are COP objects **inside** an instance, not new DNS tenants.  
Rename only by explicit human decision and a new version of this note.

### Federation vs person↔twin link (do not conflate)

| Concern                     | Where                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Instance registry / hub** | Discovery of _instances_ in the Pertitellu federation (Corte = first collective + bootstrap hub). Optional dual-role on the hub Supabase.              |
| **User ↔ personal twin**    | Optional association of a _collective member account_ with a _personal TwinRoot address_ (email match as primary verification). **Not in schema yet.** |

Full plan (agents must read before inventing columns):  
[user_personal_twin_link.md](user_personal_twin_link.md) — tracking
**[inseme#34](https://github.com/JeanHuguesRobert/inseme/issues/34)**.

**Access on the personal twin host** (`jhn.baronsmariani.org`): visitor classes and owner full
access —  
[personal_twin_access_policy.md](personal_twin_access_policy.md) —
**[inseme#35](https://github.com/JeanHuguesRobert/inseme/issues/35)**.

**Public intelligence:** John public chat is a readonly **superset** of the FractaVolta Guide
(public corpus about the Principal). Factorization plan —
[personal_twin_public_intelligence_core.md](personal_twin_public_intelligence_core.md) —
**[inseme#37](https://github.com/JeanHuguesRobert/inseme/issues/37)** ·
**[cogentia#85](https://github.com/JeanHuguesRobert/cogentia/issues/85)**.

See also:
[personal_instance_democracy_and_non_capturable_match.md](personal_instance_democracy_and_non_capturable_match.md),  
[RUNBOOK_JHN_PERSONAL_INSTANCE.md](../apps/platform/docs/RUNBOOK_JHN_PERSONAL_INSTANCE.md),  
[user_personal_twin_link.md](user_personal_twin_link.md).
