---
title: "Semantic Crosswalk — Deferred Effects, Agent Memory and COP"
date: "2026-10-08"
document_role: research
document_kind: comparative-analysis
visibility: public
lifecycle_state: working
---

# Semantic crosswalk — experimental E1–E6 ↔ existing COP specifications

**Status: non-normative, reversible and exploratory.** The experiments neither implement COP nor inherit its specifications as immutable truth. Conversely, this document does not amend COP. Preserve differences and test hypotheses before choosing what to retain.

## Compared sources

- [COP Store minimal persistence](../packages/cop-core/COP_STORE_AND_PERSISTENCE.md) — working v0.3
- [COP invariants](../packages/cop-core/Invariants.md) — protocol invariants under current formulation
- [COP Accounting](../packages/cop-core/COP_ACCOUNTING.md) — human-validated v1.0
- [E5 distributed claim](e5-independent-handler-atomic-claim.md)
- [E6 lease fencing and resource accounting](e6-effect-lease-fencing.md)
- [Conversation-agent memory](conversation-agent-memory-store-reality-test.md)
- [Deferred effects, relevance, supersession](deferred-effect-relevance-and-supersession.md)

## Comparative matrix

| Experimental notion / finding | Existing COP notion | Relationship | Open question or possible evolution |
|---|---|---|---|
| Deferred intent and effect payload | Artifact or schema + lifecycle Events + continuation View | Strong convergence | Keep *effect* a schema, not invent a third durable primitive |
| Append-only completion/supersession | Immutable Events and reconstructible Views | Strong convergence | Make cancellation/satisfaction explicit causal evidence; preserve incomplete observations |
| Memory of conversational agent | COP bounded MemoryView; non-authoritative derived View | Convergence with tension | Test recall provenance, context loss and agent portability; avoid hidden authority |
| Library file or Git blob | Artifact via adapter | Convergence | Define retrievability and integrity expectations, not privileged storage technology |
| Git ref single atomic claim (E5) | Store append/order/idempotency and locality | Additional operational evidence | The existing four-method COPStore interface does not explicitly guarantee conditional claim/CAS for external effects; profile or adapter extension may be needed |
| Lease generation and expiration (E6) | Mandate/version control, local ordering, accounting reservations | Partial convergence | Differentiate reservation, renewable lease, execution fencing token, and actual effect acknowledgement |
| Desired state satisfied elsewhere | Idempotency and traceability | Extension worth exploring | Content/desired-state equivalence across agents is stronger than exact Event ID deduplication; domain-specific observations required |
| Invalidation discovered late | Causal Events, valid-time vs recording/ingestion time | Strong convergence | Distinguish prior valid-time, discovery time and changing intention; do not retrospectively erase history |
| Preflight is insufficient | COP security/mandate and Store boundary | Unresolved integration | Require provider-side atomic revalidation or fail closed for unsafe operations |
| All leases have cost, even unknown or nominally free | COP/Accounting multidimensional resources, reservations, commitments, settlements | Strong convergence | Preserve `unknown` distinct from observed 0; measure coordination overhead, renewals, expiry, opportunity cost |
| Resource obligation without actual ledger mutation | COP/Accounting mandatory accounting traces for consequential allocation | Gap in experiment | Prototype is only a policy check; no authoritative ledger evidence or settlement yet |
| Independent handlers with their own memory | Stateless handler invariant | Productive tension | Distinguish using memory as a non-authoritative index from relying on private mutable memory for correctness |
| Terms *Topic* and *streamId* | Invariants says exactly one Topic and `topicSeq`; Store v0.3 says Topic not core primitive, `streamId` ordering scope | Existing specification tension | Clarify semantic equivalence and whether a named Topic entity is necessary, without prematurely picking a winner |
| Compute provider choice and quotas | COP resource budgets and Mandates; Magistral/Fractanet routing | Partial convergence | Require cross-provider comparable dimensions but not necessarily monetary conversion |

## Important non-equivalences

**Memory ≠ Store.** Remembering an effect or pointer does not imply append-only retention, byte-perfect retrieval, authorization, or a transactional lock. Yet conversational memory may be useful as an index or bounded View; its limits should be measured, not dismissed.

**Lease ≠ effect ≠ mandate ≠ reservation.** A lease allocates an opportunity, a mandate grants limited authority, a budget reserves constrained resources, and an effect changes a target. Their lifecycle events and proofs differ.

**Idempotent event ingestion ≠ exactly-once external action.** E5 proves one Git ref was created under two independent jobs; it does not make arbitrary provider side effects fenced or transactional.

**A specification ≠ the territory.** COP documents are historical, revisable artifacts. Tests can reveal missing distinctions, unnecessary categories or mistaken requirements. Altering the specification is a separate explicit decision supported by evidence and human governance.

## Proposed agile next sequence

1. Use the crosswalk as a **semantic View** over existing texts, not a normative patch.
2. Build a compact shared vocabulary and classify each statement: observed fact, hypothesis, present normative text, or proposed amendment.
3. Test the key missing property: a stale handler paused between claim and irreversible write, competing with newer generation. First synthetic; then provider-specific CAS if supported.
4. Test remembered-pointer retrieval across separate conversations independently from GitHub search, and document evidence quality.
5. Only after these tests, offer limited, reversible candidate amendments to COP Store/Accounting/Handler profiles. Keep the human-validated source unchanged until deliberately reviewed.

## Reality-Test limits

E1 established a synthetic canonical artifact and checksum; E3 and E4 exercised pure decisions; E5 observed two distinct GitHub Actions jobs competing for one Git ref; E6 exercised pure lease/accounting policies. Neither persistent-agent-memory durability, fully portable atomic leases, nor provider-level exactly-once arbitrary effects has been established. E2 across independent conversations and the original agent-memory deletion test remain unverified.

No change in COP is implied by this analysis.
