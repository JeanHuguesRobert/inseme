---
shared_instructions: https://github.com/JeanHuguesRobert/cogentia/blob/main/instructions/AGENTS.shared.md
scope: apps/platform/mcp/cop
license: CC BY-SA 4.0
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
language: en
date: '2026-09-15'
update_policy: UP-DEFAULT-REVIEWED
status: working-paper
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


# JHN COP runtime — local agent instructions

This directory is the current operational vertical slice for the first Cogentia Personal Digital
Twin.

## North star

The target instance is the JHN TwinRoot, with **Agent JHN / John** as its first durable
`LogicalAgent`.

The purpose of work here is not to perfect COP components in isolation. It is to make John capable
of performing real, bounded, replayable work through replaceable handlers while preserving
authority, budget discipline, traceability and imputability.

Target chain:

```text
Principal
→ Mandate
→ LogicalAgent
→ Capability selection
→ HandlerInstance
→ CapabilityInvocation
→ Act
→ Trace
→ Imputation
```

For consequential acts, COP must additionally enforce or account for the applicable resource budget
and trace regime.

## Generic vs instance-specific layers

Keep these layers separate:

```text
Cogentia / Inseme
= generic Digital Twin, COP, capability, mandate, budget, act and trace machinery

JeanHuguesRobert/JeanHuguesRobert
= public definition of the JHN Twin and Agent John

JeanHuguesRobert/registre-mariani
= private/restricted overlay for the same Twin, never a second Twin identity

mission mandate
= what John may actually do now, for whom, for what purpose and within which budget
```

Do not hard-code JHN-specific doctrine into generic COP contracts merely because JHN is the first
implementation. Conversely, do not hide reusable COP semantics inside the personal repositories.

## Read order

Before substantial work in this directory, read:

1. Cogentia's shared operational layer `instructions/AGENTS.shared.md`;
2. repository root `AGENTS.md`;
3. `packages/cop-core/Terminology.md`;
4. `packages/cop-core/COP_IDENTITY.md`;
5. `packages/cop-core/COP_ACCOUNTING.md`;
6. Inseme Issue #31, resuming at Phase 4;
7. Inseme Issue #17, the first JHN Digital Twin vertical slice;
8. `apps/platform/docs/CONTINUATION_JHN_LOCAL_COP_2026-08-02.md`;
9. this directory's `README.md`.

For JHN-specific semantics, inspect the public Twin definition in
`JeanHuguesRobert/JeanHuguesRobert` and use `JeanHuguesRobert/registre-mariani` only when the
mandate explicitly permits access to private material.

## Current implemented baseline

Treat the following as existing implementation, not future architecture:

- local SQLite/COP durable state;
- portable COP write gateway;
- short-lived Ed25519 bearer capabilities bound to a current mandate version;
- mandate status/version/grantee checks before protected writes;
- local REPL/browser conversational path;
- replaceable/stateless reasoner baseline with reconstruction from durable COP history.

Never expose or commit the local state directory, private signing key, bearer capabilities, `.env`
secrets or Vault secrets.

## Current integration frontier

Already established:

```text
LogicalAgent / Handler separation
portable JHN runtime
mandate-bound signed capabilities
standalone COP/Accounting validation/projectors
```

Immediate frontier:

```text
CapabilityInvocation
→ Act
→ Trace
→ Imputation
```

Then connect consequential invocations to:

```text
Mandate check
→ budget reservation
→ execution
→ effect receipt
→ settlement/release
→ durable evidence
→ accounts/reporting
```

Do not create a parallel JHN-specific orchestration model. Repair missing generic abstractions in
COP when they are genuinely generic.

## Reference acceptance scenario

The preferred integration test is a real, bounded repository act:

```text
Jean Hugues as Principal
→ mandate Agent JHN / John
→ John selects a repository capability
→ COP checks mandate + budget + trace requirements
→ a replaceable coding HandlerInstance executes the work
→ a CapabilityInvocation and Act are recorded
→ the external effect is identified by its receipt (for example a Git commit SHA)
→ evidence is preserved
→ the Act is imputable to John acting for the Principal, while the concrete HandlerInstance remains separately identified
→ an account/report can reconstruct what happened and why
```

Codex, Claude Code, Grok or another coding runtime is normally a `HandlerInstance`, not the durable
identity of Agent JHN.

## Minimum operational Twin criterion

Do not call the vertical slice complete merely because John can chat or remember context. The first
credible operational slice must show that John can cause at least one useful consequential Act and
later reconstruct:

- what happened;
- who materially executed it;
- which LogicalAgent caused it;
- for which Principal;
- under which Mandate and version;
- using which Capability;
- within which Budget/resource bounds;
- with which input/evidence and external effect;
- how the Act is imputed and reported.

## Working discipline

Use Issue #17 as the JHN vertical-slice epic and Issue #31 as the immediate COP semantic integration
track. Prefer small direct-main commits under the repository working contract. Keep generic protocol
changes, runtime changes and JHN-instance configuration distinguishable in commits and reports.
