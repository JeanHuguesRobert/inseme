---
title: "COP Trace Lifecycle Conformance Profile"
subtitle: "Mechanical conformance harness for governed erasure, guidance cooling, expiry, and attributable reactivation"
author: "Jean Hugues Noël Robert, baron Mariani"
affiliation: "Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica"
date: "2026-09-08"
last_modified_at: "2026-09-08"
version: "1.0"
status: "working-paper — implementation verified"
license: "CC BY-SA 4.0"
language: "en"
ai_assisted_by:
  - "Antigravity (conformance harness and profile documentation)"
human_arbitration_by: "Jean Hugues Noël Robert"
document_role: "operational"
document_kind: "documentation"
document_function: "conformance-profile"
visibility: "public"
lifecycle_state: "working"
update_policy: "UP-DEFAULT-REVIEWED"
last_stamped_at: "unknown"
canonical_url: "https://github.com/JeanHuguesRobert/inseme/blob/main/packages/cop-core/docs/trace-lifecycle-conformance.md"
classification_source: "cogentia.js"
classification_version: "1"
classification_rule: "explicit-metadata"
classification_confidence: "strong"
provenance:
  origin_type: "conversation"
  origin_repository: "JeanHuguesRobert/inseme"
  origin_ref: "https://github.com/JeanHuguesRobert/inseme/issues/72"
  origin_date: "2026-09-08"
  derived_from:
    - "https://github.com/JeanHuguesRobert/inseme/issues/71"
    - "research/cop_fractalog_profile.md"
    - "packages/cop-core/test/trace-lifecycle-conformance.test.js"
related_documents:
  - "packages/cop-core/docs/trace-contradiction-review.md"
  - "packages/cop-core/docs/measured-risk-and-exposure.md"
  - "research/cop_fractalog_profile.md"
review:
  review_status: "verified"
  reviewed_by: "Jean Hugues Noël Robert"
  reviewed_at: "2026-09-08"
---

# COP Trace Lifecycle Conformance Profile

## 1. Purpose & Scope

This document specifies the mechanical conformance harness for COP trace lifecycle management, as clarified in [Inseme Issue #71](https://github.com/JeanHuguesRobert/inseme/issues/71) and implemented under [Inseme Issue #72](https://github.com/JeanHuguesRobert/inseme/issues/72).

It defines an **exploratory conformance profile**, establishing mechanically verifiable guarantees without requiring immediate protocol migrations, database schema updates, or automated salience scoring engines.

The primary objective is to make four architectural distinctions provable by automated tests:

1. **Causal history is strictly append-only**: Past facts are never deleted or rewritten in place.
2. **Governed erasure/redaction leaves a non-reconstructive receipt**: When payload content is erased under a policy or legal requirement, an opaque immutable receipt records the act of erasure without preserving sensitive content or erasing the causal event.
3. **Cold or expired stigmergic guidance signals cannot authorize execution**: Stale guidance cannot act as implicit operational authority.
4. **Reactivation is strictly attributable**: A cooled or expired signal may only be reactivated through an explicit event backed by a present rationale and an active mandate.

---

## 2. Core Distinctions & State Invariants

### 2.1 Append-Only Erasure & Non-Reconstructive Receipts

In accordance with the Anti-Capture Doctrine and COP Core immutability invariants:
- Erasure does **not** perform an SQL `DELETE` or mutate prior envelope content.
- A governed erasure is recorded as a new append-only event (`TraceLifecycleErasure` / `GovernedErasureReceipt`) referencing the original trace reference (`target_trace_ref`) and the authorizing policy (`authority_ref`).
- The payload reference is marked unavailable (`payload_unavailable`), preventing recovery of sensitive data while preserving the chronological fact that an observation occurred.

### 2.2 Stigmergic Guidance: Cooling vs. Routing Influence

Stigmergic signals (traces that guide subsequent agent decisions) naturally undergo temporal decay:
- `hot`: Fresh, active signal within its stated validity window.
- `cold` / `frozen`: Signal has exceeded its time-to-live or has been superseded.

> **Key Invariant:** Cooling and expiry affect **routing influence** (whether an agent may select a capability or follow a hint), **not** historical occurrence or past responsibility attribution (`Imputation`).
>
> An invocation attempting to execute under an expired guidance signal is intercepted and rejected at the capability boundary before any handler runs. However, past acts and imputations performed when the guidance was active remain causally intact.

### 2.3 Attributable Reactivation

Reactivating a cold or frozen trace requires:
1. An explicit event (`TraceGuidanceReactivated`).
2. An active, verifiable `mandate_ref` covering the agent and principal at the time of reactivation.
3. A documented `reason` explaining why the prior trace is pertinent in the current context.
4. An immutable link to the prior expiry event (`prior_expiry_event_id`).

---

## 3. Conformance Verification Suite

The conformance invariants are verified by the automated Vitest test suite located at:
[`packages/cop-core/test/trace-lifecycle-conformance.test.js`](file:///C:/tweesic/inseme/packages/cop-core/test/trace-lifecycle-conformance.test.js)

| Test Case | Invariant Demonstrated |
|-----------|------------------------|
| **Governed Erasure Receipt** | Causal history remains append-only; erasure receipt leaves an opaque marker without raw payload retention. |
| **Expired Guidance Refusal** | Invocation with an expired mandate/guidance is refused before the handler execution boundary. |
| **Reactivation Guards** | Reactivation without an active mandate or missing reason is rejected. |
| **Attributable Reactivation** | Valid reactivation emits a traceable event with causal link to prior expiry and current mandate. |
| **Routing vs. Imputation** | Cooling severs forward routing without retroactively altering past imputations or event timestamps. |
