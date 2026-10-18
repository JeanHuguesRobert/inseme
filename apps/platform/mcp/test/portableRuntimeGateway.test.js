import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  CopAccessDeniedError,
  createPortableCopRuntimeGateway,
  createSupabasePortableExecutor,
} from "../cop/portableRuntimeGateway.js";

const migration = [
  await readFile(
    new URL(
      "../../supabase/migrations/20260801120000_cop_runtime_portable_tables.sql",
      import.meta.url
    ),
    "utf8"
  ),
  await readFile(
    new URL(
      "../../supabase/migrations/20261019004500_cop_packet_projection.sql",
      import.meta.url
    ),
    "utf8"
  ),
].join("\n");
const now = "2026-08-01T12:00:00.000Z";

function createSqliteExecutor(database) {
  return {
    insert(table, row) {
      const columns = Object.keys(row);
      const placeholders = columns.map(() => "?").join(", ");
      database
        .prepare(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`)
        .run(...Object.values(row));
      return row;
    },
    upsert(table, row, { conflictColumns = ["id"], preserveColumns = [] } = {}) {
      const columns = Object.keys(row);
      const placeholders = columns.map(() => "?").join(", ");
      const preserve = new Set([...conflictColumns, ...preserveColumns]);
      const updates = columns
        .filter((column) => !preserve.has(column))
        .map((column) => `${column} = excluded.${column}`);
      database
        .prepare(
          `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders}) ON CONFLICT(${conflictColumns.join(", ")}) DO UPDATE SET ${updates.join(", ")}`
        )
        .run(...Object.values(row));
      return row;
    },
  };
}

function fullMandate() {
  return {
    status: "active",
    granteeRef: "principal:jhn",
    permissions: [
      "cop.handlers.write",
      "cop.logical-agents.write",
      "cop.packets.write",
      "cop.tasks.write",
      "cop.steps.write",
      "cop.events.append",
      "cop.artifacts.append",
    ],
  };
}

test("portable gateway enforces a mandate before writing the SQLite-validated schema", async () => {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  database.exec(migration);
  const gateway = createPortableCopRuntimeGateway({
    executor: createSqliteExecutor(database),
    clock: () => new Date(now),
    idFactory: (prefix) => `${prefix}:generated`,
  });
  const context = { principal: { id: "principal:jhn" }, mandate: fullMandate() };

  await gateway.registerHandler(context, {
    handlerName: "handler:jhn:coordinator",
    handlerKind: "runtime",
    metadata: { profile: "coordinator" },
  });
  await gateway.upsertLogicalAgent(context, {
    logical_agent_id: "agent:jhn:coordinator:1",
    logical_agent_name: "JHN coordinator",
    status: "active",
    twin_root_ref: "twin:jhn",
    active_mandate_ref: "mandate:jhn:cop-mandate:1",
  });
  await gateway.upsertPacket(context, {
    packet_id: "packet:1",
    status: "dispatched",
    mandate_id: "mandate:jhn:cop-mandate:1",
    created_at: "2026-07-01T00:00:00.000Z",
    placements: [
      {
        store_id: "sqlite:jhn-local",
        store_kind: "sqlite",
        locator: "sqlite:jhn-local#packet:1",
        is_primary: true,
      },
    ],
    payload: { objective: "Specify COP/Mandate" },
  });
  await gateway.upsertPacket(context, {
    packet_id: "packet:1",
    status: "solved",
    mandate_id: "mandate:jhn:cop-mandate:1",
    payload: { objective: "Specify COP/Mandate", result: "done" },
  });
  await gateway.upsertTask(context, { id: "task:1", name: "Specify COP/Mandate" });
  await gateway.upsertStep(context, { id: "step:1", task_id: "task:1", name: "Validate SQL" });
  await gateway.appendEvent(context, { topic_id: "topic:1", type: "mission.started" });
  await gateway.appendArtifact(context, {
    topic_id: "topic:1",
    handler_name: "handler:jhn:coordinator",
    artifact_type: "cop/mandate",
    artifact_kind: "document",
    content: { version: 1 },
  });

  const packetRow = database
    .prepare("SELECT id, status, mandate_id, packet_json, created_at FROM cop_packets")
    .get();
  assert.equal(database.prepare("SELECT count(*) AS count FROM cop_packets").get().count, 1);
  assert.equal(packetRow.id, "packet:1");
  assert.equal(packetRow.status, "solved");
  assert.equal(packetRow.mandate_id, "mandate:jhn:cop-mandate:1");
  assert.equal(packetRow.created_at, "2026-07-01T00:00:00.000Z");
  assert.equal(JSON.parse(packetRow.packet_json).packet_id, "packet:1");
  assert.equal(JSON.parse(packetRow.packet_json).payload.result, "done");
  assert.equal(database.prepare("SELECT payload FROM cop_events").get().payload, "{}");
  assert.equal(
    database.prepare("SELECT content FROM cop_artifacts").get().content,
    '{"version":1}'
  );
  assert.equal(database.prepare("SELECT id FROM cop_events").get().id, "event:generated");
  assert.equal(gateway.events, undefined, "append-only records expose no mutable event collection");
  database.close();
});

test("portable gateway rejects a write without the required mandate permission", async () => {
  const database = new DatabaseSync(":memory:");
  database.exec(migration);
  const gateway = createPortableCopRuntimeGateway({ executor: createSqliteExecutor(database) });

  await assert.rejects(
    gateway.appendEvent(
      {
        principal: { id: "principal:untrusted" },
        mandate: { status: "active", granteeRef: "principal:untrusted", permissions: [] },
      },
      { type: "mission.started" }
    ),
    (error) => error instanceof CopAccessDeniedError && error.code === "COP_ACCESS_DENIED"
  );
  assert.equal(database.prepare("SELECT count(*) AS count FROM cop_events").get().count, 0);
  database.close();
});

test("Supabase executor forwards only the row accepted by the portable gateway", async () => {
  let received;
  const client = {
    from(table) {
      return {
        insert(row) {
          received = { table, row };
          return {
            select() {
              return {
                maybeSingle: async () => ({ data: row, error: null }),
              };
            },
          };
        },
      };
    },
  };
  const gateway = createPortableCopRuntimeGateway({
    executor: createSupabasePortableExecutor(client),
    clock: () => new Date(now),
    idFactory: (prefix) => `${prefix}:generated`,
  });

  await gateway.appendEvent(
    { principal: { id: "principal:jhn" }, mandate: fullMandate() },
    { type: "mission.started", payload: { source: "test" } }
  );

  assert.equal(received.table, "cop_events");
  assert.equal(received.row.id, "event:generated");
  assert.equal(received.row.payload, '{"source":"test"}');
});
