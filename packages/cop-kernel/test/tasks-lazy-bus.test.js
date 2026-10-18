import assert from "node:assert/strict";
import test from "node:test";

import { defaultBus } from "../src/bus.js";
import {
  asCognitivePacket,
  createPacketWithInitialContinuation,
  createTaskWithInitialContinuation,
} from "../src/Cop-kerneltasks.js";

async function nextTurn() {
  await new Promise((resolve) => setImmediate(resolve));
}

test("asCognitivePacket publishes through an explicitly supplied bus", async () => {
  const published = [];
  const bus = {
    async publish(event) {
      published.push(event);
    },
  };

  const packet = asCognitivePacket({
    kind: "continuation",
    envelope: { id: "packet-explicit-bus" },
    payload: { continuationId: "continuation-explicit-bus" },
    bus,
  });

  await nextTurn();

  assert.equal(published.length, 1);
  assert.equal(published[0].type, "cop.packet.created");
  assert.equal(published[0].data.packet, packet);
});

test("asCognitivePacket delivers concurrent fallback emissions after lazy bus loading", async () => {
  const ids = new Set(["packet-lazy-bus-a", "packet-lazy-bus-b"]);
  const received = [];
  const unsubscribe = defaultBus.subscribe("cop.packet.created", (event) => {
    if (ids.has(event.data?.packet?.envelope?.id)) received.push(event);
  });

  try {
    asCognitivePacket({
      kind: "continuation",
      envelope: { id: "packet-lazy-bus-a" },
      payload: { continuationId: "continuation-lazy-bus-a" },
    });
    asCognitivePacket({
      kind: "continuation",
      envelope: { id: "packet-lazy-bus-b" },
      payload: { continuationId: "continuation-lazy-bus-b" },
    });

    for (let attempt = 0; attempt < 20 && received.length < 2; attempt += 1) {
      await nextTurn();
    }

    assert.equal(received.length, 2);
    assert.deepEqual(new Set(received.map((event) => event.data.packet.envelope.id)), ids);
  } finally {
    unsubscribe();
  }
});


test("asCognitivePacket binds a continuation to packet identity and placement without mutating the source", () => {
  const continuation = {
    continuationId: "continuation-packet-bound",
    resumeTo: "magistral:capability-resolution",
    state: { input: "preserve" },
  };
  const original = structuredClone(continuation);
  const placements = [
    {
      store_id: "sqlite:node-a",
      store_kind: "sqlite",
      locator: "sqlite:node-a#packet-bound",
      is_primary: true,
    },
  ];

  const packet = asCognitivePacket({
    kind: "continuation",
    envelope: {
      id: "packet-bound",
      placements,
    },
    payload: continuation,
    emit: false,
  });

  assert.deepEqual(continuation, original);
  assert.equal(packet.packet_id, "packet-bound");
  assert.deepEqual(packet.placements, placements);
  assert.equal(packet.payload.packetRef, "packet-bound");
  assert.deepEqual(packet.payload.packetPlacementWitness, placements);

  packet.payload.packetPlacementWitness[0].store_id = "mutated-copy";
  assert.equal(placements[0].store_id, "sqlite:node-a");
});


test("createPacketWithInitialContinuation makes Packet identity primary", async () => {
  const placements = [
    {
      store_id: "sqlite:packet-first",
      store_kind: "sqlite",
      locator: "sqlite:packet-first#packet-first-001",
      is_primary: true,
    },
  ];

  const result = await createPacketWithInitialContinuation({
    packetId: "packet-first-001",
    packetKind: "research-work",
    placements,
    resumeTo: "handler:research",
    resumeIntent: "continue-research",
    state: { question: "bounded" },
    retry: { attempt: 1, maxAttempts: 3, retryDelayMs: 1000 },
    emit: false,
  });

  assert.equal(result.packet.packet_id, "packet-first-001");
  assert.equal(result.packet.envelope.id, "packet-first-001");
  assert.equal(result.continuation.packetRef, "packet-first-001");
  assert.deepEqual(result.continuation.packetPlacementWitness, placements);
  assert.equal(result.packet.payload.packetRef, "packet-first-001");
  assert.equal(result.scheduleHint.packetRef, "packet-first-001");
  assert.equal(result.scheduleHint.jobId, "packet-packet-first-001");
  assert.notEqual(result.scheduleHint.jobId, result.packet.packet_id);
});

test("createTaskWithInitialContinuation is a compatibility projection around Packet-first orchestration", async () => {
  const result = await createTaskWithInitialContinuation({
    taskType: "compatibility-task",
    workerHandlerName: "handler:compatibility",
    packetId: "packet-compatibility-001",
    resumeTo: "handler:resume",
    resumeIntent: "resume-compatible-work",
    state: { value: 42 },
    emit: false,
  });

  assert.equal(result.packet.packet_id, "packet-compatibility-001");
  assert.equal(result.continuation.packetRef, "packet-compatibility-001");
  assert.equal(result.continuation.taskId, result.task.id);
  assert.equal(result.task.metadata.packet_ref, "packet-compatibility-001");
  assert.equal(result.task.metadata.projection_of, "cognitive-packet");
  assert.equal(result.scheduleHint.packetRef, "packet-compatibility-001");
  assert.equal(result.scheduleHint.taskId, result.task.id);
  assert.equal(result.scheduleHint.jobId, "task-" + result.task.id);

  assert.notEqual(result.task.id, result.packet.packet_id);
  assert.notEqual(result.scheduleHint.jobId, result.packet.packet_id);
});
