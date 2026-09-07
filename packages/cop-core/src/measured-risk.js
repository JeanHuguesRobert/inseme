/**
 * COP Measured Risk and Exposure Module (Issue #51)
 *
 * Implements the Cogentia Measured Risk doctrine (cogentia/research/measured_risk.md):
 * - Risk minimization is not the objective: seek the smallest sufficient risk.
 * - Distinct dimensions: Objective != Budget != Exposure != Mandate != Risk != Recovery.
 * - Reversibility Envelope instead of boolean reversible.
 * - Monotonic mandate attenuation of risk tolerance and exposure.
 * - Guardrails against loss externalization, catastrophic tail omission, and perpetual damage control.
 *
 * @module measured-risk
 * @since 1.2
 */

/** Scope hierarchy from narrowest to widest */
export const EXPOSURE_SCOPE_ORDER = {
  sandbox: 0,
  local_internal: 1,
  shared_internal: 2,
  external_public: 3,
  third_party: 4,
};

/** External effect hierarchy from least to most severe */
export const EXTERNAL_EFFECT_ORDER = {
  none: 0,
  bounded: 1,
  propagating: 2,
  irreversible: 3,
};

/** Tail risk hierarchy */
export const TAIL_RISK_ORDER = {
  negligible: 0,
  bounded: 1,
  unknown: 2,
  catastrophic: 3,
};

/**
 * Create a normalized Measured Risk profile.
 *
 * @param {object} input
 * @returns {import("./types.js").MeasuredRiskProfile}
 */
export function createMeasuredRiskProfile(input) {
  if (!input) throw new TypeError("input is required for createMeasuredRiskProfile");
  if (!input.objective) throw new TypeError("objective is required");
  if (!input.objective.expected_value) throw new TypeError("objective.expected_value is required");
  if (!input.risk) throw new TypeError("risk is required");
  if (!input.exposure) throw new TypeError("exposure is required");
  if (!input.exposure.scope) throw new TypeError("exposure.scope is required");
  if (!input.exposure.external_effects)
    throw new TypeError("exposure.external_effects is required");
  if (!input.recovery) throw new TypeError("recovery is required");
  if (!input.responsibility) throw new TypeError("responsibility is required");
  if (!input.responsibility.loss_bearer_principal_ref) {
    throw new TypeError("responsibility.loss_bearer_principal_ref is required");
  }

  return {
    objective: {
      kind: input.objective.kind || "experiment",
      expected_value: input.objective.expected_value,
      discriminating_power: input.objective.discriminating_power || "medium",
      learning_hypothesis: input.objective.learning_hypothesis,
    },
    risk: {
      class: input.risk.class || "routine",
      uncertainty: input.risk.uncertainty || "low",
      tail: input.risk.tail || "bounded",
      risk_level_scalar: input.risk.risk_level_scalar,
    },
    exposure: {
      max_cost: input.exposure.max_cost,
      affected_subjects: input.exposure.affected_subjects ?? 1,
      scope: input.exposure.scope,
      external_effects: input.exposure.external_effects,
      consequential_ceiling: input.exposure.consequential_ceiling,
    },
    recovery: {
      state_reversal: input.recovery.state_reversal || "none",
      compensation: input.recovery.compensation || "none",
      restitutability: input.recovery.restitutability || "none",
      repairability: input.recovery.repairability || "none",
      expected_residue: input.recovery.expected_residue || "none",
      recovery_cost: input.recovery.recovery_cost || "negligible",
      option_loss: input.recovery.option_loss || "none",
      stop_conditions: Array.isArray(input.recovery.stop_conditions)
        ? [...input.recovery.stop_conditions]
        : [],
    },
    responsibility: {
      beneficiary_principal_ref: input.responsibility.beneficiary_principal_ref,
      loss_bearer_principal_ref: input.responsibility.loss_bearer_principal_ref,
      third_parties_affected: Boolean(input.responsibility.third_parties_affected),
    },
    damage_control: input.damage_control
      ? {
          active: Boolean(input.damage_control.active),
          trigger_reason: input.damage_control.trigger_reason,
          containment_mode: input.damage_control.containment_mode,
          entered_at: input.damage_control.entered_at,
          expires_at: input.damage_control.expires_at,
        }
      : { active: false },
  };
}

