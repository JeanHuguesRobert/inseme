---
title: "COP compute request — operator recipe and replay recovery"
date: "2026-10-15"
status: "working"
related_issues:
  - "https://github.com/JeanHuguesRobert/inseme/issues/120"
---

# ChatGPT → GitHub → COP compute → GitHub result

## Observed proof (2026-10-15)

Issue #120 comment [6184028168](https://github.com/JeanHuguesRobert/inseme/issues/120#issuecomment-6184028168) contains a typed `cop.compute-request/v1` with computation ID `cop-sha256-reality-20261015-a`. GitHub Actions run [38678769423](https://github.com/JeanHuguesRobert/inseme/actions/runs/38678769423) returned a completed `magistral.execution-receipt/v1` in [comment 6184031844](https://github.com/JeanHuguesRobert/inseme/issues/120#issuecomment-6184031844). SHA-256 for `AGENTS.md` at pinned commit `aa6baf0846d21f29f5458a7d773c82a1db2c5a82`: `d218d9c37c43f5df9e653bf6d273c212c1147f14e330528bd412592bede7071a`.

A replay using the *same* ID in [comment 6184042888](https://github.com/JeanHuguesRobert/inseme/issues/120#issuecomment-6184042888) caused Actions run [38678878635](https://github.com/JeanHuguesRobert/inseme/actions/runs/38678878635). Its logs show the idempotency check succeeded and resource admission, verification and execution were skipped, **but the finalizer incorrectly emitted a synthetic failed receipt** in [comment 6184045055](https://github.com/JeanHuguesRobert/inseme/issues/120#issuecomment-6184045055). This is a finalization bug, not evidence of a second computation. The fix in this branch is not deployed or regression-tested yet.

## Minimal operation for a fresh ChatGPT conversation

1. In the chosen GitHub Issue, write a fenced JSON `cop.compute-request/v1` comment. Use a unique and stable `computation_id` for one logical computation, an exact repository SHA, an admitted typed capability and operation descriptor, declared resource limits, and a return Issue. Do not put secrets or arbitrary untrusted shell in comments. Refer to the full known-working [request](https://github.com/JeanHuguesRobert/inseme/issues/120#issuecomment-6184028168) for the concrete adapter-specific envelope; do not blindly copy its ID or ref for a new computation.
2. Retrieve Issue comments and search for `<!-- cop-compute-result:COMPUTATION_ID -->`. Parse the JSON `cop.compute-result/v1` and check its `execution_receipt.status`, binding/provider execution ID, pinned source ref, outputs, errors and log references. Receipt existence does not imply success.
3. Correlate by the unchanged `computation_id`. A retry for the same logical request MUST keep the exact ID and payload; changing the request requires a new ID. Never infer a missing result means that no execution occurred.
4. On missing callback, inspect the Actions run and pending outbox artifact before re-emitting the request. Acknowledgement loss can happen after effect execution; reconcile with existing receipts/provider identities first.
5. Idempotence criteria: only one provider *compute execution* for a logical ID, no contradictory terminal receipts, and a replay must reuse the previously completed result. A new Actions dispatcher invocation may be needed to detect a replay; it must not rerun the compute.

## Known remaining work

- Regression-test the finalizer skip path and deploy via the governed workflow; branch code is not yet active.
- Move de-duplication before dispatch using a persistent authoritative per-`computation_id` claim or equivalent CAS, and handle simultaneous submissions, not only sequential replay.
- Ensure callback discovery checks all pages and uses atomic provider-side uniqueness/reconciliation if supported.
- Test lost webhook delivery, lost callback acknowledgement, retries and concurrency explicitly.
- Separate Action job's success/failure from `ExecutionReceipt` status and log root causes without manufacturing terminal compute results for deliberate skips.
