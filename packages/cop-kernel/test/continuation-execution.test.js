import test from "node:test";
import assert from "node:assert/strict";

import { createContinuationDescriptor } from "../src/continuation.js";
import { COPScheduler } from "../src/scheduler.js";
import { COPBus } from "../src/bus.js";
import { InMemoryPacketClaimCoordinator } from "../src/packetCoordination.js";

test("a designated continuation executes as a local Promise without mutating its descriptor", async () => {
  const continuation = createContinuationDescriptor({
    resumeTo: "capability:deterministic-test",
    resumeIntent: "produce-next-step",
    taskId: "task-continuation-execution",
    stepId: "step-1",
    state: { input: "preserved" },
  });
  const original = structuredClone(continuation);
  const readOnlyStore = Object.freeze({ kind: "test-read-only-store" });
  const bus = new COPBus({ name: "continuation-execution-test" });
  const scheduler = new COPScheduler(bus, {
    readOnlyStore,
    handlerResolver: async (resumeTo) => {
      assert.equal(resumeTo, continuation.resumeTo);
      return {
        async execute({ continuation: received, resumeMessage, triggeringEvent, reason, readOnlyStore: store }) {
          assert.deepEqual(received, original);
          assert.equal(resumeMessage.payload.resumedContinuationId, continuation.continuationId);
          assert.deepEqual(triggeringEvent, { type: "input.ready" });
          assert.equal(reason, "event-match");
          assert.equal(store, readOnlyStore);
          return {
            output: { accepted: received.state.input },
            continuations: [
              createContinuationDescriptor({
                resumeTo: "capability:next-step",
                taskId: received.taskId,
                state: { previous: received.continuationId },
              }),
            ],
          };
        },
      };
    },
  });

  const receipt = await scheduler.execute(continuation, {
    triggeringEvent: { type: "input.ready" },
    reason: "event-match",
  });

  assert.deepEqual(continuation, original);
  assert.equal(receipt.execution.handler, continuation.resumeTo);
  assert.deepEqual(receipt.execution.result.output, { accepted: "preserved" });
  assert.equal(receipt.execution.result.continuations.length, 1);
  assert.equal(receipt.execution.result.continuations[0].resumeTo, "capability:next-step");
});

test("missing designated handlers fail observably", async () => {
  const bus = new COPBus({ name: "continuation-execution-failure-test" });
  const observed = [];
  bus.subscribe("cop.continuation.execution_failed", (event) => observed.push(event));
  const scheduler = new COPScheduler(bus, { handlerResolver: async () => null });
  const continuation = createContinuationDescriptor({ resumeTo: "capability:missing" });

  await assert.rejects(() => scheduler.execute(continuation), /no executable handler/);
  assert.equal(observed.length, 1);
  assert.equal(observed[0].data.continuationId, continuation.continuationId);
});


test("MUTATE coordination allows only one scheduler to execute a claimed Packet", async () => {
  const coordinator = new InMemoryPacketClaimCoordinator();
  const continuation = createContinuationDescriptor({
    resumeTo: "capability:mutating-test",
    state: { input: "same-packet" },
  });
  let releaseFirst;
  let firstEntered;
  const firstEnteredPromise = new Promise((resolve) => {
    firstEntered = resolve;
  });
  const firstReleasePromise = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  let executions = 0;

  const handlerResolver = async () => ({
    async execute() {
      executions += 1;
      if (executions === 1) {
        firstEntered();
        await firstReleasePromise;
      }
      return { output: { executions }, continuations: [] };
    },
  });

  const schedulerA = new COPScheduler(new COPBus({ name: "mutation-claim-a" }), {
    handlerResolver,
    packetClaimCoordinator: coordinator,
    coordinationResolver: async () => ({
      mode: "MUTATE",
      packetRef: "packet:scheduler-mutation-test",
      handlerRef: "handler:A",
      ttlMs: 60_000,
    }),
  });
  const schedulerB = new COPScheduler(new COPBus({ name: "mutation-claim-b" }), {
    handlerResolver,
    packetClaimCoordinator: coordinator,
    coordinationResolver: async () => ({
      mode: "MUTATE",
      packetRef: "packet:scheduler-mutation-test",
      handlerRef: "handler:B",
      ttlMs: 60_000,
    }),
  });

  const first = schedulerA.execute(continuation);
  await firstEnteredPromise;

  await assert.rejects(
    () => schedulerB.execute(continuation),
    (error) => error?.code === "PACKET_BUSY"
  );

  releaseFirst();
  const receipt = await first;

  assert.equal(executions, 1);
  assert.equal(receipt.execution.result.output.executions, 1);
  assert.equal(coordinator.inspect("packet:scheduler-mutation-test").active_claim, null);
  assert.equal(coordinator.inspect("packet:scheduler-mutation-test").generation, 2);
});

test("OBSERVE coordination stays concurrent and does not require a PacketClaim", async () => {
  const continuation = createContinuationDescriptor({
    resumeTo: "capability:observe-test",
    state: { input: "read-only" },
  });
  let executions = 0;
  const handlerResolver = async () => ({
    async execute() {
      executions += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { output: { observed: true }, continuations: [] };
    },
  });

  const makeScheduler = (name) =>
    new COPScheduler(new COPBus({ name }), {
      handlerResolver,
      coordinationResolver: async () => ({ mode: "OBSERVE" }),
    });

  await Promise.all([
    makeScheduler("observe-a").execute(continuation),
    makeScheduler("observe-b").execute(continuation),
  ]);

  assert.equal(executions, 2);
});

test("a MUTATE handler completing after lease takeover is fenced as stale", async () => {
  let now = Date.parse("2026-10-18T12:00:00.000Z");
  const coordinator = new InMemoryPacketClaimCoordinator({ now: () => now });
  const continuation = createContinuationDescriptor({
    resumeTo: "capability:stale-mutation-test",
  });

  let releaseA;
  let enteredA;
  const enteredAPromise = new Promise((resolve) => {
    enteredA = resolve;
  });
  const releaseAPromise = new Promise((resolve) => {
    releaseA = resolve;
  });

  const schedulerA = new COPScheduler(new COPBus({ name: "stale-a" }), {
    handlerResolver: async () => ({
      async execute() {
        enteredA();
        await releaseAPromise;
        return { output: { handler: "A" }, continuations: [] };
      },
    }),
    packetClaimCoordinator: coordinator,
    coordinationResolver: async () => ({
      mode: "MUTATE",
      packetRef: "packet:stale-scheduler-test",
      handlerRef: "handler:A",
      ttlMs: 1_000,
    }),
  });

  const schedulerB = new COPScheduler(new COPBus({ name: "stale-b" }), {
    handlerResolver: async () => ({
      async execute() {
        return { output: { handler: "B" }, continuations: [] };
      },
    }),
    packetClaimCoordinator: coordinator,
    coordinationResolver: async () => ({
      mode: "MUTATE",
      packetRef: "packet:stale-scheduler-test",
      handlerRef: "handler:B",
      ttlMs: 1_000,
    }),
  });

  const lateA = schedulerA.execute(continuation);
  await enteredAPromise;

  now += 1_001;
  const b = await schedulerB.execute(continuation);
  assert.equal(b.execution.result.output.handler, "B");

  releaseA();

  await assert.rejects(
    () => lateA,
    (error) => error?.code === "STALE_CLAIM"
  );

  assert.equal(coordinator.inspect("packet:stale-scheduler-test").active_claim, null);
  assert.equal(coordinator.inspect("packet:stale-scheduler-test").generation, 2);
});