/**
 * Record an observed exposure measurement during or after execution.
 *
 * @param {object} input
 * @returns {import("./types.js").ObservedExposure}
 */
export function createObservedExposure(input) {
  return {
    observed_cost: input.observed_cost,
    observed_affected_subjects: input.observed_affected_subjects ?? 0,
    observed_external_effects: input.observed_external_effects || "none",
    stop_condition_triggered: input.stop_condition_triggered || null,
    residue: Array.isArray(input.residue) ? [...input.residue] : [],
    recorded_at: input.recorded_at || new Date().toISOString(),
  };
}

/**
 * Check if actual observed exposure triggers any defined stop conditions.
 *
 * @param {object} params
 * @param {import("./types.js").MeasuredRiskProfile} params.profile
 * @param {import("./types.js").ObservedExposure} params.observed
 * @returns {{ triggered: boolean, condition: string | null }}
 */
export function checkStopConditions(params) {
  const { profile, observed } = params;
  if (!profile || !observed) return { triggered: false, condition: null };

  // 1. Explicit trigger already recorded on observed
  if (observed.stop_condition_triggered) {
    return { triggered: true, condition: observed.stop_condition_triggered };
  }

  // 2. Cost limit trigger
  if (
    profile.exposure.max_cost != null &&
    observed.observed_cost != null &&
    Number(observed.observed_cost) > Number(profile.exposure.max_cost)
  ) {
    return { triggered: true, condition: "exposure_limit_reached" };
  }

  // 3. Subject limit trigger
  if (
    profile.exposure.affected_subjects != null &&
    observed.observed_affected_subjects != null &&
    observed.observed_affected_subjects > profile.exposure.affected_subjects
  ) {
    return { triggered: true, condition: "third_party_effect_detected" };
  }

  // 4. External effects exceeded trigger
  if (
    observed.observed_external_effects &&
    EXTERNAL_EFFECT_ORDER[observed.observed_external_effects] >
      EXTERNAL_EFFECT_ORDER[profile.exposure.external_effects]
  ) {
    return {
      triggered: true,
      condition: `external_effects_escalated:${observed.observed_external_effects}`,
    };
  }

  return { triggered: false, condition: null };
}

/**
 * Transition a Measured Risk profile into exceptional Damage Control mode.
 * Emergency authority must carry an explicit expiration.
 *
 * @param {import("./types.js").MeasuredRiskProfile} profile
 * @param {string} reason
 * @param {object} [options]
 * @returns {import("./types.js").MeasuredRiskProfile}
 */
export function transitionToDamageControl(profile, reason, options = {}) {
  if (!profile) throw new TypeError("profile is required");
  const durationMs = (options.duration_minutes || 60) * 60 * 1000;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationMs).toISOString();

  return {
    ...profile,
    damage_control: {
      active: true,
      trigger_reason: reason,
      containment_mode: options.containment_mode || "quarantine_and_contain",
      entered_at: now.toISOString(),
      expires_at: expiresAt,
    },
  };
}

/**
 * Evaluate a candidate Measured Risk profile against mandate authority and doctrine.
 *
 * Rules enforced:
 * 1. Authority Primacy: Expected value or learning NEVER creates authority.
 * 2. Exposure Ceiling: Declared exposure must fit within mandate.scope.max_exposure.
 * 3. Scope & Effects Ceiling: Scope and external effects must not exceed mandate grants.
 * 4. Non-Externalization: Loss bearer must match the authorizing Principal.
 * 5. Catastrophic Tail Guard: Unbounded or catastrophic tail risks cannot be accepted without explicit mandate.
 * 6. High Option-Loss Guard: Propagating effects with high option loss require explicit recovery and stop conditions.
 * 7. Smallest Sufficient Risk (AC13): Non-zero uncertainty or experimental class is admissible if bounded.
 * 8. Damage Control Regime: Expired damage control is rejected; active damage control restricts to containment.
 * 9. Stop Conditions: Violation of observed exposure triggers damage control.
 *
 * @param {object} options
 * @param {import("./types.js").MandateObject|null} [options.mandate]
 * @param {import("./types.js").MeasuredRiskProfile} options.measured_risk
 * @param {import("./types.js").ObservedExposure} [options.observed_prior_exposure]
 * @param {string} [options.capability]
 * @param {Date|string} [options.at_time]
 * @returns {import("./types.js").MeasuredRiskEvaluation}
 */
