import { describe, it, expect } from "vitest";
import {
  createMeasuredRiskProfile,
  createObservedExposure,
  evaluateMeasuredRisk,
  attenuateMeasuredRisk,
  transitionToDamageControl,
  assessRepairFrontier,
  checkStopConditions,
} from "../src/measured-risk.js";
import {
  evaluateMandate,
  recordMandateDeclaration,
  invokeGovernedCapability,
} from "../src/governed-act.js";
import { createCopEventEnvelope } from "../src/cop-event-envelope.js";

/**
 * In-memory append-only COP event store fixture.
 */
function createMemoryCopStore() {
  const events = [];
  return {
    append(envelope) {
      const e = envelope.schema ? envelope : createCopEventEnvelope(envelope);
      events.push(e);
      return { ok: true, event: e };
    },
    replay() {
      return structuredClone(events);
    },
    listTopic(topicId) {
      return structuredClone(
        events.filter((e) => e.topic?.id === topicId || e.topic_id === topicId)
      );
    },
    get raw() {
      return events;
    },
  };
}

/**
 * Mock provider handler.
 */
function createMockHandler({ result = { executed: true }, failWith = null } = {}) {
  let callCount = 0;
  const calls = [];
  return {
    get callCount() {
      return callCount;
    },
    get calls() {
      return calls;
    },
    async invoke(input) {
      callCount += 1;
      calls.push(input);
      if (failWith) throw failWith;
      return result;
    },
  };
}

