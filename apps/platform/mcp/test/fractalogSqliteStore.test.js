import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createFractalogActRecord } from "../../../../packages/cop-core/src/fractalog.js";
import { createFractalogSqliteStore } from "../cop/fractalogSqliteStore.js";

function record(overrides = {}) {
  return createFractalogActRecord({
    record_id: "flr:sqlite:1",
    act_id: "act:sqlite:1",
    act_kind: "navigation.page.observe",
    act_phase: "observed",
    owner_instance_ref: "instance:jhn",
    idempotency_key: "navigation:observation:1",
    time: { recorded_at: "2026-09-08T12:00:00.000Z" },
    ...overrides,
  });
}

test("FractaLog SQLite keeps immutable documents and a separate durable outbox", async () => {
  const database = new DatabaseSync(":memory:");
  try {
    const store = createFractalogSqliteStore(database);
    const first = record();
    assert.equal(store.append(first).duplicate, false);
    assert.equal(store.append(first).duplicate, true);
    assert.equal(store.pending().length, 1);
    const forwarded = await store.forward(first.record_id, async (document) => ({
      accepted: true,
      record_id: document.record_id,
      receipt_id: "receipt:central:1",
    }));
    assert.equal(forwarded.ok, true);
    assert.equal(store.outbox(first.record_id).state, "accepted");
    assert.equal(store.get(first.record_id).integrity.document_hash, first.integrity.document_hash);
  } finally {
    database.close();
  }
});

test("FractaLog SQLite leaves a failed forward pending for retry", async () => {
  const database = new DatabaseSync(":memory:");
  try {
    const store = createFractalogSqliteStore(database);
    const first = record({ record_id: "flr:sqlite:retry", idempotency_key: "navigation:retry:1" });
    store.append(first);
    const result = await store.forward(first.record_id, async () => {
      throw new Error("offline");
    });
    assert.deepEqual(result, { ok: false, error: "central_ingress_unreachable" });
    assert.equal(store.outbox(first.record_id).state, "pending");
    assert.equal(store.outbox(first.record_id).attempt_count, 1);
  } finally {
    database.close();
  }
});
