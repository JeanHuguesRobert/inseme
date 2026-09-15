---
title: Magistral — Current Status (May 2026)
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

# Magistral — Current Status (May 2026)

## Context

Work on Magistral was paused during the massive 2025 refactoring of the Inseme platform.  
As of now (late May 2026), **no brique is marked "active"** — everything is `experimental` (except
`brique-auxilia` which is `skeleton`).

## High-Level State

| Component                       | Status       | Notes                                                                                      |
| ------------------------------- | ------------ | ------------------------------------------------------------------------------------------ |
| Core Router (`src/router.js`)   | **Advanced** | Most of the plan is implemented (metrics, disable/enable, traffic log, probe, map editing) |
| Standalone Deno Pilot           | **Advanced** | Endpoints for metrics, logs, probe, map/add/save, disable/enable are present               |
| Sovereign Node (`models/ai.js`) | **Good**     | Persistence, logging, basic routing work. Some admin endpoints present                     |
| Admin UI (pilot)                | **Partial**  | Metrics tab works. Explore and Logs tabs have UI + JS but need full backend parity testing |
| Registry (maps + blueprints)    | **Basic**    | `default.json` + `coding.json` exist                                                       |
| Documentation                   | **Outdated** | README contains old ambitious prompt + partial spec                                        |
| Easy "Run" experience           | **Weak**     | Requires manual `node scripts/launcher.js --pilot ...`                                     |

## What is Working Today

- Intelligent routing across multiple LLM providers with tier + fallback logic.
- Automatic exhaustion handling (429/403/402).
- Manual `disable` / `enable` of nodes.
- Per-node metrics (requests, successes, avg latency, last error).
- Traffic logging (NDJSON + ring buffer) with filtering.
- Model probing (`/v1/magistral/probe`).
- Dynamic map editing + save (`/v1/magistral/map/add` + `/map/save`).
- Persistence across restarts for both the standalone pilot and the embedded Sovereign router.

## Remaining Work (from implementation_plan.md)

1. **Polish "Explore" tab** (probe → nice table → "Add to map" → Save)
2. **Full Logs browser** in the Sovereign inspector (`ai-inspector.html`)
3. **Better token usage estimation** (currently mostly 0 for streams)
4. **End-to-end testing** of the probe + map editing flow from the UI
5. **Cleaner launcher / one-command start** for development
6. **Documentation refresh** (current README is a mix of old ambitious prompt and partial spec)

## Recommended Next Steps (prioritized)

**DONE (May 2026 - DX focus)**

- Created `scripts/dev.js` + `npm run dev` / `npm run dev:full`
- Cleaned up README with realistic current instructions
- Created this STATUS.md

**Next priorities (updated 2026-06 during "finish" pass)**

1. ~~Improve the "Explore" tab experience (probe + add to map flow)~~ — Legacy duplicate probe section removed from Nodes tab. Explore tab is now the dedicated/primary flow. Add-to-map works (with tier guess + auto metrics refresh after add). Further UX (pre-add editor form) possible but functional.
2. ~~Finish/polish the Logs browser in both UIs~~ — Richer table (Time/Node/Tier/Status/Latency/Tokens + stream ⚡). Node + status filters (selects), row click → detail panel (preview, tokens, error, raw JSON). Scroll-to-bottom aware auto-pause ("frozen when scrolled up"). Clear + toggle. Server-side filter support already present; client re-filters current buffer.
3. ~~Make the Sovereign Node (`packages/models`) fully expose the same rich...~~ — Sovereign serves the unified `magistral/ui/index.html` (same as pilot) at / and /__inspector. Feature detection loads sovereign + magistral modules automatically. Full parity for metrics/disable/explore/logs via shared code. (Old ai-inspector.html now legacy.)
4. ~~Better error messages and onboarding when maps/blueprints are missing~~ — `scripts/launcher.js` and pilot `boot()` now emit clear warnings + actionable tips pointing at the Explore tab + editing `registry/maps/default.json`. Router throws descriptive exhaustion errors.

**Work completed during this "finish Magistral" pass** also included:
- Removed path duplication risk + legacy admin.html serving for __admin (now uses modern UI).
- Onboarding warnings in launcher/pilot.
- Small router comment clean.
- Docs/STATUS updates.
- Verified `npm test` + `npm run check` + router behavior.

---

**Last updated:** 2026-06 — "finish" pass (Explore polish, Logs browser, Sovereign parity via unified UI, onboarding).
