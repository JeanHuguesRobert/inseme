import test from "node:test";
import assert from "node:assert/strict";

import { COPBus } from "../src/bus.js";
import { COPScheduler } from "../src/scheduler.js";
import { createContinuationDescriptor } from "../src/continuation.js";
import { InMemoryPacketClaimCoordinator } from "../src/packetCoordination.js";
import { createPrimaryPlacementPacketClaimResolver } from "../src/packetClaimLocality.js";

function packet(primaryStoreId, extraPlacements = []) {
  return {
    packet_id: "packet:locality-resolution-test",
    placements: [
      {
        store_id: primaryStoreId,
        store_kind: primaryStoreId.startsWith("sqlite:") ? "sqlite" : "postgres",
        locator: `${primaryStoreId}#packet:locality-resolution-test`,
        is_primary: true,
      },
      ...extraPlacements,
    ],
  };
}

test("MUTATE resolves PacketClaim coordinator from the Packet primary placement", async () => {
  const localCoordinator = new InMemoryPacketClaimCoordinator();
  const targetPacket = packet("sqlite:node-a");
  let executed = 0;

  const localityResolver = createPrimaryPlacementPacketClaimResolver({
    async resolveCoordinator({ storeId }) {
      return storeId === "sqlite:node-a" ? localCoordinator : null;
    },
  });

  const scheduler = new COPScheduler(new COPBus({ name: "locality-primary-test" }), {
    handlerResolver: async () => ({
      async execute({ executionContext }) {
        executed += 1;
        assert.equal(executionContext.packetClaim.packet_ref, targetPacket.packet_id);
        assert.equal(executionContext.packetClaimPlacement.store_id, "sqlite:node-a");
        return { output: { ok: true }, continuations: [] };
      },
    }),
    packetClaimCoordinatorResolver: localityResolver,
    coordinationResolver: async () => ({
      mode: "MUTATE",
      packetRef: targetPacket.packet_id,
      handlerRef: "handler:node-a",
      packet: targetPacket,
      ttlMs: 10_000,
    }),
  });

  const receipt = await scheduler.execute(
    createContinuationDescriptor({ resumeTo: "capability:local-mutation" })
  );

  assert.equal(executed, 1);
  assert.equal(receipt.execution.result.output.ok, true);
  assert.equal(localCoordinator.inspect(targetPacket.packet_id).active_claim, null);
});

test("unavailable primary locality fails closed and never falls back to another coordinator", async () => {
  const wrongLocalCoordinator = new InMemoryPacketClaimCoordinator();
  const targetPacket = packet("postgres:remote-primary");
  let executed = 0;

  const localityResolver = createPrimaryPlacementPacketClaimResolver({
    async resolveCoordinator() {
      return null;
    },
  });

  const scheduler = new COPScheduler(new COPBus({ name: "locality-unavailable-test" }), {
    handlerResolver: async () => ({
      async execute() {
        executed += 1;
        return { output: {}, continuations: [] };
      },
    }),
    packetClaimCoordinator: wrongLocalCoordinator,
    packetClaimCoordinatorResolver: localityResolver,
    coordinationResolver: async () => ({
      mode: "MUTATE",
      packetRef: targetPacket.packet_id,
      handlerRef: "handler:local",
      packet: targetPacket,
    }),
  });

  await assert.rejects(
    () =>
      scheduler.execute(
        createContinuationDescriptor({ resumeTo: "capability:remote-mutation" })
      ),
    (error) =>
      error?.code === "PACKET_CLAIM_LOCALITY_UNAVAILABLE" &&
      error?.required_store_id === "postgres:remote-primary"
  );

  assert.equal(executed, 0);
  assert.equal(wrongLocalCoordinator.events(targetPacket.packet_id).length, 0);
});

test("ambiguous Packet primary placement is rejected before claim or execution", async () => {
  const coordinator = new InMemoryPacketClaimCoordinator();
  const targetPacket = packet("sqlite:node-a", [
    {
      store_id: "postgres:node-b",
      store_kind: "postgres",
      locator: "postgres:node-b#packet:locality-resolution-test",
      is_primary: true,
    },
  ]);
  let executed = 0;

  const localityResolver = createPrimaryPlacementPacketClaimResolver({
    async resolveCoordinator() {
      return coordinator;
    },
  });

  const scheduler = new COPScheduler(new COPBus({ name: "locality-ambiguous-test" }), {
    handlerResolver: async () => ({
      async execute() {
        executed += 1;
        return { output: {}, continuations: [] };
      },
    }),
    packetClaimCoordinatorResolver: localityResolver,
    coordinationResolver: async () => ({
      mode: "MUTATE",
      packetRef: targetPacket.packet_id,
      handlerRef: "handler:any",
      packet: targetPacket,
    }),
  });

  await assert.rejects(
    () =>
      scheduler.execute(
        createContinuationDescriptor({ resumeTo: "capability:ambiguous-mutation" })
      ),
    (error) =>
      error?.code === "PACKET_PRIMARY_PLACEMENT_INVALID" &&
      /ambiguous primary placements/.test(error?.reason || "")
  );

  assert.equal(executed, 0);
  assert.equal(coordinator.events(targetPacket.packet_id).length, 0);
});
