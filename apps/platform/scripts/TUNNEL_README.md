---
title: Universal Tunnel Script
author: unknown
date: '2026-07-05'
document_role: source
document_kind: documentation
visibility: public
lifecycle_state: working
update_policy: UP-DEFAULT-REVIEWED
provenance:
  origin_type: repository
  origin_repository: JeanHuguesRobert/inseme
  origin_ref: 1f30be5
  origin_date: '2026-07-05'
  derived_from: []
review:
  status: unreviewed
  reviewed_by: []
license: CC BY-SA 4.0
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
language: en
status: working-paper
---


# Universal Tunnel Script

Standalone tunnel runtime for development OAuth testing and public access. Originally part of
Inseme, now reusable by any project through `@inseme/cop-host/tunnel`.

## Features

- **Dual mode**: Inseme mode (with Supabase) or Standalone mode (without)
- **Two tunnel providers**: Cloudflare (preferred) or Ngrok (fallback)
- **Proxy sidecar**: Optional stable proxy on port+1
- **Inspector UI**: Web interface at `http://localhost:proxy_port/__inspector`
- **Health checks**: Automatic tunnel monitoring and restart

## Installation

No installation needed inside the Inseme workspace. The reusable runtime is in
`packages/cop-host/src/tunnel/runtime.js`.

The historical command still works through the Inseme wrapper:

```bash
node inseme/apps/platform/scripts/tunnel.js --standalone --env-file path/to/.env --port 8080
```

Runtime dependencies (declared by `@inseme/cop-host`):

- `ngrok` - npm package
- `qrcode` - npm package
- `dotenv` - npm package
- `@supabase/supabase-js` - only in Inseme mode

## Quick Start

### Standalone Mode (for SimpliWiki or other projects)

```bash
node inseme/apps/platform/scripts/tunnel.js --standalone --env-file path/to/.env --port 8080
```

### Inseme Mode (with Supabase)

```bash
node inseme/apps/platform/scripts/tunnel.js --port 8888
```

## Options

| Option                      | Description                                           | Default                           |
| --------------------------- | ----------------------------------------------------- | --------------------------------- |
| `--standalone`              | Enable standalone mode (no Supabase)                  | `false`                           |
| `--env-file <path>`         | Path to .env file in standalone mode                  | `ROOT_DIR/.env`                   |
| `--port <number>`           | Local app port                                        | `8888` (Inseme) / `8080` (Simpli) |
| `--proxy-port <number>`     | Proxy sidecar port                                    | `port + 1`                        |
| `--proxy`                   | Enable proxy sidecar                                  | `true`                            |
| `--no-proxy`                | Disable proxy sidecar, tunnel direct                  | -                                 |
| `--force`                   | Force start even if proxy running                     | -                                 |
| `--room <slug>`             | Supabase room slug                                    | `cyrnea`                          |
| `--redirect`                | Enable redirect on deployed instance                  | -                                 |
| `--off`                     | Stop tunnel and cleanup metadata                      | -                                 |
| `--verbose`                 | Show all traffic                                      | -                                 |
| `--debug`                   | Show debug information                                | -                                 |
| `--slow <ms>`               | Simulate latency                                      | -                                 |
| `--inject "H: V"`           | Inject HTTP header                                    | -                                 |
| `--no-inspector`            | Disable local inspector routes                        | -                                 |
| `--public-inspector`        | Allow inspector through public tunnel only with token | -                                 |
| `--inspector-token <token>` | Token required with `--public-inspector`              | `TUNNEL_INSPECTOR_TOKEN`          |
| `--terminal`                | Enable local inspector terminal                       | disabled                          |
| `--help, -h`                | Show help message                                     | -                                 |

## Environment Variables

### Standalone Mode

```bash
# Cloudflare (preferred)
CLOUDFLARE_TUNNEL_TOKEN=your_token
CLOUDFLARE_DOMAIN=your_domain.com

# Ngrok (fallback)
NGROK_AUTH_TOKEN=your_token

# Optional (for proxy updates)
# HTTP_PROXY and HTTPS_PROXY are auto-managed
```

### Inseme Mode

All standalone variables plus:

```bash
# Supabase (required)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# Optional (from vault)
# cloudflare_tunnel_token, ngrok_auth_token, etc.
```

## Usage Examples

### Example 1: SimpliWiki with OAuth

```bash
# 1. Get tunnel token from vault
cd inseme/apps/platform
node scripts/get-tunnel-token.js --env-file C:/tweesic/simpli/.env

# 2. Start tunnel
node scripts/tunnel.js --standalone --env-file C:/tweesic/simpli/.env --port 8080

# 3. Update GitHub callback URL with the tunnel URL shown
# GITHUB_CALLBACK_URL=https://xxxx.ngrok-free.app/auth/github/callback

# 4. Start SimpliWiki
cd C:/tweesic/simpli
node lib/main.js
```

