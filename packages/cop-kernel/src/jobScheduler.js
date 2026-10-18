/**
 * jobScheduler.js
 *
 * Higher-level scheduling projection for COP, inspired by cron (Unix) / Task Scheduler (Windows).
 *
 * CognitivePacket is the canonical work identity. A Job is only a runtime scheduling view over a
 * Packet and/or Continuation; jobId MUST NOT become routing, locality, claim, or effect authority.
 *
 * Lineage:
 * - Draws from l8's Task/Step scheduler (cooperating steps, resumption, synchronization).
 * - Designed to be implementable efficiently in Inox (concatenative actors with control/data separation).
 *
 * Purpose:
 * - Provide reliable, persistent scheduling of Packet-bound continuations and compatibility jobs.
 * - Native support for exponential backoff on retries.
 * - First-class support for obsolescence (decided by handlers, especially AI handlers).
 * - Survives restarts when backed by persistent storage.
 *
 * This sits on top of COPScheduler (low-level event/time reactor) and the Store.
 * It bridges the low-level Continuation primitives to higher-level "jobs" that applications
 * (starting with apps/platform) and briques will use for long-running, resumable work.
 *
 * This is still early / operational prototype — feedback welcome.
 *
 * See COP Architecture.md §2.4 (Task), §2.5 (Step), §2.7 (Continuation), §5.5 (Execution Semantics).
 */

import { asCognitivePacket } from "./Cop-kerneltasks.js";

export class COPJobScheduler {
  constructor({ scheduler, store, bus, capabilityRegistry, routingPolicy } = {}) {
    this.scheduler = scheduler;
    this.store = store;
    this.bus = bus;
    this.capabilityRegistry = capabilityRegistry || null;
    this.routingPolicy = routingPolicy || null; // optional cogentiaRoutePacket-like function for deeper policy integration
    this.jobs = new Map(); // jobId -> job definition
    this._policyUnsubs = []; // for hybrid bus listeners (e.g. cop.packet.routed)
  }

