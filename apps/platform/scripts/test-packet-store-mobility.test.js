import test from "node:test";
import assert from "node:assert/strict";
import {
  createSqlitePacketStore,
  createPostgresPacketStore,
  primaryPacketPlacement,
  transferPacket,
} from "../../../packages/cop-core/dist/packet-store.js";
import { resumePacket, computeContentHash } from "../../../packages/cop-core/dist/closure.js";
import { InMemoryPacketClaimCoordinator } from "../../../packages/cop-kernel/src/packetCoordination.js";

test("SQLite -> PostgreSQL mobility reality test: same packet moves across stores and resumes on destination node", async () => {
  // 1. Initialize SQLite store on Node A and PostgreSQL store on Node B
  const sqliteNodeA = createSqlitePacketStore("sqlite:node-a:local");
  const postgresNodeB = createPostgresPacketStore("supabase:ndiysuhzmztatpxbkezn");

  const doc = "Délibération municipale n°2025-07-01 portant aménagement urbain à Corte.";
  const docHash = computeContentHash(doc);

  // 2. Node A creates and saves the packet in its local SQLite store
  const originalPacket = {
    packet_id: "pkt-mobility-reality-test-101",
    created_at: new Date().toISOString(),
    hops: [
      {
        hop_index: 0,
        node_id: "node:local:workstation",
        instance_id: "agent:jhn",
        interface: "sqlite-local",
        route_reason: "work-initiated-locally",
        timestamp: new Date().toISOString(),
      },
    ],
    payload: { action: "analyze_deliberation", doc_id: "delib-2025-07-01" },
    closure: {
      closure_kind: "materializable",
      admissible_handlers: ["agent:jhn", "agent:ophelia"],
      referenced_dependencies: [
        {
          dependency_id: "dep:acte:delib_2025_07_01",
          kind: "document",
          locator: "store://actes/delib_2025_07_01.txt",
          hash: docHash,
        },
      ],
    },
    status: "dispatched",
  };

  const initialPlacement = await sqliteNodeA.savePacket(originalPacket);
  assert.equal(initialPlacement.store_kind, "sqlite");
  assert.equal(initialPlacement.is_primary, true);

  // 3. Mobility transfer: packet travels from SQLite (Node A) to PostgreSQL (Node B)
  const {
    packet: transferredPacket,
    sourcePlacement,
    targetPlacement,
  } = await transferPacket(originalPacket.packet_id, sqliteNodeA, postgresNodeB, {
    setTargetPrimary: true,
  });

  // Assert identity and placement manifest
  assert.equal(transferredPacket.packet_id, originalPacket.packet_id);
  assert.equal(transferredPacket.placements.length, 2);
  assert.equal(targetPlacement.store_kind, "postgres");
  assert.equal(targetPlacement.is_primary, true);
  assert.equal(sourcePlacement.is_primary, false);
  assert.equal(
    primaryPacketPlacement(transferredPacket, { required: true }).store_id,
    postgresNodeB.store_id
  );

  // Node A can delete or keep its cached copy. If it keeps it, that copy is stale:
  // PacketClaim epoch fencing in cop-kernel, not placement metadata alone, prevents
  // an old holder from committing a canonical mutation after handoff.
  await sqliteNodeA.deletePacket(originalPacket.packet_id);
  assert.equal(await sqliteNodeA.hasPacket(originalPacket.packet_id), false);

  // 4. Node B fetches ONLY from PostgreSQL store without access to Node A
  const packetOnNodeB = await postgresNodeB.getPacket(originalPacket.packet_id);
  assert.ok(packetOnNodeB);
  assert.equal(packetOnNodeB.packet_id, originalPacket.packet_id);

  // Node B resolver
  const nodeBResolver = {
    async resolve(dep) {
      if (dep.locator === "store://actes/delib_2025_07_01.txt") {
        return { content: doc, rawString: doc };
      }
      throw new Error("Not found");
    },
  };

  // Node B resumes execution
  const resumedOnNodeB = await resumePacket(packetOnNodeB, nodeBResolver, async (pkt, closure) => {
    assert.equal(closure.is_closed, true);
    const dep = closure.resolved_dependencies.get("dep:acte:delib_2025_07_01");
    assert.ok(dep.verified);

    return {
      yield: {
        summary: "Analyse validée sur nœud B distant",
        source_doc: dep.content,
      },
      newHop: {
        node_id: "node:cloud:fracta",
        instance_id: "agent:ophelia",
        interface: "postgres-cop",
        route_reason: "resumed-from-postgres-placement",
      },
    };
  });

  // Save resumed state back to PostgreSQL on Node B
  await postgresNodeB.savePacket(resumedOnNodeB);

  // 5. Final assertions
  const finalPacket = await postgresNodeB.getPacket(originalPacket.packet_id);
  assert.equal(finalPacket.status, "solved");
  assert.equal(finalPacket.hops.length, 2);
  assert.equal(finalPacket.hops[1].node_id, "node:cloud:fracta");
  assert.equal(finalPacket.hops[1].instance_id, "agent:ophelia");
  assert.match(finalPacket.yield.semantic_yield.summary, /nœud B/);
});


