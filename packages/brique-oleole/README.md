---
title: brique-oleole — Olé Olé Presence / Place surface
author: Jean Hugues Noël Robert, baron Mariani
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
date: '2026-09-15'
last_modified_at: '2026-09-15'
version: '0.1'
status: working-paper
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

# brique-oleole — Olé Olé Presence / Place surface

Public-interest Presence and Place discovery for Corsica (`oleole.acorsica.org`).

## Invariants

- Map UI and John tools share the same Presence/Place service layer (`src/lib/`).
- Public map shows **aggregates only** — never precise individual locations by default.
- Automatic contribution is first-class; pause/revoke must be immediate.
- `oleole` intent is aggregate-only, not a dating catalogue.
- No behavioral advertising SDKs.
- **Dual UX FR / EN** — full UI + John replies; toggle in header; `?lang=en` / `localStorage`; API
  `X-Oleole-Locale` / `lang`.

## Structure

| Path                       | Role                                             |
| -------------------------- | ------------------------------------------------ |
| `src/lib/presence-core.js` | Validation, aggregation, precision, time windows |
| `src/lib/places-seed.js`   | Bootstrap Corsican places (OSM/Overture refs)    |
| `src/lib/auto-presence.js` | Client significant-change detection              |
| `src/edge/presence-api.js` | HTTP API for places/claims/aggregates            |
| `src/edge/tool-*.js`       | John / Ophelia tools over the same layer         |
| `src/pages/OleoleHome.jsx` | Mobile-first map + contribute + John panel       |

See `docs/oleole-mvp-spec.md` and issue [#42](https://github.com/JeanHuguesRobert/inseme/issues/42).
