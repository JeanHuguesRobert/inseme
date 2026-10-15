---
title: "Issue #120 — E5 atomic claim integration audit"
date: "2026-10-15"
document_role: technical-decision
status: proposed
related_issues:
  - "https://github.com/JeanHuguesRobert/inseme/issues/120"
  - "https://github.com/JeanHuguesRobert/inseme/issues/121"
---

# Reuse E5 for compute.batch, without overstating its guarantees

## Source audit

- `.github/workflows/e5-shared-claim-reality-test.yml` performs an exclusive Git ref creation with GitHub `git/refs`. The E5 observation was one `claimed` handler and one `contended` handler across two jobs.
- `docs/e5-independent-handler-atomic-claim.md` explicitly limits the proof to one-shot exclusive ref creation and no external business effect.
- `docs/e6-effect-lease-fencing.md` says lease epochs are *preflight only*, and provider-atomic effect fencing remains required for irreversible writes.
- `.github/workflows/compute-batch-reality-test.yml` currently has a *read-then-check* idempotency step (searching Issue comments for a result marker). This prevents sequential replay **after receipt delivery**, not two concurrent runs which both check before either result appears.
- `scripts/github-compute-finalize.js` prevents an idempotent skip from minting a synthetic error after the #144 fix; its marker test is a callback dedupe, not a claim before execution.

## Decision

**Reuse the E5 mechanism, not its hardcoded test tag or test workflow.** The compute system needs a stable per-`computation_id` reservation before resource admission / source checkout / execution. A globally exclusive creation of `refs/tags/cop-compute-claim-<hash-of-repo-issue-id>` is a candidate first implementation for same-repository, one-shot requests, but NOT an exactly-once guarantee. Never treat a failed ref-create call automatically as contention: check the ref independently; classify ambiguous provider errors as deferred.

### Required states and invariants

| Outcome | Allowed next action |
| --- | --- |
| existing terminal result | return/reuse authoritative result; do not compute |
| atomic reservation won | persist ExecutionBinding, then enter bounded execution |
| atomic reservation lost | do not execute; observe current holder and reconcile |
| reservation API unavailable | defer without execution |
| reserved but no terminal result | reconcile provider run ID; do not blindly retry |
| conflicting same ID / different payload | reject as identity collision |
| stale/expired holder | require explicit recovery protocol and new generation; do not delete/recreate tag casually |

Reservation key must depend on stable logical identity and a payload digest. The latter must be *validated*, not folded into a key that lets a changed payload use the same ID and execute anew.

Use separate durable receipts for **claim attempt**, **binding**, **execution**, and **delivery**, so a GitHub Actions job success cannot be mistaken for compute success. Store provider run identity with reservation ownership, or use a separate authoritative journal. A one-shot tag can avoid two winners, but cannot securely renew/transfer ownership or atomically protect a downstream external provider.

## Acceptance tests before enabling on main

1. Two concurrent Issue comments carrying identical valid request ID and payload: exactly one admitted compute, other recognized as contender.
2. Same ID but differing payload: rejected collision, not a second logical compute.
3. Claim acquired then handler terminated before result: no blind second compute; state remains recoverable with run identity.
4. Claim API 5xx/timeout: deferred, not assumed contender and not allowed through.
5. Result delivered but acknowledgement lost: replay reconciles to authoritative receipt without new compute.
6. Duplicate delivery: same receipt reused, no contradictory terminal publication.
7. No unsupported `contents:write` widening for arbitrary Issue-comment code; restrict claim creation to trusted validated path.

## Rollout

Start with an isolated pull-request branch and synthetic tests. Once provider behavior is verified, connect a reusable GitHub-ref reservation helper between `Check idempotent durable result` and `Snapshot provider quota`, change all downstream guards to require `claim == won`, and preserve finalizer behavior for `contended`/deferred. Do not deploy the E5 synthetic workflow as a compute dispatcher. A separate loss-recovery mechanism is required before claiming exactly-once processing.

Until these gates are proven, the proven property of #120 is successful bounded compute and **sequential replay suppression**, not simultaneous execution exclusivity.

## Prototype implementation (PR #145)

`scripts/github-compute-claim.js` implements a pure/adapter-injected one-shot E5 reservation protocol: fixed key by repository + `computation_id`, digest of the full request payload, exclusive provider ref-create and independent read-back distinguishing `claimed`, `contended`, `collision` and `deferred`. `scripts/github-compute-claim.test.js` covers parallel claim attempts, changed-payload collision, ambiguous provider failure, key stability, and a holder interrupted after claiming.

**This adapter is not yet wired into the live GitHub Actions workflow**. Its mock ref-create must be replaced by GitHub's real atomic `POST /git/refs` backed by an annotated tag whose content preserves the exact payload digest and run identity. The private tag creation step must validate the request *first*, and its workflow job needs explicitly scoped `contents:write`; do not widen authorization merely to execute arbitrary operations described in issue comments.

For a safe local source-level check on fracta2, fetch this PR into an isolated working tree or use:
```bash
git fetch origin pull/145/head
git show FETCH_HEAD:scripts/github-compute-claim.js >/tmp/github-compute-claim.mjs
git show FETCH_HEAD:scripts/github-compute-claim.test.js >/tmp/github-compute-claim.test.mjs
sed -i 's|"./github-compute-claim.js"|"./github-compute-claim.mjs"|' /tmp/github-compute-claim.test.mjs
node --test /tmp/github-compute-claim.test.mjs
```
The source-level concurrency test is NOT a provider-side race test; only a GitHub-native two-job run can validate provider contention.
