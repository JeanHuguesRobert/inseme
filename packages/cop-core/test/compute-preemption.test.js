import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  COMPUTE_TIERS,
  RUNNER_POOL_QUOTAS,
  validateConcurrencyConfig,
  createPreemptionController,
  PreemptionError,
} from "../src/compute-preemption.js";

describe("Compute Preemption & Concurrency Hierarchy (Issue #114)", () => {
  describe("validateConcurrencyConfig", () => {
    it("accepts valid background concurrency configuration within quota", () => {
      const res = validateConcurrencyConfig({
        tier: COMPUTE_TIERS.BACKGROUND_PREEMPTIBLE,
        concurrencyGroup: "compute-background",
        maxConcurrentSlots: 2,
      });
      expect(res.ok).toBe(true);
      expect(res.maxConcurrentSlots).toBe(2);
    });

    it("rejects background configuration exceeding runner quota limit (max 2)", () => {
      const res = validateConcurrencyConfig({
        tier: COMPUTE_TIERS.BACKGROUND_PREEMPTIBLE,
        concurrencyGroup: "compute-background",
        maxConcurrentSlots: 3,
      });
      expect(res.ok).toBe(false);
      expect(res.error).toBe("background_quota_exceeded");
    });

    it("rejects background configuration with mismatched concurrency group", () => {
      const res = validateConcurrencyConfig({
        tier: COMPUTE_TIERS.BACKGROUND_PREEMPTIBLE,
        concurrencyGroup: "foreground-job-123",
      });
      expect(res.ok).toBe(false);
      expect(res.error).toBe("invalid_background_concurrency_group");
    });

    it("rejects foreground configuration using static background concurrency group", () => {
      const res = validateConcurrencyConfig({
        tier: COMPUTE_TIERS.FOREGROUND_ON_DEMAND,
        concurrencyGroup: "compute-background",
      });
      expect(res.ok).toBe(false);
      expect(res.error).toBe("foreground_in_background_group");
    });

    it("accepts valid foreground configuration with isolated run id group", () => {
      const res = validateConcurrencyConfig({
        tier: COMPUTE_TIERS.FOREGROUND_ON_DEMAND,
        concurrencyGroup: "compute-foreground-run-998877",
      });
      expect(res.ok).toBe(true);
      expect(res.maxConcurrentSlots).toBe(RUNNER_POOL_QUOTAS.MAX_RUNNER_POOL_CONCURRENCY);
    });
  });

  describe("createPreemptionController", () => {
    let tmpDir;
    let signalPath;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "preemption-test-"));
      signalPath = path.join(tmpDir, ".preempt");
    });

    afterEach(() => {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    });

    it("allows execution when within budget and unprompted", () => {
      const ctrl = createPreemptionController({
        maxWallTimeMs: 5000,
        tier: COMPUTE_TIERS.BACKGROUND_PREEMPTIBLE,
      });

      const status = ctrl.getStatus("phase_1");
      expect(status.canContinue).toBe(true);
      expect(status.wallTimeExhausted).toBe(false);
      expect(status.reason).toBeNull();
      expect(() => ctrl.assertCanContinue("phase_1")).not.toThrow();
    });

    it("preempts when wall-time budget is exhausted", async () => {
      const ctrl = createPreemptionController({
        maxWallTimeMs: 10,
      });

      await new Promise((resolve) => setTimeout(resolve, 25));

      const status = ctrl.getStatus("long_phase");
      expect(status.canContinue).toBe(false);
      expect(status.wallTimeExhausted).toBe(true);
      expect(status.reason).toBe("wall_time_budget_exhausted");

      expect(() => ctrl.assertCanContinue("long_phase")).toThrow(PreemptionError);
    });

    it("detects signal file and halts further phases gracefully", () => {
      const ctrl = createPreemptionController({
        signalFile: signalPath,
      });

      expect(ctrl.getStatus("phase_1").canContinue).toBe(true);

      // Create signal file
      fs.writeFileSync(signalPath, "preempt");

      const status = ctrl.getStatus("phase_2");
      expect(status.canContinue).toBe(false);
      expect(status.reason).toBe("signal_file_detected");
      expect(status.signalReceived).toBe(true);

      expect(() => ctrl.assertCanContinue("phase_2")).toThrow(PreemptionError);
    });

    it("integrates with AbortSignal", () => {
      const abortController = new AbortController();
      const ctrl = createPreemptionController({
        abortSignal: abortController.signal,
      });

      expect(ctrl.getStatus().canContinue).toBe(true);

      abortController.abort("user_cancelled");

      const status = ctrl.getStatus();
      expect(status.canContinue).toBe(false);
      expect(status.reason).toContain("user_cancelled");
    });

    it("supports manual programmatic preemption request", () => {
      const ctrl = createPreemptionController();
      expect(ctrl.getStatus().canContinue).toBe(true);

      ctrl.requestPreemption("emergency_priority_interrupt");

      const status = ctrl.getStatus("phase_critical");
      expect(status.canContinue).toBe(false);
      expect(status.reason).toBe("emergency_priority_interrupt");
    });

    it("generates evidence receipt in COP format", () => {
      const ctrl = createPreemptionController({
        tier: COMPUTE_TIERS.BACKGROUND_PREEMPTIBLE,
      });

      ctrl.requestPreemption("test_yield");
      const receipt = ctrl.toEvidenceReceipt({ phase: "monte_carlo_audit" });

      expect(receipt.schema).toBe("cop.preemption-receipt/v1");
      expect(receipt.outcome).toBe("preempted");
      expect(receipt.phase).toBe("monte_carlo_audit");
      expect(receipt.reason).toBe("test_yield");
      expect(receipt.tier).toBe(COMPUTE_TIERS.BACKGROUND_PREEMPTIBLE);
    });
  });
});
