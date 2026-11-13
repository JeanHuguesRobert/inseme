import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSqliteCopEventStore } from "../src/sqlite-cop-event-store.js";
import { createSqliteMcpResultReceiptStore } from "../src/sqlite-mcp-result-receipt-store.js";
import { commitMcpContinuationResult } from "../src/mcp-continuation-result-commit.js";
import { MCP_RESULT_SUBMISSION_PROTOCOL } from "../src/mcp-continuation-result.js";
import { hashPayload } from "../src/cop-event-envelope.js";

function sample(answer = "One") {
  const step_result = {
    protocol: "cogentia.step_result/v1", continuation_id: "ctn_sqlite",
    challenge: "challenge", status: "answered", result: { answer },
  };
  return { protocol: MCP_RESULT_SUBMISSION_PROTOCOL, continuation_id: "ctn_sqlite",
    attempt_id: "attempt_1", execution_binding_ref: "binding_1",
    continuation_version: "4", idempotency_key: "attempt_1:result:0",
    result_digest: hashPayload(step_result), step_result };
}
function control() {
  return { authenticated_actor: "mcp:verified-worker", receipt_read_authorized: true,
    mandate_valid: true, budget_admitted: true, claim_valid: true,
    channel_permitted: true, continuation: {
      continuation_id: "ctn_sqlite", attempt_id: "attempt_1",
      execution_binding_ref: "binding_1", version: 4, lifecycle: "suspended" },
  };
}
test("SQLite COP store persists a result receipt after close/reopen", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cop-mcp-result-"));
  const dbFile = join(dir, "cop.sqlite");
  const admitted = control();
  let sqlite;
  try {
    sqlite = createSqliteCopEventStore(dbFile);
    const host = { admit: async () => admitted,
      store: createSqliteMcpResultReceiptStore(sqlite) };
    const first = await commitMcpContinuationResult(sample(), host);
    assert.equal(first.ok, true);
    assert.equal(first.duplicate, false);
    assert.match(first.receipt_ref, /^cop:event:/);
    sqlite.close();
    sqlite = createSqliteCopEventStore(dbFile);
    host.store = createSqliteMcpResultReceiptStore(sqlite);
    admitted.continuation.lifecycle = "resolved";
    admitted.mandate_valid = false; admitted.claim_valid = false;
    admitted.budget_admitted = false;
    const retry = await commitMcpContinuationResult(sample(), host);
    assert.equal(retry.ok, true);
    assert.equal(retry.duplicate, true);
    assert.equal(retry.receipt_ref, first.receipt_ref);
    assert.equal(sqlite.replay().length, 1);
    const conflict = await commitMcpContinuationResult(sample("Changed"), host);
    assert.equal(conflict.reason, "idempotency_conflict");
    assert.equal(sqlite.replay().length, 1);
  } finally {
    sqlite?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("SQLite duplicate atomic append returns one stored event", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cop-mcp-race-"));
  let sqlite;
  try {
    sqlite = createSqliteCopEventStore(join(dir, "cop.sqlite"));
    const host = { admit: async () => control(),
      store: createSqliteMcpResultReceiptStore(sqlite) };
    const [a, b] = await Promise.all([
      commitMcpContinuationResult(sample(), host),
      commitMcpContinuationResult(sample(), host),
    ]);
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.deepEqual([a.duplicate, b.duplicate].sort(), [false, true]);
    assert.equal(a.receipt_ref, b.receipt_ref);
    assert.equal(sqlite.replay().length, 1);
  } finally {
    sqlite?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
