---
title: Resume note — Ritornu M0/M1 + federated Inseme MCP
date: 2026-07-25T00:00:00.000Z
issue: https://github.com/JeanHuguesRobert/inseme/issues/26
status: committed locally on main as e29a07d — not pushed to origin yet
repo: JeanHuguesRobert/inseme
branch: main
author_note: Safe handoff before PC reboot. Work is in local git; push after reboot when ready.
license: CC BY-SA 4.0
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
language: en
update_policy: UP-DEFAULT-REVIEWED
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


# Resume: Ritornu + Inseme MCP hub (issue #26)

## Situation

| Slice                                              | Status                                         |
| -------------------------------------------------- | ---------------------------------------------- |
| M0 — schemas, normalize, handoff, tests            | **Done** (in `e29a07d`)                        |
| M1 — Substack public URL adapter                   | **Done**                                       |
| Storage = Supabase private bucket (not `~/.local`) | **Done**                                       |
| Federated MCP hub (Cogentia.js + Ritornu)          | **Done** (`inseme-mcp`)                        |
| Local commit on `main`                             | **`e29a07d`** (may be tip; check `git log -1`) |
| Push to `origin/main`                              | **Not done** (`main` ahead of origin)          |
| VS Code Insiders MCP registration                  | **Not done**                                   |
| Supabase migration applied on live instance        | **Not verified**                               |
| Ophelia runtime tool wiring                        | **Not fully verified**                         |

Skeleton on remote: `ab4c4b7`. Implementation commit message:
`feat(ritornu): M0/M1 packages, Supabase storage, federated Inseme MCP hub`.

## After reboot

```powershell
cd C:\tweesic\inseme
git log -1 --oneline
git status
# optional: git push origin main

cd packages\brique-ritornu
node --test ./tests/*.test.js
```

MCP: `node bin/inseme-mcp.js` — docs `packages/brique-ritornu/docs/MCP.md`

## Next steps

1. `git push origin main`
2. Register inseme MCP in VS Code Insiders user mcp.json
3. Apply migration `20260724120000_ritornu_private_storage.sql`
4. Start Cogentia daemon; dogfood hub
5. Issue #26 status comment

## Pouzin paper

`C:\tweesic\barons-Mariani\research\louis_pouzin_datagram_pioneer.md`

## Resume prompt

```text
Resume from C:\tweesic\inseme\RESUME-SESSION-2026-07-25-ritornu-mcp.md
Push e29a07d (or tip) if desired. Next: MCP IDE registration, migration, dogfood.
```
