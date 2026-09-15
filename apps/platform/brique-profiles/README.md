---
title: Platform deployment profiles
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

# Platform deployment profiles

A brique manifest describes the capabilities a reusable module can offer. A deployment profile
declares the smaller set an instance is allowed to compile and deploy. This keeps instance policy
out of shared brique manifests and prevents an unrelated experimental capability from becoming a
deployment dependency merely because it exists in the monorepo.

## JHN

`jhn.json` is the initial profile for the personal John instance at `jhn.baronsmariani.org`.

- Core routes are the landing page, John conversation, and La Nasa.
- COP orchestration (`@inseme/cop-kernel` and `@inseme/cop-host`) is a required foundation, not a
  selectable brique. The compiler verifies that the host application declares both packages.
- The core Edge boundary is `nasa-control`; it verifies a John Supabase session, resolves the
  principal and optional delegates from the instance Vault, and deliberately exposes no action
  bridge.
- The John conversation uses Ophélia's Edge-native JHN adapter. It records the user turn and the
  answer through the capability-protected COP event boundary before returning the answer. Its civic
  routes, tools, collective-room runtime, and other Edge endpoints are intentionally not selected.

The compiler can inspect a profile without writing generated files:

```sh
cd apps/platform
node ../../packages/cop-host/scripts/compile-briques.js \
  --app platform \
  --profile brique-profiles/jhn.json \
  --report
```

`--report` is a validation and planning mode. A normal profile compilation generates only the
selected wrappers in `netlify/profiles/<profile-id>/`. For JHN, `build:jhn` regenerates
`chat-stream` and `nasa-control`, and Netlify is configured to bundle that directory rather than the
legacy global Edge-function directory.

The profile compiler intentionally leaves the shared frontend registry, public brique assets,
Magistral maps, and legacy Netlify outputs untouched. Frontend route minimization is a separate
increment: it must not be hidden inside a backend deployment change.

The JHN chat adapter reads `openai_api_key` and `jhn_cop_capability` from the instance Vault
(`instance_config`) after the existing service-role Supabase bootstrap. Netlify retains only
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for that bootstrap; it is not a second store for
John's application secrets. `JHN_COP_EVENT_URL` is optional: by default the adapter calls the
same-origin `jhn-cop-events` ingress, which is the only public-facing COP write boundary. No secret
is sent to the browser, and no chat turn is permitted without COP persistence.

Until that minimization is complete, `build:jhn` disables only esbuild minification for the JHN
bundle. This is a documented Windows/Node 24 workaround for a reproducible native crash after Vite
renders the current legacy bundle; source maps remain enabled and other profiles retain their normal
production minification.
