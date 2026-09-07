---
title: "COP/Mandated Agent Security — Authority, Measured Risk, Recovery, and Capacity Portability"
author: "Jean Hugues Noël Robert, baron Mariani"
affiliation: "Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica"
date: "2026-08-24"
last_modified_at: "2026-09-07"
version: "0.3"
status: "working-paper — profile: doctrinal alignment"
license: "CC BY-SA 4.0"
language: "en"
document_role: "source"
document_kind: "protocol-profile"
visibility: "public"
lifecycle_state: "working"
update_policy: "UP-DEFAULT-REVIEWED"
last_stamped_at: "unknown"
canonical_url: "https://github.com/JeanHuguesRobert/inseme/blob/main/packages/cop-core/COP_MANDATED_AGENT_SECURITY.md"
classification_source: "cogentia.js"
classification_version: "1"
classification_rule: "explicit-metadata"
classification_confidence: "strong"
provenance:
  origin_type: "repository"
  origin_repository: "JeanHuguesRobert/inseme"
  origin_ref: "https://github.com/JeanHuguesRobert/inseme/issues/51"
  origin_date: "2026-08-24"
  derived_from:
    - "COP_IDENTITY.md"
    - "COP_ACCOUNTING.md"
    - "Invariants.md"
    - "https://github.com/JeanHuguesRobert/cogentia/blob/main/research/measured_risk.md"
review:
  status: "unreviewed"
  reviewed_by: []
tags:
  - mandated-agent
  - security
  - authority
  - measured-risk
  - capacity-portability
  - cop-core
related_documents:
  - "COP_IDENTITY.md"
  - "COP_ACCOUNTING.md"
  - "Invariants.md"
  - "COP_MEASURED_RISK.md"
  - "docs/measured-risk-and-exposure.md"
  - "https://github.com/JeanHuguesRobert/cogentia/blob/main/research/measured_risk.md"
  - "https://github.com/JeanHuguesRobert/cogentia/blob/main/research/documents_as_cognitive_packets.md"
  - "https://github.com/JeanHuguesRobert/inseme/issues/51"
  - "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/souverainete_delegation_agents_mandates.md"
  - "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/security_model_representative_democracy.md"
---

# COP/Mandated Agent Security

## 1. Purpose

This profile translates the Corpus doctrine of sovereignty, bounded delegation, **Measured Risk**
and the **Mandated Agent** into COP conformance rules.

The governing distinction is:

```text
operational autonomy != autonomous authority
```

An agent MAY choose how to execute within an authorised space. It MUST NOT enlarge that authorised
space by its own decision.

Security is not defined here as universal risk minimization. A conforming implementation MAY permit
deliberate bounded risk inside an applicable Mandate when the objective, Exposure, uncertainty,
recovery possibilities and responsibility boundaries make that risk admissible.

> **Measured Risk can govern the use of authority; it cannot create authority.**

## 2. Mandated Agent

A **Mandated Agent** is an identifiable actor exercising capabilities for a principal under a
versioned, bounded, auditable and revocable mandate.

The actor MAY be human, software, institutional or hybrid. The security properties do not depend on
the actor being artificial.

A mandate authorises exercise. It does not transfer ownership of the source of authority.

## 3. Mandatory authority chain

Every consequential delegated act MUST make the following chain reconstructible:

```text
principal
-> authority source
-> mandate
-> actor / agent instance
-> capability invocation
-> consequential act
-> evidence
-> effect
-> accounting / receipt
```

Missing links MUST fail closed when the profile or local constitution classifies the act as engaging
or consequential.

Where Measured Risk materially affects the decision, the trace SHOULD also make reconstructible,
directly or by stable reference:

```text
objective / expected value or learning
accepted Exposure / effect ceiling
material uncertainty / unknowns
recovery assumptions
third-party / protected-interest boundary
stop or escalation condition
```

The exact schema remains experimental and is tracked in Inseme issue #51. Implementations MUST NOT
invent fake numerical precision merely to satisfy this trace expectation.

## 4. Non-self-elevation

A Mandated Agent MUST NOT, by its own authority:

- add a new permitted capability to its mandate;
- remove a prohibition;
- extend its validity period;
- increase an enforceable budget or resource ceiling;
- increase an enforceable Exposure, loss, disclosure or effect ceiling;
- widen recipient, data, endpoint, territorial or institutional scope;
- lower a required human or institutional approval gate;
- redefine the principal whose authority it exercises;
- turn a suggestion or recommendation into an authorisation;
- delegate more authority than it possesses.

A proposed elevation MAY be emitted as an Event or Artifact. Its activation MUST require an
authority path distinct from the requesting agent.

