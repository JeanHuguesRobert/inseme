import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { EventStorePacketClaimCoordinator } from "../../../../packages/cop-kernel/src/packetCoordination.js";
import { createSqliteCopEventStore } from "../cop/sqliteRuntimeStore.js";

const migration = await readFile(
  new URL(
    "../../supabase/migrations/20260801120000_cop_runtime_portable_tables.sql",
    import.meta.url
  ),
  "utf8"
);

function openCoordinator(databasePath, now) {
  const database = new DatabaseSync(databasePath);
  database.exec(migration);
  const coordinator = new EventStorePacketClaimCoordinator({
    store: createSqliteCopEventStore(database),
    now,
  });
  return { database, coordinator };
}

test("SQLite PacketClaim survives restart and preserves fencing epoch", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "cop-packet-claim-"));
  const databasePath = path.join(directory, "runtime.sqlite");
  let now = Date.parse("2026-10-18T14:00:00.000Z");
  const packetRef = "packet:sqlite-durable-claim";

  try {
    const firstRuntime = openCoordinator(databasePath, () => now);
    const first = await firstRuntime.coordinator.tryClaim({
      packetRef,
      handlerRef: "handler:node-a",
      ttlMs: 1_000,
    });
    assert.equal(first.ok, true);
    assert.equal(first.claim.epoch, 1);
    assert.equal(first.claim.claim_id, `${packetRef}:claim:1`);
    firstRuntime.database.close();

    const restarted = openCoordinator(databasePath, () => now);
    assert.equal(restarted.coordinator.inspect(packetRef).active_claim.claim_id, first.claim.claim_id);

    const busy = await restarted.coordinator.tryClaim({
      packetRef,
      handlerRef: "handler:node-b",
      ttlMs: 1_000,
    });
    assert.equal(busy.ok, false);
    assert.equal(busy.code, "PACKET_BUSY");

    now += 1_001;
    const second = await restarted.coordinator.tryClaim({
      packetRef,
      handlerRef: "handler:node-b",
      ttlMs: 1_000,
    });
    assert.equal(second.ok, true);
    assert.equal(second.code, "CLAIM_RECLAIMED");
    assert.equal(second.claim.epoch, 2);
    assert.equal(second.claim.claim_id, `${packetRef}:claim:2`);

    const stale = await restarted.coordinator.complete({
      packetRef,
      claimId: first.claim.claim_id,
      handlerRef: first.claim.handler_ref,
      epoch: first.claim.epoch,
      resultRef: "artifact:late-node-a",
    });
    assert.equal(stale.ok, false);
    assert.equal(stale.code, "STALE_CLAIM");

    const completed = await restarted.coordinator.complete({
      packetRef,
      claimId: second.claim.claim_id,
      handlerRef: second.claim.handler_ref,
      epoch: second.claim.epoch,
      resultRef: "artifact:node-b",
    });
    assert.equal(completed.ok, true);
    assert.equal(completed.generation, 2);
    assert.equal(restarted.coordinator.inspect(packetRef).active_claim, null);
    restarted.database.close();

    const cold = openCoordinator(databasePath, () => now);
    const projection = cold.coordinator.inspect(packetRef);
    assert.equal(projection.last_epoch, 2);
    assert.equal(projection.generation, 2);
    assert.equal(projection.completed_claims.length, 1);
    assert.equal(projection.completed_claims[0].result_ref, "artifact:node-b");
    assert.ok(cold.coordinator.events(packetRef).length >= 6);
    cold.database.close();
  } finally {
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test("two SQLite coordinators share one authoritative PacketClaim stream", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "cop-packet-claim-race-"));
  const databasePath = path.join(directory, "runtime.sqlite");
  const now = Date.parse("2026-10-18T14:10:00.000Z");
  const packetRef = "packet:sqlite-shared-authority";

  try {
    const a = openCoordinator(databasePath, () => now);
    const b = openCoordinator(databasePath, () => now);

    const first = await a.coordinator.tryClaim({
      packetRef,
      handlerRef: "handler:a",
      ttlMs: 10_000,
    });
    const second = await b.coordinator.tryClaim({
      packetRef,
      handlerRef: "handler:b",
      ttlMs: 10_000,
    });

    assert.equal(first.ok, true);
    assert.equal(second.ok, false);
    assert.equal(second.code, "PACKET_BUSY");
    assert.equal(b.coordinator.inspect(packetRef).active_claim.handler_ref, "handler:a");

    a.database.close();
    b.database.close();
  } finally {
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});