  /**
   * Schedule a continuation (or generic job) with rich scheduling options.
   *
   * @param {Object} job
   * @param {string} job.jobId
   * @param {string} [job.type = 'continuation']
   * @param {Object} [job.continuation] - the continuation descriptor
   * @param {string} [job.packetRef] - canonical CognitivePacket identity, when known
   * @param {Array<Object>} [job.packetPlacementWitness] - bounded placement witness for the Packet
   * @param {Object} [job.schedule]
   * @param {string} [job.schedule.type] - 'once' | 'delay' | 'cron' | 'exponentialBackoff'
   * @param {number} [job.schedule.delayMs]
   * @param {number} [job.schedule.baseDelayMs] - for exponential backoff
   * @param {number} [job.schedule.maxRetries]
   * @param {string} [job.schedule.cron] - future: cron expression
   * @param {Object} [job.obsolescence]
   * @param {boolean} [job.obsolescence.enabled = false]
   * @param {string} [job.obsolescence.policy = 'handler-decided'] - 'handler-decided' | 'maxAge' | ...
   * Hybrid note: pass capabilityRegistry so JobScheduler can participate in policy
   * (e.g. requiredCapability checks) while the primary Cogentia router policy lives
   * as a higher handler on the bus (see cogentiaRouter.js).
   */
  async schedule(job) {
    if (!job.jobId) throw new Error("jobId is required");

    const now = new Date().toISOString();

    const cont = job.continuation || {};
    const packetRef =
      job.packetRef ||
      cont.packetRef ||
      job.packet?.packet_id ||
      job.packet?.envelope?.id ||
      null;
    const packetPlacementWitness =
      job.packetPlacementWitness ||
      cont.packetPlacementWitness ||
      job.packet?.placements ||
      job.packet?.envelope?.placements ||
      null;

    const scheduledJob = {
      ...job,
      packetRef,
      packetPlacementWitness,
      status: "scheduled",
      createdAt: now,
      nextRunAt: this._computeNextRun(job, now),
    };

    // Hybrid policy integration: if the job/continuation declares a requiredCapability,
    // the JobScheduler can consult the (shared) capabilityRegistry for validation or
    // to record the satisfaction. This complements the higher-level Cogentia router
    // handler on the bus (which does the primary envelope-based routing decision).
    const reqCap =
      job.requiredCapability ||
      cont.requiredCapability ||
      (cont.envelope && cont.envelope.requiredCapability);
    if (
      reqCap &&
      this.capabilityRegistry &&
      typeof this.capabilityRegistry.canSatisfy === "function"
    ) {
      const satisfied = this.capabilityRegistry.canSatisfy(reqCap);
      scheduledJob.capabilitySatisfied = satisfied;
      if (!satisfied) {
        console.warn(
          `[COPJobScheduler] Capability '${reqCap}' not satisfied by registry for job ${job.jobId}`
        );
      }
    }

    // Deeper hybrid: if a routingPolicy (e.g. the cogentiaRoutePacket helper) is wired,
    // consult it to get a full decision based on envelope. This allows the policy layer
    // (higher handler style) to influence scheduling decisions directly inside JobScheduler.
    if (this.routingPolicy && typeof this.routingPolicy === "function") {
      const pktForPolicy = {
        packet_id: packetRef || undefined,
        placements: packetPlacementWitness || undefined,
        packetKind: packetRef ? "continuation" : "job",
        envelope: {
          id: packetRef || undefined,
          packetKind: packetRef ? "continuation" : "job",
          requiredCapability: reqCap,
          placements: packetPlacementWitness || undefined,
          ...(job.envelope || cont.envelope || {}),
        },
        payload: cont || job,
      };
      try {
        const decision = await this.routingPolicy(pktForPolicy, {
          registry: this.capabilityRegistry,
          // no forwardToBus here; pure decision mode
        });
        scheduledJob.routingDecision = decision;
        if (decision && decision.chosenCapability) {
          scheduledJob.chosenCapability = decision.chosenCapability;
        }
      } catch (e) {
        console.warn(`[COPJobScheduler] routingPolicy failed for job ${job.jobId}:`, e.message);
      }
    }

    this.jobs.set(job.jobId, scheduledJob);

    // Determine topic context for per-topic sub-bus (Fractanet generalization)
    const topicId =
      job.topicId ||
      (job.continuation && (job.continuation.topicId || job.continuation.meta?.topicId)) ||
      job.meta?.topicId;

    // Use scheduler's topic-aware bus when possible (preferred for genericity)
    let effectiveBus = this.bus;
    if (this.scheduler && typeof this.scheduler.getBusForTopic === "function" && topicId) {
      effectiveBus = this.scheduler.getBusForTopic(topicId);
    } else if (this.bus && typeof this.bus.forTopic === "function" && topicId) {
      effectiveBus = this.bus.forTopic(topicId);
    }

    // If there's a nextRunAt, register with the low-level scheduler using resumeAfter
    if (scheduledJob.nextRunAt && this.scheduler) {
      const continuationLike = {
        continuationId: `job-${job.jobId}`,
        resumeTo: job.resumeTo || "*",
        topicId: topicId || undefined,
        packetRef: packetRef || undefined,
        packetPlacementWitness: packetPlacementWitness
          ? structuredClone(packetPlacementWitness)
          : undefined,
        conditions: {
          resumeAfter: scheduledJob.nextRunAt,
        },
        retry:
          job.schedule?.type === "exponentialBackoff"
            ? {
                maxAttempts: job.schedule.maxRetries || 5,
                attempt: 0,
                retryDelayMs: job.schedule.baseDelayMs || 1000,
              }
            : undefined,
        meta: { jobId: job.jobId, type: "scheduled-job", topicId, packetRef },
      };

      this.scheduler.register(continuationLike);
    }

    // Emit observable event on the (possibly topic-scoped) bus
    if (effectiveBus) {
      const packetProjection = cont
        ? asCognitivePacket({
            envelope: {
              id: packetRef || undefined,
              packetKind: packetRef ? "continuation" : "job",
              requiredCapability: reqCap,
              placements: packetPlacementWitness || undefined,
              ...(job.envelope || cont.envelope || {}),
            },
            payload: cont,
            kind: packetRef ? "continuation" : "job",
          })
        : null;

      await effectiveBus.publish({
        type: "cop.job.scheduled",
        source: "cop-job-scheduler",
        data: {
          jobId: job.jobId,
          packetRef,
          nextRunAt: scheduledJob.nextRunAt,
          topicId: topicId || null,
          packet: packetProjection,
        },
      });
    }

    return scheduledJob;
  }