Risk appetite, positive expected value, available budget, prior success, model confidence or
apparent repairability MUST NOT be interpreted as authority elevation.

## 5. Mandate version pinning

Every consequential invocation MUST reference the exact mandate version evaluated before execution.

If the mandate has changed, expired, been suspended or revoked between planning and commitment, the
invocation MUST be re-evaluated before the external effect.

Silence, cached permission, prior success or model confidence MUST NOT substitute for an active
mandate.

## 6. Measured Risk and Exposure

A conforming implementation MUST NOT reduce consequential governance to a single Boolean such as:

```text
reversible = true | false
```

or a single scalar `riskLevel` when material dimensions are known to differ.

Risk is evaluated relative to an objective. Relevant dimensions MAY include:

```text
uncertainty / possible downside
Exposure / blast radius
possible propagation
OptionLoss
who receives gains and who bears losses
Reversibility Envelope
compensability
rectifiability
restitutability
repairability
recovery cost
possible residue
urgency / time-to-option-loss
```

A compact risk class MAY be used for routing as a projection. It MUST NOT silently erase a material
constraint required for authorization or recovery.

The operating rule is:

> **Prefer the smallest sufficient risk for useful progress inside the applicable Mandate, not the
> smallest attainable risk regardless of usefulness.**

This means:

- a less reversible Act MAY be admissible when Exposure is very small, the possible loss is
  authorized, and recovery/repair is cheap;
- a technically revertible Act MAY require stronger ex-ante control when it propagates, affects
  third parties, closes important options, discloses protected information, or leaves expensive
  residue;
- loss or error budgets are ceilings/envelopes, not quotas that SHOULD be consumed;
- losses and gains MUST NOT be silently netted across different Principals;
- unknown tail risk MUST NOT be silently classified as low risk.

If actual Exposure exceeds an enforceable ceiling, a required recovery path disappears, or a
material protected-interest/third-party effect appears outside the authorized envelope, the
implementation MUST stop, reduce scope, escalate, or enter an explicitly authorized damage-control
regime as applicable.

## 7. Revocation and recovery

Revocation and recovery MUST NOT collapse into `undo`.

At minimum, implementations declaring this profile MUST be able to distinguish the semantics of:

```text
suspend_future_authority
    temporarily block future exercise

revoke_future_authority
    terminate future exercise

cancel_pending_effect
    prevent a not-yet-committed effect

reverse_controlled_state
    restore state still under effective system control

compensate_committed_effect
    create a new semantically counteracting Act after commitment

rectify_record
    correct an erroneous representation or claim without falsifying history

restitute_value_or_object
    return value or an object where restitution is possible

repair_damage
    address damage that remains after the originating consequence

enter_damage_control
    temporarily prioritize containment and preservation of viability/options

accept_and_record_residue
    explicitly close recovery with attributable remaining consequences

record_nonrecoverable_effect
    preserve that a consequence cannot materially be restored under the current evidence/capability
```

These names are semantic categories, not yet mandatory Event type strings.

Stopping future authority does not erase past effects. COP MUST preserve the original trace and
express correction, compensation, restitution or repair through new Events / Artifacts / Acts as
appropriate.

A compensation is not necessarily a reversal. A compensation may itself fail, propagate, create
damage or require another governed Act.

An execution or compensation receipt is evidence from an executor, not proof that Reality is in the
intended state. For material external consequences, recovery SHOULD be followed by an appropriate
observation when feasible.

> **No recovery operation rewrites causality.**

## 8. Right of recovery

Where the governing constitution permits it, the principal MUST retain an effective recovery path
over delegated capability. Recovery MAY require stronger gates for collective, constitutional or
third-party-sensitive acts.

A system MUST NOT claim principal control merely because it offers a dashboard. The recovery path
must be operationally effective and testable.

Recovery need not mean perfect restoration. A valid recovery closure MAY include explicitly accepted
residue when further repair would be disproportionate under the applicable Mandate and rights/safety
constraints.

The decision to accept residue MUST remain attributable to an actor with authority over that
residue. An agent MUST NOT accept another Principal's uncompensated loss merely because further
repair is expensive to the agent or its own Principal.

## 9. Damage-control authority

A damage-control regime is distinct from normal execution and ordinary repair.

Its purpose is containment:

```text
prevent further deterioration
contain propagation
preserve critical invariants
preserve evidence and future options
stabilize
```

Damage-control authority MUST be bounded by an explicit or constitutionally defined trigger, scope
and exit condition. It MUST NOT silently become a permanent widening of ordinary authority.

