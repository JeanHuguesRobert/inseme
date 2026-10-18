import test from "node:test";
import assert from "node:assert/strict";

import { COPJobScheduler } from "../src/jobScheduler.js";

test("COPJobScheduler preserves Packet identity while jobId remains scheduling-only", async () => {
  const registered = [];
  const published = [];

  const scheduler = {
    register(continuation) {
      registered.push(continuation);
    },
    getBusForTopic() {
      return {
        async publish(event) {
          published.push(event);
        },
      };
    },
  };

  const jobScheduler = new COPJobScheduler({ scheduler });

  const placementWitness = [
    {
      store_id: "sqlite:node-a",
      store_kind: "sqlite",
      locator: "sqlite:node-a#packet-job-001",
      is_primary: true,
    },
  ];

  const scheduled = await jobScheduler.schedule({
    jobId: "job-runtime-001",
    type: "continuation",
    topicId: "topic-job-001",
    continuation: {
      continuationId: "continuation-job-001",
      resumeTo: "handler:resume",
      packetRef: "packet-job-001",
      packetPlacementWitness: placementWitness,
    },
    schedule: {
      type: "delay",
      delayMs: 10,
    },
  });

  assert.equal(scheduled.jobId, "job-runtime-001");
  assert.equal(scheduled.packetRef, "packet-job-001");
  assert.notEqual(scheduled.jobId, scheduled.packetRef);

  assert.equal(registered.length, 1);
  assert.equal(registered[0].packetRef, "packet-job-001");
  assert.deepEqual(registered[0].packetPlacementWitness, placementWitness);
  assert.equal(registered[0].meta.jobId, "job-runtime-001");
  assert.equal(registered[0].meta.packetRef, "packet-job-001");

  assert.equal(published.length, 1);
  assert.equal(published[0].type, "cop.job.scheduled");
  assert.equal(published[0].data.jobId, "job-runtime-001");
  assert.equal(published[0].data.packetRef, "packet-job-001");
  assert.equal(published[0].data.packet.packet_id, "packet-job-001");
  assert.equal(published[0].data.packet.payload.packetRef, "packet-job-001");
});

test("COPJobScheduler remains backward compatible when no Packet reference exists", async () => {
  const registered = [];
  const scheduler = {
    register(continuation) {
      registered.push(continuation);
    },
  };

  const jobScheduler = new COPJobScheduler({ scheduler });
  const scheduled = await jobScheduler.schedule({
    jobId: "legacy-job-001",
    resumeTo: "handler:legacy",
    schedule: { type: "once" },
  });

  assert.equal(scheduled.jobId, "legacy-job-001");
  assert.equal(scheduled.packetRef, null);
  assert.equal(registered[0].packetRef, undefined);
});