export function evaluateMeasuredRisk(options) {
  const {
    mandate,
    measured_risk: profile,
    observed_prior_exposure: observed,
    capability,
    at_time = new Date(),
  } = options;

  if (!profile) {
    return {
      admissible: false,
      decision: "refused",
      error: "missing_measured_risk_profile",
      reason: "measured_risk profile is required for evaluation",
    };
  }

  const evalTime = at_time instanceof Date ? at_time : new Date(at_time);

  // 1. Authority Primacy: positive expected value does not create mandate (AC14)
  if (!mandate) {
    return {
      admissible: false,
      decision: "refused",
      error: "mandate_required",
      reason: `measured risk rationale '${profile.objective?.expected_value}' cannot create authority without a valid mandate`,
      evaluated_profile: profile,
    };
  }

  if (mandate.status !== "active") {
    return {
      admissible: false,
      decision: "refused",
      error: "mandate_inactive",
      reason: `mandate is ${mandate.status}; cannot authorize measured risk`,
      evaluated_profile: profile,
    };
  }

  const scope = mandate.scope || {};

  // Capability authorization check
  if (capability) {
    const allowed = scope.allowed_actions || scope.capabilities || scope.authorized_capabilities;
    const forbidden = scope.forbidden_actions || [];
    if (forbidden.includes(capability)) {
      return {
        admissible: false,
        decision: "refused",
        error: "capability_forbidden",
        reason: `capability '${capability}' is forbidden under mandate scope`,
        evaluated_profile: profile,
      };
    }
    if (
      Array.isArray(allowed) &&
      allowed.length > 0 &&
      !allowed.includes(capability) &&
      !allowed.includes("*")
    ) {
      return {
        admissible: false,
        decision: "refused",
        error: "capability_out_of_scope",
        reason: `capability '${capability}' is out of authorized scope`,
        evaluated_profile: profile,
      };
    }
  }

  // 2. Non-Externalization of Losses: gains/losses cannot be silently externalized to another principal
  const principalRef = mandate.principal_ref || mandate.principal_subject_id;
  if (
    profile.responsibility?.loss_bearer_principal_ref &&
    principalRef &&
    profile.responsibility.loss_bearer_principal_ref !== principalRef
  ) {
    return {
      admissible: false,
      decision: "refused",
      error: "unauthorized_loss_externalization",
      reason: `loss bearer '${profile.responsibility.loss_bearer_principal_ref}' differs from authorizing principal '${principalRef}' without mandate`,
      evaluated_profile: profile,
    };
  }

  // 3. Exposure Ceiling Check
  const mandateMaxExposure = scope.max_exposure;
  if (mandateMaxExposure != null && profile.exposure) {
    if (typeof mandateMaxExposure === "number" || typeof mandateMaxExposure === "string") {
      const ceilingCost = Number(mandateMaxExposure);
      const requestedCost = Number(profile.exposure.max_cost || 0);
      if (requestedCost > ceilingCost) {
        return {
          admissible: false,
          decision: "refused",
          error: "exposure_ceiling_exceeded",
          reason: `requested exposure cost (${requestedCost}) exceeds mandate max_exposure (${ceilingCost})`,
          evaluated_profile: profile,
        };
      }
    } else if (typeof mandateMaxExposure === "object") {
      const expScope = mandateMaxExposure.scope;
      if (
        expScope &&
        EXPOSURE_SCOPE_ORDER[profile.exposure.scope] > EXPOSURE_SCOPE_ORDER[expScope]
      ) {
        return {
          admissible: false,
          decision: "refused",
          error: "exposure_scope_exceeded",
          reason: `requested exposure scope '${profile.exposure.scope}' exceeds mandate scope '${expScope}'`,
          evaluated_profile: profile,
        };
      }
      const expEffects = mandateMaxExposure.external_effects;
      if (
        expEffects &&
        EXTERNAL_EFFECT_ORDER[profile.exposure.external_effects] > EXTERNAL_EFFECT_ORDER[expEffects]
      ) {
        return {
          admissible: false,
          decision: "refused",
          error: "exposure_external_effects_exceeded",
          reason: `requested external effects '${profile.exposure.external_effects}' exceed mandate limit '${expEffects}'`,
          evaluated_profile: profile,
        };
      }
      if (mandateMaxExposure.max_cost != null && profile.exposure.max_cost != null) {
        if (Number(profile.exposure.max_cost) > Number(mandateMaxExposure.max_cost)) {
          return {
            admissible: false,
            decision: "refused",
            error: "exposure_ceiling_exceeded",
            reason: `requested exposure cost (${profile.exposure.max_cost}) exceeds mandate max_exposure (${mandateMaxExposure.max_cost})`,
            evaluated_profile: profile,
          };
        }
      }
    }
  }

  // 4. Catastrophic / Unbounded Tail Risk Guard
  if (profile.risk?.tail === "catastrophic") {
    return {
      admissible: false,
      decision: "refused",
      error: "catastrophic_tail_risk_refused",
      reason: "catastrophic tail risk is inadmissible under ordinary operational mandate",
      evaluated_profile: profile,
    };
  }

  if (profile.risk?.tail === "unknown" && profile.exposure?.external_effects === "irreversible") {
    return {
      admissible: false,
      decision: "refused",
      error: "unbounded_tail_risk_refused",
      reason:
        "unknown tail risk with irreversible external effects violates Measured Risk doctrine",
      evaluated_profile: profile,
    };
  }

  // 5. Propagating Effects and High Option Loss Guard
  if (
    profile.exposure?.external_effects === "propagating" &&
    profile.recovery?.option_loss === "high"
  ) {
    if (!profile.recovery.stop_conditions || profile.recovery.stop_conditions.length === 0) {
      return {
        admissible: false,
        decision: "refused",
        error: "propagating_option_loss_unguarded",
        reason:
          "propagating external effects with high option loss require explicit stop conditions",
        evaluated_profile: profile,
      };
    }
  }

  // 6. Damage Control Regime Check
  if (profile.damage_control?.active) {
    if (
      profile.damage_control.expires_at &&
      new Date(profile.damage_control.expires_at) < evalTime
    ) {
      return {
        admissible: false,
        decision: "refused",
        error: "damage_control_expired",
        reason:
          "damage control emergency authority has expired; stabilization and re-authorization required",
        evaluated_profile: profile,
      };
    }
    // In active damage control, only containment/remediation is admissible
    if (profile.objective?.kind !== "remediation" && profile.objective?.kind !== "routine") {
      return {
        admissible: false,
        decision: "refused",
        error: "damage_control_active",
        reason: "system is in damage control containment mode; exploratory acts are suspended",
        evaluated_profile: profile,
      };
    }
  }

  // 7. Check Prior Observed Exposure & Stop Conditions
  if (observed) {
    const stopCheck = checkStopConditions({ profile, observed });
    if (stopCheck.triggered) {
      return {
        admissible: false,
        decision: "refused",
        error: "stop_condition_triggered",
        reason: `stop condition '${stopCheck.condition}' triggered by observed reality`,
        damage_control_triggered: true,
        evaluated_profile: profile,
      };
    }
  }

  // 8. All checks passed -> Admissible under Measured Risk (AC13)
  return {
    admissible: true,
    decision: "admissible",
    reason: `measured risk accepted: objective '${profile.objective?.kind}', bounded exposure '${profile.exposure?.scope}', recovery '${profile.recovery?.repairability}'`,
    evaluated_profile: profile,
  };
}