Once the triggering condition no longer holds, the system MUST return to ordinary governance for
assessment, repair, responsibility and residue handling.

## 10. Capacity portability

Data export alone is insufficient for capacity portability.

A portable governed capability SHOULD export, in open and documented representations where legally
and technically possible:

- subject and actor references without collapsing them;
- mandate definitions and versions;
- policy and constitution references;
- relevant Events and Artifacts;
- provenance and evidence links;
- accounting receipts and unsettled commitments;
- capability descriptors;
- revocation state;
- material Exposure / recovery state where needed for safe continuation;
- schema versions;
- continuation state needed for safe resumption.

Secrets and provider credentials MUST NOT be exported merely for completeness. They SHOULD be
replaced by explicit unresolved capability requirements or re-binding instructions.

A receiving implementation MUST re-authorise local credentials and MUST NOT infer authority from
imported data alone.

## 11. Implementation plurality

COP compliance is a policy property, not a vendor identity.

Different runtimes, models, providers, stores and interfaces MAY implement the same governed
capability. Conformance depends on preservation of authority boundaries, trace, replay semantics,
accounting and recovery — not on using a canonical runtime.

This gives the architectural rule:

> **common governance policy, plural implementations, verifiable conformance.**

## 12. Minimum conformance tests

A conforming implementation MUST test at least:

1. **No mandate** — consequential delegated act is rejected.
2. **Expired mandate** — act is rejected.
3. **Revoked mandate** — act is rejected even if previously planned.
4. **Scope escalation** — self-requested widening does not activate itself.
5. **Budget escalation** — agent cannot raise its own ceiling.
6. **Exposure escalation** — agent cannot raise its own enforceable Exposure/effect ceiling.
7. **Child delegation** — child authority cannot exceed parent authority.
8. **Recommendation boundary** — recommendation does not become authorisation.
9. **Version race** — changed mandate forces re-evaluation before effect.
10. **Recovery** — authorised principal can suspend future authority.
11. **History preservation** — revocation, reversal, compensation, rectification or repair does not
    falsify or erase the prior Act/effect history.
12. **Non-binary recovery** — at least one test distinguishes cancellation, state reversal,
    compensation and repair rather than representing all as `undo`.
13. **Measured Risk inside mandate** — an in-scope bounded Act is not rejected merely because risk
    is non-zero when its declared Exposure/recovery profile is admissible.
14. **Measured Risk does not create mandate** — the same expected-value/risk rationale is rejected
    when authority is absent or the Exposure ceiling is exceeded.
15. **Third-party boundary** — positive aggregate value does not authorize an unmandated loss
    imposed on another Principal.
16. **Damage-control exit** — exceptional containment authority terminates or reverts to ordinary
    governance when its trigger no longer holds.
17. **Portability** — a governed capability can be exported and inspected without provider-specific
    hidden state being mistaken for authority.
18. **Rebinding** — imported capability requires local credential and authority binding before
    consequential execution.

## 13. Relationship to existing COP profiles

`COP_IDENTITY.md` defines the separation between subject, actor, principal, role, capacity and
mandate. This profile strengthens the security semantics of that separation.

`COP_ACCOUNTING.md` already requires bounded delegation, principal/actor attribution and resource
budgets. Measured Risk adds a distinct question: resource budget is what may be consumed; Exposure
is what may be put at stake; neither alone defines authority or acceptable residue.

`Invariants.md` remains the core protocol invariant set. The present profile is normative for
implementations declaring `cop/mandated-agent-security` conformance and is a candidate for future
promotion of selected rules into COP Core after implementation experience.

The representation of Exposure, Reversibility, and Measured Risk is formally defined in
`cop-core/src/measured-risk.js` and verified by `test/measured-risk.test.js` under Inseme issue #51,
providing inspectable schemas, monotonic attenuation, and stop conditions.

## 14. Open questions

The following remain deliberately unresolved:

- how collective principals authorise mandate or Exposure elevation;
- threshold and quorum semantics for emergency revocation / damage control;
- treatment of Acts whose Reversibility Envelope is extremely narrow or empty;
- which consequences must never be reduced to expected-value tradeoffs;
- how risk appetite / tolerance attenuate through delegated mandates;
- how child packets reserve or consume shared Exposure / loss budgets;
- cryptographic proof formats for portable mandate bundles;
- cross-instance equivalence of capability descriptors;
- how much risk/recovery state belongs in portable receipts versus referenced Corpus documents;
- how accepted residue is represented without converting the agent into the authority that accepts
  it.

These questions MUST be resolved by explicit profiles, Mandates or constitutions, not by hidden
runtime defaults.
