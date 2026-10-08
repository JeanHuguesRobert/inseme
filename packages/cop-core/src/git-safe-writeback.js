/**
 * Autonomous, conflict-free Git write-back mechanism for background compute workflows.
 * Implements optimistic fetch-rebase-verify-push with non-collision fallback branch isolation.
 *
 * Source doctrine: cogentia/instructions/AGENTS.workspace.md §3
 * Tracking issue: inseme#115 (GitHub Compute Fabric 2/5)
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function defaultGitExec(args, options = {}) {
  const cwd = options.cwd || process.cwd();
  try {
    const stdout = execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...options.env },
    });
    return { ok: true, code: 0, stdout: stdout.trim(), stderr: "" };
  } catch (err) {
    return {
      ok: false,
      code: err.status ?? 1,
      stdout: (err.stdout || "").toString().trim(),
      stderr: (err.stderr || "").toString().trim(),
      message: err.message,
    };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes safe autonomous git write-back with optimistic rebase and non-collision branch fallback.
 *
 * @param {object} options
 * @param {string} [options.cwd] - Working directory
 * @param {string} [options.branch="main"] - Target branch
 * @param {string} [options.remote="origin"] - Target remote
 * @param {string} [options.commitMessage] - Message for commit
 * @param {string} [options.authorName] - Commit author name
 * @param {string} [options.authorEmail] - Commit author email
 * @param {string[]} [options.paths=["."]] - Paths to add/stage
 * @param {number} [options.maxRetries=3] - Number of rebase/push retries
 * @param {number} [options.backoffBaseMs=200] - Base backoff delay in ms
 * @param {Function} [options.regenerate] - Optional callback to re-derive files after rebase
 * @param {string} [options.fallbackBranchPrefix="bot/sync"] - Prefix for conflict fallback branch
 * @param {string} [options.runId] - Unique run id or identifier for fallback branch
 * @param {Function} [options.gitExec] - Injected git runner (for tests/mocking)
 */
export async function gitSafeWriteback(options = {}) {
  const cwd = options.cwd || process.cwd();
  const branch = options.branch || "main";
  const remote = options.remote || "origin";
  const commitMessage = options.commitMessage || "chore: automated background update [skip ci]";
  const authorName = options.authorName || "github-actions[bot]";
  const authorEmail = options.authorEmail || "github-actions[bot]@users.noreply.github.com";
  const paths = options.paths || ["."];
  const maxRetries = Math.max(1, options.maxRetries ?? 3);
  const backoffBaseMs = Math.max(10, options.backoffBaseMs ?? 200);
  const fallbackBranchPrefix = options.fallbackBranchPrefix || "bot/sync";
  const runId = options.runId || `${Date.now()}`;
  const git = options.gitExec || defaultGitExec;
  const regenerate = typeof options.regenerate === "function" ? options.regenerate : null;

  const env = {
    GIT_AUTHOR_NAME: authorName,
    GIT_AUTHOR_EMAIL: authorEmail,
    GIT_COMMITTER_NAME: authorName,
    GIT_COMMITTER_EMAIL: authorEmail,
  };

  // 1. Check if there are changes to stage/commit
  const statusRes = git(["status", "--porcelain"], { cwd });
  if (!statusRes.ok) {
    return { ok: false, error: "git_status_failed", details: statusRes.stderr };
  }

  const hasWorkingChanges = statusRes.stdout.length > 0;

  if (hasWorkingChanges) {
    // Stage specified paths
    const addRes = git(["add", ...paths], { cwd });
    if (!addRes.ok) {
      return { ok: false, error: "git_add_failed", details: addRes.stderr };
    }

    // Check if staged
    const stagedRes = git(["diff", "--cached", "--name-only"], { cwd });
    if (stagedRes.ok && stagedRes.stdout.length > 0) {
      const commitRes = git(["commit", "-m", commitMessage], { cwd, env });
      if (!commitRes.ok) {
        return { ok: false, error: "git_commit_failed", details: commitRes.stderr };
      }
    }
  }

  // Check if we are ahead of remote/target branch
  const revCheck = git(["rev-parse", "HEAD"], { cwd });
  if (!revCheck.ok) {
    return { ok: false, error: "rev_parse_failed", details: revCheck.stderr };
  }
  const localHead = revCheck.stdout;

  // 2. Fetch and Rebase loop
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const fetchRes = git(["fetch", remote, branch], { cwd });
    if (!fetchRes.ok) {
      // Remote might be offline or branch not yet pushed; handle gracefully
    }

    const rebaseRes = git(["rebase", `${remote}/${branch}`], { cwd, env });
    if (!rebaseRes.ok) {
      // Conflict detected!
      git(["rebase", "--abort"], { cwd });

      // Fallback branch creation
      const fallbackBranch = `${fallbackBranchPrefix}-${runId}`;
      const branchRes = git(["checkout", "-b", fallbackBranch], { cwd });
      let pushFallbackRes = { ok: false };
      if (branchRes.ok) {
        pushFallbackRes = git(["push", "-u", remote, fallbackBranch], { cwd });
      }

      const continuationReceipt = {
        schema: "cop.continuation-request/v1",
        reason: "git_rebase_conflict",
        target_branch: branch,
        fallback_branch: fallbackBranch,
        commit_sha: localHead,
        fallback_pushed: pushFallbackRes.ok,
        timestamp: new Date().toISOString(),
      };

      return {
        ok: false,
        action: "conflict_diverged",
        error: "rebase_conflict",
        fallbackBranch,
        continuation: continuationReceipt,
        attempt,
      };
    }

    // If rebase succeeded, run optional regeneration callback
    if (regenerate) {
      try {
        await regenerate();
        const postRegenStatus = git(["status", "--porcelain"], { cwd });
        if (postRegenStatus.ok && postRegenStatus.stdout.length > 0) {
          git(["add", ...paths], { cwd });
          git(["commit", "--amend", "--no-edit"], { cwd, env });
        }
      } catch (regenErr) {
        return {
          ok: false,
          error: "regenerate_failed",
          details: regenErr.message,
        };
      }
    }

    // Try pushing
    const pushRes = git(["push", remote, branch], { cwd });
    if (pushRes.ok) {
      const finalHead = git(["rev-parse", "HEAD"], { cwd }).stdout || localHead;
      return {
        ok: true,
        action: "pushed_to_target",
        branch,
        commitSha: finalHead,
        retries: attempt - 1,
      };
    }

    // Push failed (race condition: another commit landed on upstream branch)
    if (attempt < maxRetries) {
      const jitter = Math.floor(Math.random() * 50);
      const delay = backoffBaseMs * Math.pow(2, attempt - 1) + jitter;
      await sleep(delay);
    }
  }

  // All retries exhausted without clean push -> fallback branch
  const fallbackBranch = `${fallbackBranchPrefix}-${runId}`;
  git(["checkout", "-b", fallbackBranch], { cwd });
  const pushFallback = git(["push", "-u", remote, fallbackBranch], { cwd });

  return {
    ok: false,
    action: "retries_exhausted",
    error: "push_retries_exhausted",
    fallbackBranch,
    continuation: {
      schema: "cop.continuation-request/v1",
      reason: "push_retries_exhausted",
      target_branch: branch,
      fallback_branch: fallbackBranch,
      fallback_pushed: pushFallback.ok,
      timestamp: new Date().toISOString(),
    },
    attempts: maxRetries,
  };
}
