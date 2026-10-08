---
title: "Packet artifact handoff and downstream adapters"
date: "2026-10-08"
document_role: operational
document_kind: architecture-decision
visibility: public
lifecycle_state: working
---

# Boundary: Cognitive Packet / Compute versus Gmail

## Generic lane (COP/Inseme)

A Cognitive Packet carries identity, goal, current state, references, constraints, next action and return status. A Compute Request identifies a single invocation. An ExecutionReceipt reports its observed execution. An Artifact is addressed by its content digest. These are different identities.

The generic boundary `scripts/packet-artifact-handoff.js` creates `cop.packet-artifact-handoff/v1` only after checking that the computation ID, completion status, file byte count and SHA-256 match the compute result. This **verification does not imply authority, budget reservation, durable custody, email delivery, or acceptance of the output by its recipient**.

The handoff state `verified-ready-for-adapter` expresses that a verified byte sequence is available to an adapter. The Cognitive Packet's return state is separately assessed by its handler. Other adapters (publishing, storage, human review, PDF, archival, messaging) may use the same byte-verified output without modifying this contract.

### Next generic work

- Link each handoff to the packet's stable identity and durable continuation in the owning Issue.
- Maintain stable artifact custody or deterministic replay evidence beyond the expiry of GitHub Actions archives.
- Record adapter results as separate Acts and return packets, not by overloading the Compute ExecutionReceipt.

## Gmail lane (external adapter)

Gmail-specific knowledge begins **after** the verified handoff. The Gmail adapter must be given a recipient-account context and an explicit draft-mutation instruction. The adapter should:

1. Locate the existing draft by the stable dossier subject and recipient using the authorized account.
2. Require a unique result; do not silently create a duplicate.
3. Check whether the draft already matches the intended content and avoid unnecessary mutation.
4. If mutation is permitted, update the existing draft *without sending*.
5. Verify the persisted representation by reading it back where the connector allows; distinguish transport normalization from a semantic difference.
6. Return a separate status (`updated`, `unchanged`, `blocked`), provider draft reference and evidence, while protecting account-specific identifiers from inappropriate public disclosure.

A raw MIME verification may need an authorized connector with additional access; the current cold-handling test did not verify byte-for-byte persistence. Do not claim it has.

## Anti-capture / portability

The generic handoff is provider-neutral, content-addressed and does not contain Gmail fields. If Gmail becomes unavailable, the packet and verified artifact can still be reconstructed and handled through another permitted adapter.

References:
- https://github.com/JeanHuguesRobert/cogentia/blob/main/docs/resumable_github_issues.md
- https://github.com/JeanHuguesRobert/inseme/blob/main/packages/cop-core/Terminology.md
- https://github.com/JeanHuguesRobert/inseme/issues/120
