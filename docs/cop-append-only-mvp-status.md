---
title: 'COP append-only + GitHub webhook — MVP status (issues #28 / #29)'
date: '2026-08-07'
document_role: operational
document_kind: status
visibility: public
lifecycle_state: active
related_issues:
  - https://github.com/JeanHuguesRobert/inseme/issues/28
  - https://github.com/JeanHuguesRobert/inseme/issues/29
license: CC BY-SA 4.0
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


# COP append-only + GitHub webhook — MVP status

## #28 status: **DONE**

## #29 status: **DONE (MVP)** (2026-08-07)

Software path complete: full subscription map, allowlist, activity feed, replay, reconcile helper,
edge allowlist, operator docs. **Live GitHub App install and production webhook hits remain operator
steps** (documented, not blocked on code).

## Shipped (#28 + #29)

| Surface                  | Location                                              | Evidence             |
| ------------------------ | ----------------------------------------------------- | -------------------- |
| #28 persistence          | migrations, spool, artifacts, edge RPC                | applied on JHN       |
| Full event subscriptions | `github-ingress.js` `GITHUB_EVENT_SUBSCRIPTIONS` (21) | unit tests           |
| Ingress decision         | `evaluateGithubIngress`                               | HMAC, allowlist, map |
| Activity feed            | `github-activity-feed.js`                             | unit + sim           |
| Delivery replay          | `github-delivery-replay.js`                           | unit                 |
| Reconcile gaps           | `github-reconcile.js`                                 | unit (inject list)   |
| Edge allowlist           | `GITHUB_REPO_ALLOWLIST`                               | edge function        |
| Operator doc             | `docs/github-webhook-ingress.md`                      | —                    |
| Local E2E sim            | `scripts/simulate-github-webhook-e2e.js`              | green                |

## #29 checklist

- [x] Explicit event subscription set + mapper coverage
- [x] Allowlist validation (code + edge env)
- [x] Activity-feed projection (private, rebuildable)
- [x] Delivery replay after mapper changes
- [x] Reconcile helper (injectable GitHub list)
- [x] Docs: delivery ≠ COP event ≠ activity feed
- [x] Tests: signature, idempotency, allowlist, map, visibility, unhandled
- [ ] Operator: create/install GitHub App + set Netlify secrets (human)
- [ ] Operator: provision `cop-artifacts` bucket if needed (human)
- [ ] Live production ping/push smoke (human after App install)

## Commands

```bash
cd inseme
node scripts/test-github-webhook-ingress.js
node scripts/test-github-activity-feed.js
node scripts/simulate-github-webhook-e2e.js
node scripts/test-deno-github-webhook-edge.js
```