### Example 2: Direct proxy to app

```bash
# No proxy sidecar, direct tunnel to port 3000
node tunnel.js --standalone --port 3000 --no-proxy
```

### Example 3: With custom proxy port

```bash
# Proxy on port 9000, tunnel to port 8080
node tunnel.js --standalone --port 8080 --proxy-port 9000
```

### Example 4: Inseme development

```bash
# Full Inseme mode with Supabase integration
node tunnel.js --port 8888 --redirect
```

## Inspector UI

When proxy is enabled, access the inspector at:

```
http://localhost:PROXY_PORT/__inspector
```

Features:

- **Status**: Tunnel status, URL, target connectivity
- **Traffic**: HTTP traffic history (last 100 requests)
- **Stats**: Request count, bytes transferred, errors
- **Terminal**: Interactive shell in browser
- **Controls**: Toggle tunnel, toggle proxy, reset stats
- **QR Code**: Scan to open tunnel URL on mobile

Security:

- Inspector routes are local-only by default.
- Public tunnel access to `/__inspector/*` and `/__exit` returns `403`.
- The browser terminal is disabled unless `--terminal` is explicit.
- Do not use `--public-inspector` unless you also set a strong inspector token and understand the
  exposure.

## Health Check

The tunnel provides a health endpoint:

```
http://localhost:PORT/__health
```

Returns: `TUNNEL_OK`

Used for automatic tunnel verification.

## Proxy Environment Variables

When proxy sidecar is enabled, the script automatically sets:

```bash
HTTP_PROXY=http://localhost:PROXY_PORT
HTTPS_PROXY=http://localhost:PROXY_PORT
VITE_PROXY_URL=http://localhost:PROXY_PORT/
```

Your app can use these for proxying outgoing requests.

## Output

```
✅ Standalone mode: Reading tokens from .env/process.env

--- TUNNEL MODE: NGROK ---
--- START TIME: 21:20:15 ---
ℹ️  Standalone mode: Skipping Supabase operational tests

📱 Scan this QR code to onboard/open app:
[QR CODE]

ngrok url: https://xxxx.ngrok-free.app
```

## Exit Codes

- `0` - Normal exit
- `1` - Error (missing tokens, Supabase connection failed, etc.)

## Troubleshooting

### "Either CLOUDFLARE_TUNNEL_TOKEN or NGROK_AUTH_TOKEN must be provided"

Add to your `.env`:

```bash
NGROK_AUTH_TOKEN=your_token_here
# Get token at: https://dashboard.ngrok.com/get-started/your-authtoken
```

### "Supabase connection FAILED" (Inseme mode only)

Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`.

### Tunnel URL not accessible

1. Check firewall settings
2. Verify ngrok/cloudflare account status
3. Try `--verbose` to see traffic logs

### Port already in use

Use `--force` to override, or kill the existing process:

```bash
netstat -ano | findstr :8080  # Windows
lsof -ti:8080 | xargs kill -9  # Linux/Mac
```

## For AI Agents

When using this script from an AI agent:

1. **Always use `--standalone`** unless working on Inseme itself
2. **Specify `--env-file`** explicitly to avoid confusion
3. **Use `--no-proxy`** for simple cases (no sidecar needed)
4. **Read tunnel URL** from stdout - look for "ngrok url:" or the domain shown
5. **Do not enable `--public-inspector`** in agent workflows

### Minimal Example

```bash
# From project directory
node ../inseme/apps/platform/scripts/tunnel.js \
  --standalone \
  --env-file .env \
  --port 8080 \
  --no-proxy
```

Output includes the public tunnel URL - use this for OAuth callbacks.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Public URL     │────▶│ Tunnel (Ngrok/CF)│────▶│ Proxy (8081)│
│ (ngrok/free.app)│     │  (External)      │     │   Sidecar    │
└─────────────────┘     └──────────────────┘     └──────┬──────┘
                                                     │
                                                     ▼
                                              ┌─────────────┐
                                              │ Your App    │
                                              │  (port 8080) │
                                              └─────────────┘
```

Without proxy:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Public URL     │────▶│ Tunnel (Ngrok/CF)│────▶│  Your App   │
│ (ngrok/free.app)│     │  (External)      │     │  (port 8080)│
└─────────────────┘     └──────────────────┘     └─────────────┘
```

## License

Same parent repository license.

## Contributing

When modifying this script:

1. **Test both modes**: `--standalone` and Inseme mode
2. **Keep English messages**: For AI agent readability
3. **Update this README**: Document new options
4. **Preserve backward compatibility**: Existing Inseme usage must work

## See Also

- [inseme/docs/PROXY_TUNNEL.md](../inseme/docs/PROXY_TUNNEL.md) - Architecture details
- [survey/scripts/set-ngrok.js](../survey/scripts/set-ngrok.js) - Simpler ngrok-only script
