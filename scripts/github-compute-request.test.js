import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  executeNodeTestRequest,
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

test("parses a bare JSON comment when GitHub strips presentation fencing", () => {
  const value = request();
  const parsed = parseComputeRequestComment(JSON.stringify(value), {
    expectedRepository: "JeanHuguesRobert/inseme",
    expectedIssue: 120,
  });
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


test("accepts bounded node-test files and rejects arbitrary paths", () => {
  const value = request({
    computation_id: "inseme-120-node-test-v1",
    operation: {
      kind: "node-test",
      files: [
        "scripts/watch-the-watchers.test.js",
        "apps/platform/mcp/test/artifactAccessSupabaseStore.test.js",
      ],
    },
  });
  const parsed = parseComputeRequestComment(JSON.stringify(value), {
    expectedRepository: "JeanHuguesRobert/inseme",
    expectedIssue: 120,
  });
  assert.deepEqual(parsed.operation, value.operation);

  const bad = request({
    operation: { kind: "node-test", files: ["packages/cop-core/test/anything.test.js"] },
  });
  assert.throws(
    () => parseComputeRequestComment(JSON.stringify(bad), {
      expectedRepository: "JeanHuguesRobert/inseme",
      expectedIssue: 120,
    }),
    /node_test_path_not_allowed/,
  );
});

test("executes bounded node tests without shell command text", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "inseme-node-test-"));
  fs.mkdirSync(path.join(dir, "scripts"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "scripts", "sample.test.js"),
    'import test from "node:test"; import assert from "node:assert/strict"; test("ok", () => assert.equal(2 + 2, 4));\n',
  );
  const value = request({
    computation_id: "inseme-120-node-test-local-v1",
    operation: { kind: "node-test", files: ["scripts/sample.test.js"] },
  });

  const result = executeNodeTestRequest(value, {
    workspace: dir,
    runId: "54321",
    runUrl: "https://example.test/run/54321",
  });

  assert.equal(result.result.operation, "node-test");
  assert.equal(result.result.passed, true);
  assert.equal(result.execution_receipt.status, "completed");
  assert.equal(result.execution_binding.provider_execution_id, "54321");
});
