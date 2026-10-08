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


## Convergence as a systemic feedback loop (working hypothesis)

Treat specification S, implementation/experiments E, observed reality R, and resource budget B as coupled evolving states, not a one-way compliance pipeline. An iteration is: choose a falsifiable discrepancy → experiment within budget → measure effects and unintended consequences → compare with S → revise E, S, both or neither → repeat.

A stable fixed point (`S ≈ E` according to our chosen tests) **is not evidence of a global optimum**. Stability can arise from shared blind spots, restricted test diversity, path dependence, lock-in, or reward/measurement capture. Multiple local attractors may coexist. Distinguish:
- *syntactic conformance* (same vocabulary), *semantic consistency* (same meaning), *operational effectiveness* (desired effects in reality), *systemic desirability* (net effects over contexts and stakeholders);
- *equilibrium* (little observed change) from *optimum* (best attainable under explicitly stated, contested criteria);
- *convergence* from premature closure, oscillation and hysteresis.

### Small experimental loop — first cycle

Question: Is a `COP Topic` truly a separate durable entity, or does a `streamId` ordering scope preserve the same invariants?

Current source A: `packages/cop-core/Invariants.md` §2 requires Topic-local total, gap-free ordering with `topicSeq`.
Current source B: `packages/cop-core/COP_STORE_AND_PERSISTENCE.md` §2 and §5 uses `streamId`, `streamSeq` and does not posit Topic as an autonomous core object.

Hypothesis H1: renaming Topic→streamId loses no required ordering semantics, **provided** append is atomic per stream, replay is deterministic, and independent streams do not gain hidden global ordering.
Competing H2: Topic has extra indispensable identity/lifecycle/authority semantics which cannot be reduced to stream metadata.
Reality Test: construct two independent streams; concurrent appends; duplicate delivery; crash-and-replay; then inspect whether H1 and H2 predict observably different outcomes. Record counterexamples, not just successes. Do not rewrite COP sources before evidence.

Decision dimensions: fidelity of ordering, traceability, recoverability, simplicity/number of core entities, cross-store portability, resource consumption including unknown costs, authority and locality. No scalar global 'fitness' without declared stakeholder weights.

### Anti-lock-in discipline

1. Each cycle must preserve a live alternative and identify at least one falsification condition.
2. Measure both intended and unintended consequences, and count test/coordination/lease costs.
3. Record uncertainty, source provenance and limits, including unmeasurable dimensions.
4. Permit reversible amendments and exploration outside the current COP vocabulary.
5. Trigger renewed exploration when an apparent equilibrium is sensitive to changed environments, agents or measurement choices.

The loop is an *epistemic and engineering method*, **not** a newly mandated COP runtime primitive. Both the present specifications and this proposal remain revisable.

### First Reality Probe outcome — Topic vs streamId (2026-10-08)

Synthetic bounded Node tests: [source](../scripts/topic-stream-semantic-probe.test.js), [GitHub Compute receipt](https://github.com/JeanHuguesRobert/inseme/issues/121#issuecomment-6068891637), 3/3 passed.

**Observed within the toy model:** a lossless Topic/topicSeq → streamId/streamSeq renaming preserves per-scope order, duplicate elimination and replay. Gap detection is invariant under that renaming. A stream ID alone does not encode lifecycle/governance metadata.

**Not demonstrated:** atomic concurrent append, restart durability, replay across actual adapters, independent Topic identity or required Topic governance lifecycle. The governance test is a representation counterexample, not proof a distinct Topic primitive is necessary: such properties could be Events/metadata/Views.

**Judgement:** H1 remains plausible for the *ordering scope*. H2 remains open for any independently required governance/identity invariant. Do not conflate naming with a semantic distinction or assume independent entity status merely to carry extra metadata.

**Peripheral observation (serendipity discipline):** what appeared to be a conflict between two names may instead be a confusion between two questions: the identity of an ordering scope and the locus of its authorization/governance. Preserve this as a new question, not as a settled conclusion. Continue without manufacturing an A/B campaign.

**Resource/attention accounting:** one synthetic test execution, three tests; actual provider resource/attention cost not reliably observable here. Do not represent as zero.

### Second semantic probe — stream governance and independent authority (2026-10-08)

[Source test](../scripts/stream-governance-semantic-probe.test.js), [GitHub Compute receipt](https://github.com/JeanHuguesRobert/inseme/issues/121#issuecomment-6068976905), 4/4 synthetic tests passed.

The experiment separates three concerns: stable stream identity, append ordering, and authorization to append. Revoking or versioning a mandate changes who may append without requiring mutation of historical events or replacement of the stream ID. An actor being permitted to append says nothing about atomic allocation of the next sequence number. This is consistent with current [COP/Identity](../packages/cop-core/COP_IDENTITY.md) and [Mandated Agent Security](../packages/cop-core/COP_MANDATED_AGENT_SECURITY.md), but does not prove that an implementation supplies required transactional semantics.

**New possible discovered en route:** a Topic/stream distinction may be better understood as a governance projection over a stable ordered event scope, instead of either (a) an independent universal core noun or (b) a bare name with no authorization semantics. This is a hypothesis, not a COP amendment or a universal constraint.

**Missing Reality Tests:** real concurrent appends and crash/restart recovery; provenance and revocation arriving during a write; explicit atomicity/consistency contract at adapter boundary; cost of enforcing governance. Preserve alternative hypotheses until evidence discriminates.

### Third semantic probe — mandate revocation across the check/write boundary (2026-10-08)

[Source](../scripts/stream-revocation-boundary.test.js) and [verified Compute receipt](https://github.com/JeanHuguesRobert/inseme/issues/121#issuecomment-6069284203): 3/3 synthetic tests passed.

- A new authoritative observation after a mandate's revocation fences a handler that retained an old authorization snapshot.
- A stale handler may still race if mandate revocation occurs **after** the final read but **before** its write. This is a check-to-use window (TOCTOU).
- Thus permissions/mandates and stream sequence allocation are semantically independent, yet a real consequential append may require their enforcement to share a transactional boundary or a provider-enforced fencing/idempotency contract.

**Limit:** these are pure model tests, not a real shared-store concurrent write, and they prove no atomic revocation guarantee. A dedicated GitHub Actions workflow was not published because the tool disallowed that write-enabled workflow creation. Do not infer provider guarantees from this probe.

**Peripheral observation:** revocation is a *temporal authority condition*, not merely a property of stream identity or order. This suggests that narrowing the analysis to Topic/stream naming would have missed the important causal boundary.
