---
title: Configuration Vault (`instance_config`)
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

# Configuration Vault (`instance_config`)

**Status:** canonical (2026-07)  
**Scope:** every Inseme / platform Supabase instance (Pertitellu, JHN, future personal or civic)

---

## Why this exists (remember this)

Without a vault, every new API key had to be copy-pasted into the **Netlify UI** (and again for
previews, other sites, other instances). That was operational hell: easy to forget, easy to mix
projects (e.g. Pertitellu vs JHN), impossible to review in git, painful for multi-instance.

**The vault was built so Netlify only needs the minimum bootstrap credentials**, while the full set
of keys and identity config lives in the instance database and is shared by all runtimes that can
reach that project.

```text
Workstation SoT:  inseme/.env
        │  (includes COGENTIA_API_KEY — Cogentia system bearer;
        │   FractaVolta is a commercial deploy face, not a separate secret namespace)
        │  push-env-to-vault / loadConfig align
        ▼
Supabase table:   public.instance_config   ← "the vault"
        │  Edge functions MUST use the vault: they have no inseme/.env filesystem.
        ▲
        │  service_role client reads full table
        │
   ┌────┴────┬──────────────────┬─────────────────────┐
   │ Local   │ Netlify Node     │ Netlify Edge (Deno) │
   │ Vite /  │ functions/       │ edge-functions/     │
   │ scripts │ (legacy Node)    │ (modern Deno)       │
   └─────────┴──────────────────┴─────────────────────┘
```

| Runtime                                                | How it gets secrets                                | Bootstrap outside vault                                          |
| ------------------------------------------------------ | -------------------------------------------------- | ---------------------------------------------------------------- |
| **Local** (Vite, scripts)                              | `.env` and/or vault if `SERVICE_ROLE` present      | Full `.env` is fine for dogfood                                  |
| **Netlify Functions** (`netlify/functions/`, **Node**) | `instanceConfig.backend.js` → admin client → vault | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` of **this** project |
| **Netlify Edge** (`netlify/edge-functions/`, **Deno**) | `instanceConfig.edge.js` → admin client → vault    | Same two vars in Netlify env                                     |

Public HTTP config endpoints **must not** expose `is_secret=true` rows (code filter + RLS).

---

## Design principles

1. **One vault per Supabase project** — never share Pertitellu secrets into JHN or the reverse.
2. **Workstation → vault is a full copy of real capabilities** — every non-empty, non-placeholder
   key available in `inseme/.env` should be pushable (`push-env-to-vault --apply`).
3. **Empty / placeholders stay empty** — e.g. `ANTHROPIC_API_KEY=` or `your_…` must not be stored as
   a fake key (code would believe the provider is configured).
4. **Netlify stays thin** — only bootstrap to open the vault; not a second secret spreadsheet.
5. **Migrations for public/identity schema seeds** — CLI `supabase/migrations/`; secrets never
   committed in migration SQL (use the push script).

---

## Table (conceptual)

See live migrations under `apps/platform/supabase/migrations/` for the authoritative DDL.

Important columns:

| Column                 | Role                                                     |
| ---------------------- | -------------------------------------------------------- |
| `key`                  | Normalized name (`openai_api_key`, not `OPENAI_API_KEY`) |
| `value` / `value_json` | Payload                                                  |
| `is_secret`            | Never serve to browsers / public config API              |
| `is_public`            | Safe for public config snapshot                          |
| `category`             | identity, branding, features, secrets, …                 |

RLS (JHN+): secret rows are **not** readable by `anon` / `authenticated`. **Service role** bypasses
RLS (edge/backend admin path).

---

## Day-to-day commands

```powershell
cd C:\tweesic\inseme\apps\platform

# Dry-run: what would go to the vault
node scripts/push-env-to-vault.js

# Complete copy of non-empty / non-placeholder .env keys → vault
node scripts/push-env-to-vault.js --apply --verbose

