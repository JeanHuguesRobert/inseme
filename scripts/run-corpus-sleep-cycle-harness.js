#!/usr/bin/env node

/**
 * Preemptible Corpus Sleep Cycle CI Harness.
 * Connects the Cogentia Sleep Cycle engine with Inseme's Compute Preemption Controller
 * and Autonomous Safe Git Writeback.
 *
 * Source doctrine: cogentia/research/memory_and_corpus_sleep_cycle.md
 * Tracking issue: inseme#116 (GitHub Compute Fabric 3/5)
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  COMPUTE_TIERS,
  createPreemptionController,
  validateConcurrencyConfig,
} from "../packages/cop-core/src/compute-preemption.js";
import { gitSafeWriteback } from "../packages/cop-core/src/git-safe-writeback.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

function findCogentiaSleepScript(explicitRoot) {
  const candidates = [
    explicitRoot ? path.join(explicitRoot, "scripts", "run-corpus-sleep-cycle.js") : null,
    explicitRoot
      ? path.join(explicitRoot, "cogentia", "scripts", "run-corpus-sleep-cycle.js")
      : null,
    path.join(ROOT_DIR, "..", "cogentia", "scripts", "run-corpus-sleep-cycle.js"),
    path.join(ROOT_DIR, "cogentia", "scripts", "run-corpus-sleep-cycle.js"),
    process.env.COGENTIA_DIR
      ? path.join(process.env.COGENTIA_DIR, "scripts", "run-corpus-sleep-cycle.js")
      : null,
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return path.resolve(candidate);
    }
  }
  return null;
}

export async function runCorpusSleepHarness(options = {}) {
  const budgetMs = options.budgetMs || 15 * 60 * 1000;
  const maxPairs = options.maxPairs || 50;
  const force = options.force !== false;
  const dryRun = Boolean(options.dryRun);
  const writeBack = options.writeBack !== false;
  const explicitRoot = options.root || null;

  // 1. Verify concurrency configuration adherence
  const concurrencyValidation = validateConcurrencyConfig({
    tier: COMPUTE_TIERS.BACKGROUND_PREEMPTIBLE,
    concurrencyGroup: options.concurrencyGroup || "compute-background",
    maxConcurrentSlots: options.maxConcurrentSlots || 1,
  });

  if (!concurrencyValidation.ok) {
    return {
      ok: false,
      error: "concurrency_validation_failed",
      details: concurrencyValidation.reason,
    };
  }

  // 2. Initialize cooperative preemption controller
  const preemptionCtrl = createPreemptionController({
    tier: COMPUTE_TIERS.BACKGROUND_PREEMPTIBLE,
    maxWallTimeMs: budgetMs,
    signalFile: options.signalFile || null,
  });

  const sleepScript = findCogentiaSleepScript(explicitRoot);
  if (!sleepScript) {
    if (dryRun) {
      // Validate the orchestration envelope without asserting the external
      // Cogentia executable actually ran. CI may check out inseme alone.
      const evidence = preemptionCtrl.toEvidenceReceipt({
        phase: "dry_run_dependency_unavailable",
        outcome: "completed_partial",
        details: { execution_skipped: true, reason: "sleep_cycle_script_not_found" },
      });
      return {
        ok: true, status: "completed_partial", evidence,
        sleepOutput: null, writeBack: null, cogentiaDir: null,
        execution_skipped: true,
      };
    }
    return {
      ok: false,
      error: "sleep_cycle_script_not_found",
      details: "Could not locate cogentia/scripts/run-corpus-sleep-cycle.js",
    };
  }

  const cogentiaDir = path.dirname(path.dirname(sleepScript));

  // Check preemption before launching subprocess
  preemptionCtrl.assertCanContinue("preflight");

  // 3. Execute the underlying sleep cycle runner
  const sleepArgs = [
    sleepScript,
    "--json",
    "--skip-repo-sync",
    "--budget-ms",
    String(budgetMs),
    "--max-pairs",
    String(maxPairs),
  ];
  if (force) sleepArgs.push("--force");

  let sleepOutput = null;
  let exitError = null;

  try {
    const rawOut = execFileSync(process.execPath, sleepArgs, {
      cwd: cogentiaDir,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      timeout: budgetMs + 30000,
    });
    sleepOutput = JSON.parse(rawOut);
  } catch (err) {
    exitError = err;
    if (err.stdout) {
      try {
        sleepOutput = JSON.parse(err.stdout);
      } catch {}
    }
  }

  // 4. Construct execution evidence receipt
  const receipt = preemptionCtrl.toEvidenceReceipt({
    phase: sleepOutput?.phases?.slice(-1)[0]?.name || "sleep_cycle_execution",
    outcome: sleepOutput?.status || (exitError ? "failed" : "completed"),
    details: {
      pairs_evaluated: sleepOutput?.candidate_signals ?? null,
      metrics: sleepOutput?.metrics ?? null,
      error: exitError ? exitError.message : null,
    },
  });

  // 5. Autonomous safe write-back if changes exist in cogentiaDir
  let writeBackResult = null;
  if (!dryRun && writeBack && fs.existsSync(cogentiaDir)) {
    writeBackResult = await gitSafeWriteback({
      cwd: cogentiaDir,
      branch: options.branch || "main",
      remote: options.remote || "origin",
      commitMessage: `chore(sleep-cycle): record audit review queue & metrics [skip ci]`,
      paths: [".cogentia", "research/corpus-status.md"],
      runId: options.runId || `sleep-cycle-${Date.now()}`,
    });
  }

  return {
    ok:
      !exitError &&
      (sleepOutput?.status === "completed" ||
        sleepOutput?.status === "preempted" ||
        sleepOutput?.status === "completed_partial"),
    status: sleepOutput?.status || "error",
    evidence: receipt,
    sleepOutput,
    writeBack: writeBackResult,
    cogentiaDir,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const options = {
    budgetMs: 15 * 60 * 1000,
    maxPairs: 50,
    force: true,
    dryRun: false,
    writeBack: true,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--budget-ms" && args[i + 1]) {
      options.budgetMs = parseInt(args[++i], 10);
    } else if (arg === "--max-pairs" && args[i + 1]) {
      options.maxPairs = parseInt(args[++i], 10);
    } else if (arg === "--root" && args[i + 1]) {
      options.root = args[++i];
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--no-write-back") {
      options.writeBack = false;
    } else if (arg === "--json") {
      options.json = true;
    }
  }

  const result = await runCorpusSleepHarness(options);
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("Corpus Sleep Cycle Harness Completed:");
    console.log(`  Status: ${result.status}`);
    console.log(`  Evidence outcome: ${result.evidence?.outcome}`);
    if (result.writeBack) {
      console.log(`  Write-back action: ${result.writeBack.action}`);
    }
  }

  if (!result.ok) {
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].includes("run-corpus-sleep-cycle-harness.js")) {
  main().catch((err) => {
    console.error("Sleep harness fatal error:", err);
    process.exit(1);
  });
}
