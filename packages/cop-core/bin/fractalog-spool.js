#!/usr/bin/env node

/**
 * packages/cop-core/bin/fractalog-spool.js
 *
 * CLI utility for inspecting and draining the FractaLog degraded fallback spool.
 * Usage:
 *   fractalog-spool status [spoolDir] [--json]
 *   fractalog-spool drain [spoolDir] [--json] [--dry-run] [--target-url <url>]
 */

import path from "node:path";
import {
  inspectFractalogSpool,
  drainFractalogSpool,
  formatSpoolInspectionReport,
  formatSpoolDrainReport,
} from "../src/fractalog-spool.js";

const argv = process.argv.slice(2);

if (argv.includes("--help") || argv.includes("-h") || argv.length === 0) {
  console.log("Usage: fractalog-spool <status|drain> [spoolDir] [options]");
  console.log("");
  console.log("Subcommands:");
  console.log("  status [dir]       Inspect pending offline spooled records, age, and integrity");
  console.log(
    "  drain  [dir]       Forward pending spooled records to ingress, purge, and quarantine"
  );
  console.log("");
  console.log("Options:");
  console.log("  --json             Output results as JSON");
  console.log("  --dry-run          Simulate forward without mutating or purging spool files");
  console.log("  --target-url <url> Ingress HTTP endpoint to forward records to");
  console.log("  --no-quarantine    Do not isolate corrupted records into quarantine");
  console.log("  --no-purge         Do not unlink successfully forwarded records");
  console.log("  --batch <n>        Limit maximum records drained in this cycle");
  console.log("  -h, --help         Show this help message");
  process.exit(0);
}

const command = argv[0].toLowerCase();
const remainingArgs = argv.slice(1);

const jsonMode = remainingArgs.includes("--json");
const dryRun = remainingArgs.includes("--dry-run");
const noQuarantine = remainingArgs.includes("--no-quarantine");
const noPurge = remainingArgs.includes("--no-purge");

let targetUrl = null;
const urlIdx = remainingArgs.indexOf("--target-url");
if (urlIdx >= 0 && remainingArgs[urlIdx + 1]) {
  targetUrl = remainingArgs[urlIdx + 1];
}

let batchSize = Infinity;
const batchIdx = remainingArgs.indexOf("--batch");
if (batchIdx >= 0 && remainingArgs[batchIdx + 1]) {
  const parsed = parseInt(remainingArgs[batchIdx + 1], 10);
  if (!Number.isNaN(parsed) && parsed > 0) {
    batchSize = parsed;
  }
}

// Spool directory is the first non-option argument after command
const positionalArgs = remainingArgs.filter((a, idx) => {
  if (a.startsWith("-")) return false;
  if (
    idx > 0 &&
    (remainingArgs[idx - 1] === "--target-url" || remainingArgs[idx - 1] === "--batch")
  ) {
    return false;
  }
  return true;
});

const spoolDir = positionalArgs[0] || process.env.COP_SPOOL_DIR || ".cop-spool";

async function main() {
  if (command === "status") {
    const report = inspectFractalogSpool(spoolDir);
    if (jsonMode) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatSpoolInspectionReport(report));
    }
    if (report.corrupted_count > 0) {
      process.exitCode = 2;
    }
    return;
  }

  if (command === "drain") {
    let ingressClient = null;

    if (targetUrl) {
      ingressClient = { url: targetUrl };
    } else {
      // If no target-url provided, dry-run or warn
      if (!dryRun) {
        console.error(
          "Error: No ingress target specified. Provide --target-url <url> or run with --dry-run."
        );
        process.exit(1);
      }
      ingressClient = async () => ({ ok: true });
    }

    const drainReport = await drainFractalogSpool(spoolDir, ingressClient, {
      dryRun,
      quarantine: !noQuarantine,
      purge: !noPurge,
      batchSize,
    });

    if (jsonMode) {
      console.log(JSON.stringify(drainReport, null, 2));
    } else {
      console.log(formatSpoolDrainReport(drainReport));
    }

    if (!drainReport.ok) {
      process.exitCode = 1;
    }
    return;
  }

  console.error(`Unknown subcommand: "${command}". Expected "status" or "drain".`);
  process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error running fractalog-spool:", err);
  process.exit(1);
});
