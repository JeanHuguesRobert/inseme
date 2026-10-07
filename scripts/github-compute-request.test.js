import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  executeSha256Request,
  formatResultComment,
  parseComputeRequestComment,
} from "./github-compute-request.js";

function request(overrides = {}) {
  return {
    schema: "cop.compute-request/v1",
    computation_id: "inseme-120-sha-v1",
    capability: "compute.batch",
    repository: {
      name: "JeanHuguesRobert/inseme",
      ref: "a".repeat(40),
    },
    operation: {
      kind: "sha256-file",
      path: "AGENTS.md",
    },
    limits: {
      timeout_seconds: 60,
      network: false,
      repository_write: false,
    },
    return: {
      github_issue: 120,
      structured_result: true,
    },
    ...overrides,
  };
}

test("parses one typed fenced JSON request", () => {
  const value = request();
  const parsed = parseComputeRequestComment(
    `please compute\n\n\`\`\`json\n${JSON.stringify(value)}\n\`\`\``,
    {
      expectedRepository: "JeanHuguesRobert/inseme",
      expectedIssue: 120,
    },
  );
  assert.deepEqual(parsed, value);
});

test("rejects arbitrary operation kinds", () => {
  const value = request({ operation: { kind: "shell", command: "rm -rf /" } });
  assert.throws(
    () => parseComputeRequestComment(
      `\`\`\`json\n${JSON.stringify(value)}\n\`\`\``,
      { expectedRepository: "JeanHuguesRobert/inseme", expectedIssue: 120 },
    ),
    /unsupported_operation/,
  );
});

test("rejects traversal and widened execution policy", () => {
  for (const value of [
    request({ operation: { kind: "sha256-file", path: "../secret" } }),
    request({ limits: { timeout_seconds: 60, network: true, repository_write: false } }),
    request({ limits: { timeout_seconds: 60, network: false, repository_write: true } }),
  ]) {
    assert.throws(
      () => parseComputeRequestComment(
        `\`\`\`json\n${JSON.stringify(value)}\n\`\`\``,
        { expectedRepository: "JeanHuguesRobert/inseme", expectedIssue: 120 },
      ),
    );
  }
});

test("executes deterministic sha256 and emits durable correlation", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "inseme-compute-"));
  fs.writeFileSync(path.join(dir, "known.txt"), "Reality\n");
  const value = request({ operation: { kind: "sha256-file", path: "known.txt" } });

  const result = executeSha256Request(value, {
    workspace: dir,
    runId: "12345",
    runUrl: "https://example.test/run/12345",
  });

  assert.equal(
    result.result.digest,
    crypto.createHash("sha256").update("Reality\n").digest("hex"),
  );
  assert.equal(result.execution_binding.provider_execution_id, "12345");
  assert.equal(result.execution_receipt.status, "completed");
  assert.match(formatResultComment(result), /cop-compute-result:inseme-120-sha-v1/);
});
