import test from "node:test";
import assert from "node:assert/strict";

import { InMemoryPacketClaimCoordinator } from "../packages/cop-kernel/src/packetCoordination.js";
import { PacketClaimEvent } from "../packages/cop-core/src/packet-coordination.js";

test("Fractanet F1: one of two concurrent schedulers wins", async () => {
  let now = Date.parse("2026-10-07T17:00:00.000Z");
  const c = new InMemoryPacketClaimCoordinator({ now: () => now });
  const packetRef = "packet:coordination-reality-test:f1";

  const [a, b] = await Promise.all([
    c.tryClaim({ packetRef, handlerRef: "scheduler:A", ttlMs: 1000 }),
    c.tryClaim({ packetRef, handlerRef: "scheduler:B", ttlMs: 1000 }),
  ]);

  assert.equal([a, b].filter((x) => x.ok).length, 1);
  assert.equal([a, b].filter((x) => !x.ok).length, 1);
  assert.equal([a, b].find((x) => x.ok).claim.epoch, 1);
  assert.equal([a, b].find((x) => !x.ok).code, "PACKET_BUSY");
});

test("Fractanet F1: takeover increments epoch after lease expiry", async () => {
  let now = Date.parse("2026-10-07T17:00:00.000Z");
  const c = new InMemoryPacketClaimCoordinator({ now: () => now });
  const packetRef = "packet:coordination-reality-test:f1-takeover";

  const a = await c.tryClaim({ packetRef, handlerRef: "scheduler:A", ttlMs: 1000 });
  now += 1001;
  const b = await c.tryClaim({ packetRef, handlerRef: "scheduler:B", ttlMs: 1000 });

  assert.equal(a.claim.epoch, 1);
  assert.equal(b.code, "CLAIM_RECLAIMED");
  assert.equal(b.claim.epoch, 2);
  assert.ok(c.events(packetRef).some((e) => e.type === PacketClaimEvent.EXPIRED));
});

test("Fractanet F1: stale scheduler completion is fenced", async () => {
  let now = Date.parse("2026-10-07T17:00:00.000Z");
  const c = new InMemoryPacketClaimCoordinator({ now: () => now });
  const packetRef = "packet:coordination-reality-test:f1-fence";

  const a = await c.tryClaim({ packetRef, handlerRef: "scheduler:A", ttlMs: 1000 });
  now += 1001;
  const b = await c.tryClaim({ packetRef, handlerRef: "scheduler:B", ttlMs: 1000 });

  const stale = await c.complete({
    packetRef,
    claimId: a.claim.claim_id,
    handlerRef: a.claim.handler_ref,
    epoch: a.claim.epoch,
    resultRef: "artifact:stale-A",
  });
  assert.equal(stale.code, "STALE_CLAIM");
  assert.equal(c.inspect(packetRef).active_claim.claim_id, b.claim.claim_id);

  const winner = await c.complete({
    packetRef,
    claimId: b.claim.claim_id,
    handlerRef: b.claim.handler_ref,
    epoch: b.claim.epoch,
    resultRef: "artifact:winner-B",
  });
  assert.equal(winner.code, "CLAIM_COMPLETED");
  assert.equal(winner.generation, 2);
  assert.equal(c.inspect(packetRef).active_claim, null);
});