/**
 * Monotonically attenuate Measured Risk from parent to child (Authority(child) <= Authority(parent)).
 *
 * Rules:
 * - Child scope <= Parent scope
 * - Child max_cost <= Parent max_cost
 * - Child affected_subjects <= Parent affected_subjects
 * - Child external_effects <= Parent external_effects
 * - Child tail risk <= Parent tail risk
 *
 * @param {import("./types.js").MeasuredRiskProfile} parent
 * @param {import("./types.js").MeasuredRiskProfile} child
 * @returns {{ ok: boolean, error?: string, attenuated_profile?: import("./types.js").MeasuredRiskProfile }}
 */
export function attenuateMeasuredRisk(parent, child) {
  if (!parent || !child) throw new TypeError("parent and child profiles are required");

  // Scope check
  if (EXPOSURE_SCOPE_ORDER[child.exposure.scope] > EXPOSURE_SCOPE_ORDER[parent.exposure.scope]) {
    return {
      ok: false,
      error: `child exposure scope '${child.exposure.scope}' exceeds parent scope '${parent.exposure.scope}'`,
    };
  }

  // External effects check
  if (
    EXTERNAL_EFFECT_ORDER[child.exposure.external_effects] >
    EXTERNAL_EFFECT_ORDER[parent.exposure.external_effects]
  ) {
    return {
      ok: false,
      error: `child external effects '${child.exposure.external_effects}' exceed parent limit '${parent.exposure.external_effects}'`,
    };
  }

  // Cost ceiling check
  if (parent.exposure.max_cost != null && child.exposure.max_cost != null) {
    if (Number(child.exposure.max_cost) > Number(parent.exposure.max_cost)) {
      return {
        ok: false,
        error: `child max_cost (${child.exposure.max_cost}) exceeds parent ceiling (${parent.exposure.max_cost})`,
      };
    }
  }

  // Subject ceiling check
  if (parent.exposure.affected_subjects != null && child.exposure.affected_subjects != null) {
    if (child.exposure.affected_subjects > parent.exposure.affected_subjects) {
      return {
        ok: false,
        error: `child affected_subjects (${child.exposure.affected_subjects}) exceeds parent (${parent.exposure.affected_subjects})`,
      };
    }
  }

  // Tail risk check
  if (TAIL_RISK_ORDER[child.risk.tail] > TAIL_RISK_ORDER[parent.risk.tail]) {
    return {
      ok: false,
      error: `child tail risk '${child.risk.tail}' exceeds parent risk tolerance '${parent.risk.tail}'`,
    };
  }

  return {
    ok: true,
    attenuated_profile: {
      ...child,
      exposure: {
        ...child.exposure,
        max_cost: child.exposure.max_cost ?? parent.exposure.max_cost,
        affected_subjects: Math.min(
          child.exposure.affected_subjects ?? parent.exposure.affected_subjects ?? 1,
          parent.exposure.affected_subjects ?? 1
        ),
      },
    },
  };
}

