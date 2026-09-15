---
title: Mandated Agent Security — Implementation Audit and Backlog
author: Jean Hugues Noël Robert
date: '2026-08-24'
last_modified_at: '2026-08-24'
version: '0.1'
status: working audit — implementation gap analysis
license: CC BY-SA 4.0
document_role: source
document_kind: implementation-audit
visibility: public
lifecycle_state: working
related:
  - COP_MANDATED_AGENT_SECURITY.md
  - COP_IDENTITY.md
  - COP_ACCOUNTING.md
  - src/governed-act.js
  - src/execution-budget.js
  - ../magistral/CAPABILITY_RESOLUTION.md
  - ../../apps/platform/mcp/cop/jhnDelegatingAgent.js
  - ../../apps/platform/mcp/cop/magistralCapabilityResolver.js
changelog:
  - v0.1 (2026-08-24) — first implementation audit against the twelve minimum conformance tests of COP/Mandated Agent Security; prioritized backlog added.
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
language: en
update_policy: UP-DEFAULT-REVIEWED
review:
  status: unreviewed
  reviewed_by: []
provenance:
  origin_type: unknown
  origin_repository: unknown
  origin_ref: unknown
  origin_date: unknown
  derived_from: []
---


# Mandated Agent Security — Implementation Audit and Backlog

## 1. Purpose

This audit compares the current COP / John / Magistral implementation with the twelve minimum conformance tests defined by [`COP_MANDATED_AGENT_SECURITY.md`](COP_MANDATED_AGENT_SECURITY.md).

The result is deliberately stricter than a documentation review. A doctrinal statement counts as implemented only when the execution path enforces it or a test demonstrates the property.

Status vocabulary:

- **PASS** — the tested property is materially enforced on the examined path;
- **PARTIAL** — useful enforcement exists, but the property can still be bypassed or is incomplete;
- **FAIL** — no adequate enforcement was found;
- **N/A** — the property is outside the examined implementation slice.

## 2. Executive finding

The implementation is strongest in four areas:

1. append-only trace and preservation of past acts;
2. bounded execution-budget reservation;
3. separation of capability discovery from authority;
4. ACP transport defaults that fail closed for permissions and MCP-server admission.

The principal weakness is that **authority is still represented mainly by references and caller discipline rather than by a single mandatory pre-effect authorization gate**.

The current path is approximately:

```text
caller says mandate_ref
-> optional active check
-> optional budget reservation
-> handler / ACP effect
-> governed-act trace
```

The target path is:

```text
resolve exact mandate artifact/version
-> validate principal / actor / capability / scope / time / parent delegation
-> validate revocation state
-> reserve mandate-bound budget
-> resolve admissible capability
-> re-check authority immediately before external effect
-> execute
-> trace + evidence + accounting receipt
```

The difference is important: **recording an act under a mandate reference is not equivalent to proving that the act was authorised by that mandate.**

## 3. Conformance matrix

| # | Test | Status | Current evidence | Main gap |
|---|---|---|---|---|
| 1 | No mandate | **PARTIAL** | John and `recordGovernedAct` require a non-empty `mandate_ref` | A fabricated or nonexistent reference is accepted; no mandate artifact is resolved |
| 2 | Expired mandate | **FAIL** | schema contains `status`, `valid_from`, `valid_until` | runtime does not evaluate expiry or artifact status |
| 3 | Revoked mandate | **PARTIAL** | `MandateControl`, `isMandateActive`, John pre-check, test exists | direct delegation can bypass it; TOCTOU race remains between check and effect |
| 4 | Scope escalation | **FAIL** | scope exists in mandate schema | no execution-time comparison of requested capability/input/effect with scope |
| 5 | Budget escalation | **PARTIAL** | execution-budget limits are immutable inside a ledger and reservations fail closed | ledger limits are supplied by caller and are not cryptographically/logically bound to the mandate authority path |
| 6 | Child delegation | **FAIL** | doctrine states child authority must not exceed parent | no parent-mandate derivation/enforcement found in execution path |
| 7 | Recommendation boundary | **FAIL** | documented distinction exists in Kudocracy / doctrine | no generic runtime type/gate preventing recommendation material from becoming authority |
| 8 | Version race | **FAIL** | mandate refs sometimes include version-like suffixes | exact mandate version is not resolved/pinned/revalidated before effect |
| 9 | Recovery | **PARTIAL** | principal-labelled `MandateControl` can suspend/revoke future acts | caller-supplied `principal_ref` is not itself authorised; in-flight effects are not atomically gated |
| 10 | Irreversibility | **PASS** | append-only event model preserves prior acts; revocation adds new events | compensation/rectification semantics remain broader future work |
| 11 | Portability | **PARTIAL** | COP Continuations, capability descriptors, provider-neutral Magistral boundary | no complete governed-capability export bundle containing mandate/revocation/accounting/continuation state |
| 12 | Rebinding | **PARTIAL** | capability offers omit credentials; runtime binding is checked; ACP transport does not infer authority | no explicit import/rebind workflow exists yet, so the positive and negative cases are not conformance-tested |

