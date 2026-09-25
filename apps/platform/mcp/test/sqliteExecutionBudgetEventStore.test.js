import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createSqliteCopEventStore } from "../cop/sqliteRuntimeStore.js";
import { createEventSourcedExecutionBudgetLedger } from "../../../../packages/cop-core/src/execution-budget.js";

const migration = await readFile(
  new URL(
    "../../supabase/migrations/20260801120000_cop_runtime_portable_tables.sql",
    import.meta.url
  ),
  "utf8"
);

const limits = {
  max_steps: 2,
  max_tool_calls: 1,
  max_subagents: 0,
  max_elapsed_ms: 1000,
  max_external_effects: 0,
};

test("SQLite COP event store durably enforces the budget topic version", () => {
  const database = new DatabaseSync(":memory:");
  database.exec(migration);
  try {
    const first = createEventSourcedExecutionBudgetLedger({
      store: createSqliteCopEventStore(database),
      budget_id: "budget:sqlite",
      limits,
    });
    const second = createEventSourcedExecutionBudgetLedger({
      store: createSqliteCopEventStore(database),
      budget_id: "budget:sqlite",
      limits,
    });
    const reserved = first.reserve({
      idempotency_key: "run:sqlite-one",
      expected_version: 0,
      demand: {
        max_steps: 1,
        max_tool_calls: 0,
        max_subagents: 0,
        max_elapsed_ms: 100,
        max_external_effects: 0,
      },
    });
    assert.equal(reserved.ok, true);
    assert.equal(reserved.snapshot.version, 1);
    const stale = second.reserve({
      idempotency_key: "run:sqlite-two",
      expected_version: 0,
      demand: {
        max_steps: 1,
        max_tool_calls: 0,
        max_subagents: 0,
        max_elapsed_ms: 100,
        max_external_effects: 0,
      },
    });
    assert.equal(stale.error, "budget_version_conflict");
    assert.equal(second.snapshot().available.max_steps, 1);

    const restarted = createEventSourcedExecutionBudgetLedger({
      store: createSqliteCopEventStore(database),
      budget_id: "budget:sqlite",
      limits,
    });
    assert.equal(restarted.snapshot().version, 1);
    assert.equal(restarted.snapshot().reserved.max_steps, 1);
    const duplicate = restarted.reserve({
      idempotency_key: "run:sqlite-one",
      expected_version: 0,
      demand: reserved.reservation.demand,
    });
    assert.equal(duplicate.duplicate, true);
    assert.equal(database.prepare("SELECT count(*) AS count FROM cop_events").get().count, 1);
  } finally {
    database.close();
  }
});

function eventCount(database) {
  return database.prepare("SELECT count(*) AS count FROM cop_events").get().count;
}

function note(key, payload, extra = {}) {
  return {
    event_type: "Note",
    topic_id: "topic:batch",
    epistemic_status: "observed",
    payload,
    idempotency_key: key,
    ...extra,
  };
}

test("SQLite transaction commits several events or none", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "cop-sqlite-tx-"));
  const databasePath = path.join(directory, "events.sqlite");
  try {
    const database = new DatabaseSync(databasePath);
    database.exec(migration);
    const store = createSqliteCopEventStore(database);
    const committed = store.transaction((tx) => {
      const first = tx.append(note("batch-1", { n: 1 }));
      const second = tx.append(note("batch-2", { n: 2 }));
      return { first, second };
    });
    assert.equal(committed.ok, true);
    assert.equal(committed.value.first.event.topic.seq, 1);
    assert.equal(committed.value.second.event.topic.seq, 2);
    assert.equal(eventCount(database), 2);

    const duplicate = store.transaction((tx) => {
      const again = tx.append(note("batch-1", { n: 9 }));
      const third = tx.append(note("batch-3", { n: 3 }));
      return { again, third };
    });
    assert.equal(duplicate.ok, true);
    assert.equal(duplicate.value.again.duplicate, true);
    assert.equal(duplicate.value.again.event.payload.n, 1);
    assert.equal(eventCount(database), 3);

    const refused = store.append(note("batch-4", { n: 4 }, { topic_seq: 1 }));
    assert.equal(refused.ok, false);
    assert.equal(refused.error, "topic_seq_conflict");
    assert.equal(eventCount(database), 3);

    const rolledBack = store.transaction((tx) => {
      const first = tx.append(note("batch-5", { n: 5 }));
      assert.equal(first.ok, true);
      const conflict = tx.append(note("batch-6", { n: 6 }, { event_id: first.event.event_id }));
      assert.equal(conflict.ok, false);
      assert.equal(conflict.error, "event_id_conflict");
      return conflict;
    });
    assert.equal(rolledBack.ok, false);
    assert.equal(rolledBack.rolledBack, true);
    assert.equal(eventCount(database), 3);

    assert.throws(
      () =>
        store.transaction((tx) => {
          const inserted = tx.append(note("batch-7", { n: 7 }));
          assert.equal(inserted.ok, true);
          throw new Error("stop the batch");
        }),
      /stop the batch/
    );
    assert.equal(eventCount(database), 3);

    assert.throws(
      () =>
        store.transaction(() => {
          store.transaction(() => {});
        }),
      /nested COP SQLite transaction is not supported/
    );
    assert.equal(eventCount(database), 3);
    database.close();

    const reopened = new DatabaseSync(databasePath);
    try {
      assert.equal(eventCount(reopened), 3);
      const restored = createSqliteCopEventStore(reopened).replay();
      assert.deepEqual(
        restored.map((event) => event.idempotency_key),
        ["batch-1", "batch-2", "batch-3"]
      );
    } finally {
      reopened.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});
