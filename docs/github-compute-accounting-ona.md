---
title: "Accounting GitHub Compute — ONA host polling"
date: "2026-10-17"
document_role: operational
document_kind: implementation-guide
visibility: public
lifecycle_state: working
---

# Accounting GitHub Compute — ONA integration

## What exists

- Operium ONA already runs an in-process job scheduler and accepts optional script jobs via `ONA_EXTRA_JOBS_JSON`; it is the sole scheduler needed here.
- Inseme `apps/platform/scripts/run-github-accounting-tick.js` consumes a host-local pending JSON projection, reads trusted GitHub issue comments using `gh api`, binds provider run and SHA to an existing reserved accounting obligation, and settles observed usage through the existing Supabase SQL.
- `apps/platform/mcp/cop/githubComputeAccountingQueue.js` persists job state with atomic rename. SQL accounting reservations and settlement events, **not the JSON file**, remain the durable financial authority.

## Opt-in runbook on fracta2 (not yet deployed)

1. Deploy the current Inseme and Operium versions through the normal managed checkout/update route.
2. Configure an existing ONA job (NOT a second daemon) with a 120-second tick; its script:
   `inseme/apps/platform/scripts/run-github-accounting-tick.js`.
   Use ONA `ONA_EXTRA_JOBS_JSON` (array with `job_id`, `kind:"script"`, `interval_ms:120000`, `enabled:true`, `config.script`, `config.cwd` and `config.env_files`). Reuse existing trusted env file(s) containing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SERVICE_KEY`, `COP_ACCOUNTING_POLL_ENABLED=1`, `COP_ACCOUNTING_PENDING_FILE`. Secrets remain entirely outside GitHub.
3. Ensure `gh` is authenticated on the host with read permission to the relevant issues; do not transfer the service-role key to GitHub Actions.
4. Seed only obligations which have already completed `reserve()` durably. Each pending entry must include `reserved:true`, `epoch_id`, `computation_id`, `run_id`, `repository`, `source_ref`, `issue_number`, `actor`, `usage_dimension`, `reservation_key=github-compute:<computation_id>:<run_id>`, `nextAtMs`. This queue projection is NOT itself a budget reservation.
5. Run synthetic smoke test first; verify an exact callback, observed metric, SQL settlement receipt and replay no-op. No live expense-bearing budget until validated.

## Invariants and current limits

- Never settle a job that was not reserved first.
- Replay is suppressed in the queue, but **durable deduplication** is provided by the transactional Supabase settlement RPC and its idempotency/event guards.
- Zero pending jobs: no GitHub call. ONA still invokes the local tick at its configured 120s cadence; that is cheap, not a network poll.
- The GitHub comment fetcher currently inspects the most recent page (up to 100 comments) and requires a `github-actions[bot]` authored result block. Older callbacks, alternate automation identities or pagination require a later tested extension.
- `runner_wall_seconds` is observed runtime, **not billable GitHub Actions minutes**. Unmeasured billed minutes do not get booked as zero.
- Current code **does not automatically register every newly submitted GitHub Compute job into the pending queue**. Operational wiring to the claim/submission control-plane, robust queue reconstruction after loss and production deployment remain open.
- Do not claim an ONA integration is deployed from a GitHub commit or green CI alone.

## Boundary

ONA remains the scheduler, Inseme owns accounting and the result consumer, Supabase records authoritative transactions, GitHub issues carry computational receipts. Operium inventory references the service and its env *paths*, not secrets.

## Trusted enrollment (implemented)

The host control plane must invoke the idempotent enrollment command **after**
the GitHub run id and issuing issue are known, rather than relying on the
GitHub Actions runner to carry Supabase credentials:

```sh
node apps/platform/scripts/run-github-accounting-tick.js enroll /path/to/approved-compute-obligation.json
```

The private JSON describes `epoch_id`, `budget_ref`, `unit`,
`maximum`, `computation_id`, `run_id`, `issue_number`,
`repository`, `source_ref`, `actor`, `usage_dimension`, and
`reservation_key=github-compute:<computation_id>:<run_id>`.
The command uses `COP_ACCOUNTING_PENDING_FILE` and existing Supabase
host credentials. It calls the **durable SQL reserve RPC first**, then writes
the pending queue projection; retries are idempotent.

A host-local originator is still responsible for invoking this command on
actual submission/claim. No automatic hook is installed yet in GitHub Actions:
the runner must **not** receive the service-role key. For production, protect
the private queue directory against concurrent writers or add a host-local
serializing lock before multiple producers are enabled.
