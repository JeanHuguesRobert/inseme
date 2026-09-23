---
title: "COP/Janus Booster — Prospective Assertions Made Answerable"
subtitle: "Ten-decision field experiment using existing COP 2.x primitives before introducing any Janus core abstraction"
description: "Operational experiment for testing the smallest useful Janus residue: decisive prospective assertions with ex-ante resolution expectations, followed through COP Continuations and later qualified EvidenceRelations."
author: "Jean Hugues Noël Robert, baron Mariani"
affiliation: "Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica"
date: "2026-09-23"
last_modified_at: "2026-09-23"
last_stamped_at: "unknown"
version: "0.2"
status: "experiment"
license: "CC BY-SA 4.0"
language: "en"
document_role: "source"
document_kind: "experiment-protocol"
document_function: "reality-test"
visibility: "public"
lifecycle_state: "working"
update_policy: "UP-DEFAULT-REVIEWED"
canonical_url: "https://github.com/JeanHuguesRobert/inseme/blob/main/research/cop_janus_booster.md"
provenance:
  origin_type: "conversation"
  origin_repository: "unknown"
  origin_ref: "unknown"
  origin_date: "2026-09-23"
  derived_from:
    - "research/cop_trace_model.md"
    - "packages/cop-core/Invariants.md"
    - "packages/cop-core/src/trace.js"
    - "packages/cop-kernel/src/continuation.js"
    - "packages/cop-core/COP_MEASURED_RISK.md"
    - "https://github.com/JeanHuguesRobert/cogentia/blob/main/research/janus_cognitive_gatekeeper.md"
review:
  status: "unreviewed"
  reviewed_by: []
tags:
  - cop
  - janus
  - cognitive-packets
  - assertion
  - evidence-relation
  - continuation
  - reality-test
  - resolution
  - foresight
changelog:
  - "v0.1 (2026-09-23) — initial N=10 field protocol and executable scenario reference."
  - "v0.2 (2026-09-23) — measurement-only amendment before case 1/10: freezes a Janus Case Record and explicit anti-bias rules; sample eligibility and resolution semantics are unchanged."
---

# COP/Janus Booster — Prospective Assertions Made Answerable

## 1. Goal

Test the smallest useful Janus residue using existing COP primitives before creating any new core abstraction.

The experiment asks whether a decision-relevant prospective assertion becomes more useful when it is:

1. recorded before resolving evidence is observed;
2. marked as genuinely decisive for a continuation;
3. given an explicit resolution criterion and horizon;
4. revisited through an existing COP Continuation;
5. resolved only through qualified COP EvidenceRelations to later traces.

No `cop-core` schema change is authorized by this experiment.

## 2. Existing COP primitives reused

The Booster deliberately reuses:

- `cop.assertion/v1` for the prospective claim;
- `cop.evidence-relation/v1` for later support, contradiction, or context;
- COP temporal semantics for distinguishing Reality time, registration time, and observation time;
- `Continuation.meta` for experimental Janus metadata;
- `resumeAfter` and `waitForEvents` for follow-up ownership;
- COP/Measured Risk by reference when an actual Act or external Exposure is involved.

Janus is therefore tested first as a composition pattern, not as a new runtime layer.

## 3. Experimental profile in `meta`

For each genuinely decision-bearing continuation, only decisive prospective assertions are instrumented.

A decisive assertion is one whose material reversal could have changed the selected continuation.

Example:

```yaml
meta:
  janus:
    decisive: true
    recorded_at: "2026-09-23T09:00:00Z"

    revision_conditions:
      - "A qualified later trace materially contradicts the expected outcome."

    resolution_expectation:
      criterion: "Observable condition capable of supporting or contradicting the assertion."
      horizon: "2026-10-01T12:00:00Z"
```

The assertion itself remains an ordinary COP `cop.assertion/v1`.

## 4. Resolution ownership

A resolution expectation should create or accompany a normal COP Continuation:

```text
assertion
→ resolution expectation
→ COP Continuation
   resumeAfter = horizon
   waitForEvents = relevant trace events
→ Reality
→ later Trace
→ EvidenceRelation
→ assertion
```

A missing result is itself observable.

At the horizon, the handler should be able to record one of:

- qualified supporting evidence;
- qualified contradicting evidence;
- contextualizing evidence;
- ambiguous evidence;
- unattributable evidence;
- not-yet-observable / unresolved at horizon.

The last three states are not silently converted into support or contradiction.

## 5. Frozen sample

The field sample is fixed in advance:

> **the next 10 genuinely decision-bearing COP continuations encountered after this experiment is activated.**

Do not substitute easier cases after seeing outcomes.

A continuation enters the sample when a real choice is made among materially different continuations and at least one prospective assertion actually contributes to that choice.

If no genuinely decisive prospective assertion exists, record that fact rather than inventing one.

## 6. Frozen Janus Case Record — measurement-only amendment

This observation format is frozen before case 1/10 to reduce variation between handlers and cases.

