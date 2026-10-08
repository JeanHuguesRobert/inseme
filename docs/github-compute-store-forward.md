---
title: "Compute callback Store & Forward"
date: "2026-10-08"
document_role: operational
document_kind: implementation-guide
visibility: public
lifecycle_state: working
---

# Store & Forward for GitHub Compute receipts

`compute.batch` has two independently observable outcomes: **computation status** and **callback delivery status**. A compute failure is not a GitHub Actions infrastructure failure, and a GitHub API callback failure must not trigger a second computation.

## Workflow

1. Run the requested computation or recover any handled parse, checkout, admission, execute or formatting exception into `cop.compute-result/v1`.
2. The trusted finalizer `scripts/github-compute-finalize.js` builds `cop.compute-outbox/v1` with `computation_id`, Issue target, idempotency marker and the complete structured result. It writes `pending.json` before attempting GitHub callback delivery.
3. Before posting, check for an existing callback bearing the same computation marker; if already posted, mark delivered. On successful post, rename `pending.json` to `delivered.json`.
4. If the callback fails, GitHub Actions uploads `pending.json` as an artifact named `compute-outbox-<run-id>-<attempt>`, retained for 30 days. The job still concludes success for handled errors. GitHub platform cancellation/outage or checkout failure before the finalizer is available remain exceptions to this guarantee.
5. Recover by running [Compute Outbox Forward](https://github.com/JeanHuguesRobert/inseme/actions/workflows/compute-outbox-forward.yml) with `source_run_id`. It downloads the outbox artifact and invokes `scripts/github-compute-forward.js` to check marker and attempt delivery. It **does not rerun the original compute**.

This is a bounded GitHub-hosted spool, not an independent durable queue. Actions artifact retention, GitHub API availability, missing authorizations and rate limits still constrain delivery. Persisting outbox content to an independent durable COP Store is the stronger follow-up, with scheduled bounded retry and delivery receipts.

Do not conflate status:
- `execution_receipt.status: completed|failed|refused` — operation semantics.
- `delivery: delivered|pending` — transport semantics.
- GitHub workflow conclusion: success for handled application errors; runner may remain unavailable during a GitHub outage.

The implementation is at:
- https://github.com/JeanHuguesRobert/inseme/blob/main/scripts/github-compute-finalize.js
- https://github.com/JeanHuguesRobert/inseme/blob/main/scripts/github-compute-forward.js
- https://github.com/JeanHuguesRobert/inseme/blob/main/.github/workflows/compute-batch-reality-test.yml
- https://github.com/JeanHuguesRobert/inseme/blob/main/.github/workflows/compute-outbox-forward.yml

## Remaining verification
- Deliberately break source checkout and confirm one failed receipt, success job and no duplicate callback.
- Simulate GitHub API publication failure and verify `pending.json` is uploaded.
- Replay same outbox twice to prove no second issue comment.
- Make transport state durable outside Actions and add automatic retry with bounded backoff; avoid polling storms.
