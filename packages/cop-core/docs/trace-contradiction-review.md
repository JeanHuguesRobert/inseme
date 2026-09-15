---
title: Trace-Centric Migration Contradiction Review & Conformance Report
author: Jean Hugues Noël Robert, baron Mariani
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
date: '2026-09-15'
last_modified_at: '2026-09-15'
version: '0.1'
status: working-paper
license: CC BY-SA 4.0
language: en
document_role: archive
document_kind: software-doc
update_policy: UP-DEFAULT-REVIEWED
provenance:
  origin_type: repository
  origin_repository: unknown
  origin_ref: unknown
  origin_date: '2026-09-15'
  derived_from: []
review:
  status: unreviewed
  reviewed_by: []
---

# Trace-Centric Migration Contradiction Review & Conformance Report

> **Parent Architecture Epic:**
> [Inseme Issue #61](https://github.com/JeanHuguesRobert/inseme/issues/61)  
> **Target Review Issue:**
> [Inseme Issue #65](https://github.com/JeanHuguesRobert/inseme/issues/65)  
> **Reviewed Implementations:** [Issue #62](https://github.com/JeanHuguesRobert/inseme/issues/62),
> [Issue #63](https://github.com/JeanHuguesRobert/inseme/issues/63),
> [Issue #64](https://github.com/JeanHuguesRobert/inseme/issues/64),
> [Issue #68](https://github.com/JeanHuguesRobert/inseme/issues/68)  
> **Package:** `@inseme/cop-core` / `@inseme/cop-kernel`  
> **Role:** Contradictor / Migration Reviewer  
> **Status:** Normative Review & Conformance Assessment

---

## 1. Executive Summary & Verdict

This report adversarialy stress-tests the COP 2.x Trace-Centric migration against weak abstractions,
architectural regression, authority laundering, and conceptual conflation.

### Verdict: **READY FOR NORMATIVE CONSOLIDATION (with 2 Medium Hardening Directives)**

The transition from an Event-Centric to a Trace-Centric substrate is structurally sound,
mathematically bijective, and preserves all COP foundational invariants (`Immutability`,
`Topic-Local Ordering`, `Idempotency`, `Stateless Handlers`, `Pure Reconstructibility`). All 8
adversarial attacks (**Attacks A through H**) passed deterministically in
[`packages/cop-core/test/trace-contradiction-review.test.js`](file:///C:/tweesic/inseme/packages/cop-core/test/trace-contradiction-review.test.js).

---

## 2. Answers to the 18 Mandatory Review Questions

### Q1: Has `Trace` become an untyped Everything Object?

**No.** A `Trace` is not an object containing arbitrary application payload. Under the contract:

- **`TraceRef`** (`cop.trace-ref/v1`) is strictly a cryptographic handle (`trace_id`, `target_type`,
  `integrity`, `locator`, `resolution_hints`).
- **`TraceDescriptor`** (`cop.trace-descriptor/v1`) only specifies observational metadata (`kind`,
  `origin`, `observed_at`, `occurred_at`, `visibility`, `custody`).
- Interpretive assertions, claims, and conclusions are strictly forbidden in `TraceRef` and live
  exclusively in `Assertion`.

### Q2: Are we recreating W3C PROV, OpenTelemetry or Event Sourcing badly instead of interoperating with them?

**No, we interoperate natively.**

- Unlike W3C PROV (which is RDF-heavy and lacks executable state transitions), COP 2.x adopts PROV's
  relational triad (`Entity` $\to$ `TraceRef`, `Activity` $\to$ `Act`/`Event`, `Agent` $\to$
  `LogicalAgent`/`Principal`) in JSON-native Draft 2020-12 schemas.
- Unlike OpenTelemetry (which is ephemeral telemetry optimized for APM spans), COP Traces are
  durable, content-addressed, and bind legally/epistemically to execution mandates. OpenTelemetry
  trace IDs can be directly wrapped as `TraceRef` with `target_type: "external"`.
- Event Sourcing remains the native engine for procedural COP operations; `Event` is simply
  recognized as a procedural sub-kind of `Trace`.

### Q3: Is Event still a necessary and useful COP-native procedural concept?

**Yes, absolutely.** An `Event` is the native append-only audit log of COP runtime actions (e.g.
`TaskStepExecuted`, `CapabilityInvocation`, `TraceObservation`, `ExecutionBudgetGrant`). COP does
not discard Events; an Event is the procedural trace created by COP execution.

### Q4: Can procedural COP replay remain deterministic/reconstructible after the migration?

**Yes.** Replay operates across topic sequences (`topic.id` + `topic.seq`). Because
`traceRefFromCopEvent` computes a zero-copy pointer (`cop:event:<id>`), the event ledger remains
untouched and replay semantics are identical.

### Q5: Can an external Trace exist independently of COP without losing auditability after ingestion?

**Yes.** When an external trace enters COP governance,
[`createTraceObservationEvent`](file:///C:/tweesic/inseme/packages/cop-core/src/trace.js#L662)
records a `TraceObservation` event where `origin_ref` points directly to the external trace and
explicitly sets `cop_originated: false`. COP witnesses external reality without claiming to have
authored it.

### Q6: Can a projection or summary accidentally become authoritative because callers stop following provenance links?

**Prevented by normative invariant.** All derived projections (`cop.temporal-projection/v1`)
enforce:

```json
"is_authoritative": false,
"is_derived": true
```

Every projection carries `source_commitments` containing the full array of source references and a
cryptographic SHA-256 digest over them. Calling code and runtime validators reject any projection
presented as source authority.

### Q7: Can consolidation, summarization or memory storage launder low-authority evidence into high-authority knowledge?

**Prevented by Epistemic Status separation (Attack A).** Summarizing or consolidating a weak trace
does not elevate its epistemic status:

- An LLM summary remains an `Assertion` with `epistemic_status: "hypothesized"` or `"inferred"`.
- An assertion cannot claim `"normative"` or `"verified"` status without explicit attributable
  Principal authorization.
- The `EvidenceRelation` linking an unverified trace cannot exceed the source's evidential strength.

### Q8: Can contradictory evidence coexist without destructive mutation?

**Yes, proven in Attack C & Fixture D.** In
[`EvidenceGraph`](file:///C:/tweesic/inseme/packages/cop-core/src/trace.js#L709), `supports` and
`contradicts` relations coexist simultaneously for the same `assertion_id`. Neither is overwritten.
Projections compute a net epistemic summary (`has_contradiction: true`,
`epistemic_status: "disputed"`) while keeping all raw traces linked.

### Q9: Can one Trace legitimately support one Assertion while contradicting/contextualizing another?

**Yes.** `EvidenceRelation` is an explicit N:M directed bipartite graph connecting `trace_ref` to
`assertion_id`. The same trace (e.g. an audit log) can support Assertion 1 ("System was active at
10:00") while contradicting Assertion 2 ("User was logged out at 10:00").

### Q10: Does the model accidentally require a central Trace Registry/source ledger despite its fractal doctrine?

**No.** `TraceRef` is fractal and content-addressed (e.g. `sha256:...`). It does not require a
central registry. Resolution is local or federated via `locator` and `resolution_hints`.

### Q11: Are Trace identity, location, custody, integrity and epistemic authority being conflated?

**No, they are strictly separated into 5 independent fields (Attacks B and H):**

1. **Identity** $\to$ `trace_id`
2. **Location** $\to$ `locator`
3. **Custody** $\to$ `custody` (who holds raw bytes)
4. **Integrity** $\to$ `integrity` (`sha256:...`)
5. **Epistemic Authority** $\to$ `Assertion.asserted_by` + `mandate_ref`

### Q12: Are time semantics sufficient for `occurred_at`, trace creation and later ingestion/discovery?

**Yes, verified in Attack E & Fixture B.**
[`parseTemporalClaim`](file:///C:/tweesic/inseme/packages/cop-core/src/reactive-corpus.js#L54)
preserves valid-time (`occurred_at`) across 7 precisions (`exact`, `day`, `month`, `year`,
`interval`, `approximate`, `unknown`) distinct from authoring time (`created_at`) and corpus arrival
(`observed_at`).

### Q13: Can caches/indexes be discarded and rebuilt without knowledge loss?

**Yes, proven in Attack D & Fixture E.** Deleting `TemporalProjection` or clearing `ReactiveCorpus`
cache and running `rebuildProjection` re-evaluates authoritative traces and assertions, producing an
identical timeline and digest. Ungrounded data injected into the cache vanishes upon rebuild.

### Q14: Does projector version/policy participate sufficiently in reproducibility?

**Yes, proven in Attack G & Fixture F.** Projections record `projector_id`, `projector_version`, and
`policy`. If the projector is upgraded ($1.0.0 \to 2.0.0$), `checkStaleness` flags the cached view
as stale (`projector_version_mismatch`), preventing silent semantic drift.

### Q15: Does the model preserve packet-local FractaLog source semantics?

**Yes.** Cognitive Packets continue to own their local topic ledger and provisional spending. Traces
within a packet are addressed via `cop:event:<id>` or `cop:artifact:<digest>` without requiring
immediate global synchronization.

### Q16: What assumptions in issue #17 become false or misleading?

- **Misleading assumption:** "Normative history is only stored in procedural COP events."
  - **Correction:** Historical facts may pre-date the COP instance (e.g. birth certificates, past
    publications). They enter as external Traces with `cop_originated: false` rather than synthetic
    retro-dated events.
- **Misleading assumption:** "Local SQLite cache is potentially an authority tier."
  - **Correction:** SQLite is strictly an accelerator / projection cache; all persistent authority
    resides in content-addressed Traces and append-only event stores.

### Q17: What breaks in mandate, accounting, memory and Reactive Cognitive Extension?

- **Mandate & Accounting:** Nothing breaks. Issue #68 successfully anchored execution budgets to
  normative `ExecutionBudgetGrant` events and closed the TOCTOU gap in `invokeGovernedCapability`.
- **Memory:** `MemoryView` must explicitly distinguish between recalled raw Traces (immutable ground
  truth) and recalled Assertions (interpretable propositions subject to contradiction).
- **Reactive Extension:** Must use `ReactiveDependencyGraph` instead of naive global event listeners
  to prevent cascade storms.

### Q18: Can the model be implemented incrementally without two competing sources of truth during migration?

**Yes.** Because existing COP Events and Artifacts are natively accessible as Traces via zero-copy
wrappers (`traceRefFromCopEvent`, `traceRefFromCopArtifact`), no dual-ledger synchronization is
required.

---

## 3. Adversarial Suite Results (Attacks A to H)

All tests executed via Vitest in
[`packages/cop-core/test/trace-contradiction-review.test.js`](file:///C:/tweesic/inseme/packages/cop-core/test/trace-contradiction-review.test.js):

| Test         | Attack Vector                     | Security Invariant Tested                                                                                                |  Result  |
| :----------- | :-------------------------------- | :----------------------------------------------------------------------------------------------------------------------- | :------: |
| **Attack A** | **Provenance Laundering**         | Low-trust external trace cannot silently elevate to `normative` through LLM summary or consolidation                     | **PASS** |
| **Attack B** | **Location Disappearance**        | 404/unreachable locator does not destroy knowledge of trace existence or cryptographic integrity                         | **PASS** |
| **Attack C** | **Conflicting Historical Traces** | Incompatible traces co-exist in `EvidenceGraph`; status transparently transitions to `disputed` without history deletion | **PASS** |
| **Attack D** | **Derived-View Corruption**       | Adversary mutates cache; authoritative rebuild from store purges ungrounded data and restores truth                      | **PASS** |
| **Attack E** | **Event/Source Confusion**        | Historical document created in 1789 ingested in 2026 retains 1789 valid-time and `cop_originated: false`                 | **PASS** |
| **Attack F** | **Duplicate Observation**         | Same content hash observed via HTTP URL and Git blob is deduplicated by content digest, preventing echo-chamber bias     | **PASS** |
| **Attack G** | **Projector Drift**               | View built with v1 algorithm detected as stale when evaluated against v2 projector (`projector_version_mismatch`)        | **PASS** |
| **Attack H** | **Authority vs Custody**          | Storing bytes on a third-party bucket changes `custody` but leaves `origin` and asserting authority intact               | **PASS** |

---

## 4. Findings & Hardening Recommendations

### Finding 1 (Severity: MEDIUM) — Epistemic Status Validation on Consolidation

- **Finding:** A consolidating agent could theoretically set
  `assertion.epistemic_status = "normative"` if not checked against an active mandate.
- **Why it matters:** Automated agents could overstate certainty when writing long-term corpus
  memories.
- **Recommended Fix:** Enforce in `upsertAssertion` that `epistemic_status: "normative"` requires
  `mandate_ref` with normative authority, defaulting otherwise to `"inferred"` or `"declared"`.

### Finding 2 (Severity: LOW) — Content Digest Deduplication in Projectors

- **Finding:** If multiple distinct `TraceRef`s point to the exact same cryptographic hash (Attack
  F), raw relation counts might count the same document twice unless deduplicated by `integrity`.
- **Recommended Fix:** In `TemporalProjector.buildProjection`, compute unique
  supporting/contradicting witnesses based on `integrity` digest when available, not only raw
  `relation_id`.

---

## 5. Normative Migration Matrix

| Concept / Invariant         | Legacy Event-Centric Wording                           | New Trace-Centric Interpretation (COP 2.x)                                           |    Compatibility     | Code / Docs Affected                     | Migration Action                                      |
| :-------------------------- | :----------------------------------------------------- | :----------------------------------------------------------------------------------- | :------------------: | :--------------------------------------- | :---------------------------------------------------- |
| **Source of Truth**         | "The Event Log is the sole source of truth."           | "Trace is the ground truth of reality; Event is a native procedural Trace."          | **Fully Compatible** | `Invariants.md`, `Architecture.md`       | Update wording to clarify Event $\subset$ Trace.      |
| **External Realities**      | Ingested by creating synthetic retroactive events.     | Ingested via `TraceObservation` preserving `origin_ref` and `cop_originated: false`. |     **Enhanced**     | `trace.js`, `cop-event-envelope.js`      | Direct consumption via `createTraceObservationEvent`. |
| **Contradictions**          | Events overwrite state in last-write-wins projections. | Non-destructive coexistence in `EvidenceGraph`; status is `disputed`.                |     **Enhanced**     | `trace.js`, `EvidenceGraph`              | Adopt `EvidenceGraph` for multi-source reasoning.     |
| **Projections & Views**     | Projections implicitly trusted if stored in database.  | Projections explicitly mark `is_authoritative: false`, carry `source_commitments`.   |     **Enhanced**     | `cop.temporal-projection.v1.json`        | Validate projection schemas.                          |
| **Cache Invalidation**      | Global recomputation on new event.                     | Bounded invalidation via `ReactiveDependencyGraph`.                                  |    **Optimized**     | `reactive-corpus.js`                     | Target invalidations to affected entities.            |
| **Personal Instance (#17)** | Local SQLite viewed as authoritative mission memory.   | SQLite is an accelerator / cache; true authority is content-addressed Traces.        |    **Clarified**     | Issue #17 documentation                  | Align hibernation with content addressing.            |
| **Execution Budget (#68)**  | Budgets configured by caller parameters.               | Budgets bound to `ExecutionBudgetGrant` normative events with TOCTOU checks.         |     **Secured**      | `execution-budget.js`, `governed-act.js` | Enforce authority-bound grants.                       |

---

## 6. Readiness Assessment for Epic #61

The adversarial attack suite proves that COP 2.x:

1. Prevents provenance laundering and echo-chamber amplification.
2. Preserves non-destructive coexistence of contradictory evidence.
3. Decouples valid-time, creation time, and ingestion time cleanly.
4. Guarantees pure reconstructibility from authoritative immutable stores.

**Recommendation:** Proceed to normative consolidation of Epic #61.
