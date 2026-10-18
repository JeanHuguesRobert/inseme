/**
 * Scénario : research-review
 *
 * Exemple classique de workflow asynchrone avec continuation COP.
 * Inspiré des pipelines Cogentia : étapes nommées, production de traces structurées.
 *
 * Flux :
 * 1. Researcher produit une première analyse
 * 2. Il "suspend" en créant une continuation en attendant une critique
 * 3. Un Reviewer (simulé) reprend la continuation et ajoute sa critique
 * 4. Le flux se termine avec une synthèse
 */

/**
 * Scénario research-review
 *
 * Objectif : tester la convergence sémantique entre COP (continuations) et les patterns Cogentia.
 * On essaie d'utiliser le plus possible de vrai code de cop-kernel.
 */

export default {
  name: "research-review",
  description:
    "Test de suspension et reprise via continuation COP (avec vrai code cop-kernel quand possible).",

  steps: [
    {
      name: "research-initial",
      description:
        "L'agent Researcher crée un CognitivePacket + Continuation liée via le helper Packet-first du kernel.",
      async run(ctx) {
        ctx.emit({
          type: "agent.thought",
          data: { agent: "researcher", thought: "J'ai une première version de l'analyse." },
        });

        try {
          const { createPacketWithInitialContinuation } =
            await import("../../../packages/cop-kernel/src/Cop-kerneltasks.js");

          const { packet, continuation } = await createPacketWithInitialContinuation({
            packetId: "research-review-001",
            packetKind: "research-review",
            resumeTo: "reviewer",
            resumeIntent: "provide-critique",
            state: {
              draft: "Version initiale de l'analyse sur la souveraineté cognitive.",
              confidence: 0.7,
            },
            rootCorrelationId: "research-001",
          });

          ctx.currentPacket = packet;
          ctx.currentContinuation = continuation;

          console.log(
            `[SCENARIO] Packet+Continuation created via kernel: packet=${packet.packet_id}`
          );
        } catch (e) {
          console.warn(
            "[SCENARIO] Packet-first helper failed, using fallback continuation:",
            e.message
          );
          // Fallback keeps the scenario runnable while the kernel matures
          ctx.currentContinuation = {
            continuationId: "cont-fallback-" + Date.now(),
            resumeTo: "reviewer",
            resumeIntent: "provide-critique",
          };
          ctx.suspend(ctx.currentContinuation);
        }
      },
    },

    {
      name: "review-critique",
      description: "Reprise de la continuation (idéalement via vrai cop-kernel).",
      async run(ctx) {
        if (!ctx.currentContinuation) {
          throw new Error("Aucune continuation active");
        }

        try {
          await ctx.resumeContinuation({
            continuation: ctx.currentContinuation,
            payload: {
              critique:
                "Le point sur la traçabilité est faible. Ajouter des événements explicites.",
              score: 6,
            },
          });
        } catch (e) {
          console.warn("[SCENARIO] Reprise réelle échouée, fallback local");
          ctx.resume(ctx.currentContinuation.id || ctx.currentContinuation.continuationId, {
            critique: "Le point sur la traçabilité est faible.",
            score: 6,
          });
        }

        ctx.emit({
          type: "agent.critique",
          data: { agent: "reviewer" },
        });
      },
    },

    {
      name: "final-synthesis",
      description: "Synthèse finale (convergence Cogentia + COP).",
      async run(ctx) {
        ctx.emit({
          type: "workflow.completed",
          data: {
            result: "Version finale produite via orchestration asynchrone COP + patterns Cogentia.",
          },
        });
      },
    },

    // === New: Exercise the higher-level COPJobScheduler (post-interruption work) ===
    {
      name: "schedule-review-followup-job",
      description:
        "Use COPJobScheduler + per-topic sub-bus (Fractanet pattern). Demonstrates generalized sub-bus + subscribe scheme.",
      async run(ctx) {
        const topicId = "research-topic-001";

        // Get a per-topic sub-bus (generalized scoping)
        const topicBus = ctx.getBusForTopic
          ? ctx.getBusForTopic(topicId)
          : ctx.bus.forTopic(topicId);

        // Demonstrate the improved subscribe scheme on the sub-bus
        const unsub = topicBus.subscribe("cop.task.orchestrated", (event) => {
          console.log(`[SUB-BUS DEMO] Received on topic sub-bus: ${event.type}`);
        });

        if (!ctx.jobScheduler) {
          console.warn("[SCENARIO] No jobScheduler — skipping");
          return;
        }

        const scheduled = await ctx.jobScheduler.schedule({
          jobId: `review-followup-${Date.now()}`,
          type: "continuation",
          schedule: {
            type: "exponentialBackoff",
            baseDelayMs: 500,
            maxRetries: 3,
          },
          obsolescence: {
            enabled: true,
            policy: "agent-decided",
          },
          resumeTo: "reviewer",
          resumeIntent: "followup-review",
          payload: {
            originalCorrelationId: "research-001",
            topicId,
            note: "Scheduled via COPJobScheduler on per-topic sub-bus",
          },
        });

        ctx.emit({
          type: "job.scheduled",
          data: {
            jobId: scheduled.jobId,
            nextRunAt: scheduled.nextRunAt,
            scheduleType: "exponentialBackoff",
            topicId,
          },
        });

        console.log(`[SCENARIO] Job scheduled on per-topic sub-bus: ${scheduled.jobId}`);

        // Clean up subscription (good practice)
        if (unsub) unsub();
      },
    },
  ],
};
