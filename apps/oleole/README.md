---
title: Olé Olé (`apps/oleole`)
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

# Olé Olé (`apps/oleole`)

Public Presence / discovery surface for Corsica.

> **Architecture (2026-08-12):** Olé Olé is a **façade of Agent JHN**, not a separate product.
> Canonical host app is **platform + profil JHN** (`HomeRoute` + host discrimination). See
> [`docs/oleole-as-jhn-facade.md`](../../docs/oleole-as-jhn-facade.md). This `apps/oleole` tree
> remains an optional standalone shell / smoke target.

- Spec: [`docs/oleole-mvp-spec.md`](../../docs/oleole-mvp-spec.md)
- Issue: [#42](https://github.com/JeanHuguesRobert/inseme/issues/42)
- Target: `https://oleole.acorsica.org` (domain **alias** on JHN Netlify site)
- Package: `@inseme/brique-oleole`
- Local façade test on platform: `/?facade=oleole` or `/oleole`

## Dev

```bash
# from monorepo root
pnpm install
pnpm oleole:dev
# or
pnpm --filter @inseme/app-oleole run dev
```

Vite: `http://localhost:5190` Netlify dev (API edge):
`pnpm --filter @inseme/app-oleole run netlify:dev` → port 8890

## Build

```bash
pnpm oleole:build
```

## DNS / custom domain

See [`docs/oleole-mvp-status.md`](../../docs/oleole-mvp-status.md) for Gandi + Netlify steps
mirroring `jhn.baronsmariani.org` without guessing records.
