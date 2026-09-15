---
title: Inseme federated MCP
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

# Inseme federated MCP

One MCP server that **maximizes the visible and actionable tool surface** for ChatGPT, Claude, Grok,
Cursor, Codex, and other hosts:

| Surface      | Source of truth                                                             | Examples                                                        |
| ------------ | --------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Cogentia** | Cogentia MCP core (`cogentia-mcp-core.js`) — same catalog as `cogentia-mcp` | search, packs, skills, patterns, CLI catalog, resources/prompts |
| **Ritornu**  | this package                                                                | prepare Substack, normalize copy, handoff (no Git)              |
| **Hub**      | federation meta                                                             | `inseme_cockpit`, `inseme_list_surfaces`                        |

Issue memory: [inseme#26](https://github.com/JeanHuguesRobert/inseme/issues/26) (Ritornu) + corpus
tooling.

## Prefer this entrypoint

```bash
cd packages/brique-ritornu
node bin/inseme-mcp.js          # stdio — Claude / Cursor / Grok / Codex
node bin/inseme-mcp-http.js     # HTTP POST /mcp — remote / ChatGPT connectors
```

Ritornu-only remains available: `node bin/ritornu-mcp.js`.

## Host config (stdio)

```json
{
  "mcpServers": {
    "inseme": {
      "command": "node",
      "args": ["C:/tweesic/inseme/packages/brique-ritornu/bin/inseme-mcp.js"],
      "env": {
        "INSEME_MCP_SURFACE": "full",
        "COGENTIA_DAEMON_URL": "http://127.0.0.1:8790",
        "COGENTIA_MCP_VIEW": "public",
        "SUPABASE_URL": "https://YOUR.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "…",
        "RITORNU_STORAGE_BUCKET": "ritornu-private"
      }
    }
  }
}
```

### Environment

| Variable                    | Role                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| `COGENTIA_DAEMON_URL`       | Default `http://127.0.0.1:8790` — run `cogentia.js` daemon                                   |
| `COGENTIA_MCP_VIEW`         | `public` (default) or `full` (needs admin token)                                             |
| `COGENTIA_ADMIN_TOKEN`      | Full-view bearer to daemon                                                                   |
| `COGENTIA_MCP_ALLOW_OPS`    | Alias for `COGENTIA_MCP_ALLOW_MUTATE` (Cogentia mutate tools; still needs full view + admin) |
| `COGENTIA_MCP_ALLOW_MUTATE` | `1` to expose Cogentia mutate tools when view is `full`                                      |
| `COGENTIA_REPO_ROOT`        | Cogentia checkout (default: sibling `../cogentia` from this workspace)                       |
| `INSEME_MCP_SURFACE`        | `full` \| `cogentia` \| `ritornu`                                                            |
| `SUPABASE_*`                | Ritornu private captures (else session memory)                                               |
| `INSEME_MCP_TOKEN`          | Optional bearer for HTTP transport                                                           |

## Agent workflow (recommended)

1. **`inseme_cockpit`** — situational picture (both surfaces)
2. **Corpus** — `cogentia_search` → `cogentia_context_pack` → `cogentia_get_lines` (cite)
3. **Navigation** — `cogentia_guide_resolve`, `cogentia_issue_graph`, `cogentia_continuation_list`
4. **Maximum set** — `resources/list`, `skills/list`, `cogentia_pattern_list`,
   `cogentia_cli_catalog` (not `tools/list` alone)
5. **CLI mirrors** — `cogentia_grep`, `cogentia_docs_*`, `cogentia_concepts_*`
6. **Retrofit** (mandate) — `ritornu_prepare_substack` / `ritornu_normalize_provided` → human review
   → `ritornu_create_handoff` (patch only)

## Cogentia tools (high level)

The Inseme hub **does not keep a parallel Cogentia tool table**. `tools/list` is the live Cogentia
MCP public catalog (plus hub + Ritornu tools). Skills, patterns, prompts, and gated verbs are also
visible via `resources/list`, `skills/list`, and `cogentia_cli_catalog`.

Mutate tools (`continuation_emit` / `resolve`, `issues_sync`, `concepts_init`) stay off the
anonymous list unless Cogentia lockers allow them.

If the daemon is down, the catalog remains **visible**; daemon-backed calls return a clear error
with start hints. Local Cogentia methods (skills, patterns, catalog) still work.

## HTTP

```bash
set PORT=8793
set INSEME_MCP_TOKEN=long-secret
node bin/inseme-mcp-http.js
# POST http://127.0.0.1:8793/mcp
# GET  /health  /tools
```

## Tests

```bash
node --test ./tests/hub-mcp.test.js ./tests/mcp.test.js
```
