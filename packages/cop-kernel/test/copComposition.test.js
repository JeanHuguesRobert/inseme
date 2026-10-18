import assert from "node:assert/strict";
import test from "node:test";

import {
  asCognitivePacket,
  markPacketSolved,
  markPacketReturned,
  markPacketAssimilated,
  markPacketCancelled,
} from "../src/Cop-kerneltasks.js";

import { copFork, copAll, copRace, copSequence, copCascadeCancel } from "../src/copComposition.js";

import { COPBus } from "../src/bus.js";

test("copComposition: copFork spawns child with upstream lineage and parent Ithaca", async () => {
  const bus = new COPBus({ name: "cop-fork-test-bus" });
  const parent = asCognitivePacket({
    kind: "parent-task",
    envelope: { id: "pkt-parent-001", intent: "Overarching job" },
    bus,
  });

  const child = copFork(
    parent,
    {
      kind: "child-subtask",
      intent: "Process sub-component",
      requiredCapability: "data-processing",
      payload: { items: [1, 2, 3] },
      spawnReason: "data_parallel_split",
    },
    { bus }
  );

  assert.ok(child.envelope.id.startsWith("pkt-child-"));
  assert.equal(child.envelope.lineage.upstream_packet_id, "pkt-parent-001");
  assert.equal(child.envelope.lineage.spawn_reason, "data_parallel_split");
  assert.equal(child.envelope.ithaca.return_target, "pkt-parent-001");
  assert.ok(parent.envelope.lineage.downstream_packet_ids.includes(child.envelope.id));
});