Current score, counting PASS=1 and PARTIAL=0.5, is **4.5 / 12**. This number is diagnostic only; it is not a maturity badge.

## 4. Detailed findings

### 4.1 Mandate references are not mandate verification

`recordGovernedAct()` requires `principal_ref`, `mandate_ref`, logical agent, handler and capability, and produces a strong four-event trace:

```text
CapabilityInvocation -> Act -> Trace -> Imputation
```

This is good accountability infrastructure. However, the function does not resolve a mandate artifact or test whether the capability is allowed by it.

`jhnDelegateToHandler()` likewise accepts an identity object and invokes the handler. The resulting trace therefore proves **what the caller declared as the mandate reference**, not that the mandate semantically authorised the act.

Required correction: introduce one canonical authority evaluator and make consequential invocation use it before effect.

### 4.2 Revocation exists but is vulnerable to check/effect races

`recordMandateControl()` and `isMandateActive()` are useful primitives, and the existing test proves that a later `recordGovernedActIfActive()` is refused after revocation.

But the normal John delegation path does:

```text
isMandateActive()
-> reserve budget
-> jhnDelegateToHandler()
-> handler.invoke()
```

A revocation arriving after the first check can therefore occur before the external effect while the effect still proceeds.

The doctrine requires a re-check at the commitment/effect boundary. This should be treated as a TOCTOU security issue rather than a documentation detail.

### 4.3 Expiry is represented but not enforced

`identity.mandate.schema.json` already has:

```text
status: active | suspended | revoked | expired | draft
valid_from
valid_until
```

This is sufficient as a starting representation, but no examined runtime path resolves these fields before invocation.

Required correction: mandate evaluation must include time validity and status; an unresolved mandate must fail closed for consequential work.

### 4.4 Scope is currently descriptive

The mandate schema contains `allowed_actions` and `forbidden_actions`, but the capability resolver selects offers using the `CapabilityRequirement`, not a verified mandate-derived admissible capability set.

Magistral correctly states that availability is not authority. The implementation must now operationalize that statement.

Required correction: the capability requirement should be intersected with a verified authority envelope before offer selection and again before invocation.

### 4.5 Budget enforcement is technically good but authority binding is incomplete

The execution-budget ledger has strong local properties:

- fixed limits per ledger instance;
- optimistic version checks;
- reservation before work;
- settlement/release;
- refusal on exhaustion;
- refusal when observed usage exceeds reservation.

This is a solid primitive.

The missing link is provenance of the ceiling: a caller can instantiate a ledger with arbitrary limits. The budget needs an authority source / grant / mandate binding so an agent cannot obtain a larger budget simply by constructing a different ledger configuration.

### 4.6 ACP boundary is appropriately subordinate

`acp.js` explicitly does not decide mandate, authority or budget. It also has useful fail-closed defaults:

- default permission response is cancellation;
- MCP servers require an explicit admission predicate;
- additional directories require advertised support;
- session transport does not itself confer local authority.

This separation should be retained. ACP should remain an execution protocol below the authority gate.

### 4.7 Magistral capability selection is provider-neutral but not yet authority-complete

The capability catalog deliberately excludes commands and credentials and represents availability/dependency posture. Runtime host/handler/surface binding is checked before invocation.

This is good anti-capture architecture.

However, the resolver explicitly leaves mandate and budget policy to its caller. That is acceptable as modularity, but only if there is a mandatory governed caller. At present the lower-level resolver can be invoked directly in tests and can execute a runtime without an authority object.

Required correction: distinguish explicitly between:

```text
resolveCapability()          # pure, non-authorising discovery
invokeGovernedCapability()   # mandatory authority + budget + effect gate
```

