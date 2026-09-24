---
title: "ACP Execution-Budget Accounting — Evidence Before Authority"
description: "Working investigation of what a real ACP HandlerInstance can honestly reserve, measure, and settle under COP execution-budget semantics before Agent JHN authorizes coding.assist.read."
author: "Jean Hugues Noël Robert, baron Mariani"
date: "2026-09-24"
status: "investigation"
language: "en"
document_role: "derived"
document_kind: "research-note"
document_function: "implementation-research"
visibility: "public"
lifecycle_state: "working"
update_policy: "UP-DEFAULT-REVIEWED"
provenance:
  origin_type: "github-issue"
  origin_repository: "JeanHuguesRobert/inseme"
  origin_ref: "issue:101"
  origin_date: "2026-09-24"
  derived_from:
    - "packages/cop-core/COP_ACCOUNTING.md"
    - "packages/cop-core/Terminology.md"
    - "packages/cop-core/src/execution-budget.js"
    - "packages/cop-core/src/governed-act.js"
    - "packages/magistral/src/acp.js"
    - "apps/platform/mcp/cop/hostRuntimeClient.js"
    - "apps/platform/mcp/cop/jhnLocalAgentAuthority.js"
    - "inseme#98"
    - "inseme#99"
review:
  status: "unreviewed"
  reviewed_by: []
---

# ACP Execution-Budget Accounting — Evidence Before Authority

## Scope

This note is the working research output of Inseme #101.

It does **not** amend:

```text
mandate:jhn:agent:1
budget:jhn:agent:local:1
```

It does not unpark #98 and does not authorize a real ACP invocation through Agent JHN.

The immediate question is narrower:

> Before authorizing `coding.assist.read`, what can COP honestly reserve before an ACP invocation, what can it honestly measure after the invocation, and what must remain unknown or refused?

The governing accounting rule is:

```text
unknown != zero
```

## 1. Source-derived facts

### 1.1 COP Accounting requires enforceability before execution

`COP_ACCOUNTING.md` states that an agent loop carries bounded native execution dimensions such as steps, tool calls, sub-agents, elapsed time and external effects.

For consequential invocation:

```text
reserve every enforceable dimension before execution
→ execute
→ settle observed use or release unused capacity
```

The same document explicitly distinguishes:

```text
measured
estimated
not_estimated
```

for resources whose quantity cannot honestly be asserted.

A missing quantity therefore cannot be silently converted into measured zero.

### 1.2 The current execution-budget ledger requires a complete integer vector

`packages/cop-core/src/execution-budget.js` defines exactly five dimensions:

```text
max_steps
max_tool_calls
max_subagents
max_elapsed_ms
max_external_effects
```

`normalizeLimits()` requires every one of them to be a non-negative integer.

That validation is used for:

- granted limits;
- reservation demand;
- settlement usage.

The current implementation therefore has no representation inside the budget vector for:

```text
unknown
not observed
not enforceable
not applicable
```

### 1.3 Governed settlement prefers handler-reported execution_usage

`invokeGovernedCapability()` currently chooses settlement usage in this order:

```text
effect.execution_usage
→ compatible effect.usage
→ reservation.demand
```

Thus, once a handler returns an `execution_usage` object, that object becomes the settlement input rather than the original complete demand.

### 1.4 The ACP host adapter reports a partial budget vector

For ACP, `hostRuntimeClient.js` currently returns:

```js
execution_usage: {
  max_steps: 1,
  max_elapsed_ms: result.elapsed_ms
}
```

and separately:

```js
permission_trace
```

It does not report:

```text
max_tool_calls
max_subagents
max_external_effects
```

### 1.5 Static code finding: real ACP settlement is currently structurally incomplete

The current code path is:

```text
ACP handler returns partial execution_usage
→ invokeGovernedCapability selects that object
→ ledger.settle(usage)
→ normalizeLimits(usage)
→ missing dimensions are invalid
```

By static reading, a successful real ACP invocation that reaches settlement can therefore fail validation **after the provider has already run**.

This is a code-derived finding, not yet an executed Reality Test.

It is important because a hard execution ceiling must not depend primarily on discovering a violation after the effect boundary.

### 1.6 The ACP read-only policy can allow local commands

`createReadOnlyPermissionPolicy()` rejects:

- edit permission requests;
- unknown or unsafe command requests;
- permission escalation / `other`;
- shell composition, redirection and interpolation surfaces.

It may allow one-shot local read commands inside the configured root, including selected forms of:

