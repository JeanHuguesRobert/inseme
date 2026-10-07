import test from "node:test";
import assert from "node:assert/strict";

import { InMemoryPacketClaimCoordinator } from "../src/packetCoordination.js";
import { PacketClaimEvent } from "../../cop-core/src/packet-coordination.js";

test("F1 race: exactly one concurrent mutation claimant wins", async () => {
  let now = Date.parse("2026-10-07T17:00:00.000Z");
  const coordinator = new InMemoryPacketClaimCoordinator({ now: () => now });
  const packetRef = "packet:coordination-reality-test:f1";

  const [a, b] = await Promise.all([
    coordinator.tryClaim({ packetRef, handlerRef: "scheduler:A", ttlMs: 1_000 }),
    coordinator.tryClaim({ packetRef, handlerRef: "scheduler:B", ttlMs: 1_000 }),
  ]);

  const granted = [a, b].filter((x) => x.ok);
  const denied = [a, b].filter((x) => !x.ok);

  assert.equal(granted.length, 1);
  assert.equal(denied.length, 1);
  assert.equal(granted[0].code, "CLAIM_GRANTED");
  assert.equal(granted[0].claim.epoch, 1);
  assert.equal(denied[0].code, "PACKET_BUSY");
  assert.equal(coordinator.inspect(packetRef).active_claim.epoch, 1);
});

test("F1 takeover: expired lease yields a newer fencing epoch", async () => {
  let now = Date.parse("2026-10-07T17:00:00.000Z");
  const coordinator = new InMemoryPacketClaimCoordinator({ now: () => now });
  const packetRef = "packet:coordination-reality-test:f1-takeover";

  const first = await coordinator.tryClaim({
    packetRef,
    handlerRef: "scheduler:A",
    ttlMs: 1_000,
  });
  assert.equal(first.claim.epoch, 1);

  now += 1_001;

  const second = await coordinator.tryClaim({
    packetRef,
    handlerRef: "scheduler:B",
    ttlMs: 1_000,
  });

  assert.equal(second.ok, true);
  assert.equal(second.code, "CLAIM_RECLAIMED");
  assert.equal(second.claim.epoch, 2);
  assert.equal(second.claim.handler_ref, "scheduler:B");

  const types = coordinator.events(packetRef).map((event) => event.type);
  assert.ok(types.includes(PacketClaimEvent.EXPIRED));
  assert.ok(types.includes(PacketClaimEvent.RECLAIMED));
});

test("F1 fencing: stale handler cannot complete after takeover", async () => {
  let now = Date.parse("2026-10-07T17:00:00.000Z");
  const coordinator = new InMemoryPacketClaimCoordinator({ now: () => now });
  const packetRef = "packet:coordination-reality-test:f1-stale";

  const a = await coordinator.tryClaim({
    packetRef,
    handlerRef: "scheduler:A",
    ttlMs: 1_000,
  });

  now += 1_001;

  const b = await coordinator.tryClaim({
    packetRef,
    handlerRef: "scheduler:B",
    ttlMs: 1_000,
  });

  const stale = await coordinator.complete({
    packetRef,
    claimId: a.claim.claim_id,
    handlerRef: a.claim.handler_ref,
    epoch: a.claim.epoch,
    resultRef: "artifact:stale-A",
  });

  assert.equal(stale.ok, false);
  assert.equal(stale.code, "STALE_CLAIM");
  assert.equal(coordinator.inspect(packetRef).active_claim.claim_id, b.claim.claim_id);
  assert.equal(coordinator.inspect(packetRef).generation, 1);

  const completed = await coordinator.complete({
    packetRef,
    claimId: b.claim.claim_id,
    handlerRef: b.claim.handler_ref,
    epoch: b.claim.epoch,
    resultRef: "artifact:winner-B",
  });

  assert.equal(completed.ok, true);
  assert.equal(completed.code, "CLAIM_COMPLETED");
  assert.equal(completed.generation, 2);
  assert.equal(coordinator.inspect(packetRef).active_claim, null);

  const staleEvents = coordinator
    .events(packetRef)
    .filter((event) => event.type === PacketClaimEvent.STALE_REJECTED);
  assert.equal(staleEvents.length, 1);
  assert.equal(staleEvents[0].operation, "complete");
});