test("copComposition: copAll fork-join combinator waits for children and combines Yields", async () => {
  const bus = new COPBus({ name: "cop-all-test-bus" });

  const p1 = asCognitivePacket({ kind: "t", envelope: { id: "p-1", intent: "T1" }, bus });
  const p2 = asCognitivePacket({ kind: "t", envelope: { id: "p-2", intent: "T2" }, bus });

  setTimeout(async () => {
    await markPacketSolved(p1, { yieldData: { semantic_yield: { result: "R1" } }, bus });
  }, 15);

  setTimeout(async () => {
    await markPacketSolved(p2, { yieldData: { semantic_yield: { result: "R2" } }, bus });
  }, 30);

  const result = await copAll([p1, p2], {
    bus,
    combiner: (yields) => ({
      combined: yields.map((y) => y.semantic_yield.result).join("+"),
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "completed");
  assert.equal(result.yields.length, 2);
  assert.equal(result.combinedYield.combined, "R1+R2");
});

test("copComposition: copRace returns first solver and auto-cancels competitors", async () => {
  const bus = new COPBus({ name: "cop-race-test-bus" });

  const fast = asCognitivePacket({ kind: "t", envelope: { id: "p-fast", intent: "Fast" }, bus });
  const slow = asCognitivePacket({ kind: "t", envelope: { id: "p-slow", intent: "Slow" }, bus });

  setTimeout(async () => {
    await markPacketSolved(fast, {
      yieldData: { semantic_yield: { answer: "fast-win" } },
      bus,
    });
  }, 10);

  const raceResult = await copRace([fast, slow], { bus });

  assert.equal(raceResult.ok, true);
  assert.equal(raceResult.winnerPacketId, "p-fast");
  assert.equal(raceResult.winningYield.semantic_yield.answer, "fast-win");
  assert.equal(slow.envelope.status, "cancelled");
  assert.equal(slow.cancellation.reason, "competitor_won_race");
});

test("copComposition: copSequence pipelines Yields across steps", async () => {
  const bus = new COPBus({ name: "cop-sequence-test-bus" });

  const result = await copSequence(
    { number: 10 },
    [
      async (payload) => {
        const p1 = asCognitivePacket({ kind: "step1", envelope: { id: "p-step-1" }, bus });
        return markPacketSolved(p1, {
          yieldData: { semantic_yield: { value: payload.number * 2 } },
          bus,
        });
      },
      async (payload) => {
        const p2 = asCognitivePacket({ kind: "step2", envelope: { id: "p-step-2" }, bus });
        return markPacketSolved(p2, {
          yieldData: { semantic_yield: { result: `Final value is: ${payload.value + 5}` } },
          bus,
        });
      },
    ],
    { bus }
  );

  assert.equal(result.ok, true);
  assert.equal(result.finalYield.result, "Final value is: 25");
  assert.equal(result.history.length, 2);
});

test("copComposition: copCascadeCancel aborts parent and all active children", async () => {
  const bus = new COPBus({ name: "cop-cancel-test-bus" });

  const parent = asCognitivePacket({
    kind: "p",
    envelope: { id: "parent-99", status: "dispatched" },
    bus,
  });
  const c1 = asCognitivePacket({
    kind: "c",
    envelope: { id: "child-11", status: "dispatched" },
    bus,
  });
  const c2 = asCognitivePacket({ kind: "c", envelope: { id: "child-12", status: "solved" }, bus });
  const c3 = asCognitivePacket({ kind: "c", envelope: { id: "child-13", status: "draft" }, bus });

  const result = await copCascadeCancel(parent, [c1, c2, c3], {
    reason: "timeout_abort",
    bus,
  });

  assert.equal(parent.envelope.status, "cancelled");
  assert.equal(c1.envelope.status, "cancelled");
  assert.equal(c2.envelope.status, "solved");
  assert.equal(c3.envelope.status, "cancelled");
  assert.equal(result.totalCancelled, 3);
});


test("copComposition: local maxFanOut refuses excess descendants without mutating parent lineage", () => {
  const parent = asCognitivePacket({
    kind: "parent",
    envelope: { id: "parent-bounded-fanout" },
    emit: false,
  });

  const first = copFork(
    parent,
    { id: "child-bounded-1", payload: { n: 1 } },
    { emit: false, maxFanOut: 1 }
  );

  assert.equal(first.envelope.lineage.upstream_packet_id, "parent-bounded-fanout");
  assert.deepEqual(parent.envelope.lineage.downstream_packet_ids, ["child-bounded-1"]);

  assert.throws(
    () =>
      copFork(
        parent,
        { id: "child-bounded-2", payload: { n: 2 } },
        { emit: false, maxFanOut: 1 }
      ),
    (error) =>
      error?.code === "PACKET_FANOUT_LIMIT_REACHED" &&
      error?.packet_ref === "parent-bounded-fanout" &&
      error?.max_fan_out === 1
  );

  assert.deepEqual(parent.envelope.lineage.downstream_packet_ids, ["child-bounded-1"]);
});

test("copComposition: autonomous descendants are canonically referenced, not embedded in parent", () => {
  const parent = asCognitivePacket({
    kind: "parent",
    envelope: { id: "parent-reference-only" },
    payload: { stable: true },
    emit: false,
  });

  const child = copFork(
    parent,
    { id: "child-reference-only", payload: { large: { nested: "state" } } },
    { emit: false }
  );

  assert.deepEqual(parent.envelope.lineage.downstream_packet_ids, ["child-reference-only"]);
  assert.equal(parent.payload.child, undefined);
  assert.equal(parent.payload.children, undefined);
  assert.equal(parent.payload.downstream_packets, undefined);
  assert.equal(child.envelope.lineage.upstream_packet_id, "parent-reference-only");
});

test("copComposition: copAll aggregates child Yields without copying child packet state into parent", async () => {
  const parent = asCognitivePacket({
    kind: "parent",
    envelope: { id: "parent-aggregate-only" },
    payload: { request: "aggregate results" },
    emit: false,
  });

  const c1 = copFork(parent, { id: "aggregate-child-1" }, { emit: false });
  const c2 = copFork(parent, { id: "aggregate-child-2" }, { emit: false });

  await markPacketSolved(c1, {
    yieldData: { semantic_yield: { value: 2 } },
    emit: false,
  });
  await markPacketSolved(c2, {
    yieldData: { semantic_yield: { value: 3 } },
    emit: false,
  });

  const result = await copAll([c1, c2], {
    combiner: (yields) => ({
      total: yields.reduce((sum, entry) => sum + entry.semantic_yield.value, 0),
    }),
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.combinedYield, { total: 5 });
  assert.deepEqual(parent.envelope.lineage.downstream_packet_ids, [
    "aggregate-child-1",
    "aggregate-child-2",
  ]);
  assert.equal(parent.payload.downstream_packets, undefined);
  assert.equal(parent.payload.children, undefined);
});
