---
title: "Reason-Bearing Handler-Assist Decision"
description: "Sandbox result for preserving why handler assistance was selected without conflating qualification, capability resolution, authority, execution, or usefulness."
author: "Jean Hugues Noël Robert, baron Mariani"
date: "2026-09-24"
status: "sandbox recommendation"
language: "en"
document_role: "derived"
document_kind: "design-note"
document_function: "implementation-design"
visibility: "public"
lifecycle_state: "working"
update_policy: "UP-DEFAULT-REVIEWED"
provenance:
  origin_type: "github-issue"
  origin_repository: "JeanHuguesRobert/inseme"
  origin_ref: "issue:93"
  origin_date: "2026-09-23"
  derived_from:
    - "apps/platform/mcp/cop/jhnDelegatingAgent.js"
    - "apps/platform/mcp/cop/magistralCapabilityResolver.js"
    - "packages/cop-core/Terminology.md"
    - "research/cop_trace_model.md"
    - "https://github.com/JeanHuguesRobert/cogentia/blob/main/research/janus_cognitive_gatekeeper.md"
review:
  status: "unreviewed"
  reviewed_by: []
---

# Reason-Bearing Handler-Assist Decision

## Scope

This note answers Inseme #93 without changing production behavior in
`jhnDelegatingAgent.js`, changing a COP Core schema, or incrementing the #90
Janus sample.

The decision in scope is only:

```text
local_only
vs
handler_assisted
```

It qualifies whether assistance is expected to add enough value to request a
capability. It does not establish availability, select a provider, grant
authority, reserve a budget, authorize execution, or prove later usefulness.

## Representation options compared

### Option 1 — plain local reason-bearing value, then existing COP Event

The decision function returns a small immutable value. Before capability
resolution or governed invocation, the runtime records that value as the
payload of an existing `cop.event/v1` envelope.

Advantages:

- small enough for the hot decision boundary;
- preserves event ordering and ex-ante rationale durably;
- uses the current append-only event store;
- can refer to ordinary `cop.assertion/v1` objects without embedding them;
- can later be wrapped in a Cognitive Packet when cross-process routing is
  actually needed.

Cost: the payload kind is a local runtime convention until production
integration justifies stabilizing it.

### Option 2 — Cognitive Packet `decision` payload

A Decision Packet already carries a decision, alternatives, rationale,
authority/accountability, and reversibility. It is coherent when the decision
itself must be routed, handed off, or resumed across handlers.

For the synchronous `jhnDelegatingAgent.js` boundary it is unnecessarily
large. Its authority and reversibility emphasis also risks making a
qualification value appear to own downstream authorization semantics.

### Option 3 — dedicated COP or Janus schema/class

This would offer strong validation, but present evidence does not justify a
new primitive. Existing Events, Assertions, EvidenceRelations, Continuations,
and Cognitive Packets already compose the required semantics. A new schema
would prematurely stabilize an experiment.

## Recommendation

Use Option 1. The minimal value is:

```js
{
  kind: "handler_assist.decision",
  decision_id: "decision:...",
  selected_path: "handler_assisted",
  alternatives: ["local_only", "handler_assisted"],
  capability_requirement: {
    capability: "coding.assist"
  },
  rationale: {
    kind: "reasoned",
    summary: "The request calls for a bounded coding contribution.",
    decisive_assertion_refs: [
      "assertion:handler-assist-usefulness:..."
    ]
  },
  decided_at: "..."
}
```

The rationale summary is a Reason. Each referenced assertion is a distinct
prospective claim. The decision does not embed Assertion content, so:

```text
Reason != Assertion
Decision != Assertion
```

`capability_requirement` remains provider- and HandlerInstance-neutral. It
describes what is wanted; Magistral or another resolver later determines
whether and how that requirement can be satisfied.

The decision value deliberately has no fields for:

- handler availability;
- capability offer or concrete HandlerInstance;
- Mandate or authorization outcome;
- budget or Measured Risk outcome;
- invocation, Act, or execution receipt;
- usefulness resolution.

Those are later facts linked causally to the recorded decision event.

## Durability and ordering

Before capability resolution begins, record the decision as a
`HandlerAssistDecisionRecorded` `cop.event/v1` event. Downstream facts reference
its event or decision identifier:

```text
HandlerAssistDecisionRecorded
→ CapabilityAvailable | HandlerAssistUnavailable
→ HandlerAssistRefused | CapabilityResolved
→ CapabilityInvocation
→ Act
→ Trace
→ optional later usefulness evidence
```

