---
title: Olé Olé MVP — implementation status (#42)
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

# Olé Olé MVP — implementation status (#42)

Date: 2026-08-11 Spec: [`oleole-mvp-spec.md`](./oleole-mvp-spec.md) Issue:
[inseme#42](https://github.com/JeanHuguesRobert/inseme/issues/42)

## Architecture (no parallel subsystem)

```text
apps/oleole/                 host app + Netlify site surface
packages/brique-oleole/      Presence/Place core, map UI, John tools, edge API
apps/platform/supabase/migrations/20260811120000_oleole_presence_places.sql
```

Map UI, HTTP API (`/api/oleole/*`), and John tools all call the same `createPresenceStore` /
`presence-core` layer. Public responses are aggregates only.

Reuse decisions:

| Capability    | Choice                                                                                                                             |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Map renderer  | Leaflet + react-leaflet (same stack as `brique-map`); OSM tiles for light host app                                                 |
| Chat agent    | John (not a new persona); local service turn + Ophelia-compatible tools                                                            |
| Identity      | Server-resolved subject: signed pseudonymous participant cookie or verified Supabase session; localStorage ID is offline-demo only |
| Design tokens | FractaVolta Sass variables (`#d63131` / `#fbcb1c` / `#0a3fa0` / ink / off-white)                                                   |
| GIS brique    | Not forked wholesale; oleole owns Presence semantics to avoid Tinder/municipal coupling                                            |

## Dual UX (FR / EN)

- Dictionaries: `packages/brique-oleole/src/i18n/messages.js` (same keys in both locales).
- Header switch **FR | EN**; preference in `localStorage` (`oleole.locale`); shareable `?lang=en`.
- John chat + NL parse + API replies follow the active locale (`X-Oleole-Locale` / body `lang`).
- Place names stay as official toponyms (Corte, Calvi…); UI chrome and John copy are localized.

## Vertical slices shipped in this implementation

1. **Public surface + map + seed Places** — `apps/oleole`, OSM basemap, Corsica places with
   OSM+Overture provenance.
2. **Manual PresenceClaim + aggregate display** — contribute panel, temporal windows `now` /
   `tonight` / `tomorrow`.
3. **Future / intended presence** — modality `intended` + NL parse for “demain”.
4. **John read tools** — `search_places`, `get_presence`, `get_presence_map`,
   `get_my_presence_state`.
5. **John write proposal + confirmation** — `declare_presence` / `declare_future_presence` require
   `confirm` unless mandate; chat NL proposes then confirms.
6. **Automatic contribution** — client significant-change + precision reduction to municipality;
   pause/off immediate; `set_presence_mode`.
7. **Intent aggregates** — `discovery` / `social` / `oleole` on claims; map shows aggregate counts
   only.
8. **Privacy baseline + Bauhaus/Mondrian UI** — no ad SDK, Permissions-Policy `interest-cohort=()`,
   revocations, FractaVolta-derived CSS.

## Acceptance scenarios

| #   | Scenario                                                    | Status                               |
| --- | ----------------------------------------------------------- | ------------------------------------ |
| 1   | Visitor opens map without account, sees places + aggregates | Implemented (seed + API; domain TBD) |
| 2   | Temporal view changes aggregates                            | Implemented                          |
| 3   | “Je suis à Corte jusqu’à 20h” aggregate only                | Implemented (UI + NL + store)        |
| 4   | Future Calvi + John/map context                             | Implemented                          |
| 5   | Auto mode visible + pause                                   | Implemented (browser geolocation)    |
| 6   | Coarse precision drops raw GPS                              | Implemented + unit tested            |
| 7   | John “où ça bouge ce soir ?” same data                      | Implemented via `/api/oleole/chat`   |
| 8   | NL → structured write after confirm                         | Implemented                          |
| 9   | Map ↔ chat context (minimal)                                | Implemented (`focus_place` / window) |
| 10  | Aggregate `olé olé` intent                                  | Implemented                          |
| 11  | Revoke / mode off stops auto                                | Implemented                          |
| 12  | No ad/tracking SDK                                          | Implemented                          |
| 13  | Place provenance OSM+Overture                               | Implemented                          |
| 14  | FractaVolta visual language                                 | Implemented (tokens extracted)       |

## Definition of Done blockers / ops

### A. Apply SQL migration

```bash
# on the JHN / platform Supabase project
supabase db push
# or apply apps/platform/supabase/migrations/20260811120000_oleole_presence_places.sql
```

Without migration, edge API falls back to **in-memory** store (works for single-isolate demo; not
multi-instance durable).

Required Netlify bootstrap environment: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The
high-entropy `oleole_session_secret` is stored in the Agent JHN `instance_config` vault and loaded
by the edge function; it is not a Netlify variable. The service-role key is edge-only. Browser
clients never supply `subject_ref`; the edge derives it from a verified Supabase bearer session or
an HttpOnly, HMAC-signed participant cookie. Public API responses contain Places or aggregates only.

### B. DNS + Netlify custom domain — `oleole.acorsica.org`

**Do not guess** record type or Netlify target. Inspect the live pattern used by
`jhn.baronsmariani.org` first.

Suggested runbook:

1. **Inspect current JHN mapping**
   - Netlify UI → site for `jhn.baronsmariani.org` → Domain management: note custom domain, Netlify
     subdomain (`*.netlify.app`), HTTPS status.
   - DNS at registrar (Gandi for baronsmariani / acorsica as applicable):
     ```text
     dig jhn.baronsmariani.org +short
     dig CNAME jhn.baronsmariani.org +short
     dig A jhn.baronsmariani.org +short
     dig NS acorsica.org +short
     dig NS baronsmariani.org +short
     ```
   - Record whether the apex/subdomain uses **CNAME** to `*.netlify.app` or **A/AAAA** Netlify
     load-balancer IPs / ALIAS.

2. **Create / link Netlify site for Olé Olé**
   - New site from monorepo, base directory `apps/oleole`, build command and publish as in
     `apps/oleole/netlify.toml`.
   - Env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` or anon (same JHN project initially),
     `NODE_VERSION=24`.

3. **Attach custom domain**
   - Netlify → Domain management → Add `oleole.acorsica.org`.
   - Copy the **exact** DNS instructions Netlify shows (CNAME target or A records).

4. **Gandi DNS (acorsica.org)**
   - Create the record Netlify requested for host `oleole` (or FQDN).
   - Do not invent values; paste Netlify’s target.

5. **TLS**
   - Wait for Netlify certificate provisioning; verify:
     ```text
     curl -I https://oleole.acorsica.org
     ```
   - Confirm HTTP→HTTPS redirect and valid cert.

6. **Report back in issue #42**
   - Final DNS record(s)
   - Netlify site id / name
   - Whether pattern matches or intentionally differs from `jhn.baronsmariani.org`

**Status as of implementation PR:** code and site config are ready; **public DNS/TLS not applied
from this agent session** (requires Gandi + Netlify credentials / UI confirmation).

### C. Full Overture/OSM bulk ingest

Seed covers major communes + sample POIs. Full Overture GeoParquet ingest is a follow-up (spec §3.7
allows seed + open strategy; bulk pipeline not a ship blocker for first useful loop).

### D. Capacitor / background location native

Browser `watchPosition` + significant-change is implemented. Thin native wrapper remains a SHOULD
spike if background reliability is insufficient on iOS.

## Local commands

```bash
pnpm install
pnpm --filter @inseme/brique-oleole test
pnpm oleole:dev          # Vite :5190
pnpm oleole:build
pnpm --filter @inseme/app-oleole run netlify:dev  # :8890 with edge API
```

## Explicit non-goals respected

- No swipe/profile catalogue, no stranger DMs, no ad SDK, no pay-to-rank, no new Olé Olé chatbot
  persona.
