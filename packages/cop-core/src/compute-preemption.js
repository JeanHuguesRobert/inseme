/**
 * Compute fabric priority tiers, runner pool quota boundaries, and cooperative preemption protocol.
 * Source doctrine: operium/docs/fracta-trust-perimeter.md
 * Tracking issue: inseme#114 (GitHub Compute Fabric 1/5)
 */

import fs from "node:fs";

export const COMPUTE_TIERS = Object.freeze({
  FOREGROUND_ON_DEMAND: "foreground_on_demand",
  BACKGROUND_PREEMPTIBLE: "background_preemptible",
});

export const RUNNER_POOL_QUOTAS = Object.freeze({
  MAX_RUNNER_POOL_CONCURRENCY: 20,
  BACKGROUND_POOL_MAX_CONCURRENCY: 2,
  FOREGROUND_POOL_MIN_HEADROOM: 18,
});

/**
 * Validates workflow concurrency configurations against runner pool quotas.
 */
export function validateConcurrencyConfig({
  tier = COMPUTE_TIERS.BACKGROUND_PREEMPTIBLE,
  concurrencyGroup = null,
  maxConcurrentSlots = null,
} = {}) {
  const normalizedTier = tier || COMPUTE_TIERS.BACKGROUND_PREEMPTIBLE;
  if (!Object.values(COMPUTE_TIERS).includes(normalizedTier)) {
    throw new TypeError(`Unknown compute tier: ${tier}`);
  }

  if (normalizedTier === COMPUTE_TIERS.BACKGROUND_PREEMPTIBLE) {
    if (
      typeof maxConcurrentSlots === "number" &&
      maxConcurrentSlots > RUNNER_POOL_QUOTAS.BACKGROUND_POOL_MAX_CONCURRENCY
    ) {
      return {
        ok: false,
        error: "background_quota_exceeded",
        reason: `Background tier cannot allocate more than ${RUNNER_POOL_QUOTAS.BACKGROUND_POOL_MAX_CONCURRENCY} concurrent slots (requested ${maxConcurrentSlots})`,
      };
    }

    if (concurrencyGroup && !concurrencyGroup.startsWith("compute-background")) {
      return {
        ok: false,
        error: "invalid_background_concurrency_group",
        reason: `Background concurrency group must start with 'compute-background' (got '${concurrencyGroup}')`,
      };
    }
  }

  if (normalizedTier === COMPUTE_TIERS.FOREGROUND_ON_DEMAND) {
    if (concurrencyGroup && concurrencyGroup === "compute-background") {
      return {
        ok: false,
        error: "foreground_in_background_group",
        reason:
          "Foreground on-demand runs must not share the static 'compute-background' group to prevent queue head-of-line blocking",
      };
    }
  }

  return {
    ok: true,
    tier: normalizedTier,
    concurrencyGroup,
    maxConcurrentSlots:
      maxConcurrentSlots ??
      (normalizedTier === COMPUTE_TIERS.BACKGROUND_PREEMPTIBLE
        ? RUNNER_POOL_QUOTAS.BACKGROUND_POOL_MAX_CONCURRENCY
        : RUNNER_POOL_QUOTAS.MAX_RUNNER_POOL_CONCURRENCY),
  };
}

export class PreemptionError extends Error {
  constructor(status) {
    super(
      `Execution preempted at phase '${status.phase || "unknown"}': ${status.reason || "unspecified"}`
    );
    this.name = "PreemptionError";
    this.status = status;
  }
}

/**
 * Creates a cooperative preemption controller for long-running workflows and phase loops.
 */
export function createPreemptionController(options = {}) {
  const startedAt = Date.now();
  const tier = options.tier || COMPUTE_TIERS.BACKGROUND_PREEMPTIBLE;
  const maxWallTimeMs =
    typeof options.maxWallTimeMs === "number" && options.maxWallTimeMs >= 0
      ? options.maxWallTimeMs
      : null;
  const signalFile = options.signalFile || null;
  const abortSignal = options.abortSignal || null;
  const customChecker = typeof options.checkCustom === "function" ? options.checkCustom : null;

  let manuallyPreempted = false;
  let manualPreemptionReason = null;

  if (abortSignal) {
    if (abortSignal.aborted) {
      manuallyPreempted = true;
      manualPreemptionReason = abortSignal.reason
        ? String(abortSignal.reason)
        : "abort_signal_triggered";
    } else {
      abortSignal.addEventListener(
        "abort",
        () => {
          manuallyPreempted = true;
          manualPreemptionReason = abortSignal.reason
            ? String(abortSignal.reason)
            : "abort_signal_triggered";
        },
        { once: true }
      );
    }
  }

  function getStatus(phase = null) {
    const elapsedMs = Date.now() - startedAt;
    const remainingMs = maxWallTimeMs !== null ? Math.max(0, maxWallTimeMs - elapsedMs) : null;
    const wallTimeExhausted = maxWallTimeMs !== null && elapsedMs >= maxWallTimeMs;

    let signalFileDetected = false;
    if (signalFile) {
      try {
        if (fs.existsSync(signalFile)) {
          signalFileDetected = true;
        }
      } catch {
        // file system check failure treated as not detected
      }
    }

    let customPreempted = false;
    let customReason = null;
    if (customChecker) {
      try {
        const checkResult = customChecker();
        if (checkResult && checkResult.ok === false) {
          customPreempted = true;
          customReason = checkResult.reason || "custom_predicate_preempted";
        }
      } catch (err) {
        customPreempted = true;
        customReason = `custom_predicate_error: ${err.message}`;
      }
    }

    let canContinue = true;
    let reason = null;

    if (manuallyPreempted) {
      canContinue = false;
      reason = manualPreemptionReason || "manual_preemption_requested";
    } else if (signalFileDetected) {
      canContinue = false;
      reason = "signal_file_detected";
    } else if (wallTimeExhausted) {
      canContinue = false;
      reason = "wall_time_budget_exhausted";
    } else if (customPreempted) {
      canContinue = false;
      reason = customReason;
    }

    return {
      canContinue,
      reason,
      tier,
      phase,
      startedAt,
      elapsedMs,
      remainingMs,
      maxWallTimeMs,
      wallTimeExhausted,
      signalReceived: manuallyPreempted || signalFileDetected || customPreempted,
    };
  }

  function assertCanContinue(phase = null) {
    const status = getStatus(phase);
    if (!status.canContinue) {
      throw new PreemptionError(status);
    }
    return status;
  }

  function requestPreemption(reason = "manual_request") {
    manuallyPreempted = true;
    manualPreemptionReason = reason;
  }

  function toEvidenceReceipt({ phase = null, outcome = null, details = {} } = {}) {
    const status = getStatus(phase);
    const finalOutcome = outcome || (status.canContinue ? "completed" : "preempted");

    return {
      schema: "cop.preemption-receipt/v1",
      timestamp: new Date().toISOString(),
      tier,
      outcome: finalOutcome,
      phase: phase || status.phase,
      reason: status.reason,
      elapsed_ms: status.elapsedMs,
      budget_limit_ms: maxWallTimeMs,
      details,
    };
  }

  return {
    getStatus,
    assertCanContinue,
    requestPreemption,
    toEvidenceReceipt,
  };
}