test("packet transfer rejects ambiguous or non-source primary authority", async () => {
  const source = createSqlitePacketStore("sqlite:source");
  const target = createPostgresPacketStore("postgres:target");

  await source.savePacket({
    packet_id: "pkt-primary-mismatch",
    created_at: new Date().toISOString(),
    hops: [],
    payload: {},
    placements: [
      {
        store_id: "postgres:other",
        store_kind: "postgres",
        locator: "postgres://other/pkt-primary-mismatch",
        is_primary: true,
      },
    ],
  });

  await assert.rejects(
    () => transferPacket("pkt-primary-mismatch", source, target),
    /primary placement is postgres:other, not source store sqlite:source/
  );

  const ambiguous = {
    packet_id: "pkt-ambiguous-primary",
    placements: [
      {
        store_id: "sqlite:a",
        store_kind: "sqlite",
        locator: "sqlite://a/pkt-ambiguous-primary",
        is_primary: true,
      },
      {
        store_id: "postgres:b",
        store_kind: "postgres",
        locator: "postgres://b/pkt-ambiguous-primary",
        is_primary: true,
      },
    ],
  };

  assert.throws(
    () => primaryPacketPlacement(ambiguous, { required: true }),
    /ambiguous primary placements/
  );
});

test("primary placement is optional for an unplaced packet but can be required explicitly", () => {
  const packet = { packet_id: "pkt-unplaced", placements: [] };

  assert.equal(primaryPacketPlacement(packet), null);
  assert.throws(
    () => primaryPacketPlacement(packet, { required: true }),
    /has no primary placement/
  );
});


test("placement handoff plus PacketClaim epoch fences the former primary holder", async () => {
  let now = Date.parse("2026-10-18T13:00:00.000Z");
  const coordinator = new InMemoryPacketClaimCoordinator({ now: () => now });
  const source = createSqlitePacketStore("sqlite:node-a");
  const target = createPostgresPacketStore("postgres:node-b");
  const packetId = "pkt-authority-handoff";

  await source.savePacket({
    packet_id: packetId,
    created_at: new Date(now).toISOString(),
    hops: [],
    payload: { operation: "mutate-after-handoff" },
    status: "dispatched",
  });

  const claimA = await coordinator.tryClaim({
    packetRef: packetId,
    handlerRef: "handler:node-a",
    ttlMs: 1_000,
  });
  assert.equal(claimA.ok, true);
  assert.equal(claimA.claim.epoch, 1);

  const { packet: moved } = await transferPacket(packetId, source, target, {
    setTargetPrimary: true,
  });
  assert.equal(primaryPacketPlacement(moved, { required: true }).store_id, target.store_id);

  // Authority moves only after the old lease can no longer authorize canonical mutation.
  now += 1_001;
  const claimB = await coordinator.tryClaim({
    packetRef: packetId,
    handlerRef: "handler:node-b",
    ttlMs: 1_000,
  });
  assert.equal(claimB.ok, true);
  assert.equal(claimB.claim.epoch, 2);

  const staleA = await coordinator.complete({
    packetRef: packetId,
    claimId: claimA.claim.claim_id,
    handlerRef: claimA.claim.handler_ref,
    epoch: claimA.claim.epoch,
    resultRef: "artifact:late-node-a-result",
  });
  assert.equal(staleA.ok, false);
  assert.equal(staleA.code, "STALE_CLAIM");

  const currentB = await coordinator.complete({
    packetRef: packetId,
    claimId: claimB.claim.claim_id,
    handlerRef: claimB.claim.handler_ref,
    epoch: claimB.claim.epoch,
    resultRef: "artifact:node-b-result",
  });
  assert.equal(currentB.ok, true);
});