  /**
   * Mark a scheduled job / continuation as obsolete.
   * This is the "clause d'obsolescence" — typically decided by an AI handler.
   */
  async markObsolete(jobId, reason, decidedBy = "ai-handler") {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    job.status = "obsolete";
    job.obsolescence = {
      reason,
      decidedBy,
      decidedAt: new Date().toISOString(),
    };

    if (this.scheduler) {
      // Try to cancel any pending registration
      // (in real impl we would remove from pending + cancel timeout)
    }

    // Compute topic-aware bus for the obsoleted event (Fractanet / per-topic scoping consistency with schedule())
    let effectiveBus = this.bus;
    const topicId =
      job?.topicId ||
      (job?.continuation && (job.continuation.topicId || job.continuation.meta?.topicId)) ||
      job?.meta?.topicId;

    if (this.scheduler && typeof this.scheduler.getBusForTopic === "function" && topicId) {
      effectiveBus = this.scheduler.getBusForTopic(topicId);
    } else if (this.bus && typeof this.bus.forTopic === "function" && topicId) {
      effectiveBus = this.bus.forTopic(topicId);
    }

    if (effectiveBus) {
      const packetProjection =
        job && (job.continuation || job)
          ? asCognitivePacket({
              envelope: {
                id: job.packetRef || undefined,
                packetKind: job.packetRef ? "continuation" : "job",
                placements: job.packetPlacementWitness || undefined,
                ...(job.envelope || {}),
              },
              payload: job.continuation || job,
              kind: job.packetRef ? "continuation" : "job",
            })
          : null;

      await effectiveBus.publish({
        type: "cop.job.obsoleted",
        source: "cop-job-scheduler",
        data: {
          jobId,
          packetRef: job.packetRef || null,
          reason,
          decidedBy,
          topicId: topicId || null,
          packet: packetProjection,
        },
      });
    }

    return job;
  }

  _computeNextRun(job, nowIso) {
    const schedule = job.schedule || {};
    const now = new Date(nowIso);

    if (schedule.type === "delay" || schedule.type === "exponentialBackoff") {
      const base = schedule.baseDelayMs || schedule.delayMs || 1000;
      const attempt = job.attempt || 0;
      const delay = schedule.type === "exponentialBackoff" ? base * Math.pow(2, attempt) : base;

      return new Date(now.getTime() + delay).toISOString();
    }

    if (schedule.resumeAfter) {
      return schedule.resumeAfter;
    }

    // Default: immediate
    return nowIso;
  }

  // Future: support cron expressions, recurring jobs, etc.

  /**
   * Wire a routing policy (e.g. the reusable cogentiaRoutePacket helper) for deeper
   * hybrid integration. The policy can be consulted during schedule() to decide
   * or validate capabilities based on envelope (still without touching payload).
   */
  setRoutingPolicy(policyFn) {
    this.routingPolicy = policyFn;
  }

  /**
   * Hybrid integration point: listen on a (topic/federated) bus for cop.packet.routed
   * events published by a higher-level Cogentia router handler (see cogentiaRouter.js).
   * When seen, auto-schedule the continuation payload from the packet.
   * This is a small example of the hybrid: policy decision lives on the bus (handler + registry),
   * operational scheduler reacts to the published decision and schedules.
   */
  listenForRoutedPackets(bus) {
    if (!bus || typeof bus.subscribe !== "function") return;
    const unsub = bus.subscribe("cop.packet.routed", async (evt) => {
      try {
        const pkt = evt.data && evt.data.packet;
        if (pkt && pkt.payload && pkt.payload.continuationId) {
          console.log(
            "[COPJobScheduler] Hybrid: reacting to cop.packet.routed (from bus handler policy), auto-scheduling continuation"
          );
          await this.schedule({
            jobId: "hybrid-from-routed-" + pkt.payload.continuationId,
            type: "continuation",
            packetRef: pkt.packet_id || pkt.envelope?.id || pkt.payload.packetRef || null,
            packetPlacementWitness:
              pkt.placements || pkt.envelope?.placements || pkt.payload.packetPlacementWitness || null,
            continuation: pkt.payload,
            routingDecision: evt.data.routingDecision || null,
            topicId: pkt.envelope && pkt.envelope.topicId,
          });
        }
      } catch (e) {
        console.warn(
          "[COPJobScheduler] Error handling cop.packet.routed in hybrid listener:",
          e.message
        );
      }
    });
    this._policyUnsubs.push(unsub);
  }

  /**
   * Reset for tests / bac-à-sable. Clears scheduled jobs map.
   * (Timing/pending work lives in the underlying scheduler, which should be reset separately.)
   */
  resetForTest() {
    this.jobs.clear();
    // cleanup hybrid listeners
    for (const unsub of this._policyUnsubs) {
      try {
        unsub && unsub();
      } catch (e) {}
    }
    this._policyUnsubs = [];
    console.log("[COPJobScheduler] Reset for test (jobs cleared)");
  }
}
