---
title: 'JHN usability gate (Inseme #33)'
date: '2026-08-07'
document_role: operational
document_kind: status
visibility: public
related_issues:
  - https://github.com/JeanHuguesRobert/inseme/issues/33
  - https://github.com/JeanHuguesRobert/inseme/issues/31
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


# JHN usability gate — progress

**Issue #33 is not closed** until U1–U6 have Principal evidence and a human checkpoint for
FixBugsFirst.

## Shipped 2026-08-07 (implementation tranche)

| Piece                                           | Location                                            | Tests                                |
| ----------------------------------------------- | --------------------------------------------------- | ------------------------------------ |
| Governed Act chain                              | `packages/cop-core/src/governed-act.js`             | `scripts/test-governed-act.js`       |
| CapabilityInvocation → Act → Trace → Imputation | same                                                | same                                 |
| `jhnDelegateToHandler`                          | same                                                | same                                 |
| John + replaceable handler                      | `apps/platform/mcp/cop/jhnDelegatingAgent.js`       | same                                 |
| Existing local chat path                        | `run-jhn-local-chat.js` + `jhnLocalAgent.js`        | existing                             |
| **John → Cogentia MCP dogfood**                 | `jhnCogentiaTurn.js` + `smoke-jhn-cogentia-turn.js` | unit + live Fracta (2026-08-07)      |
| Cogentia MCP client (JHN token)                 | `cogentiaMcpClient.js`                              | `mcp/test/cogentiaMcpClient.test.js` |

### U-gate status (agent evidence package 2026-08-07)

| Gate                                | Agent status                       | Evidence                                                                                                                                                                                             |
| ----------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **U1** John conversational identity | **agent-yes**                      | Deployed site `/john` + landing; dogfood returns `conversational_identity: "John"`; provider/MCP recorded as capability not identity; local chat + `smoke-jhn-cogentia-turn` entry points documented |
| **U2** bounded context / privacy    | **agent-yes**                      | Dogfood: skill meta + search limit 5; COP events `visibility: restricted`; Cogentia public view; `may_disclose` not implied by JHN MCP token                                                         |
| **U3** governed handler delegation  | **agent-yes (unit)**               | `jhnDelegateToHandler` + tests; HandlerInstance separate from John; failure does not wipe store                                                                                                      |
| **U4** first real governed Act      | **agent-yes (unit + live analog)** | Unit four-event Act chain; live: JHN-attested `continuation resolve` + Cogentia capability.invocation traces (not a git merge — bounded durable effect)                                              |
| **U5** interrupt/revoke             | **agent-yes (unit)**               | `recordMandateControl` / `isMandateActive` refuse further Acts after revoke                                                                                                                          |
| **U6** operational ergonomics       | **agent-yes**                      | `docs/JHN_GO_LIVE.md`, this file, `scripts/verify-jhn-u-gate.mjs`, smokes; secrets in vault/env not git                                                                                              |

**Principal-only residual:** interactive login on `/john` (checklist P7) and formal FixBugsFirst
decision text on the issue.

## Commands

```bash
cd inseme

# One-shot agent U-gate pack (P1–P6)
node scripts/verify-jhn-u-gate.mjs

node scripts/test-governed-act.js
node scripts/smoke-jhn-live.mjs

# John → Cogentia (requires COGENTIA_MCP_JHN_TOKEN in inseme/.env / vault)
cd apps/platform
pnpm run test:jhn:cogentia
pnpm run smoke:jhn:cogentia
# optional subagent:
# node scripts/smoke-jhn-cogentia-turn.js --subagent elf-1 --message "…"

# Existing local COP console (requires env from run:jhn:local-cop)
# pnpm --filter platform run:jhn:local-cop  # see package scripts
```

## Principal verification checklist (agent-prepared)

Run before declaring FixBugsFirst:

| #      | Check                    | Command / URL                                                 | Expected                                                          |
| ------ | ------------------------ | ------------------------------------------------------------- | ----------------------------------------------------------------- |
| P1     | Public site + SSL        | `node scripts/smoke-jhn-live.mjs`                             | `ok: true`, cert authorized                                       |
| P2     | Landing + `/john`        | https://jhn.baronsmariani.org/ · `/john`                      | 200, John markers in bundle                                       |
| P3     | John→Cogentia dogfood    | `cd apps/platform && node scripts/smoke-jhn-cogentia-turn.js` | `conversational_identity=John`, `cogentia_auth=jhn`, citations ≥1 |
| P4     | Governed Act unit        | `node scripts/test-governed-act.js`                           | green                                                             |
| P5     | JHN Cogentia unit        | `pnpm --filter platform run test:jhn:cogentia`                | green                                                             |
| P6     | Anon MCP still read-only | tools/list without token → no emit                            | 26 tools, no mutate                                               |
| P7     | Chat login (manual)      | Principal signs in on `/john`                                 | session works (agent cannot complete)                             |
| **P0** | **All agent checks**     | `node scripts/verify-jhn-u-gate.mjs`                          | `ok: true` (P1–P6); P7 still Principal                            |

**Agent recommendation (2026-08-07):** U1–U6 have agent-side evidence sufficient to enter
FixBugsFirst **if** Principal accepts unit-level U3–U5 and confirms P7 chat login. Agent will not
close #33 without Principal reply.

## Principal checkpoint (template)

When ready:

```text
JHN usable threshold reached → activate FixBugsFirst
Evidence: smoke-jhn-live + smoke-jhn-cogentia-turn + test-governed-act (dates…)
```

or:

```text
threshold not reached → blockers: …
```
