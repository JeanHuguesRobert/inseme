/**
 * Scenario: task-step-continuation-genericity
 *
 * Validates the Packet-first orchestration helper from Cop-kerneltasks.js
 * together with the scheduler and topic-scoped buses.
 *
 * Goal: ensure applications can start resumable work from CognitivePacket +
 * Continuation directly, without inventing a Task identity first.
 */

export default {
  name: "task-step-continuation-genericity",
  description:
    "Exercises generic CognitivePacket + Continuation orchestration with topic scoping and the scheduler.",

  defaultTopicId: "genericity-test-topic",

  steps: [
    {
      name: "create-packet-with-linked-continuation",
      description:
        "Use the Packet-first helper to create a CognitivePacket + linked Continuation in one call.",
      async run(ctx) {
        const { createPacketWithInitialContinuation } =
          await import("../../../packages/cop-kernel/src/Cop-kerneltasks.js");

        const result = await createPacketWithInitialContinuation({
          packetId: "genericity-packet-001",
          packetKind: "test-genericity",
          resumeTo: "reviewer",
          resumeIntent: "continue-work",
          state: { draft: "initial state for genericity test" },
          waitForEvents: ["genericity.trigger"],
          retry: { maxAttempts: 3, baseDelayMs: 200 },
        });

        ctx.genericity = { packet: result.packet, continuation: result.continuation };

        ctx.emit({
          type: "generic.packet.created",
          data: {
            packetId: result.packet.packet_id,
            continuationId: result.continuation.continuationId,
          },
        });

        console.log(
          `[GENERICITY-TEST] Created Packet ${result.packet.packet_id} with linked Continuation via kernel helper.`
        );
      },
    },

    {
      name: "register-with-scheduler-on-topic-bus",
      description: "Register the continuation using the topic-aware scheduler.",
      async run(ctx) {
        const { continuation } = ctx.genericity;
        const topicBus = ctx.busForCurrentTopic();

        // Using bac-à-sable isolated factory for auto post-run reset (debt/ OOM hygiene).
        const scheduler = ctx.createIsolatedScheduler(topicBus);
        scheduler.start();

        scheduler.register(continuation);

        ctx.genericity.scheduler = scheduler;

        console.log("[GENERICITY-TEST] Continuation registered on topic-scoped scheduler.");
      },
    },

    {
      name: "trigger-resumption",
      description: "Publish the waiting event on the topic bus and observe resumption.",
      async run(ctx) {
        const { scheduler } = ctx.genericity;
        const topicBus = ctx.busForCurrentTopic();

        await topicBus.publish({
          type: "genericity.trigger",
          data: { note: "resuming generic packet" },
        });

        // Give the scheduler a moment
        await new Promise((r) => setTimeout(r, 50));

        const stillPending = scheduler.getPendingContinuations().length;

        if (stillPending === 0) {
          console.log(
            "[GENERICITY-TEST] PASS: Continuation was resumed after event on the same topic bus."
          );
        } else {
          console.log(`[GENERICITY-TEST] Still ${stillPending} continuation(s) pending.`);
        }

        // Clean up the per-test scheduler to avoid leaving timers/pending (debt mitigation).
        if (scheduler && typeof scheduler.resetForTest === "function") {
          scheduler.resetForTest();
        } else if (scheduler && typeof scheduler.stop === "function") {
          scheduler.stop();
        }
      },
    },
  ],
};
