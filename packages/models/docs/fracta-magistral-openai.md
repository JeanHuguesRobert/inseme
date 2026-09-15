---
title: Fracta Magistral OpenAI Profile
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

# Fracta Magistral OpenAI Profile

This profile runs the Inseme unified AI server as a loopback-only Magistral router for Cogentia on
the Fracta VPS.

The first public Guide deployment uses OpenAI as the initial conversational provider. Provider keys
stay on the server. Browser code calls Cogentia, and Cogentia calls the loopback AI router.

```text
FractaVolta Guide
  -> Cogentia /guide/chat
  -> Cogentia /v1/chat/completions
  -> Magistral on 127.0.0.1:8880
  -> OpenAI-compatible provider
       (cloud OpenAI and/or Tailnet Agent CLI Gateway / coding agents)
```

## Secret authority: `inseme/.env`

**Canonical values** for Magistral provider keys live in **`inseme/.env`** (loaded by
`packages/models/src/ai.js` via dotenv). Other locations are **copies**:

| Location                                                 | Role                                                                                                                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `inseme/.env`                                            | Workstation **authority** (key names + values for dogfood)                                                                                                   |
| `/etc/cogentia/magistral.env`                            | Runtime **copy** for `magistral.service`                                                                                                                     |
| Tool-host secrets (ThinkPad, etc.)                       | Runtime **copy** for Agent CLI Gateway                                                                                                                       |
| **`instance_config` vault** (Supabase / Inseme platform) | Authority for **edge / Netlify** (no filesystem `.env`); fill via `push-env-to-vault` from workstation SoT — see `apps/platform/docs/CONFIGURATION_VAULT.md` |

Use the name **`COGENTIA_API_KEY` only** for the shared bearer (do not also store the same secret as
`AGENT_GATEWAY_TOKEN=`). Legacy names remain read aliases in code.

If a runtime copy **must** differ from `inseme/.env`, put a **comment immediately above** the
override explaining why. Do not silent-diverge.

**Naming:** Cogentia is the system; FractaVolta is a commercial deployment face. Shared bearer:
**`COGENTIA_API_KEY`** (legacy alias: `AGENT_GATEWAY_TOKEN`).

Required for coding-agent map nodes (`apiKeyEnv: "COGENTIA_API_KEY"`):

```text
# Authority: inseme/.env — copy to /etc/cogentia/magistral.env on fracta
COGENTIA_API_KEY=...same value as Agent CLI Gateway on ThinkPad...
```

Magistral builds the router key bag via `buildMagistralApiKeys()` so `COGENTIA_API_KEY` (and
map-declared `apiKeyEnv` names) are forwarded as `Authorization: Bearer …`.

## Environment

The service should use a dedicated map file rather than mutating the shared development default map:

```text
MAGISTRAL_API_KEY=local-loopback
MAGISTRAL_MAP_PATH=/etc/cogentia/magistral-openai-map.json
MAGISTRAL_INCLUDE_LOCAL_FALLBACK=false
OPENAI_API_KEY=...          # from inseme/.env (or documented override)
COGENTIA_API_KEY=...        # from inseme/.env (or documented override)
```

`MAGISTRAL_API_KEY` currently enables the embedded router inside `packages/models/src/ai.js`. It is
not exposed publicly in this profile.

Preferred public map template (Operium): `operium/profiles/magistral-map.coding-agents.v1.json`
(coding-agent nodes on ThinkPad + OpenAI as `tier: fallback`).

Example map:

```json
[
  {
    "id": "openai-fast",
    "url": "https://api.openai.com/v1/chat/completions",
    "model": "gpt-4o-mini",
    "tier": "fast",
    "weight": 10
  },
  {
    "id": "openai-strong",
    "url": "https://api.openai.com/v1/chat/completions",
    "model": "gpt-4.1-mini",
    "tier": "strong",
    "weight": 5
  }
]
```

Cogentia should force its chat model to `magistral`:

```text
COGENTIA_CHAT_MODEL=magistral
```

Without that setting, a surface-specific visible model such as `fractavolta-guide` may be forwarded
to the AI router and miss the Magistral routing branch.

## Quota

This profile is intentionally metered-provider aware:

- do not expose provider keys to browsers;
- keep Magistral loopback-only;
- route public answers through Cogentia retrieval first;
- keep fallback answers available when quota or provider access fails;
- add usage/billing monitoring later as a vendor-neutral service concern.
