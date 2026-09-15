---
title: Tunnel Script - Quick Reference for AI Agents
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

# Tunnel Script - Quick Reference for AI Agents

## TL;DR

```bash
node inseme/apps/platform/scripts/tunnel.js --standalone --env-file path/to/.env --port PORT
```

The command above is an Inseme wrapper. The reusable runtime lives in:

```text
inseme/packages/cop-host/src/tunnel/runtime.js
```

## Essential Options

| Flag                | Purpose                   | When to Use                        |
| ------------------- | ------------------------- | ---------------------------------- |
| `--standalone`      | Disable Supabase          | Always for non-Inseme projects     |
| `--env-file <path>` | Specify .env file         | Always specify explicitly          |
| `--port <n>`        | Target app port           | Always specify                     |
| `--no-proxy`        | No sidecar proxy          | For simple cases                   |
| `--no-inspector`    | Disable local inspector   | For unattended runs                |
| `--terminal`        | Enable inspector terminal | Avoid unless local and intentional |

## Required Environment Variables

In the specified `--env-file`:

```bash
# One of these is required:
CLOUDFLARE_TUNNEL_TOKEN=xxx
# OR
NGROK_AUTH_TOKEN=xxx
```

## Expected Output

```
✅ Standalone mode: Reading tokens from .env/process.env
--- TUNNEL MODE: NGROK ---
ngrok url: https://xxxxx.ngrok-free.app
```

**The tunnel URL is on the line starting with "ngrok url:"**

Public tunnel URLs do not expose `/__inspector/*` by default. Do not use `--public-inspector` in
normal agent workflows.

## Common Patterns

### OAuth Testing (Most Common)

```bash
node inseme/apps/platform/scripts/tunnel.js \
  --standalone \
  --env-file /path/to/project/.env \
  --port 8080 \
  --no-proxy
```

### With Proxy Sidecar

```bash
node inseme/apps/platform/scripts/tunnel.js \
  --standalone \
  --env-file /path/to/project/.env \
  --port 8080
```

### Get Token from Vault (Inseme only)

```bash
cd inseme/apps/platform
node scripts/get-tunnel-token.js --env-file /path/to/target/.env
```

## For AI Coding Tasks

When asked to "add OAuth" or "enable external access":

1. Check if `.env` exists
2. Check for `NGROK_AUTH_TOKEN` or `CLOUDFLARE_TUNNEL_TOKEN`
3. If missing, use `get-tunnel-token.js` (if Inseme environment)
4. Start tunnel with `--standalone --env-file`
5. Parse output for tunnel URL
6. Update OAuth callback URL with tunnel URL

## Exit Codes

- `0` - Success (tunnel running)
- `1` - Error (check stdout)

## Signal Handling

- `Ctrl+C` - Graceful shutdown (stops tunnel, cleanup)
