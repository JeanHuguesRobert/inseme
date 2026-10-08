---
title: "Cold-handler Reality Test — Issue #120 and document-draft pipeline"
date: "2026-10-08"
document_role: operational
document_kind: reality-test
visibility: public
lifecycle_state: working
language: en
---

# Reality Test: resume Inseme #120 without prior chat

## Entry point and method

Cold-handler instruction:

> Resume issue 120 of repository JeanHuguesRobert/inseme.

Evidence used: issue body and its comments; current repository files; referenced GitHub Actions run/artifact; public Corpus instructions. No previous-chat state is required to reconstruct the **compute leg**. Gmail draft-state is an external account-bound dependency and cannot be inferred from public GitHub traces.

## Recoverable work state

- Main packet: https://github.com/JeanHuguesRobert/inseme/issues/120
- Corpus contract: https://github.com/JeanHuguesRobert/cogentia/blob/main/docs/resumable_github_issues.md
- Generic program implementation: https://github.com/JeanHuguesRobert/inseme/blob/main/scripts/github-compute-execute-program.js
- GitHub compute loop: https://github.com/JeanHuguesRobert/inseme/blob/main/.github/workflows/compute-batch-reality-test.yml
- Provider integration instructions: https://github.com/JeanHuguesRobert/inseme/blob/main/docs/github-actions-generic-program-compute.md
- Ubikia builder: https://github.com/JeanHuguesRobert/ubikia/blob/main/src/text-product/build.js
- Case-specific source manifest: https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/senatoriales-2026/build/provenance-email.ubikia.yaml
- Compute request: https://github.com/JeanHuguesRobert/inseme/issues/120#issuecomment-6057554203
- Compute result/ExecutionReceipt: https://github.com/JeanHuguesRobert/inseme/issues/120#issuecomment-6057558702
- Regression suite: https://github.com/JeanHuguesRobert/inseme/issues/120#issuecomment-6057590613
- Run: https://github.com/JeanHuguesRobert/inseme/actions/runs/37761550017
- Artifact ID: `11542726388`, archive name `compute-inseme-120-git-program-ubikia-20261008-a`, observed unexpired on 2026-10-08, expiry `2026-10-22T10:09:09Z`.

Build outcome: completed. Produced `output.md` (37,088 bytes, SHA-256 `75397bb1343c09664ddc0bf90c0587d8a261af1cc18906110e5213a1995a240f`) and `output.md.manifest.json` (1,750 bytes, SHA-256 `806c04c3abd197751e89c0395263bcac2a684e82be3d2944c32b04e0c9ae4d3b`). The result is **not** an email-sent receipt.

## Cold-resume matrix

| Gate | Verdict | Evidence / repair |
| --- | --- | --- |
| Goal, boundaries and instructions | PASS | #120 body plus current-state checkpoint |
| Current program and case-input references | PASS | GitHub paths and pinned commits in compute request |
| Computation ID, run and ExecutionReceipt | PASS | Issue result and Actions run |
| Output artifact retrievable at time of test | PASS, TEMPORARY | Actions artifact exists but expires 2026-10-22; durable custody outside Actions not yet established |
| Applicable local instructions | PASS for discovery | Inseme AGENTS and shared Cogentia instructions referenced |
| Gmail draft latest state | NOT PROVEN | Gmail is account-bound and the independent recheck returned FORBIDDEN; issue does not grant access or prove draft identity |
| Byte equivalence of Gmail body to produced Markdown | NOT PROVEN | Gmail may normalize line endings and representation; raw MIME verification is needed |
| Next action reconstructible | PASS after this checkpoint | Recover artifact; validate hashes; under appropriately authorized Gmail connection locate *existing* draft; compare/update in place, never send |
| Full cross-provider handoff closure | PARTIAL | Account-bound draft and ephemeral artifact require recovery plan |

## Resume procedure

1. Read #120 and this document, inspect latest `main` and relevant local instructions; reconcile material changes before acting.
2. Inspect the tagged compute request and associated result. Verify `computation_id` matches in both.
3. Fetch workflow artifact by run/artifact ID. Verify the Markdown and receipt JSON content SHA-256. Do not confuse ZIP digest with file digest.
4. If expired, re-run from immutable program/inputs as a **new** computation ID, preserving the prior result and recording the new provenance. New run is a new act, not a replay of a prior artifact.
5. Treat Gmail as an account-bound external system. If connector access is available, search existing drafts by dossier-specific subject and recipient. Do not create a new draft until the existing one is deterministically identified or absence is verified.
6. Compare current Gmail draft state and the candidate Markdown. Distinguish transport normalization from content loss. Update *in place* only within applicable authority. Never send without a separate authorization.
7. Return to the packet with status, exact refs/hashes, test outcome, changes, remaining dependency, and next resumable action.

## Boundaries

Issue identity ≠ computation ID ≠ artifact digest ≠ Gmail draft ID.
A GitHub Issue is a work packet by reference, not an authority mint.
An ExecutionReceipt proves observed compute result, not acceptance by institutional recipients or Gmail dispatch.
This reality test is read-only regarding institutional communications and does not establish full COP/Magistral integration.

## Follow-up: draft discovery and durable reconstruction

A fresh, authorized Gmail connector draft listing found one match for the exact dossier-specific subject and the Council greffe recipient. Thus the earlier access error was intermittent rather than evidence that the draft disappeared. Do not store account-specific draft IDs as public canonical instructions: locate the existing draft afresh by exact subject and recipient, require a unique match, and use its returned ID for in-place updates. A later raw MIME read was denied; byte equivalence is still unproven. Stop without mutation if access fails or identification is ambiguous.

Derived build outputs need not be committed into a source repository. For deterministic reconstruction, preserve the pinned compute request and result already linked above, including the exact program/input commits and the expected hashes:

- Markdown: 37088 bytes; SHA-256 `75397bb1343c09664ddc0bf90c0587d8a261af1cc18906110e5213a1995a240f`.
- Manifest: 1750 bytes; SHA-256 `806c04c3abd197751e89c0395263bcac2a684e82be3d2944c32b04e0c9ae4d3b`.

After Actions artifact expiration, request a new computation ID using the **same pinned source commits and program commands** from the original typed request. Verify that the rebuilt files match both recorded hashes. This is conditional recoverability from Git objects, **not** redundant preservation of the original build bytes. Never silently replace immutable refs with current `main`.

Gmail connection and draft update remain a separate external-effect boundary, not authority conferred by the GitHub Issue or compute receipt.
