#!/usr/bin/env node

/**
 * Root convenience runner for autonomous Git writeback.
 * Usage:
 *   node scripts/git-safe-writeback.js [options]
 */

import { gitSafeWriteback } from "../packages/cop-core/src/git-safe-writeback.js";

async function main() {
  const args = process.argv.slice(2);
  const options = {
    branch: "main",
    remote: "origin",
    commitMessage: "chore: automated background update [skip ci]",
    paths: ["."],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--branch" && args[i + 1]) {
      options.branch = args[++i];
    } else if (arg === "--remote" && args[i + 1]) {
      options.remote = args[++i];
    } else if ((arg === "--message" || arg === "-m") && args[i + 1]) {
      options.commitMessage = args[++i];
    } else if (arg === "--paths" && args[i + 1]) {
      options.paths = args[++i].split(/\s+/).filter(Boolean);
    } else if (arg === "--run-id" && args[i + 1]) {
      options.runId = args[++i];
    }
  }

  const result = await gitSafeWriteback(options);
  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    process.exit(result.action === "conflict_diverged" ? 2 : 1);
  }
}

main().catch((err) => {
  console.error("git-safe-writeback fatal error:", err);
  process.exit(1);
});
