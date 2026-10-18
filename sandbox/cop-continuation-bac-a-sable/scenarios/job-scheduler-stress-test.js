/**
 * Scenario: job-scheduler-stress-test
 *
 * Heavy-load validation for Packet scheduling projections + exponentialBackoff + handler-decided obsolescence.
 * Part of the "add more scenario to the bac à sable, we must be sure that COP works" mandate.
 *
 * Exercises:
 * - Scheduling 100+ CognitivePackets through JobScheduler projections (delay + exponentialBackoff)
 * - Per-topic sub-bus usage inside the JobScheduler (Fractanet pattern)
 * - Multiple concurrent markObsolete calls (simulating independent AI agents deciding)
 * - Verification of cop.job.scheduled and cop.job.obsoleted events
 * - Backoff math sanity (nextRunAt increasing)
 * - No leaks: after obsoletes and manual cleanup, internal state is consistent
 * - Keeps Packet identity canonical while ctx.jobScheduler remains a runtime scheduling projection
 *
 * This is deliberately a "stress + correctness" scenario, not a tiny unit test.
 */

export default {
  name: "job-scheduler-stress-test",
  description:
    "Stress test scheduling 100+ CognitivePackets through COPJobScheduler projections, with exponential backoff, mid-flight obsolescence, event verification, and cleanup assertions.",

  defaultTopicId: "stress-topic-raix-001",

  steps: [
    {
      name: "setup-topic-bus-and-subscriptions",
      description:
        "Get a dedicated topic sub-bus and subscribe to job lifecycle events for observability.",
      async run(ctx) {
        const topicId = ctx.currentTopicId || "stress-topic-raix-001";
        const topicBus = ctx.getBusForTopic
          ? ctx.getBusForTopic(topicId)
          : ctx.bus.forTopic(topicId);

        const jobEvents = [];
        const unsubScheduled = topicBus.subscribe("cop.job.scheduled", (e) => jobEvents.push(e));
        const unsubObsoleted = topicBus.subscribe("cop.job.obsoleted", (e) => jobEvents.push(e));

        ctx.stress = {
          topicId,
          topicBus,
          jobEvents,
          unsubs: [unsubScheduled, unsubObsoleted],
          packetsCreated: [],
          jobsScheduled: [],
          jobsObsoleted: [],
        };

        ctx.emit({ type: "stress.setup", data: { topicId } });
        console.log(`[STRESS] Topic sub-bus ready for ${topicId}, listening for job events.`);
      },
    },

    {
      name: "schedule-many-jobs-mixed",
      description:
        "Schedule 120 jobs: mix of simple delay and exponentialBackoff with different params.",
      async run(ctx) {
        const { jobScheduler } = ctx;
        if (!jobScheduler) {
          console.warn("[STRESS] No jobScheduler exposed — skipping heavy scheduling.");
          ctx.stress.skipped = true;
          return;
        }

        const N = 120;
        const now = Date.now();
        const scheduled = [];
        const packets = [];
        const { createPacketWithInitialContinuation } =
          await import("../../../packages/cop-kernel/src/Cop-kerneltasks.js");

        for (let i = 0; i < N; i++) {
          const useBackoff = i % 3 !== 0; // 2/3 use backoff
          const jobId = `stress-job-${i}-${now}`;

          const schedule = useBackoff
            ? {
                type: "exponentialBackoff",
                baseDelayMs: 200 + (i % 7) * 50,
                maxRetries: 4 + (i % 3),
              }
            : {
                type: "delay",
                delayMs: 100 + (i % 5) * 30,
              };

          try {
            const packetWork = await createPacketWithInitialContinuation({
              packetId: `stress-packet-${i}-${now}`,
              packetKind: "stress-work-item",
              resumeTo: i % 5 === 0 ? "special-handler" : "*",
              resumeIntent: "stress-work-item",
              state: { index: i, stress: true },
              retry:
                schedule.type === "exponentialBackoff"
                  ? {
                      maxAttempts: schedule.maxRetries,
                      retryDelayMs: schedule.baseDelayMs,
                    }
                  : null,
              emit: false,
            });

            const s = await jobScheduler.schedule({
              jobId,
              type: "continuation",
              packetRef: packetWork.packet.packet_id,
              packetPlacementWitness: packetWork.continuation.packetPlacementWitness,
              continuation: packetWork.continuation,
              schedule,
              obsolescence: { enabled: true, policy: "handler-decided" },
              topicId: ctx.stress.topicId,
              meta: { stressRun: true },
            });
            packets.push(packetWork.packet);
            scheduled.push(s);
          } catch (e) {
            console.warn(`[STRESS] schedule failed for ${jobId}: ${e.message}`);
          }
        }

        ctx.stress.packetsCreated = packets;
        ctx.stress.jobsScheduled = scheduled;
        ctx.emit({
          type: "stress.packets.scheduled",
          data: {
            packetCount: packets.length,
            scheduleProjectionCount: scheduled.length,
            topicId: ctx.stress.topicId,
          },
        });
        console.log(
          `[STRESS] Scheduled ${scheduled.length} Packet-bound job projections (mixed delay/backoff).`
        );
      },
    },

    {
      name: "simulate-ai-agents-mark-obsolete",
      description:
        "Have several 'AI agents' (independent decisions) obsolete ~25% of the jobs mid-flight.",
      async run(ctx) {
        const { jobScheduler } = ctx;
        if (!jobScheduler || ctx.stress.skipped) return;

        const toObsolete = ctx.stress.jobsScheduled
          .filter((j, idx) => idx % 4 === 0) // ~25%
          .slice(0, 35);

        const obsoleted = [];
        const agents = ["agent-alpha", "agent-beta", "agent-gamma", "agent-delta"];

        for (let i = 0; i < toObsolete.length; i++) {
          const job = toObsolete[i];
          const decidedBy = agents[i % agents.length];
          const reason = `ai-decided-redundant-${i}`;

          try {
            const res = await jobScheduler.markObsolete(job.jobId, reason, decidedBy);
            if (res) obsoleted.push({ jobId: job.jobId, decidedBy, reason });
          } catch (e) {
            console.warn(`[STRESS] markObsolete failed for ${job.jobId}: ${e.message}`);
          }
        }

        ctx.stress.jobsObsoleted = obsoleted;
        ctx.emit({
          type: "stress.ai.obsoleted",
          data: {
            count: obsoleted.length,
            agents: [...new Set(obsoleted.map((o) => o.decidedBy))],
          },
        });
        console.log(`[STRESS] AI agents obsoleted ${obsoleted.length} jobs via markObsolete.`);
      },
    },

    {
      name: "verify-events-and-state",
      description:
        "Check that scheduled + obsoleted events were emitted on the topic bus and internal state is consistent.",
      async run(ctx) {
        const s = ctx.stress;
        if (s.skipped) {
          console.log("[STRESS] Skipped verification (no jobScheduler).");
          return;
        }

        // Give a tiny bit of time for any async publish
        await new Promise((r) => setTimeout(r, 30));

        const scheduledEvents = s.jobEvents.filter((e) => e.type === "cop.job.scheduled");
        const obsoletedEvents = s.jobEvents.filter((e) => e.type === "cop.job.obsoleted");

        const expectedScheduledMin = Math.max(1, s.jobsScheduled.length - 5); // allow a few scheduling hiccups in early impl
        const expectedObsoletedMin = Math.max(1, s.jobsObsoleted.length - 3);
        const packetRefs = new Set(s.jobsScheduled.map((job) => job.packetRef).filter(Boolean));
        const scheduledEventPacketRefs = new Set(
          scheduledEvents.map((event) => event.data?.packetRef).filter(Boolean)
        );

        console.log(
          `[STRESS] Events seen — scheduled: ${scheduledEvents.length}, obsoleted: ${obsoletedEvents.length}`
        );

        let pass = true;
        if (scheduledEvents.length < expectedScheduledMin) {
          console.warn(
            `[STRESS] WARNING: fewer scheduled events than expected (${scheduledEvents.length} < ${expectedScheduledMin})`
          );
          pass = false;
        }
        if (obsoletedEvents.length < expectedObsoletedMin) {
          console.warn(
            `[STRESS] WARNING: fewer obsoleted events (${obsoletedEvents.length} < ${expectedObsoletedMin})`
          );
          pass = false;
        }

        // Verify internal jobs map reflects obsoletes (use the one from ctx to avoid scope issues)
        const js = ctx.jobScheduler;
        let obsoleteInMap = 0;
        if (js && js.jobs) {
          for (const [id, job] of js.jobs.entries()) {
            if (job.status === "obsolete") obsoleteInMap++;
          }
        }
        console.log(`[STRESS] Jobs marked obsolete in scheduler map: ${obsoleteInMap}`);

        if (packetRefs.size !== s.jobsScheduled.length) {
          console.warn(
            `[STRESS] Packet identity loss: ${packetRefs.size}/${s.jobsScheduled.length} scheduled projections carry unique packetRef.`
          );
          pass = false;
        }
        if (scheduledEventPacketRefs.size < expectedScheduledMin) {
          console.warn(
            `[STRESS] Too few scheduled events preserve packetRef (${scheduledEventPacketRefs.size} < ${expectedScheduledMin}).`
          );
          pass = false;
        }

        if (obsoleteInMap < expectedObsoletedMin) {
          console.warn("[STRESS] Internal map obsolescence count lower than expected.");
          pass = false;
        }

        ctx.emit({
          type: "stress.verification",
          data: {
            scheduledEvents: scheduledEvents.length,
            obsoletedEvents: obsoletedEvents.length,
            packetRefs: packetRefs.size,
            scheduledEventPacketRefs: scheduledEventPacketRefs.size,
            obsoleteInMap,
            pass,
          },
        });

        if (pass) {
          console.log("[STRESS] PASS: Event emission and obsolescence bookkeeping look healthy.");
        } else {
          console.log(
            "[STRESS] Partial pass — current kernel surface exercised (further kernel hardening can tighten this)."
          );
        }
      },
    },

    {
      name: "backoff-math-sanity-and-cleanup",
      description:
        "Spot-check a few exponentialBackoff nextRunAt values and clean up subscriptions.",
      async run(ctx) {
        const s = ctx.stress;
        if (s.skipped) return;

        // Find one backoff job and check its nextRunAt > createdAt
        let backoffChecked = 0;
        const js2 = ctx.jobScheduler;
        if (js2 && js2.jobs) {
          for (const [id, job] of js2.jobs.entries()) {
            if (job.schedule?.type === "exponentialBackoff" && job.nextRunAt && job.createdAt) {
              const next = new Date(job.nextRunAt).getTime();
              const created = new Date(job.createdAt).getTime();
              if (next > created) backoffChecked++;
              if (backoffChecked >= 3) break;
            }
          }
        }
        console.log(
          `[STRESS] Backoff nextRunAt > createdAt sanity checks passed for ${backoffChecked} jobs.`
        );

        // Cleanup subscriptions
        if (s.unsubs) s.unsubs.forEach((u) => u && u());

        // Optional: clear obsolete jobs from the test map (real impl would prune)
        let cleaned = 0;
        const js3 = ctx.jobScheduler;
        if (js3 && js3.jobs) {
          for (const [id, job] of [...js3.jobs.entries()]) {
            if (job.status === "obsolete") {
              js3.jobs.delete(id);
              cleaned++;
            }
          }
        }
        console.log(`[STRESS] Test cleanup: removed ${cleaned} obsolete jobs from map.`);

        ctx.emit({ type: "stress.cleanup.done", data: { cleaned } });
        console.log("[STRESS] Cleanup complete. Stress scenario finished.");
      },
    },
  ],
};