It does **not** change:

- the frozen N=10 sample;
- the inclusion rule in §5;
- the definition of a decisive prospective Assertion;
- the allowed Resolution / unresolved states;
- COP schemas or authorization semantics.

A candidate observation must not be promoted merely because the record can be filled in.

Minimal record:

```yaml
case_id: "janus-01"
sample_index: 1
detected_at: "ISO-8601"

continuation_ref: "durable reference"

candidate_decision:
  description: "what choice is being made"
  alternatives_considered:
    - "continuation A"
    - "continuation B"

eligibility:
  genuinely_decision_bearing: true
  decisive_assertion_exists: true
  inclusion_reason: "why this case qualifies for the frozen sample"

decisive_assertions:
  - assertion_ref: "..."
    why_decisive: "what could have changed if this assertion were materially reversed"
    recorded_at: "ISO-8601"
    revision_conditions:
      - "..."
    resolution_expectation:
      criterion: "..."
      horizon: "ISO-8601 or durable event condition"

followup_continuation_ref: "..."

later_trace_refs: []
evidence_relations: []

resolution_state: "pending"
# Later examples:
# supported | contradicted | contextualized |
# ambiguous | unattributable | not-yet-observable | unresolved-at-horizon

information_preserved:
  useful_information_otherwise_lost: null
  note: null

review_friction:
  human_minutes: null
  machine_or_handler_note: null
  ambiguity_note: null

governance_refs:
  mandate_ref: null
  measured_risk_ref: null
  act_ref: null

residue: []
```

### 6.1 Candidate with no decisive assertion

The record must support a negative observation without manufacturing Janus content.

For a real decision-bearing continuation where no prospective Assertion was genuinely decisive, preserve:

```yaml
eligibility:
  genuinely_decision_bearing: true
  decisive_assertion_exists: false
  inclusion_reason: "real decision-bearing continuation; no genuinely decisive prospective assertion found"

decisive_assertions: []
```

Such an observation is useful evidence about Janus applicability. Whether it occupies one of the frozen ten follows the §5 sample rule; do not redefine that rule from the form.

### 6.2 Temporal and retrospective completion

At initial capture, all later evidence fields may legitimately be empty.

At the declared horizon or relevant event, append or link:

- the later TraceRef(s);
- the qualified EvidenceRelation(s);
- the resulting resolution state;
- what information the ex-ante record preserved;
- review friction, ambiguity and residue.

Do not edit the original prospective commitment to make it fit later Reality.

When an external Act is involved, reference the applicable Mandate and COP/Measured Risk material instead of copying a risk dossier into Janus metadata.

## 7. Primary observations after N = 10

1. How many promoted decisions had at least one genuinely decisive prospective assertion?
2. How many expectations were recorded before the resolving evidence was ingested?
3. How many were actually revisited at the declared horizon?
4. How many obtained a qualified resolution?
5. How many remained ambiguous, unattributable, or not yet observable?
6. Did the metadata preserve information that would otherwise have been lost?
7. What human or machine review burden did the pattern add?
8. Did any case expose a need for enforcement rather than convention?

These are field observations, not yet a claim of statistical significance.

## 8. Decision after the Booster

Possible dispositions:

```text
Pattern unused or adds no useful continuity
→ do not promote Janus.

Useful without enforcement
→ retain COP/Janus as a documented composition pattern/profile.

Repeated failures caused by missing required metadata or missed follow-up
→ design a later enforced-contract experiment.

Dedicated Janus service/layer
→ not justified by this Booster.
```

## 9. Executable scenario

Reference implementation:

`sandbox/cop-continuation-bac-a-sable/scenarios/janus-resolution-booster.js`

Prospective phase:

```bash
node sandbox/cop-continuation-bac-a-sable/scenarios/janus-resolution-booster.js
```

Optional immediate demonstration of a later supporting trace:

```bash
JANUS_RESOLUTION=supports \
node sandbox/cop-continuation-bac-a-sable/scenarios/janus-resolution-booster.js
```

Allowed demo relation types are the existing COP vocabulary:

```text
supports
contradicts
contextualizes
```

The scenario prints the generated COP Assertion, resolution Continuation, and, when requested, the settling TraceRef and EvidenceRelation.

## 10. Success criterion for this stage

The Booster succeeds if it produces useful prospective-to-retrospective continuity using existing COP primitives with minimal friction.

It does **not** succeed merely because all ten records can be filled in.

The most important evidence is whether, at later review time, the recorded expectation makes it easier to answer:

> What did we actually rely on before acting, and what did Reality later tell us about that reason?

## 11. Relation to Janus research

This experiment follows the external review of Janus v0.3 and intentionally tests the concept before expanding the theory.

The working practical hypothesis is:

> **Janus may be a COP composition pattern in which decisive prospective Assertions are recorded ex ante with a ResolutionExpectation, then revisited through COP Continuations so that later Traces can qualify them through EvidenceRelations.**

The experiment is allowed to show that even this residue is unnecessary.
