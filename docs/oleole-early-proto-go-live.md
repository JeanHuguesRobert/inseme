---
title: Olé Olé — early proto go-live
author: Jean Hugues Noël Robert, baron Mariani
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
date: '2026-09-15'
last_modified_at: '2026-09-15'
version: '0.1'
status: working-paper
license: CC BY-SA 4.0
language: en
document_role: archive
document_kind: documentation
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

# Olé Olé — early proto go-live

Date: 2026-08-12 Mode: **early proto** (public exploratory surface, not full MVP DoD)

## Architecture update (2026-08-12)

Olé Olé is a **façade of Agent JHN** on the **same** Netlify site as the Twin
(`jhn-baronsmariani-org`), not a long-term separate product site.

Canonical doc: [`oleole-as-jhn-facade.md`](./oleole-as-jhn-facade.md).

| Target                         | Role                                                  |
| ------------------------------ | ----------------------------------------------------- |
| `jhn.baronsmariani.org`        | Twin landing + `/john`                                |
| `oleole.acorsica.org`          | **domain alias** on the **same** JHN Netlify project  |
| `apps/platform` + profil `jhn` | host app that mounts `OleoleHome` when Host is oleole |
| `oleole-acorsica` (early site) | optional temporary shell; prefer alias → JHN site     |

## Early shell (optional / legacy of first push)

| Check                          | Status                                                  |
| ------------------------------ | ------------------------------------------------------- |
| Netlify site `oleole-acorsica` | created · id `cbab0c97-…` (standalone shell)            |
| Production URL                 | https://oleole-acorsica.netlify.app/                    |
| Desired end state              | alias `oleole.acorsica.org` → **jhn-baronsmariani-org** |

## What is live in early proto

- Map of Corsica + seeded Places (OSM/Overture provenance on records)
- Temporal windows, manual presence, auto mode UI, John FR/EN
- Dual UX FR | EN
- Client localStorage fallback when API edge is offline (same-browser demo loop)
- Visible red **Early proto** banner

## Explicit early-proto limits

- No durable multi-user presence backend on this publish
- No custom domain until DNS step (`oleole.acorsica.org`)
- No stranger messaging, no dating catalogue
- Aggregates are contributed / local — not population estimates

## Redeploy

```bash
cd C:\tweesic\inseme
pnpm oleole:build
# absolute path required: monorepo CLI resolves relative dist from repo root
netlify deploy --prod --dir apps/oleole/dist --site cbab0c97-66cc-48a3-8c1a-23eccc53728c --no-build --message "Ole Ole early proto"
```

## Next hardening

1. Apply `20260811120000_oleole_presence_places.sql` on JHN Supabase
2. Ship edge `presence-api` only (no leftover monorepo edge gens) + env `SUPABASE_*`
3. DNS CNAME `oleole.acorsica.org` → `oleole-acorsica.netlify.app` (mirror jhn after dig)
4. Commit/PR #42
