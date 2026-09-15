---
shared_instructions: https://github.com/JeanHuguesRobert/cogentia/blob/main/instructions/AGENTS.shared.md
language: en
license: CC BY-SA 4.0
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
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


# AGENTS.md — Inseme Multi-Agent Working Contract

This file defines the working contract for coding agents, research agents, and review agents
contributing to this repository.

It is intentionally short. Agents should read it before modifying code, documents, workflows, or
package structure.

---

## 0. Shared baseline and read order

Before acting here:

1. read this repository-local `AGENTS.md`;
2. read the shared
   [`cogentia/AGENTS.md`](https://github.com/JeanHuguesRobert/cogentia/blob/main/AGENTS.md);
3. inspect any closer package-level rule files;
4. apply the most specific and most restrictive applicable mandate.

The shared baseline supplies the default corpus workflow. This file specializes it for Inseme, COP,
the monorepo, and implementation work; it does not silently widen permissions.

---

## 1. Repository priority

`inseme` is the platform repository of the corpus.

### Current North Star — first Cogentia Digital Twin

The current integration target is the first operational Cogentia Personal Digital Twin:

```text
represented subject: JHN
TwinRoot: twin:jhn
first LogicalAgent: Agent JHN / John
```

The purpose of current COP work is not to perfect protocol components in isolation. It is to make
this first Twin capable of performing real, bounded, replayable work through replaceable handlers.

Target governed execution chain:

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

Consequential capabilities additionally require the applicable budget/resource discipline and
proportional trace regime.

**Measured Risk rule (binding):** Inseme does **not** optimize for minimum risk as an end in itself.
Useful transformation and Reality Tests may deliberately accept uncertainty and bounded loss when
that risk buys enough value, learning, optionality or capability. Before a consequential Act, judge
risk against the objective and at least the material parts of:

```text
Exposure / blast radius
possible propagation and OptionLoss
who receives gains and who bears possible losses
Reversibility Envelope
compensation / rectification / restitution / repair paths
recovery cost and possible residue
Mandate / rights / hard constraints
```

Reversibility is not Boolean. A locally hard-to-undo Act may be admissible when Exposure is tiny and
repair cheap; a technically revertible Act may require stronger ex-ante control when it propagates,
affects third parties, destroys important options, or leaves expensive residue.

Agents SHOULD therefore prefer the **smallest sufficient risk** for useful progress, not the smallest
attainable risk regardless of usefulness. `Measured` does not require fake numerical precision:
qualitative bounds, explicit unknowns and scenario classes are legitimate. Positive expected value
never creates authority, and losses MUST NOT be silently externalized across Principal boundaries.

When actual Exposure exceeds the authorized envelope, a recovery path disappears, or material
third-party impact appears, stop, reduce scope, escalate, or enter the applicable damage-control
regime. Skills and agents must not widen mandate, budget, disclosure, Exposure or effect ceiling.

Canonical source: `cogentia/research/measured_risk.md`. COP Exposure integration is tracked in
[#51](https://github.com/JeanHuguesRobert/inseme/issues/51).

Use Issue #17 as the JHN vertical-slice epic and Issue #31 as the immediate COP semantic integration
track. The scoped runtime instructions in `apps/platform/mcp/cop/AGENTS.md` define the current
implementation frontier.

Keep generic and instance-specific layers separate:

```text
Cogentia / Inseme
= generic Digital Twin and COP machinery

JeanHuguesRobert/JeanHuguesRobert
= public JHN Twin / Agent John instance definition

JeanHuguesRobert/registre-mariani
= private/restricted overlay for the same Twin
```

**Federation / twin association (planned, shared doctrine):**

- Pertitellu = informal federation of **collective** citizen twin instances; Corte
  (`pertitellu-corte` / lepp.fr) is first city node + bootstrap hub — not a formal _personne morale_
  registry product.
- **Instance registry** discovers _instances_; it is not person↔twin binding. Personal TwinRoot
  (`jhn`) is not the steady-state hub.
- Optional **user ↔ personal twin** link on collective membership (claim personal twin address;
  verify primarily by **email match**; **personal twin email is authoritative** when following
  address changes later). Schema **not** implemented yet — do not invent columns without an explicit
  task.
- Canonical note (all agents):
  [`research/user_personal_twin_link.md`](research/user_personal_twin_link.md); map pointer:
  [`research/instance_map.md`](research/instance_map.md); tracking issue:
  [inseme#34](https://github.com/JeanHuguesRobert/inseme/issues/34).
- **Personal Twin access policy** (who may do what on `jhn.baronsmariani.org`): visitors ≠ owner;
  conversational agent must receive `access_class` + server-enforced capabilities. One living person
  = one Personal Twin; owner has full access. Note:
  [`research/personal_twin_access_policy.md`](research/personal_twin_access_policy.md); tracking:
  [inseme#35](https://github.com/JeanHuguesRobert/inseme/issues/35).
- **Interactions Registry / multichannel messaging**: prefer traceable interactions; email as
  durable spine; extend existing Interaction Packets (method in cogentia, public traces in
  JeanHuguesRobert, private in registre-mariani); Personal Twin “desk” later. Plan:
  [`research/interactions_registry_and_multichannel_messaging.md`](research/interactions_registry_and_multichannel_messaging.md).
  Tracking: [inseme#36](https://github.com/JeanHuguesRobert/inseme/issues/36),
  [JeanHuguesRobert#2](https://github.com/JeanHuguesRobert/JeanHuguesRobert/issues/2),
  [cogentia#84](https://github.com/JeanHuguesRobert/cogentia/issues/84).
- **Public intelligence core (factorize):** John public chat is a **readonly superset** of the
  FractaVolta Guide (full public GitHub corpus about the Principal, incl. FractaVolta / future SAS
  public material; exclude private repos). One core turn runner; surfaces = web UX, OpenAI-compat
  (`jhn-public`), MCP skills/tools, CLI. Plan:
  [`research/personal_twin_public_intelligence_core.md`](research/personal_twin_public_intelligence_core.md).
  Tracking: [inseme#37](https://github.com/JeanHuguesRobert/inseme/issues/37),
  [cogentia#85](https://github.com/JeanHuguesRobert/cogentia/issues/85).

Do not hard-code JHN-specific doctrine into generic COP contracts merely because JHN is the first
implementation. Missing abstractions discovered by the JHN vertical slice should be repaired
generically when they are genuinely reusable.

Current COP implementation priority remains especially:

- `packages/cop-core` — protocol, data model, invariants, interfaces;
- `packages/cop-kernel` — reference runtime / implementation layer;
- `packages/cop-host` — platform integration surface;
- `apps/platform/mcp/cop` — first JHN governed runtime slice;
- `cop-cli`, `cop-chat`, and future adapters — operational profiles or surfaces.

COP must remain distinguishable from its implementations.

```text
cop-core     = abstract protocol / invariant level
cop-kernel   = reference implementation profile
cop-host     = platform integration surface
cop-cli/chat = operational derived interfaces
```

---

## 2. Core rule: one issue = one bounded mandate

Before starting substantial work, identify the issue or create one.

A good issue should state:

- target files or packages;
- problem or opportunity;
- proposed change;
- expected value / learning where the work is exploratory;
- known risks, Exposure and recovery concerns;
- expected closure condition;
- agent-resumable next step.

Do not expand the scope silently. If the work reveals a new problem, create or propose a new issue.

---

## 3. Branch / PR discipline

Current solo-corpus rule: write directly to the default branch unless Jean Hugues Robert explicitly
authorizes a branch or a pull request.

This repository follows **Optimistic Mainline Governance** and **Measured Risk** by reference:

- [`cogentia/AGENTS.md`](https://github.com/JeanHuguesRobert/cogentia/blob/main/AGENTS.md)
- [`cogentia/research/optimistic_mainline_governance.md`](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/optimistic_mainline_governance.md)
- [`cogentia/research/measured_risk.md`](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/measured_risk.md)

Direct-main work remains legitimate when scoped, inspectable by diff, reported, and inside a
Measured Risk envelope with a credible correction/recovery path. Branches or PRs are exceptions
when isolation materially improves the Exposure, recovery, review or collaboration profile.

Avoid mixing protocol changes, runtime changes, UI changes, documentation updates, refactors and
generated files unless the coupling is necessary and explained.

---

## 4. Preserve COP invariants

Any change touching COP must preserve these invariants unless the change explicitly proposes a
versioned protocol revision:

- immutable Events and Artifacts;
- topic-local ordering;
- idempotency under at-least-once delivery;
- durability of meaningful state;
- stateless / replaceable handlers;
- durable `LogicalAgent` identity and resumable work state must not depend solely on inaccessible
  `HandlerInstance` memory;
- coordination via Events and Artifacts, not hidden direct coupling;
- deterministic replay of recorded traces and projections;
- explicit schema versioning;
- transparency over convenience.

If a shortcut violates one of these invariants, flag it clearly as non-conformant or experimental.

---

## 5. Abstract / implementation separation

When working on COP or related systems, separate:

- **abstract level** — concepts, invariants, interfaces, conformance;
- **implementation level** — concrete runtime, storage, bus, scheduler, UI, adapter, package;
- **instance level** — JHN-specific configuration, public definition, private overlays and situated
  mandates.

Do not let an implementation or one personal instance silently redefine the protocol. Do not let
protocol documents drift into untested speculation.

---

## 6. Documentation expectations

For significant changes, update or create the smallest useful document:

- README for package-level usage;
- architecture note for structural choices;
- implementation profile note for concrete runtimes;
- state-of-play note for living implementation status;
- issue comment for temporary continuation.

Documentation should state what is stable, what is experimental, and what remains to verify.

---

## 7. Testing and validation

Before presenting work as ready, run the relevant checks when available.

At minimum, report:

- commands run;
- tests passed or missing;
- failures and suspected causes;
- files intentionally not tested;
- assumptions requiring human review.

If no tests exist, say so and propose the smallest **sufficient** conformance or regression test that
can materially discriminate between the live hypotheses while keeping Exposure proportionate.
Do not minimize test risk so far that the test ceases to provide useful evidence.

For the JHN vertical slice, prefer integration tests that demonstrate governed real Acts rather than
only conversational quality.

---

## 8. Traceability and uncertainty

Agents must preserve traceability.

When making decisions, state:

- why the change was made;
- which issue or document it serves;
- what evidence supports it;
- what remains uncertain;
- what could break;
- for material Acts, what was put at stake and what recovery path exists.

For consequential execution, keep material actor / `HandlerInstance`, `LogicalAgent`, Principal,
Mandate, CapabilityInvocation, Act, evidence/effect and Imputation distinguishable where applicable.

Do not conceal uncertainty behind confident prose. Do not manufacture numeric risk estimates when
only qualitative bounds or explicit unknowns are defensible.

---

## 9. Human validation anchors

Stop and request human validation when a change affects:

- COP invariants;
- public doctrine or institutional positioning;
- licensing;
- security model;
- destructive or hard-to-recover data migrations;
- naming of major concepts;
- deletion of documents or package structure;
- anything likely to affect several repositories.

A valid explicit ongoing mandate may cover ordinary in-scope Acts whose Measured Risk fits the
standing envelope; use judgment rather than adding approval ceremony to every micro-action. Human
decision artifacts remain part of the governance model.

Human validation is not a substitute for measuring the consequence profile, and Measured Risk is
not a substitute for authority.

---

## 10. Existing agent tools and references

Use current documentation tools rather than guessing about third-party packages.

Also inspect, when present:

- `.rules.md`;
- `.ai-rules.md`;
- `.gemini.md`;
- `.api-docs.md`;
- `ARCHITECTURE.md`;
- `ROADMAP-TECH.md`;
- [`cogentia/AGENTS.md`](https://github.com/JeanHuguesRobert/cogentia/blob/main/AGENTS.md);
- [`cogentia/research/agent_configuration_layer.md`](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/agent_configuration_layer.md);
- [`cogentia/research/optimistic_mainline_governance.md`](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/optimistic_mainline_governance.md);
- [`cogentia/research/measured_risk.md`](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/measured_risk.md);
- [Inseme #51 — Exposure and Measured Risk](https://github.com/JeanHuguesRobert/inseme/issues/51).

If these files disagree with this document, preserve the conflict and report it. Do not silently
choose one.

---

## 11. Minimal completion report

Every substantial agent contribution should end with:

```text
Issue:
Files changed:
Tests run:
Expected value / reason:
Known risks / observed Exposure:
Recovery / correction path:
Residue or unresolved risk:
Next step:
Human validation needed: yes/no
```

This keeps multi-agent work reviewable, resumable, and compatible with the Cogentia / COP
traceability and Measured Risk doctrine.
