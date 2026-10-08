---
title: "GitHub Actions generic program compute — adapter v1"
language: en
document_role: operational
document_kind: implementation-guide
visibility: public
lifecycle_state: working
update_policy: UP-DEFAULT-REVIEWED
date: "2026-10-08"
---

# Generic compute through issue #120

The previously operational `cop.compute-request/v1` loop supports a generic `git-program` operation, alongside the existing `sha256-file` and `node-test` operations. This adapter remains a GitHub-specific provider implementation: it is not the owner of Mandate or Budget semantics.

## Contract

Requests are made as JSON in an issue comment in the trusted `inseme` repository and return to that same issue via `cop.compute-result/v1` with an `ExecutionBinding` and `ExecutionReceipt`. The existing adapter validates that the initiating comment author matches the repository owner. The request must reference the exact `inseme` source commit, because that commit supplies the adapter code.

```json
{
  "schema": "cop.compute-request/v1",
  "computation_id": "example-generic-build-001",
  "capability": "compute.batch",
  "repository": {
    "name": "JeanHuguesRobert/inseme",
    "ref": "<exact 40-digit commit>"
  },
  "operation": {
    "kind": "git-program",
    "descriptor": {
      "schema": "fractanet.compute-program/v1",
      "program": { "repository": "JeanHuguesRobert/ubikia", "ref": "<exact 40-digit commit>" },
      "commands": [["npm", "ci"], ["node", "cli/text-product.js", "--output", "output.md", "--contract", "../inputs/owner/repo/contract.yaml"]],
      "inputs": [{ "repository": "owner/repo", "ref": "<exact 40-digit commit>" }],
      "outputs": ["output.md"],
      "execution": { "runtime": "github-actions-ubuntu", "timeout_seconds": 270 }
    }
  },
  "limits": { "timeout_seconds": 300, "network": true, "repository_write": false },
  "return": { "github_issue": 120, "structured_result": true }
}
```

The computation clones the pinned program and each pinned input repository into separate disposable directories. The program executes argument-vector commands (without a shell) in its own checkout, with no GitHub or Gmail publishing token deliberately provided. A result contains output sizes and SHA-256 checksums. GitHub Actions publishes the corresponding files as a time-limited workflow artifact named `compute-<computation_id>`.

The provider's `limits.timeout_seconds` is an execution ceiling and **does not represent a COP budget reservation**. The program descriptor describes technical work; it is **not** a Mandate. In particular, authenticated comment ingress by the owner does not establish a portable Mandate/Accounting proof. Full COP ingress, capability resolution, budget reservation/settlement, and authorization of consequential effects remain distinct integration work.

## Reality Test

A successful `git-program` request in issue #120 executed the generic Ubikia Markdown builder against the pinned `barons-Mariani` repository:

- [Typed request](https://github.com/JeanHuguesRobert/inseme/issues/120#issuecomment-6057554203)
- [ExecutionReceipt and SHA-256 result](https://github.com/JeanHuguesRobert/inseme/issues/120#issuecomment-6057558702)
- [GitHub Actions run / downloadable artifact](https://github.com/JeanHuguesRobert/inseme/actions/runs/37761550017)

The recorded `ExecutionReceipt` on this first run used the preliminary artifact reference label `compute-artifacts`; the actual Actions archive is named `compute-inseme-120-git-program-ubikia-20261008-a`. The source code was corrected for future executions. Do not mistake the ZIP digest for the Markdown content SHA-256.

## Boundaries

- The output archive is temporary (14-day retention in the current workflow), not a permanent document repository.
- Only public repositories accessible to the runner can be cloned by the current credential-free implementation.
- The generic program may perform arbitrary computation requested through this trusted channel, but its existence does not grant external publication authority.
- Running commands in the same OS-level runner does not constitute a strong sandbox for adversarial code. Container/job isolation is separate hardening work.
- Gmail draft creation and updating is a separate governed external effect, outside GitHub Actions.
