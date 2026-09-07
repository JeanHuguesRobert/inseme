---
title:
  "COP/Measured Risk and Exposure — Bounded Experimentation, Recovery Envelopes, and Consequential
  Ceilings"
subtitle: "Normative profile, schema specification, and implementation guide for COP Core"
author: "Jean Hugues Noël Robert, baron Mariani"
affiliation: "Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica"
date: "2026-09-07"
last_modified_at: "2026-09-07"
version: "0.1"
status: "working-paper — implementation verified"
license: "CC BY-SA 4.0"
language: "en"
ai_assisted_by:
  - "Antigravity (drafting, schema formalization, and test suite implementation)"
human_arbitration_by: "Jean Hugues Noël Robert"
document_role: "source"
document_kind: "protocol-profile"
document_function: "normative-specification"
visibility: "public"
lifecycle_state: "working"
update_policy: "UP-DEFAULT-REVIEWED"
last_stamped_at: "unknown"
canonical_url: "https://github.com/JeanHuguesRobert/inseme/blob/main/packages/cop-core/COP_MEASURED_RISK.md"
classification_source: "cogentia.js"
classification_version: "1"
classification_rule: "explicit-metadata"
classification_confidence: "strong"
provenance:
  origin_type: "conversation"
  origin_repository: "JeanHuguesRobert/inseme"
  origin_ref: "https://github.com/JeanHuguesRobert/inseme/issues/51"
  origin_date: "2026-09-07"
  derived_from:
    - "https://github.com/JeanHuguesRobert/cogentia/blob/main/research/measured_risk.md"
    - "COP_MANDATED_AGENT_SECURITY.md"
    - "Invariants.md"
review:
  status: "unreviewed"
  reviewed_by: []
tags:
  - measured-risk
  - exposure
  - reversibility-envelope
  - damage-control
  - repair-frontier
  - cop-core
  - governance
related_documents:
  - "COP_MANDATED_AGENT_SECURITY.md"
  - "COP_ACCOUNTING.md"
  - "Invariants.md"
  - "docs/measured-risk-and-exposure.md"
  - "https://github.com/JeanHuguesRobert/cogentia/blob/main/research/measured_risk.md"
  - "https://github.com/JeanHuguesRobert/inseme/issues/51"
---

# COP/Measured Risk and Exposure