```text
rg
ls / dir
pwd
type
head / tail
Get-ChildItem / Get-Content
git status / diff / log / show / branch / ls-files / grep
```

Each policy decision can be recorded in `permission_trace`.

### 1.7 permission_trace is not currently a complete execution trace

The policy's own documentation says that it does not remove the agent's native inspection tools; it only decides permission prompts the agent raises.

Therefore:

```text
permission_trace
= trace of permission decisions seen by this policy

permission_trace
!= proven complete list of every provider-native tool action
```

A recorded admitted `execute` is positive evidence that at least one command-like action occurred.

An empty permission trace is not yet proof that zero tools ran.

### 1.8 Current elapsed-time reservation and ACP timeout do not align

Agent JHN currently declares:

```text
per-turn demand max_elapsed_ms = 1000
budget grant max_elapsed_ms = 60000
```

The Codex ACP runtime defaults to:

```text
invoke_timeout_ms = 240000
```

The adapter measures actual elapsed time, but the host runtime can continue well beyond both the one-second reservation and the 60-second grant ceiling.

Under the current design, an excessive elapsed time may therefore become visible only during settlement.

This is another post-effect enforcement gap.

## 2. Three meanings near “external effect”

The corpus currently contains three nearby but not yet reconciled uses.

### Architecture / replay

COP Architecture describes outputs from external systems — such as LLM outputs, API results or human decisions — as external effects/outcomes that must be recorded for deterministic replay.

### Measured Risk / Exposure

Measured Risk uses `external_effects` as a qualitative Exposure dimension:

```text
none
bounded
propagating
irreversible
```

### Execution budget

The execution-budget ledger uses a numeric dimension:

```text
max_external_effects: integer
```

The code and current normative prose do not yet define what one unit of this numeric dimension means.

These meanings must not be collapsed merely because they share words.

## 3. Preliminary accounting matrix

| Dimension | Current effective unit | Ex-ante enforceable today? | Ex-post evidence today | Safe treatment now |
| --- | --- | --- | --- | --- |
| `max_steps` | ACP adapter currently reports one step for one runtime invocation | Partly: the COP wrapper can bound number of governed invocations, but this does not describe provider-internal reasoning steps | hard-coded `1` from adapter | usable only if “step” is explicitly the governed runtime invocation unit |
| `max_tool_calls` | undefined at ACP/COP boundary | No complete bound shown by current policy; safe read `execute` requests may be admitted and native inspection actions may not all enter `permission_trace` | permission decisions give partial/lower-bound evidence | **unknown, not zero** |
| `max_subagents` | undefined for provider-internal ACP behavior | no evidence yet; COP itself does not explicitly spawn another LogicalAgent in this path | not reported | unresolved until unit is defined; do not infer provider-level zero |
| `max_elapsed_ms` | wall-clock runtime duration | Yes in principle through host timeout, but current timeout is not aligned with JHN reservation/grant | measured `result.elapsed_ms` | enforceable only after timeout is bounded to reserved/available capacity |
| `max_external_effects` | numeric unit undefined | not established | not reported; permission policy rejects some effect surfaces but is not proved complete | **unknown, not zero** |

This matrix is preliminary. It is deliberately stricter than the labels “read-only” or “local”.

## 4. What permission_trace can and cannot currently prove

### Positive evidence it can provide

An entry with:

```text
kind = execute
decision = selected
reason = one_shot_local_read_command
```

shows that the policy admitted at least one scoped local command.

An entry for edit/other/unsafe execute with a cancelled decision shows that this permission request was refused.

### Evidence it cannot yet provide

It does not currently prove:

- total provider-native tool-call count;
- absence of actions that do not raise a permission request;
- absence of network activity at every provider-internal layer;
- total subagent count;
- a complete numeric external-effect count.

Therefore it is useful evidence, but not yet a complete budget usage receipt.

## 5. Working hypotheses to test

These are hypotheses, not adopted semantics.

### H1 — every handler-initiated tool action consumes max_tool_calls

If so, an admitted local read command consumes at least one tool call.

The current `max_tool_calls = 0` demand is incompatible with an ACP policy that may admit such commands.

A count ceiling would need to be enforced before or during the session, not merely observed afterward.

### H2 — max_tool_calls counts only COP-visible delegated tool boundaries

If so, provider-internal inspection might not consume this dimension.

That would make the current zero more plausible, but it requires an explicit definition so that different handlers account consistently.

### H3 — numeric external effects count consequential state/world changes

