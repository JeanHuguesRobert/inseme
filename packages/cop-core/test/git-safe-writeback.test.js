import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { gitSafeWriteback } from "../src/git-safe-writeback.js";

const TEST_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test User",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test User",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function run(cmd, args, cwd) {
  return execFileSync(cmd, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: TEST_ENV,
  }).trim();
}

describe(
  "Autonomous Safe Git Write-Back (Issue #115)",
  { timeout: 30000, hookTimeout: 30000 },
  () => {
    let tmpRoot;
    let remoteBareDir;
    let localDir;
    let peerDir;

    beforeEach(() => {
      tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "git-writeback-test-"));
      remoteBareDir = path.join(tmpRoot, "remote.git");
      localDir = path.join(tmpRoot, "local");
      peerDir = path.join(tmpRoot, "peer");

      // 1. Initialize bare remote repository with HEAD pointing to main
      run("git", ["init", "--bare", "--initial-branch=main", remoteBareDir]);

      // 2. Initialize local repository and push initial main branch
      fs.mkdirSync(localDir, { recursive: true });
      run("git", ["init", "-b", "main"], localDir);
      run("git", ["remote", "add", "origin", remoteBareDir], localDir);

      fs.writeFileSync(path.join(localDir, "README.md"), "# Initial Commit\n");
      run("git", ["add", "README.md"], localDir);
      run("git", ["commit", "-m", "Initial commit"], localDir);
      run("git", ["push", "-u", "origin", "main"], localDir);

      // 3. Clone peer on branch main
      run("git", ["clone", "-b", "main", remoteBareDir, peerDir]);
    }, 30000);

    afterEach(() => {
      try {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      } catch {}
    }, 30000);

    it("commits and pushes clean local changes directly to main", async () => {
      // Modify a file in local
      fs.writeFileSync(path.join(localDir, "status.txt"), "status: ok\n");

      const result = await gitSafeWriteback({
        cwd: localDir,
        branch: "main",
        remote: "origin",
        commitMessage: "test: update status",
        paths: ["status.txt"],
      });

      expect(result.ok, JSON.stringify(result)).toBe(true);
      expect(result.action).toBe("pushed_to_target");
      expect(result.branch).toBe("main");

      // Verify remote has the commit
      const log = run("git", ["log", "-1", "--pretty=%s"], localDir);
      expect(log).toBe("test: update status");
    });

    it("optimistically rebases over non-conflicting concurrent upstream commit", async () => {
      // 1. Peer commits a non-conflicting file and pushes to origin/main
      fs.writeFileSync(path.join(peerDir, "peer-work.txt"), "peer data\n");
      run("git", ["add", "peer-work.txt"], peerDir);
      run("git", ["commit", "-m", "peer: add peer-work"], peerDir);
      run("git", ["push", "origin", "main"], peerDir);

      // 2. Local has changes to a different file
      fs.writeFileSync(path.join(localDir, "background-digest.md"), "# Background Digest\n");

      const result = await gitSafeWriteback({
        cwd: localDir,
        branch: "main",
        remote: "origin",
        commitMessage: "chore: sleep cycle digest",
        paths: ["background-digest.md"],
      });

      expect(result.ok, JSON.stringify(result)).toBe(true);
      expect(result.action).toBe("pushed_to_target");

      // Verify that both peer-work and background-digest exist
      expect(fs.existsSync(path.join(localDir, "peer-work.txt"))).toBe(true);
      expect(fs.existsSync(path.join(localDir, "background-digest.md"))).toBe(true);
    });

    it("executes regeneration hook post-rebase and commits updated derived file", async () => {
      // 1. Peer commits an entry
      fs.writeFileSync(path.join(peerDir, "data.txt"), "data A\n");
      run("git", ["add", "data.txt"], peerDir);
      run("git", ["commit", "-m", "peer: add data A"], peerDir);
      run("git", ["push", "origin", "main"], peerDir);

      // 2. Local sets up a derived index
      const indexFile = path.join(localDir, "index.txt");
      fs.writeFileSync(indexFile, "index: initial\n");

      // Hook that regenerates index.txt based on current directory contents
      const regenerate = async () => {
        const files = fs.readdirSync(localDir).filter((f) => !f.startsWith(".git"));
        fs.writeFileSync(indexFile, `index: ${files.sort().join(",")}\n`);
      };

      const result = await gitSafeWriteback({
        cwd: localDir,
        branch: "main",
        remote: "origin",
        commitMessage: "chore: update derived index",
        paths: ["index.txt"],
        regenerate,
      });

      expect(result.ok, JSON.stringify(result)).toBe(true);
      expect(result.action).toBe("pushed_to_target");

      // Ensure index.txt includes the peer's data.txt post-rebase
      const indexContent = fs.readFileSync(indexFile, "utf8");
      expect(indexContent).toContain("data.txt");
    });

    it("handles merge conflict by aborting rebase, branching to fallback, and emitting continuation", async () => {
      // 1. Peer modifies README.md
      fs.writeFileSync(path.join(peerDir, "README.md"), "# Concurrent conflict from peer\n");
      run("git", ["add", "README.md"], peerDir);
      run("git", ["commit", "-m", "peer: conflicting edit"], peerDir);
      run("git", ["push", "origin", "main"], peerDir);

      // 2. Local modifies the same README.md conflictingly
      fs.writeFileSync(
        path.join(localDir, "README.md"),
        "# Local background edit causing conflict\n"
      );

      const result = await gitSafeWriteback({
        cwd: localDir,
        branch: "main",
        remote: "origin",
        commitMessage: "chore: background edit",
        paths: ["README.md"],
        runId: "run-404-test",
      });

      expect(result.ok).toBe(false);
      expect(result.action).toBe("conflict_diverged");
      expect(result.error).toBe("rebase_conflict");
      expect(result.fallbackBranch).toBe("bot/sync-run-404-test");

      // Continuation packet must be emitted
      expect(result.continuation).toBeDefined();
      expect(result.continuation.schema).toBe("cop.continuation-request/v1");
      expect(result.continuation.reason).toBe("git_rebase_conflict");
      expect(result.continuation.fallback_branch).toBe("bot/sync-run-404-test");

      // Main must remain untouched on remote
      run("git", ["fetch", "origin", "main"], localDir);
      const originMainLog = run("git", ["log", "-1", "--pretty=%s", "origin/main"], localDir);
      expect(originMainLog).toBe("peer: conflicting edit");
    });
  }
);