Normative Reference & Implementation Guide  
Parent Tracking Issue: [#51](https://github.com/JeanHuguesRobert/inseme/issues/51)  
Source Doctrine:
[`cogentia/research/measured_risk.md`](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/measured_risk.md)  
Package:
`@inseme/cop-core`

---

## 1. Executive Summary

The Cogentia / COP architecture rejects two symmetric governance errors:

- **Risk Minimization:** Treating risk itself as a defect and suppressing useful action whenever
  uncertainty cannot be eliminated.
- **Recklessness:** Treating high upside or positive expected value as sufficient justification to
  ignore exposure, mandates, and externalized harm.

**Measured Risk** governs for worthwhile progress by identifying and bounding the **smallest
sufficient risk** (_the least Exposure that still has enough discriminating power or expected value
to justify the experiment_).

---

## 2. Core Dimensional Separations

An implementation conforming to `cop/mandated-agent-security` and `cop-core` MUST NOT collapse these
distinct concepts:

| Dimension          | Definition                                     | Governing Question                              |
| ------------------ | ---------------------------------------------- | ----------------------------------------------- |
| **Objective**      | Value, learning, or optionality sought         | What gain or learning justifies this act?       |
| **Budget**         | Scarce resources consumed during execution     | What is spent (compute, tokens, money)?         |
| **Exposure**       | Blast radius put at stake in Reality           | What can be affected externally?                |
| **Mandate**        | Authorized scope granted by Principal          | What is the agent permitted to do?              |
| **Risk**           | Uncertainty and downside relative to objective | What can go wrong, and what is the tail?        |
| **Reversibility**  | Recovery structure and paths                   | What can be restored, compensated, or repaired? |
| **Residue**        | What remains after reasonable recovery         | What consequence is explicitly accepted?        |
| **Responsibility** | Distribution of gains and losses               | Who benefits and who bears losses?              |

---

## 3. Schema & Envelope Definitions

### 3.1 Objective Descriptor

```typescript
export interface ObjectiveDescriptor {
  kind: "experiment" | "routine" | "exploration" | "remediation" | "dispositive";
  expected_value: string;
  discriminating_power?: "low" | "medium" | "high";
  learning_hypothesis?: string;
}
```

### 3.2 Risk Descriptor

```typescript
export interface RiskDescriptor {
  class: "experimental" | "routine" | "high_uncertainty" | "critical";
  uncertainty: "low" | "medium" | "high" | "unknown";
  tail: "negligible" | "bounded" | "unknown" | "catastrophic";
  risk_level_scalar?: "low" | "medium" | "high" | "critical";
}
```

### 3.3 Exposure Envelope

```typescript
export interface ExposureEnvelope {
  max_cost?: string | number;
  affected_subjects?: number;
  scope: "sandbox" | "local_internal" | "shared_internal" | "external_public" | "third_party";
  external_effects: "none" | "bounded" | "propagating" | "irreversible";
  consequential_ceiling?: Record<string, number | string>;
}
```

### 3.4 Reversibility Envelope

```typescript
export interface ReversibilityEnvelope {
  state_reversal: "full" | "partial" | "none";
  compensation: "available" | "partial" | "none";
  restitutability?: "full" | "partial" | "none";
  repairability: "high" | "medium" | "low" | "none";
  expected_residue: "none" | "low" | "material";
  recovery_cost?: "negligible" | "cheap" | "expensive" | "prohibitive";
  option_loss?: "none" | "bounded" | "high";
  stop_conditions?: string[];
}
```

### 3.5 Damage Control State

```typescript
export interface DamageControlState {
  active: boolean;
  trigger_reason?: string;
  containment_mode?: string;
  entered_at?: string;
  expires_at?: string; // Emergency authority MUST have an explicit expiry
}
```

---

## 4. Key Doctrines Enforced

### 4.1 Authority Primacy (AC14)

Positive expected value or high learning value **never** creates authority. If a capability or
exposure exceeds the active Mandate, the Act is rejected (`authority_refused` /
`exposure_ceiling_exceeded`).

### 4.2 Smallest Sufficient Risk / Non-Zero Admissibility (AC13)

An in-scope bounded Act is **not** rejected merely because risk is non-zero or uncertainty is high,
provided its declared Exposure and recovery profile are admissible.

### 4.3 Non-Externalization of Losses

Losses and gains must not be silently netted across Principal boundaries. If
`responsibility.loss_bearer_principal_ref` differs from the authorizing Principal without an
explicit mandate, execution is rejected (`unauthorized_loss_externalization`).

### 4.4 Monotonic Attenuation

When work is delegated or spawned into downstream packets:
$$\text{Exposure}(\text{child}) \subseteq \text{Exposure}(\text{parent})$$ Child packets cannot
enlarge exposure scope, increase cost ceilings, or accept higher tail risks than their upstream
parent (`attenuateMeasuredRisk`).

### 4.5 Repair Frontier & Explicit Residue

Continue repair while marginal restoration value > marginal recovery cost. When further recovery
costs more than the value restored, the system enters an explicit accepted residue state rather than
an endless loop (`assessRepairFrontier`). Hard rights violations cannot be traded off.

### 4.6 Damage Control Regime

When actual observed exposure breaches an authorized limit, a stop condition triggers, transitioning
the profile into containment mode with an explicit expiration timestamp
(`transitionToDamageControl`). Exploratory acts are suspended until stabilization.

---

## 5. Answers to Issue #51 Architectural Questions

1. **First-class vs profile:** Structured profile `measured_risk` on the Cognitive Packet envelope
   and `CapabilityInvocation`, with `observed_exposure` on `Trace` and `Imputation`.
2. **Generic Core dimensions:** `max_cost`, `affected_subjects`, `scope` hierarchy, and
   `external_effects` hierarchy.
3. **Cascade composition:** Strictly monotonic via `attenuateMeasuredRisk`.
4. **Ex-ante vs Ex-post:** Ex-ante ceiling is in `exposure`; ex-post reality is in
   `observed_exposure`.
5. **Routing interaction:** `risk_level_scalar` provides a lightweight projection for `riskPenalty`
   routing without erasing multi-dimensional governance.
6. **Recovery structure:** Compact `ReversibilityEnvelope` specifying reversal, compensation,
   repairability, option loss, and stop conditions.
7. **Tolerance attenuation:** Non-increasing monotonic attenuation; children cannot widen risk
   appetite.
8. **Aggregate micro-losses:** Monitored against `max_cost` and `affected_subjects`, triggering
   `exposure_limit_reached` upon breach.
9. **Hard tail ceilings:** `catastrophic` tail risk and `unknown` tail risk with `irreversible`
   effects are categorically inadmissible under ordinary operational mandates.
10. **Extensibility:** Open scalar/object ceilings and stop-condition string arrays preserve
    protocol simplicity without ontology bloat.