Under this interpretation, a pure local read could consume zero external effects while a repository write, network mutation or third-party action consumes one or more.

This is intuitively compatible with the distinction between Budget and Exposure, but the corpus does not yet define the numeric unit this way.

### H4 — invoking an external provider/runtime is itself one external effect

Under this interpretation every ACP call consumes at least one external effect and the current zero ceiling cannot authorize it.

This interpretation is also plausible given Architecture's broad use of “external effects”, which is why the vocabulary must be resolved explicitly.

## 6. Accounting safety requirements emerging from the investigation

Regardless of which hypotheses survive, several invariants already follow.

### 6.1 Unknown budget dimensions cannot settle as zero

If a hard budget includes a dimension, the adapter must either:

- provide an enforceable upper bound before invocation and a compatible observed use afterward; or
- cause the invocation to fail closed before the effect boundary.

### 6.2 Complete postflight usage is not enough

A perfect ex-post measurement does not repair an ex-ante authorization failure.

For a hard ceiling, the runtime must know before invocation that the possible use fits the reservation.

### 6.3 Policy-derived zero requires an actual policy proof

A zero may be supplied only when the execution surface guarantees that the relevant action cannot occur, not merely because no event was observed.

### 6.4 Reservation demand must dominate possible usage

This must hold for every enforceable dimension:

```text
possible usage <= reserved demand <= authorized remaining capacity
```

The current ACP elapsed-time configuration does not satisfy this relation for JHN.

## 7. Candidate implementation directions

No option is selected yet.

### A — complete handler-adapter budget contract

A handler adapter exposes before invocation:

```text
maximum_usage / demand
evidence or policy basis for each dimension
```

and after invocation:

```text
complete observed usage
evidence
```

If any hard-budget dimension cannot be bounded, the handler is not admissible.

This is the strongest local fix and keeps the core integer ledger unchanged.

### B — policy-bounded usage normalization

A host adapter may fill a complete vector only for dimensions whose bounds are guaranteed by runtime policy.

Example pattern:

```text
elapsed timeout = 1000 ms
→ max_elapsed_ms <= 1000 is enforceable

all execute permission requests denied
→ perhaps max_tool_calls = 0, if and only if tool_call is defined as that mediated surface
```

Unknown dimensions remain inadmissible.

### C — separate enforceable budget dimensions from observational resource assessments

`COP_ACCOUNTING.md` already says reservations apply only to enforceable limits.

The current ledger nevertheless requires all five dimensions.

A future core revision could distinguish:

```text
hard enforceable budget dimensions
vs
observed / estimated / not_estimated resource assessments
```

This is potentially more principled but is a generic COP change and therefore requires a separate design/review mandate.

### D — fill missing settlement fields from reservation demand

This is safe only when the reservation value is already an enforced upper bound.

It is unsafe when the missing field is genuinely unknown, especially with a reserved value of zero.

Therefore this cannot be a generic “missing means demand” repair.

## 8. Immediate Reality probes still needed

A host with the installed Codex ACP should run bounded diagnostic probes in a disposable/read-only context.

### Probe A — answer without repository inspection

Question: does a minimal prompt produce any permission requests or session updates identifiable as tool use?

### Probe B — explicit one-file / git-status observation

Question: what exact ACP messages, permission requests, session updates and usage values appear for a known read?

### Probe C — attempted mutation in disposable workspace

Question: does the policy reliably refuse the write before mutation, and what evidence is emitted?

The probes should preserve raw diagnostic evidence locally but publish only the minimum useful trace.

## 9. Provisional conclusion

At the current frontier, the honest statement is:

```text
Capability:
  coding.assist.read exists and can now be required coherently (#99)

Authority:
  Agent JHN does not yet authorize it (#98 remains PARKED)

Budget:
  current ACP accounting is not yet sufficient to prove the 0/0 dimensions
  and has a structural partial-settlement problem

Elapsed time:
  current ACP timeout exceeds both the per-turn reservation and the local grant

Therefore:
  do not amend the Mandate merely to get past the first blocker.
```

The next implementation decision should be made only after the runtime probes establish what the ACP surface can actually enforce and observe.

## 10. Decision frontier

Human review should eventually choose among two broad directions:

```text
1. make the existing five-dimensional execution budget genuinely enforceable
   at the ACP adapter boundary

or

2. revise the generic budget model so only enforceable dimensions are hard budgets,
   while non-enforceable observations use Accounting resource assessments
```

That choice precedes any honest authorization of a real Codex ACP handler for Agent JHN.
