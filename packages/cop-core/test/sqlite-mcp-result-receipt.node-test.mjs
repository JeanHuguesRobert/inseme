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
import { EventStorePacketClaimCoordinator } from "../../cop-kernel/src/packetCoordination.js";

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
async function claimedControl(sqlite) {
  const coordinator = new EventStorePacketClaimCoordinator({ store: sqlite });
  const grant = await coordinator.tryClaim({
    packetRef: "ctn_sqlite", handlerRef: "mcp:verified-worker", ttlMs: 60000,
  });
  assert.equal(grant.ok, true);
  return { authenticated_actor: "mcp:verified-worker", receipt_read_authorized: true,
    mandate_valid: true, budget_admitted: true, claim_valid: true,
    channel_permitted: true, claim: {
      packet_ref: grant.claim.packet_ref, claim_id: grant.claim.claim_id,
      handler_ref: grant.claim.handler_ref, epoch: grant.claim.epoch,
      expected_generation: coordinator.inspect("ctn_sqlite").generation,
    }, continuation: {
      continuation_id: "ctn_sqlite", attempt_id: "attempt_1",
      execution_binding_ref: "binding_1", version: 4, lifecycle: "suspended" },
  };
}
test("SQLite COP store persists a result receipt after close/reopen", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cop-mcp-result-"));
  const dbFile = join(dir, "cop.sqlite");
  let admitted;
  let sqlite;
  try {
    sqlite = createSqliteCopEventStore(dbFile);
    admitted = await claimedControl(sqlite);
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
    assert.equal(sqlite.listTopic("continuation:ctn_sqlite").length, 1);
    const conflict = await commitMcpContinuationResult(sample("Changed"), host);
    assert.equal(conflict.reason, "idempotency_conflict");
    assert.equal(sqlite.listTopic("continuation:ctn_sqlite").length, 1);
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
    const admitted = await claimedControl(sqlite);
    const host = { admit: async () => admitted,
      store: createSqliteMcpResultReceiptStore(sqlite) };
    const [a, b] = await Promise.all([
      commitMcpContinuationResult(sample(), host),
      commitMcpContinuationResult(sample(), host),
    ]);
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.deepEqual([a.duplicate, b.duplicate].sort(), [false, true]);
    assert.equal(a.receipt_ref, b.receipt_ref);
    assert.equal(sqlite.listTopic("continuation:ctn_sqlite").length, 1);
  } finally {
    sqlite?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("stale handler fenced after claim release and takeover", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cop-mcp-fence-"));
  let sqlite;
  try {
    sqlite = createSqliteCopEventStore(join(dir, "cop.sqlite"));
    const stale = await claimedControl(sqlite);
    const coordinator = new EventStorePacketClaimCoordinator({ store: sqlite });
    const released = await coordinator.release({
      packetRef: stale.claim.packet_ref,
      claimId: stale.claim.claim_id,
      handlerRef: stale.claim.handler_ref,
      epoch: stale.claim.epoch,
    });
    assert.equal(released.ok, true);
    const takeover = await coordinator.tryClaim({
      packetRef: "ctn_sqlite", handlerRef: "mcp:replacement-worker", ttlMs: 60000,
    });
    assert.equal(takeover.ok, true);
    assert.equal(takeover.claim.epoch, stale.claim.epoch + 1);
    const host = { admit: async () => stale,
      store: createSqliteMcpResultReceiptStore(sqlite) };
    const denied = await commitMcpContinuationResult(sample(), host);
    assert.equal(denied.ok, false);
    assert.equal(denied.reason, "stale_claim");
    assert.equal(sqlite.listTopic("continuation:ctn_sqlite").length, 0);
    stale.authenticated_actor = takeover.claim.handler_ref;
    stale.claim = { packet_ref: "ctn_sqlite", claim_id: takeover.claim.claim_id,
      handler_ref: takeover.claim.handler_ref, epoch: takeover.claim.epoch,
      expected_generation: coordinator.inspect("ctn_sqlite").generation };
    const accepted = await commitMcpContinuationResult(sample(), host);
    assert.equal(accepted.ok, true);
    assert.equal(sqlite.listTopic("continuation:ctn_sqlite").length, 1);
  } finally {
    sqlite?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("stale generation and missing claim cannot enter COP journal", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cop-mcp-generation-"));
  let sqlite;
  try {
    sqlite = createSqliteCopEventStore(join(dir, "cop.sqlite"));
    const admitted = await claimedControl(sqlite);
    const host = { admit: async () => admitted,
      store: createSqliteMcpResultReceiptStore(sqlite) };
    admitted.claim.expected_generation += 1;
    const denied = await commitMcpContinuationResult(sample(), host);
    assert.equal(denied.reason, "stale_packet_generation");
    assert.equal(sqlite.listTopic("continuation:ctn_sqlite").length, 0);
    delete admitted.claim;
    const missing = await commitMcpContinuationResult(sample(), host);
    assert.equal(missing.reason, "claim_fence_required");
    assert.equal(sqlite.listTopic("continuation:ctn_sqlite").length, 0);
  } finally {
    sqlite?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("transaction rejects asynchronous callbacks without persisting them", () => {
  const dir = mkdtempSync(join(tmpdir(), "cop-mcp-tx-"));
  let sqlite;
  try {
    sqlite = createSqliteCopEventStore(join(dir, "cop.sqlite"));
    const tx = sqlite.transaction(() => Promise.resolve("not allowed"));
    assert.equal(tx.ok, false);
    assert.equal(tx.error, "async_transaction_callback_forbidden");
    const afterward = sqlite.transaction((ctx) => ctx.listTopic("test").length);
    assert.deepEqual(afterward, { ok: true, value: 0 });
  } finally {
    sqlite?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
