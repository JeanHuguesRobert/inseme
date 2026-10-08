---
title: "E5 Reality Test — independent handlers and atomic Git ref claim"
date: 2026-10-08
document_role: operational
document_kind: reality-test
visibility: public
lifecycle_state: verified-limited
---

# E5 — Cross-job atomic claim

Two independent GitHub Actions jobs were triggered by separate issue comments for the same synthetic capability effect. The shared store was Git's refs namespace. Both attempted to create `refs/tags/cop-e5-shared-20261008-v1` through `POST /repos/{owner}/{repo}/git/refs`, after preparing an annotated tag object identifying the handler.

Observed:
- Handler A run https://github.com/JeanHuguesRobert/inseme/actions/runs/37829405067 : `claimed`, receipt https://github.com/JeanHuguesRobert/inseme/issues/121#issuecomment-6067076578
- Handler B run https://github.com/JeanHuguesRobert/inseme/actions/runs/37829426605 : `contended`, receipt https://github.com/JeanHuguesRobert/inseme/issues/121#issuecomment-6067079044
- No business effect was executed.

This validates exclusive creation of this **specific Git ref** under the observed two-handler contention. It does not establish a reusable lease, renewal, failure recovery, external action exactly-once guarantee, cross-store atomicity or protection against authorized deletion/recreation of the reference. A stale handler could act after claim without further provider-level checks. Future tests must use fencing tokens, explicit states, version-conditional mutation and provider-side idempotency.

Implementation: https://github.com/JeanHuguesRobert/inseme/blob/main/.github/workflows/e5-shared-claim-reality-test.yml

The retained Git tag is a test artifact; do not treat it as live mandate or permission. Distinguish the claim's state from an actual effect's completion receipt.