Direct resolution may remain public; consequential invocation should go through the governed entry point.

## 5. Prioritized implementation backlog

### P0 — Authority must fail closed before effect

#### P0.1 Canonical `evaluateMandate()`

Implement a provider-neutral evaluator returning an immutable decision/receipt.

Minimum inputs:

```text
principal_ref
actor_ref
mandate_ref + exact version
capability
scope / target / endpoint
current time
parent mandate if delegated
requested budget/resource envelope
```

Minimum output:

```text
allow | refuse
reason
resolved mandate artifact/version
allowed authority envelope
revocation/status/time evidence
policy/constitution refs
```

Acceptance tests: #1, #2, #4, #6, #8.

#### P0.2 Pre-effect revalidation

Immediately before a consequential external effect, revalidate the exact mandate version and current revocation state.

Do not rely on a check performed before routing, planning, reservation, model reasoning or an ACP session startup.

Acceptance tests: #3 and #8, including a deterministic race test that revokes after planning but before invocation.

#### P0.3 Governed invocation as the only consequential entry point

Create a canonical API such as:

```text
invokeGovernedCapability(...)
```

It should combine authority evaluation, budget reservation, capability binding, final revalidation, effect, settlement and governed trace.

`jhnDelegateToHandler()` should either call this API or be explicitly marked unsafe/internal for non-consequential tests.

#### P0.4 Authorised revocation

`recordMandateControl()` must not trust an arbitrary caller-supplied `principal_ref`. It needs an authority rule proving that the actor may suspend/revoke this mandate.

Acceptance test: an unrelated subject cannot revoke another principal's mandate merely by naming that principal.

### P1 — Complete non-self-elevation

#### P1.1 Bind budgets to authority grants

A budget ledger should reference the grant/mandate version that created its maximum. Creation of a larger ledger must not constitute a valid budget increase.

Acceptance test: #5.

#### P1.2 Parent/child delegation attenuation

Represent parent mandate/ref and compute child authority as an attenuation/intersection, never an expansion.

Acceptance test: #6 with capability, scope, time and budget dimensions.

#### P1.3 Typed decision-strength boundary

Introduce explicit semantic types/events for:

```text
suggestion
recommendation
authorisation
mandate
decision
```

No parser/router should infer authorisation from recommendation text or model confidence.

Acceptance test: #7.

### P1 — Portable governed capability

#### P1.4 Export bundle

Define a portable bundle containing at least:

```text
logical agent / subject refs
mandate artifacts + versions
policy refs
revocation state
relevant event/artifact window
accounting receipts / unsettled commitments
capability requirement/descriptors
continuation state
schema versions
unresolved local bindings
```

Credentials remain excluded.

Acceptance test: #11.

#### P1.5 Explicit rebind ceremony

On import, local credentials/capabilities must remain unresolved until a local authority binds them.

Acceptance test: #12 — imported state cannot perform a consequential act before rebind; after authorised rebind it can resume with preserved lineage.

### P2 — Recovery and remediation semantics

Implement explicit event types for:

```text
cancel_pending_effect
compensate_reversible_effect
rectify_record
record_irreversible_effect
```

Do not overload `MandateControl` with remediation of past effects.

## 6. Test suite target

Create a dedicated executable conformance suite, preferably near COP Core:

```text
scripts/test-mandated-agent-security.js
```

or a Node test module integrated with the repository test runner.

It must contain the twelve tests from the profile, not merely unit tests for helper functions.

A useful first vertical slice is:

1. construct real mandate v1;
2. execute permitted read-only coding capability;
3. plan a second invocation;
4. revoke v1 before effect;
5. prove second invocation never reaches the fake external-effect handler;
6. issue v2 with a changed scope;
7. prove stale v1 continuation cannot execute;
8. migrate the continuation to a second fake vendor/runtime;
9. prove no authority appears until local rebinding;
10. resume under v2 and preserve causal lineage.

This single scenario exercises revocation, version pinning, portability, rebinding and implementation plurality.

## 7. Architectural conclusion

The existing implementation already embodies an important part of the doctrine:

```text
provider != logical agent
capability != authority
ACP != governance
trace != permission
```

The next implementation step is to enforce the complementary rule:

> **No consequential effect without a currently valid, exact, bounded authority decision.**

Once this gate exists, John can remain highly autonomous in execution while being structurally unable to autonomise his authority. That is the operational definition of the Mandated Agent sought by the Corpus.