# Schema / public seed only (no secrets in git)
supabase db push
supabase migration list
```

Source implementation:

- CLI push / env mapping: `apps/platform/scripts/lib/config.js`, `scripts/push-env-to-vault.js`
- Frontend: `@inseme/cop-host` + `instanceConfig.client.js`
- Node functions: `packages/cop-host/src/config/instanceConfig.backend.js` + `runtime/function.js`
- Deno edge: `packages/cop-host/src/config/instanceConfig.edge.js` + `runtime/edge.js`

---

## Netlify: two function families

Netlify has (names vary in docs):

1. **Serverless / Functions** — traditionally **Node.js** → our `netlify/functions/`
2. **Edge Functions** — **Deno** → our `netlify/edge-functions/`

Both should load config through the vault after bootstrapping with the **same project’s** service
role. Prefer the matching adapter (`backend` vs `edge`); avoid importing Node-only modules from Deno
edge.

---

## Instance lifecycle (mental model)

```text
1. Create blank Supabase project
2. CLI migrations (schema + public identity seed)
3. inseme/.env → JHN URL + service_role + all workstation keys
4. push-env-to-vault --apply
5. Netlify site env: only SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (+ build vars)
6. Local: pnpm platform:dev against same project
```

Personal instance dogfood: `docs/RUNBOOK_JHN_PERSONAL_INSTANCE.md`.  
Multi-instance overview: `docs/ARCHITECTURE_MULTI_INSTANCE.md`.  
Provisioning: `docs/PROVISIONING_GUIDE.md` (step-vault).

---

## Anti-patterns

| Don't                                             | Do                                                                |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| Paste every API key into Netlify UI               | Vault + thin Netlify bootstrap                                    |
| Copy vault rows between Supabase projects blindly | Per-project push from that instance’s SoT                         |
| Store `your_anthropic_key_here` in vault          | Leave empty until real key exists                                 |
| Commit secrets in SQL migrations                  | `push-env-to-vault` only                                          |
| Use Pertitellu service_role with JHN URL          | Always pair URL + keys of one project                             |
| Push `HTTP_PROXY` / `VITE_PROXY_URL` into vault   | Keep proxies **workstation-only** (CSP + dogfood break otherwise) |

---

## OpenAI keys (inference vs admin usage)

| Env                | Vault key          | Role                                                                                                                                                                   |
| ------------------ | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`   | `openai_api_key`   | Chat, embeddings, normal API (project key)                                                                                                                             |
| `OPENAI_ADMIN_KEY` | `openai_admin_key` | **Organization Admin API** only — usage/costs (`api.usage.read`). **Not** for chat completions. Create at https://platform.openai.com/settings/organization/admin-keys |

Fill `openai_admin_key` in the JHN vault (or `OPENAI_ADMIN_KEY=` in `inseme/.env` then
`push-env-to-vault --apply`) after creating the Admin key. Do not put the admin key on Fracta unless
a usage-snapshot job needs it.

## Agent JHN WhatsApp (John / personal twin)

Config for the Cogentia WhatsApp adapter lives in the **JHN** vault (project `ndiysuh…`), not
Pertitellu. Env → vault keys (via `ENV_KEY_MAPPING` in `scripts/lib/config.js`):

| Env                                      | Vault key                                | Notes                                          |
| ---------------------------------------- | ---------------------------------------- | ---------------------------------------------- |
| `AGENT_JHN_WHATSAPP_ALLOWED_SELF_JID`    | `agent_jhn_whatsapp_allowed_self_jid`    | PII — `is_secret`                              |
| `AGENT_JHN_WHATSAPP_PREFERRED_SELF_PEER` | `agent_jhn_whatsapp_preferred_self_peer` | Message-yourself `@lid` — `is_secret`          |
| `AGENT_JHN_WHATSAPP_STATE_DIR`           | `agent_jhn_whatsapp_state_dir`           | Workstation path — `is_secret`                 |
| `AGENT_JHN_WHATSAPP_MODE`                | `agent_jhn_whatsapp_mode`                | e.g. `self_chat_only`                          |
| `AGENT_JHN_WHATSAPP_SEND_ENABLED`        | `agent_jhn_whatsapp_send_enabled`        | Prefer `false` in vault; enable only for tests |
| `AGENT_JHN_WHATSAPP_NOTICE_URL`          | `agent_jhn_whatsapp_notice_url`          | Public disclosure URL                          |
| `AGENT_JHN_WHATSAPP_USAGE_GRANT_ID`      | `agent_jhn_whatsapp_grant_id`            | Governance id                                  |
| `AGENT_JHN_WHATSAPP_MANDATE_ID`          | `agent_jhn_whatsapp_mandate_id`          | Governance id                                  |

**Not in vault (by design):** Baileys session files under `STATE_DIR/baileys-auth/` (noise keys,
multi-device creds). Those stay on the principal’s machine / registry runtime disk
(`registre-mariani/runtime/…`). Re-pair on a new host instead of shipping session material through
the vault unless a dedicated encrypted session-export path is designed later.

Category: `integrations`. Push: `node scripts/push-env-to-vault.js --apply` from `apps/platform`
with JHN `SUPABASE_*` in `inseme/.env`.

## Related

- `apps/platform/scripts/push-env-to-vault.js`
- `apps/platform/scripts/sync-secrets.js` (hygiene / dry-run; `.env` remains SoT on workstation)
- `apps/platform/docs/RUNBOOK_JHN_PERSONAL_INSTANCE.md`
- Cogentia: `docs/agent-jhn-whatsapp-mvp.md`
- `apps/platform/docs/ARCHITECTURE_MULTI_INSTANCE.md` (section vault / Netlify thin env)

---

_Last updated: 2026-07-20 — rewrote obsolete Survey-era notes; records “avoid Netlify key hell”
rationale and Node vs Deno edge paths._