/**
 * Assess repair frontier: determine whether further active recovery remains cost-effective
 * or whether explicit authorized residue should be accepted and recorded.
 *
 * Rule: Continue repair while marginal restoration value > marginal recovery cost.
 * When recovery_cost > restored_value, accept explicit residue instead of endless mitigation.
 *
 * @param {object} params
 * @param {number} params.restored_value - Value of further restoration
 * @param {number} params.recovery_cost - Cost of further active recovery
 * @param {string[]} [params.unresolved_residue] - Residue that would remain
 * @param {boolean} [params.rights_violation] - Whether unresolved harm affects hard rights
 * @returns {{ action: "continue_repair" | "accept_residue", reason: string, residue?: string[] }}
 */
export function assessRepairFrontier(params) {
  const {
    restored_value,
    recovery_cost,
    unresolved_residue = [],
    rights_violation = false,
  } = params;

  // Hard rights cannot be traded off by cost-benefit
  if (rights_violation) {
    return {
      action: "continue_repair",
      reason:
        "rights violation cannot be converted to accepted residue; mandatory restitution required",
    };
  }

  if (recovery_cost > restored_value) {
    return {
      action: "accept_residue",
      reason: `repair frontier reached: recovery cost (${recovery_cost}) exceeds restored value (${restored_value}); accepting explicit residue`,
      residue: unresolved_residue,
    };
  }

  return {
    action: "continue_repair",
    reason: `marginal restoration value (${restored_value}) exceeds recovery cost (${recovery_cost})`,
  };
}