describe("COP Measured Risk & Bounded Exposure (Issue #51)", () => {
  const PRINCIPAL_ALICE = "principal:alice";
  const AGENT_BOB = "agent:bob";
  const THIRD_PARTY_CHARLIE = "principal:charlie";
  const MANDATE_ID = "mandate:mnd-alice-bob@v1";

  // --------------------------------------------------------------------------
  // Case 1: Pure Cognitive Experiment
  // High uncertainty, no external effect -> admissible under standing mandate
  // --------------------------------------------------------------------------
  it("Case 1: pure cognitive experiment (high uncertainty, sandbox scope, no external effect) is admissible", () => {
    const mandate = {
      mandate_id: MANDATE_ID,
      principal_ref: PRINCIPAL_ALICE,
      logical_agent_ref: AGENT_BOB,
      status: "active",
      scope: {
        allowed_actions: ["ai:reasoning", "tool:simulate"],
        max_exposure: {
          scope: "sandbox",
          external_effects: "none",
          max_cost: 50,
        },
      },
    };

    const riskProfile = createMeasuredRiskProfile({
      objective: {
        kind: "experiment",
        expected_value: "test whether hypothesis H holds in simulation",
        discriminating_power: "high",
        learning_hypothesis: "H_zero_leakage",
      },
      risk: {
        class: "experimental",
        uncertainty: "high",
        tail: "bounded",
      },
      exposure: {
        max_cost: 5,
        affected_subjects: 1,
        scope: "sandbox",
        external_effects: "none",
      },
      recovery: {
        state_reversal: "full",
        compensation: "none",
        repairability: "high",
        expected_residue: "none",
      },
      responsibility: {
        loss_bearer_principal_ref: PRINCIPAL_ALICE,
        third_parties_affected: false,
      },
    });

    const evalResult = evaluateMeasuredRisk({
      mandate,
      measured_risk: riskProfile,
      capability: "ai:reasoning",
    });

    expect(evalResult.admissible).toBe(true);
    expect(evalResult.decision).toBe("admissible");
    expect(evalResult.error).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // Case 2: Small Real-World Experiment
  // Bounded Exposure, incomplete reversibility, cheap repair, high info value
  // --------------------------------------------------------------------------
  it("Case 2: small real-world experiment (bounded exposure, cheap repair, partial reversibility) is admissible", () => {
    const mandate = {
      mandate_id: MANDATE_ID,
      principal_ref: PRINCIPAL_ALICE,
      logical_agent_ref: AGENT_BOB,
      status: "active",
      scope: {
        allowed_actions: ["api:provider_call"],
        max_exposure: {
          scope: "external_public",
          external_effects: "bounded",
          max_cost: 50,
        },
      },
    };

    const riskProfile = createMeasuredRiskProfile({
      objective: {
        kind: "experiment",
        expected_value: "validate real API rate limits under actual network load",
        discriminating_power: "high",
      },
      risk: {
        class: "experimental",
        uncertainty: "medium",
        tail: "bounded",
      },
      exposure: {
        max_cost: 20, // 20 EUR/USD
        affected_subjects: 1,
        scope: "external_public",
        external_effects: "bounded",
      },
      recovery: {
        state_reversal: "partial",
        compensation: "available",
        repairability: "high",
        recovery_cost: "cheap",
        expected_residue: "low",
      },
      responsibility: {
        loss_bearer_principal_ref: PRINCIPAL_ALICE,
        third_parties_affected: false,
      },
    });

    const evalResult = evaluateMeasuredRisk({
      mandate,
      measured_risk: riskProfile,
      capability: "api:provider_call",
    });

    expect(evalResult.admissible).toBe(true);
    expect(evalResult.decision).toBe("admissible");
  });

  // --------------------------------------------------------------------------
  // Case 3: Technically Reversible but Propagating Act
  // Low local rollback cost, but third-party reliance / high OptionLoss
  // --------------------------------------------------------------------------
  it("Case 3: propagating act with high option-loss without stop conditions is refused", () => {
    const mandate = {
      mandate_id: MANDATE_ID,
      principal_ref: PRINCIPAL_ALICE,
      logical_agent_ref: AGENT_BOB,
      status: "active",
      scope: {
        allowed_actions: ["social:post_announcement"],
        max_exposure: {
          scope: "external_public",
          external_effects: "propagating",
        },
      },
    };

    // Propagating external effect with high option loss but NO stop conditions
    const unguardedProfile = createMeasuredRiskProfile({
      objective: {
        kind: "exploration",
        expected_value: "gauge market reaction to unreleased pricing",
      },
      risk: {
        class: "high_uncertainty",
        uncertainty: "high",
        tail: "bounded",
      },
      exposure: {
        max_cost: 10,
        affected_subjects: 1000,
        scope: "external_public",
        external_effects: "propagating",
      },
      recovery: {
        state_reversal: "full", // technically can delete post locally
        compensation: "none",
        repairability: "low",
        option_loss: "high", // but screenshots propagate!
        stop_conditions: [], // missing stop conditions!
      },
      responsibility: {
        loss_bearer_principal_ref: PRINCIPAL_ALICE,
        third_parties_affected: true,
      },
    });

    const evalResult = evaluateMeasuredRisk({
      mandate,
      measured_risk: unguardedProfile,
      capability: "social:post_announcement",
    });

    expect(evalResult.admissible).toBe(false);
    expect(evalResult.error).toBe("propagating_option_loss_unguarded");
  });

  // --------------------------------------------------------------------------
  // Case 4: High-Effect Act
  // Explicit Mandate required, ex-ante scrutiny, stop-loss and recovery plan
  // --------------------------------------------------------------------------
  it("Case 4: high-effect act requires explicit mandate matching scope and stop conditions", () => {
    // Mandate only allows internal sandbox scope
    const restrictedMandate = {
      mandate_id: MANDATE_ID,
      principal_ref: PRINCIPAL_ALICE,
      logical_agent_ref: AGENT_BOB,
      status: "active",
      scope: {
        allowed_actions: ["infra:deploy_production"],
        max_exposure: {
          scope: "local_internal",
          external_effects: "bounded",
          max_cost: 100,
        },
      },
    };

    const highEffectProfile = createMeasuredRiskProfile({
      objective: {
        kind: "dispositive",
        expected_value: "rollout core payment gateway update",
      },
      risk: {
        class: "critical",
        uncertainty: "medium",
        tail: "bounded",
      },
      exposure: {
        max_cost: 500, // exceeds 100 limit!
        affected_subjects: 10000,
        scope: "external_public", // exceeds local_internal!
        external_effects: "propagating",
      },
      recovery: {
        state_reversal: "partial",
        compensation: "available",
        repairability: "medium",
        option_loss: "bounded",
        stop_conditions: ["error_rate > 1%", "latency > 500ms"],
      },
      responsibility: {
        loss_bearer_principal_ref: PRINCIPAL_ALICE,
        third_parties_affected: true,
      },
    });

    // 1. Refused because exposure scope and cost exceed mandate
    const evalRefused = evaluateMeasuredRisk({
      mandate: restrictedMandate,
      measured_risk: highEffectProfile,
      capability: "infra:deploy_production",
    });
    expect(evalRefused.admissible).toBe(false);
    expect(evalRefused.error).toBe("exposure_scope_exceeded");

    // 2. When explicit elevated mandate is granted with appropriate exposure ceiling -> admissible
    const elevatedMandate = {
      ...restrictedMandate,
      scope: {
        allowed_actions: ["infra:deploy_production"],
        max_exposure: {
          scope: "external_public",
          external_effects: "propagating",
          max_cost: 1000,
        },
      },
    };
    const evalAdmitted = evaluateMeasuredRisk({
      mandate: elevatedMandate,
      measured_risk: highEffectProfile,
      capability: "infra:deploy_production",
    });
    expect(evalAdmitted.admissible).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Case 5: Repair Frontier & Explicit Residue
  // Marginal recovery cost > restored value -> accept explicit residue
  // --------------------------------------------------------------------------
  it("Case 5: repair frontier accepts explicit residue when further recovery exceeds value restored", () => {
    // 1. Where recovery cost (100) > restored value (10) -> accept residue
    const assessment = assessRepairFrontier({
      restored_value: 10,
      recovery_cost: 100,
      unresolved_residue: ["minor_log_discrepancy_5_bytes"],
      rights_violation: false,
    });
    expect(assessment.action).toBe("accept_residue");
    expect(assessment.residue).toEqual(["minor_log_discrepancy_5_bytes"]);
    expect(assessment.reason).toContain("repair frontier reached");

    // 2. Where rights violation is involved -> cost-benefit cannot trade it off!
    const rightsAssessment = assessRepairFrontier({
      restored_value: 10,
      recovery_cost: 100,
      unresolved_residue: ["unauthorized_pii_retained"],
      rights_violation: true,
    });
    expect(rightsAssessment.action).toBe("continue_repair");
    expect(rightsAssessment.reason).toContain(
      "rights violation cannot be converted to accepted residue"
    );
  });

  // --------------------------------------------------------------------------
  // Case 6: Damage Control Regime
  // Actual Exposure exceeds normal envelope -> stop condition fires -> containment mode
  // --------------------------------------------------------------------------
  it("Case 6: damage control triggers upon stop condition and expires after duration", () => {
    const profile = createMeasuredRiskProfile({
      objective: {
        kind: "experiment",
        expected_value: "high throughput ingestion probe",
      },
      risk: {
        class: "experimental",
        uncertainty: "high",
        tail: "bounded",
      },
      exposure: {
        max_cost: 50,
        affected_subjects: 5,
        scope: "sandbox",
        external_effects: "bounded",
      },
      recovery: {
        state_reversal: "full",
        compensation: "none",
        repairability: "high",
        expected_residue: "none",
        stop_conditions: ["exposure_limit_reached", "third_party_effect_detected"],
      },
      responsibility: {
        loss_bearer_principal_ref: PRINCIPAL_ALICE,
      },
    });

    // 1. Observed exposure exceeds max_cost (65 > 50)
    const observed = createObservedExposure({
      observed_cost: 65,
      observed_affected_subjects: 1,
    });

    const stopCheck = checkStopConditions({ profile, observed });
    expect(stopCheck.triggered).toBe(true);
    expect(stopCheck.condition).toBe("exposure_limit_reached");

    // 2. Transition profile into Damage Control mode
    const dcProfile = transitionToDamageControl(profile, "exposure limit breached", {
      duration_minutes: 30,
      containment_mode: "circuit_breaker_open",
    });

    expect(dcProfile.damage_control.active).toBe(true);
    expect(dcProfile.damage_control.containment_mode).toBe("circuit_breaker_open");
    expect(dcProfile.damage_control.expires_at).toBeDefined();

    // 3. In damage control, exploratory acts are refused
    const mandate = {
      mandate_id: MANDATE_ID,
      principal_ref: PRINCIPAL_ALICE,
      logical_agent_ref: AGENT_BOB,
      status: "active",
      scope: { allowed_actions: ["data:probe", "remediation:rollback"] },
    };

    const evalExploratory = evaluateMeasuredRisk({
      mandate,
      measured_risk: dcProfile,
      capability: "data:probe",
    });
    expect(evalExploratory.admissible).toBe(false);
    expect(evalExploratory.error).toBe("damage_control_active");

    // 4. Remediation act is admissible in damage control
    const remediationProfile = {
      ...dcProfile,
      objective: {
        kind: "remediation",
        expected_value: "contain blast radius and rollback",
      },
    };
    const evalRemediation = evaluateMeasuredRisk({
      mandate,
      measured_risk: remediationProfile,
      capability: "remediation:rollback",
    });
    expect(evalRemediation.admissible).toBe(true);

    // 5. Expired damage control authority is refused
    const expiredDcProfile = {
      ...remediationProfile,
      damage_control: {
        ...dcProfile.damage_control,
        expires_at: new Date(Date.now() - 10000).toISOString(), // expired 10s ago
      },
    };
    const evalExpired = evaluateMeasuredRisk({
      mandate,
      measured_risk: expiredDcProfile,
      capability: "remediation:rollback",
    });
    expect(evalExpired.admissible).toBe(false);
    expect(evalExpired.error).toBe("damage_control_expired");
  });

  // --------------------------------------------------------------------------
  // Conformance Criterion AC13: Measured Risk Inside Mandate
  // In-scope bounded Act is not rejected merely because risk is non-zero
  // --------------------------------------------------------------------------
  it("AC13: in-scope bounded act is not rejected merely because uncertainty/risk is non-zero", async () => {
    const store = createMemoryCopStore();
    const handler = createMockHandler({ result: { simulated: true } });

    recordMandateDeclaration(store, {
      mandate_id: MANDATE_ID,
      version: "v1",
      principal_ref: PRINCIPAL_ALICE,
      logical_agent_ref: AGENT_BOB,
      scope: {
        allowed_actions: ["sim:experiment"],
        max_exposure: {
          scope: "sandbox",
          external_effects: "none",
          max_cost: 100,
        },
      },
    });

    const riskProfile = createMeasuredRiskProfile({
      objective: {
        kind: "experiment",
        expected_value: "explore state space",
        discriminating_power: "high",
      },
      risk: {
        class: "experimental",
        uncertainty: "high", // High uncertainty!
        tail: "bounded",
      },
      exposure: {
        max_cost: 25,
        scope: "sandbox",
        external_effects: "none",
      },
      recovery: {
        state_reversal: "full",
        compensation: "none",
        repairability: "high",
        expected_residue: "none",
      },
      responsibility: {
        loss_bearer_principal_ref: PRINCIPAL_ALICE,
      },
    });

    const result = await invokeGovernedCapability({
      store,
      handler,
      identity: {
        principal_ref: PRINCIPAL_ALICE,
        mandate_ref: MANDATE_ID,
        logical_agent_ref: AGENT_BOB,
      },
      capability: "sim:experiment",
      measured_risk: riskProfile,
    });

    expect(result.ok).toBe(true);
    expect(handler.callCount).toBe(1);

    // Verify events carry measured_risk
    const events = store.replay();
    const inv = events.find((e) => e.payload?.kind === "CapabilityInvocation");
    expect(inv.payload.measured_risk).toBeDefined();
    expect(inv.payload.measured_risk.objective.kind).toBe("experiment");
  });

  // --------------------------------------------------------------------------
  // Conformance Criterion AC14: Measured Risk Does Not Create Mandate
  // Expected-value rationale rejected when mandate absent or ceiling exceeded
  // --------------------------------------------------------------------------
  it("AC14: positive expected value / learning rationale rejected when authority absent or ceiling exceeded", async () => {
    const store = createMemoryCopStore();
    const handler = createMockHandler();

    const highValueRiskProfile = createMeasuredRiskProfile({
      objective: {
        kind: "experiment",
        expected_value: "transformative learning with enormous upside",
      },
      risk: {
        class: "experimental",
        uncertainty: "high",
        tail: "bounded",
      },
      exposure: {
        max_cost: 50,
        scope: "sandbox",
        external_effects: "none",
      },
      recovery: {
        state_reversal: "full",
        compensation: "available",
        repairability: "high",
        expected_residue: "none",
      },
      responsibility: {
        loss_bearer_principal_ref: PRINCIPAL_ALICE,
      },
    });

    // 1. Rejection when mandate does not exist (cannot self-authorize via expected value)
    const resNoMandate = await invokeGovernedCapability({
      store,
      handler,
      identity: {
        principal_ref: PRINCIPAL_ALICE,
        mandate_ref: "mandate:non-existent@v1",
        logical_agent_ref: AGENT_BOB,
      },
      capability: "repo:write",
      measured_risk: highValueRiskProfile,
    });
    expect(resNoMandate.ok).toBe(false);
    expect(resNoMandate.error).toBe("mandate_not_found");
    expect(handler.callCount).toBe(0);

    // 2. Rejection when exposure ceiling is exceeded
    recordMandateDeclaration(store, {
      mandate_id: MANDATE_ID,
      version: "v1",
      principal_ref: PRINCIPAL_ALICE,
      logical_agent_ref: AGENT_BOB,
      scope: {
        allowed_actions: ["repo:write"],
        max_exposure: {
          max_cost: 10, // Max cost is 10, but profile asks for 50!
          scope: "sandbox",
          external_effects: "none",
        },
      },
    });

    const resCeilingExceeded = await invokeGovernedCapability({
      store,
      handler,
      identity: {
        principal_ref: PRINCIPAL_ALICE,
        mandate_ref: MANDATE_ID,
        logical_agent_ref: AGENT_BOB,
      },
      capability: "repo:write",
      measured_risk: highValueRiskProfile,
    });
    expect(resCeilingExceeded.ok).toBe(false);
    expect(resCeilingExceeded.error).toBe("exposure_ceiling_exceeded");
    expect(handler.callCount).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Guardrail: Non-Externalization of Losses
  // --------------------------------------------------------------------------
  it("Non-externalization: attempting to assign losses to a non-authorizing principal is rejected", () => {
    const mandate = {
      mandate_id: MANDATE_ID,
      principal_ref: PRINCIPAL_ALICE,
      logical_agent_ref: AGENT_BOB,
      status: "active",
      scope: { allowed_actions: ["tool:action"] },
    };

    const externalizedProfile = createMeasuredRiskProfile({
      objective: { kind: "experiment", expected_value: "test externalized cost" },
      risk: { class: "routine", uncertainty: "low", tail: "bounded" },
      exposure: { max_cost: 10, scope: "sandbox", external_effects: "none" },
      recovery: {
        state_reversal: "full",
        compensation: "none",
        repairability: "high",
        expected_residue: "none",
      },
      responsibility: {
        beneficiary_principal_ref: PRINCIPAL_ALICE,
        loss_bearer_principal_ref: THIRD_PARTY_CHARLIE, // Charlie bears loss without mandate!
      },
    });

    const evalResult = evaluateMeasuredRisk({
      mandate,
      measured_risk: externalizedProfile,
      capability: "tool:action",
    });

    expect(evalResult.admissible).toBe(false);
    expect(evalResult.error).toBe("unauthorized_loss_externalization");
  });

  // --------------------------------------------------------------------------
  // Monotonic Attenuation of Measured Risk (Authority(child) <= Authority(parent))
  // --------------------------------------------------------------------------
  it("Monotonic Attenuation: child risk profile cannot exceed parent exposure or tail tolerance", () => {
    const parentProfile = createMeasuredRiskProfile({
      objective: { kind: "exploration", expected_value: "parent search" },
      risk: { class: "routine", uncertainty: "medium", tail: "bounded" },
      exposure: {
        max_cost: 100,
        affected_subjects: 5,
        scope: "local_internal",
        external_effects: "bounded",
      },
      recovery: {
        state_reversal: "full",
        compensation: "none",
        repairability: "high",
        expected_residue: "none",
      },
      responsibility: { loss_bearer_principal_ref: PRINCIPAL_ALICE },
    });

    // 1. Valid child within parent bounds
    const validChild = createMeasuredRiskProfile({
      objective: { kind: "experiment", expected_value: "child sub-search" },
      risk: { class: "routine", uncertainty: "low", tail: "bounded" },
      exposure: { max_cost: 25, affected_subjects: 1, scope: "sandbox", external_effects: "none" },
      recovery: {
        state_reversal: "full",
        compensation: "none",
        repairability: "high",
        expected_residue: "none",
      },
      responsibility: { loss_bearer_principal_ref: PRINCIPAL_ALICE },
    });
    const attValid = attenuateMeasuredRisk(parentProfile, validChild);
    expect(attValid.ok).toBe(true);
    expect(attValid.attenuated_profile.exposure.max_cost).toBe(25);

    // 2. Child scope wider than parent (external_public > local_internal) -> rejected
    const invalidScopeChild = createMeasuredRiskProfile({
      ...validChild,
      exposure: { ...validChild.exposure, scope: "external_public" },
    });
    const attInvalidScope = attenuateMeasuredRisk(parentProfile, invalidScopeChild);
    expect(attInvalidScope.ok).toBe(false);
    expect(attInvalidScope.error).toContain("exceeds parent scope");

    // 3. Child cost exceeds parent (150 > 100) -> rejected
    const invalidCostChild = createMeasuredRiskProfile({
      ...validChild,
      exposure: { ...validChild.exposure, max_cost: 150 },
    });
    const attInvalidCost = attenuateMeasuredRisk(parentProfile, invalidCostChild);
    expect(attInvalidCost.ok).toBe(false);
    expect(attInvalidCost.error).toContain("exceeds parent ceiling");

    // 4. Child tail risk exceeds parent (catastrophic > bounded) -> rejected
    const invalidTailChild = createMeasuredRiskProfile({
      ...validChild,
      risk: { ...validChild.risk, tail: "catastrophic" },
    });
    const attInvalidTail = attenuateMeasuredRisk(parentProfile, invalidTailChild);
    expect(attInvalidTail.ok).toBe(false);
    expect(attInvalidTail.error).toContain("exceeds parent risk tolerance");
  });
});
