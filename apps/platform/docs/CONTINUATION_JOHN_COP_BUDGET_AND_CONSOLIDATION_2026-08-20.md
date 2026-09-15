---
title: Continuation — John execution budget and Corpus consolidation
date: '2026-08-20'
status: paused
scope: Inseme COP core, local JHN runtime, cogentia john CLI contract
issue:
  - https://github.com/JeanHuguesRobert/cogentia/issues/112
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


# Continuation — John execution budget and Corpus consolidation

## Decision recorded

SQLite is **local working memory**, not the long-term Corpus of a Cogentia Digital Twin Instance. It
retains fine-grained execution traces long enough for recovery, incident investigation and
authorised handoff. Supabase/Corpus stores only an explicit consolidated receipt unless a mandate
and exposure policy call for more detail.

The retained local journal is append-only. Consolidation never rewrites it. The Corpus-facing
receipt contains the meaningful result, relevant artifacts, resource assessments, a local retention
deadline and an integrity hash over a bounded local event window. It excludes raw prompts, streamed
deltas and other working payloads by default.

## Implemented, uncommitted work

### Inseme

- Native resource assessment contract: measured, estimated with interval and confidence, or
  explicitly `not_estimated`. Subscription/quota usage never receives an invented USD valuation.
- In-memory and event-sourced execution-budget ledgers for steps, tools, subagents, elapsed time and
  external effects. Reservations use optimistic versions; uncertain forecasts are evidence, not
  capacity reservations.
- A local SQLite COP event-store adapter uses the existing `cop_events` table and stores complete
  COP envelopes in `metadata`. `BEGIN IMMEDIATE` protects topic sequencing/idempotency. No new
  SQLite table or migration was added.
- `cop.local-trace-consolidation.receipt.v1` and the explicit `LocalTraceConsolidated` Corpus event
  establish the local-to-Corpus boundary.
- `COP_ACCOUNTING.md` documents both the bounded execution budget and the working-trace /
  Corpus-consolidation doctrine.

Key files:

- `packages/cop-core/src/resource-assessment.js`
- `packages/cop-core/src/execution-budget.js`
- `packages/cop-core/src/local-trace-consolidation.js`
- `packages/cop-core/src/governed-act.js`
- `apps/platform/mcp/cop/sqliteRuntimeStore.js`
- `packages/cop-core/COP_ACCOUNTING.md`

### Cogentia

The first headless `john` CLI contract is uncommitted in `C:\tweesic\cogentia`:

- `node scripts/john.js run --request <file> --format ndjson|human`
- request schema includes principal, mandate, budget, exposure and bounded execution dimensions;
- current handler is deliberately `mock.echo` only; no provider, tool or external effect is
  connected yet;
- NDJSON ends with one terminal event.

## Verification already run

From `C:\tweesic\inseme`:

```powershell
node --test apps/platform/mcp/test/localTraceConsolidation.test.js apps/platform/mcp/test/sqliteExecutionBudgetEventStore.test.js apps/platform/mcp/test/eventSourcedExecutionBudget.test.js apps/platform/mcp/test/executionBudget.test.js apps/platform/mcp/test/resourceAssessment.test.js apps/platform/mcp/test/jhnDelegatingAgentPacket.test.js
```

Result: 12 passing tests. Node prints its known experimental SQLite warning.

Also passed:

```powershell
node -e "JSON.parse(require('node:fs').readFileSync('packages/cop-core/schemas/local-trace-consolidation.receipt.v1.json', 'utf8'))"
git diff --check -- packages/cop-core/COP_ACCOUNTING.md packages/cop-core/src/local-trace-consolidation.js packages/cop-core/schemas/local-trace-consolidation.receipt.v1.json apps/platform/mcp/test/localTraceConsolidation.test.js apps/platform/mcp/cop/sqliteRuntimeStore.js
```

From `C:\tweesic\cogentia`:

```powershell
node scripts/test-john.js
node scripts/john.js run --request scripts/fixtures/john-request-example.json --format ndjson
git diff --check
```

These passed before the pause.

## Exact next increment

Integrate execution-budget reservation into the real governed delegation path, before any
consequential handler runs:

```text
mandate check
→ reserve enforceable execution dimensions
→ invoke handler
→ record CapabilityInvocation / Act / Trace / Imputation
→ settle observed use, or release on refusal/failure
```

Use the event-sourced ledger. A version conflict must cause re-read/retry or a smaller bounded
slice; it must not be treated as proof that the work is impossible. A manifestly unavailable
required capability must fail closed. Do not connect a provider or write external effects in this
increment unless a specific mandate and budget path is supplied.

After that, wire the explicit `LocalTraceConsolidated` receipt to the selected Corpus adapter. Do
not automatically replicate local event detail to Supabase.

## Progress after resumption

- `apps/platform/mcp/cop/jhnDelegatingAgent.js` now requires an explicit bounded execution budget
  before invoking a delegated handler. It creates or accepts the event-sourced ledger, reserves
  before invocation, settles measured local use after success, and releases the reservation after a
  handler failure. Missing budget, exhausted capacity, inactive mandate, and a missing required
  handler capability all produce a refusal without invoking the handler.
- `apps/platform/mcp/test/jhnDelegatingAgentPacket.test.js` covers the successful
  reservation/settlement path, the missing-budget fail-closed path, and release after handler
  failure.
- Verification after resumption: the 14 focused COP/accounting/runtime tests listed above pass;
  `git diff --check` passes for the affected files. Node continues to emit its known experimental
  SQLite warning.

The next increment remains the explicit `LocalTraceConsolidated` handoff to a selected Corpus
adapter under a separate mandate/exposure decision. No provider, Supabase write, or external effect
was connected in this resumption.

## Worktree boundary

Do not stage or discard unrelated changes already present in `inseme`, notably:

- `packages/cop-core/src/packet.ts`
- `packages/cop-kernel/src/Cop-kerneltasks.js`
- `packages/cop-kernel/test/cognitivePacketRealityRoundtrip.test.js`
- `sandbox/cop-continuation-bac-a-sable/`

The files listed above under “Implemented, uncommitted work” and the listed Cogentia `john` files
are this increment. No commit, push, deployment, Supabase write or external provider call was
performed.

## Resume

1. Read this packet and `apps/platform/mcp/cop/AGENTS.md`.
2. Inspect both worktrees before editing; retain the worktree boundary above.
3. Re-run the verification commands before extending the governed delegation path.
4. Continue against cogentia issue #112 without creating child issues unless a genuinely independent
   mandate emerges.