The durable pre-invocation record should contain the selected path, alternatives,
provider-neutral requirement, reason, references to any genuinely decisive
Assertions, decision time, actor, topic, visibility, and causal/idempotency
identity. It should not copy authority or budget dossiers into the decision.

If the decision must cross a process or handler boundary, the same value can be
placed in a Cognitive Packet `decision` payload. Packetization is a transport
and resumption concern, not a different decision ontology.

## Legacy compatibility

The current `shouldDelegate(): boolean` contract can be projected as:

```js
{
  selected_path: wantsDelegate ? "handler_assisted" : "local_only",
  rationale: {
    kind: "legacy_boolean",
    summary: null,
    decisive_assertion_refs: []
  }
}
```

This preserves behavior without fabricating a rationale. A legacy projection
is ineligible for Janus prospective credit because it contains no decisive
Assertion reference.

## Execution success and usefulness

A governed execution Trace can show that a concrete HandlerInstance was
invoked, an Act completed, and a receipt or output exists. That proves only the
execution outcome.

Evidence bearing on usefulness requires a later qualified Trace, for example:

- handler output incorporated into the final response;
- patch or artifact retained rather than discarded;
- a test newly passes because of the contribution;
- human acceptance or rejection;
- downstream reuse of the result;
- a counterfactual or comparative evaluation showing incremental value.

If a prospective usefulness Assertion exists, such a Trace still needs an
ordinary `cop.evidence-relation/v1` to support, contradict, or contextualize it.
Execution success alone creates no such relation.

## Sandbox result

The sandbox scenario and focused tests cover:

- A: `local_only` with no availability or Mandate fact;
- B: assistance desired but unavailable, with the original reason preserved;
- C: assistance desired and available but refused at Mandate or budget stage;
- D: execution with separate HandlerInstance, invocation, Act, and Trace, while
  usefulness remains unresolved;
- E: legacy Boolean projection with no invented reason or Assertion.

The result supports the recommended composition and does not demonstrate a need
for a new COP primitive.

## Answers to the required design questions

1. **Smallest representation:** the immutable local value shown above, recorded
   as an existing COP Event before any downstream resolution or gate.
2. **Object kind:** a plain local value composed with `cop.event/v1`; use a
   Cognitive Packet decision payload only when routing or resumption requires a
   packet. It is not itself a new Trace, Packet, or schema.
3. **Assertion references:** `rationale.decisive_assertion_refs` holds identifiers
   of separate ordinary `cop.assertion/v1` objects. Assertion content and Janus
   metadata remain on those Assertion objects.
4. **Capability reference:** a provider-neutral `CapabilityRequirement` value,
   such as `{ capability: "coding.assist" }`, names what is requested without
   selecting an offer, provider, or HandlerInstance.
5. **Legacy Boolean:** project the selected path with
   `rationale.kind = "legacy_boolean"`, `summary = null`, and no Assertion refs.
6. **Pre-invocation durability:** record selected path, alternatives, requirement,
   actual reason, decisive Assertion refs, time, actor, topic, visibility,
   idempotency identity, and causal identity before resolution begins.
7. **Execution-success trace:** an invocation/Act/Trace chain with concrete
   HandlerInstance and receipt can show attempted or completed execution.
8. **Usefulness trace:** output use or retention, a contribution-linked test
   result, human acceptance, downstream reuse, or another qualified incremental
   value observation can bear on usefulness; it still needs an EvidenceRelation
   to resolve a prospective Assertion.
9. **New COP primitive:** no. The sandbox found no missing primitive that cannot
   be expressed by composing current Events, Assertions, EvidenceRelations,
   Continuations, and optional Decision Packets.
10. **Smallest later production change:** add an optional reason-bearing callback,
    normalize it or the legacy Boolean to this value, and append the decision
    event immediately before the existing availability branch. Keep all current
    downstream gates and execution behavior intact.

## Smallest justified later production change

If this sandbox is accepted, the smallest production change is to add an
optional `decideHandlerAssist({ message, history })` callback alongside
`shouldDelegate`, normalize either contract to the value above, and record the
decision event before the current handler-availability branch. The existing
availability, Mandate, budget, governed invocation, and response behavior can
remain downstream and unchanged.

Janus instrumentation should remain optional and separate: only an explicitly
referenced, genuinely decisive prospective Assertion would be eligible for the
Janus profile.

## Residue

- The local payload convention is not yet a stable public schema.
- The exact trace vocabulary for output use, retention, acceptance, and
  incremental value remains to be designed separately.
- Production integration is outside #93 and requires its own mandate.
- The #90 field sample remains unchanged by this sandbox.
