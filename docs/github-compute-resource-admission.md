---
title: "GitHub Compute Resource Admission and Before/After Accounting"
date: "2026-10-08"
document_role: operational
document_kind: implementation-guide
visibility: public
lifecycle_state: working
---

# Resource accounting for GitHub Compute

Scope: https://github.com/JeanHuguesRobert/inseme/issues/89 ; used by #120/#121.

The GitHub Actions typed-compute adapter now attaches `cop.compute-resource-receipt/v1` to every handled `cop.compute-result/v1` (including refused, failed and completed results). It contains:

- `before`: provider resource observations prior to the user computation.
- `admission`: `admitted | deferred | refused`, deficits, unknowns and quota policy.
- `after`: second provider resource observation after computation.
- `usage`: wall-clock seconds measured across the adapter interval; Actions billed minutes remain unknown unless a trusted usage provider is integrated.
- `execution_status`: `completed | failed | not_started`.

## Distinct dimensions

1. **Provider quotas**: GitHub API REST core rate limit may be observed using `gh api rate_limit` with workflow token. This is a rate-limit bucket; it is not Actions runtime minutes, artifact storage, a billing balance, or a monetary budget. Missing/failed probes produce `not_estimated`.
2. **Actions-minute availability**: current adapter cannot independently retrieve the authoritative remaining Actions-minute quota. An optional explicitly configured `GITHUB_COMPUTE_AVAILABLE_MINUTES` is an *operator-provided bound*, not certified GitHub balance. Do not present it as authenticated provider truth. Without it, `actions_minutes` is `not_estimated`.
3. **COP mandate and budgets**: remain separate checks, neither inferred nor granted by provider quota snapshots. The receipt explicitly records `mandate_check: separate_required` and `budget_check: separate_required`.
4. **Actual usage**: current runner wall elapsed seconds are measurable; billed Actions minutes, final ledger settlement, bytes transferred, polling, storage and provider costs need dedicated meters. Do not silently replace missing values with zero.

## Admission

Before checking out the pinned computation source, the **trusted adapter** checks configured quotas. The current request reserves an upper estimate of `ceil(timeout_seconds / 60)` Actions minutes, plus configurable recovery reserve (`GITHUB_COMPUTE_RECOVERY_RESERVE_MINUTES`), and 2 REST API requests plus 5 reserve requests.

Known deficit → `refused` before computation, with structured non-success receipt.
Unknown dimension → `deferred` under `GITHUB_COMPUTE_UNKNOWN_QUOTA_POLICY=conservative`; otherwise `admitted` with an explicit unknown list and `policy=allow_unknown` (currently default for compatibility).

**Important limitation:** allowing unknown is not a hard quota guarantee, and this admission is per-run rather than globally atomic. Two concurrent runs may both admit against the same remaining balance. A robust provider budget gate requires durable reservations/settlements and a provider quota authority (Issue #89 and COP/Accounting).

Exceptions and quota refusal return structured results without turning expected capacity refusals into GitHub Actions infrastructure-failure notifications. Actual checkout, API callback and authentication failures remain visible.

## Reproduction

The resource admission pure policy is implemented and tested at:
- https://github.com/JeanHuguesRobert/inseme/blob/main/scripts/github-compute-resources.js
- https://github.com/JeanHuguesRobert/inseme/blob/main/scripts/github-compute-resources.test.js

Workflow integration:
- https://github.com/JeanHuguesRobert/inseme/blob/main/scripts/github-compute-resource-cli.js
- https://github.com/JeanHuguesRobert/inseme/blob/main/.github/workflows/compute-batch-reality-test.yml

This does not replace provider selection in Magistral nor COP's authority/budget semantics.
