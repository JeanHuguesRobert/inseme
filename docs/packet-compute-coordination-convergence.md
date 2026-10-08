---
title: "Convergence #120 + #121 — capability composition and Packet coordination"
date: "2026-10-08"
document_role: operational
document_kind: architecture-decision
visibility: public
lifecycle_state: working
---

# Convergence: compute freely, coordinate effects

## Ownership and identity

- #120: `CapabilityRequirement` → provider computation → immutable Artifact + `ExecutionReceipt`. It does not own packet mutation policy.
- #121: packet-scoped claims, generations and fencing. The scheduler does not own policy. F1 is an in-memory reference model with passing synthetic tests, **not yet a deployed distributed lock across runners**.
- Ubikia `markdown.to_gmail_draft`: independent capability, callable with plain Markdown and a destination; it has no requirement that the document originate from a Packet.
- External Gmail synchronization: separate provider effect and receipt, not part of Compute or Packet artifact verification.

## Composition example

1. Cognitive Packet states that a document build is needed.
2. Several handlers may compute candidate artifacts concurrently. Each result is content-addressed and records its observed Packet generation when available.
3. The handler checks its completed artifact via `packet-artifact-handoff.js`.
4. To change canonical Packet state, request a claim through #121; `packet-compute-coordination.js` checks the current F1 claim as **preflight only**.
5. The durable Packet-state effect must recheck claim, epoch, generation and idempotency **atomically at commit** (F4). The current bridge alone does not enforce that.
6. To update a Gmail draft, independently resolve `markdown.to_gmail_draft`. The provider-side draft mutation needs its own idempotency and latest-state checks. A Packet claim does not automatically grant Gmail modification authority.
7. Record the external adapter receipt in the Packet as evidence, then a handler creates its Return Packet / next continuation.

## The three distinctions that prevent erroneous synchronization

- Computation can be concurrent without exclusive Packet mutation. A stale computation is not intrinsically useless.
- Packet claim validity does not authorize a third-party effect. Mandate, budget, consent and target-specific checks remain distinct.
- Read-time claim preflight is insufficient to prevent time-of-check/time-of-use races. F4 effect-boundary fencing requires a durable coordinated commit or supported provider conditional mutation.

## Reality Test

`scripts/packet-compute-coordination.test.js` tests observation without claim, live F1 promotion preflight, and rejection of a stale claim after takeover. This is a synthetic integration test using `InMemoryPacketClaimCoordinator`, not a cross-process deployment test.

References:
- https://github.com/JeanHuguesRobert/inseme/issues/120
- https://github.com/JeanHuguesRobert/inseme/issues/121
- https://github.com/JeanHuguesRobert/cogentia/blob/main/research/optimistic_mainline_governance.md
- https://github.com/JeanHuguesRobert/cogentia/blob/main/research/documents_as_cognitive_packets.md
