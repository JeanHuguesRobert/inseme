#!/usr/bin/env node

/**
 * packages/cop-core/bin/verify-trace-lifecycle.js
 *
 * CLI runner for verifying trace logs against COP Trace Lifecycle conformance invariants.
 * Usage:
 *   node bin/verify-trace-lifecycle.js [file.json|file.jsonl ...] [--json]
 *   cat traces.jsonl | node bin/verify-trace-lifecycle.js --json
 */

import fs from "node:fs";
import path from "node:path";
import {
  verifyTraceLogConformance,
  verifyTraceLogFile,
  formatTraceConformanceReport,
} from "../src/trace-lifecycle-verifier.js";

const argv = process.argv.slice(2);

if (argv.includes("--help") || argv.includes("-h")) {
  console.log("Usage: cop-trace-verify <file.json|file.jsonl...> [--json]");
  console.log("       cat stream.jsonl | cop-trace-verify [--json] [--stdin]");
  console.log("");
  console.log("Options:");
  console.log("  --json     Output verification report as JSON");
  console.log("  --stdin    Read trace log from standard input");
  console.log("  -h, --help Show this help message");
  process.exit(0);
}

const jsonIndex = argv.indexOf("--json");
const jsonMode = jsonIndex >= 0;
if (jsonIndex >= 0) {
  argv.splice(jsonIndex, 1);
}

const stdinIndex = argv.indexOf("--stdin");
const explicitStdin = stdinIndex >= 0;
if (stdinIndex >= 0) {
  argv.splice(stdinIndex, 1);
}

async function run() {
  const filePaths = argv.filter((a) => !a.startsWith("-") && a !== "-");
  const readStdin =
    explicitStdin || argv.includes("-") || (filePaths.length === 0 && !process.stdin.isTTY);

  if (filePaths.length === 0) {
    // Read from standard input if piped or requested
    if (readStdin) {
      let input = "";
      for await (const chunk of process.stdin) {
        input += chunk;
      }
      const report = verifyTraceLogConformance(input);
      if (!report.ok) {
        process.exitCode = 1;
      }
      if (jsonMode) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(formatTraceConformanceReport(report));
      }
      return;
    }

    console.error("Usage: node bin/verify-trace-lifecycle.js <file.json|file.jsonl...> [--json]");
    console.error("       cat stream.jsonl | node bin/verify-trace-lifecycle.js [--json]");
    process.exitCode = 1;
    return;
  }

  let allOk = true;
  const reports = [];

  for (const fp of filePaths) {
    const report = verifyTraceLogFile(fp);
    reports.push({ file: fp, ...report });
    if (!report.ok) {
      allOk = false;
    }
  }

  if (!allOk) {
    process.exitCode = 1;
  }

  if (jsonMode) {
    console.log(JSON.stringify(reports.length === 1 ? reports[0] : reports, null, 2));
  } else {
    for (const r of reports) {
      console.log(`=== File: ${r.file} ===`);
      console.log(formatTraceConformanceReport(r));
      console.log("");
    }
  }
}

run().catch((err) => {
  console.error("Fatal error during trace verification:", err);
  process.exit(1);
});
