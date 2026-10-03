import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { runCorpusSleepHarness } from "../../../scripts/run-corpus-sleep-cycle-harness.js";

describe("Corpus Sleep Cycle CI Harness (Issue #116)", { timeout: 30000 }, () => {
  let tmpDir;
  let signalPath;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sleep-harness-test-"));
    signalPath = path.join(tmpDir, ".preempt");
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it("rejects execution if concurrency group violates background tier rules", async () => {
    const res = await runCorpusSleepHarness({
      concurrencyGroup: "foreground-job-99",
      dryRun: true,
      writeBack: false,
    });

    expect(res.ok).toBe(false);
    expect(res.error).toBe("concurrency_validation_failed");
  });

  it("executes a dry-run sleep cycle and generates structured preemption evidence", async () => {
    const res = await runCorpusSleepHarness({
      budgetMs: 3000,
      maxPairs: 2,
      dryRun: true,
      writeBack: false,
    });

    expect(res.ok).toBe(true);
    expect(["completed", "preempted", "completed_partial"]).toContain(res.status);
    expect(res.evidence).toBeDefined();
    expect(res.evidence.schema).toBe("cop.preemption-receipt/v1");
    expect(res.evidence.tier).toBe("background_preemptible");
  });
});
