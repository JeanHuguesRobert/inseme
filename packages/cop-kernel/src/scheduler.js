/**
 * scheduler.js
 *
 * Minimal COPScheduler implementation.
 *
 * Strictly derived from spec sections 5.2, 5.5 and 5.6.
 *
 * Key normative points implemented:
 * - Scheduler watches for events and time to decide on resumption (§5.5.2)
 * - When resuming, it "invokes the designated handler" (in this implementation: publishes a resumption message that a handler would listen to)
 * - Scheduler does NOT directly mutate the Store (it only publishes events)
 * - Original Continuation is not mutated; new state is expressed via new Events/Artifacts
 * - Failure must be observable
 *
 * This implementation is intentionally minimal so that exercising it in the
 * bac-à-sable can reveal ambiguities or missing details in the spec.
 */

import { defaultBus as bus } from "./bus.js";
import { executeContinuation } from "./continuation.js";

export class COPScheduler {
  constructor(busInstance = bus, options = {}) {
    this.bus = busInstance;
    this.handlerResolver = options.handlerResolver || null;
    this.readOnlyStore = options.readOnlyStore || null;
    this.pending = new Map(); // continuationId -> { continuation, registeredAt, timeoutId? }
    this.topicBuses = new Map(); // topicId -> SubBus (per-topic isolation for Fractanet)
    this.unsubscribe = null;
    this.globalTimer = null; // fallback for legacy cases without resumeAfter
  }

  /**
   * Get (or create) a per-Topic sub-bus.
   * This is the key for Fractanet-style scoping: each Topic gets its own
   * isolated event space while still being able to federate upward.
   */
  getBusForTopic(topicId) {
    if (!topicId) return this.bus;
    if (!this.topicBuses.has(topicId)) {
      const sub = this.bus.forTopic(topicId);
      this.topicBuses.set(topicId, sub);
    }
    return this.topicBuses.get(topicId);
  }

  start() {
    if (this.unsubscribe) return;

    // The Scheduler reacts to all events to check waitForEvents conditions (§5.5.2)
    this.unsubscribe = this.bus.subscribeAll((event) => this._onEvent(event));

    // Lightweight global fallback timer (every 5s) for any continuations without precise resumeAfter
    this.globalTimer = setInterval(() => this._evaluateTimeBased(), 5000);

    console.log(
      "[COPScheduler] Started (following spec §5.5) – async time-based scheduling enabled"
    );
  }

  stop() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.globalTimer) {
      clearInterval(this.globalTimer);
      this.globalTimer = null;
    }

    // Clear any per-continuation timeouts
    for (const entry of this.pending.values()) {
      if (entry.timeoutId) clearTimeout(entry.timeoutId);
    }
    this.pending.clear();
    console.log("[COPScheduler] Stopped");
  }

  /**
   * Full reset for tests / bac-à-sable scenarios.
   * Stops timers + subscriptions, clears all pending work and per-topic buses.
   * Prevents accumulation of setInterval / setTimeout / listener leaks when
   * many scenarios or schedulers are created in the same process (the main
   * source of OOM in heavy router + federation runs).
   */
  resetForTest() {
    this.stop();

    // Drop pending continuations (their timeoutIds already cleared above)
    this.pending.clear();

    // Clean per-topic SubBuses (they may hold registrations on the underlying bus)
    for (const sub of this.topicBuses.values()) {
      if (sub && typeof sub.clear === "function") {
        try {
          sub.clear();
        } catch (e) {}
      }
    }
    this.topicBuses.clear();

    console.log("[COPScheduler] Reset for test (timers, pending, topic buses cleared)");
  }

  /**
   * Configure the optional execution boundary.  Without a resolver the
   * scheduler remains a wake-up/publish-only component, as in earlier
   * profiles.  With one, it executes the designated Step through the handler
   * supplied by the host (for example Magistral).
   */
  setExecutionContext({ handlerResolver = null, readOnlyStore = null } = {}) {
    this.handlerResolver = handlerResolver;
    this.readOnlyStore = readOnlyStore;
    return this;
  }

  /** Execute a designated continuation immediately and return its local Promise receipt. */
  async execute(continuation, { triggeringEvent = null, reason = "manual", payload = {} } = {}) {
    return this._performResumption(continuation, triggeringEvent, reason, payload);
  }

  /**
   * Register a continuation that is now waiting for resumption conditions.
   * If the continuation has a resumeAfter (from exponential backoff or explicit delay),
   * we schedule a precise async setTimeout instead of relying on polling.
   */
  register(continuation) {
    if (!continuation?.continuationId) throw new Error("Valid continuation required");

    const entry = {
      continuation,
      registeredAt: Date.now(),
    };

    // Truly asynchronous delayed scheduling using per-continuation timeout
    const resumeAfter = continuation.conditions?.resumeAfter;
    if (resumeAfter) {
      const targetTime = new Date(resumeAfter).getTime();
      const delay = Math.max(0, targetTime - Date.now());

      entry.timeoutId = setTimeout(() => {
        this._evaluateTimeBased(); // will pick it up and resume
      }, delay);
    }

    this.pending.set(continuation.continuationId, entry);

    // Determine the best bus: prefer per-Topic sub-bus when we have topic context
    const topicId = continuation.topicId || continuation.meta?.topicId || continuation.taskId; // fallback heuristic

    const effectiveBus = topicId ? this.getBusForTopic(topicId) : this.bus;

    // Emit an observable event so the fact that work is suspended is traceable
    // (published on the topic-scoped bus when possible → natural isolation)
    effectiveBus.publish({
      type: "cop.continuation.registered",
      source: "cop-scheduler",
      data: {
        continuationId: continuation.continuationId,
        resumeTo: continuation.resumeTo,
        resumeAfter: resumeAfter || null,
        topicId: topicId || null,
      },
    });
  }

  // === Internal logic ===

  async _onEvent(event) {
    for (const [id, entry] of this.pending) {
      const cont = entry.continuation;
      const waitList = cont.conditions?.waitForEvents || [];

      const contId = cont.continuationId || cont.continuation_id;
      const isReturnedResult =
        (event?.type === "cop.event/v1" || event?.event_type === "cop.event/v1") &&
        event.payload?.profile === "cop.continuation-result/v1" &&
        event.payload?.phase === "returned" &&
        (event.payload?.continuation_id === contId ||
          event.subject_ref === `continuation:${contId}`);

      if (waitList.includes(event?.type) || isReturnedResult) {
        const reason = isReturnedResult ? "external_result_returned" : "event-match";
        const payload = isReturnedResult
          ? {
              candidateResult: event.payload?.candidate_result,
              yield: event.payload?.candidate_result?.result,
              provenance: event.payload?.provenance,
              observationKey: event.payload?.observation_key,
            }
          : {};
        // Matching event arrived → resume
        await this._performResumption(cont, event, reason, payload);
        this.pending.delete(id);
      }
    }
  }

  async _evaluateTimeBased() {
    const now = Date.now();

    for (const [id, entry] of this.pending) {
      const cont = entry.continuation;
      const cond = cont.conditions || {};

      let reason = null;

      if (cond.resumeAfter) {
        if (now >= new Date(cond.resumeAfter).getTime()) reason = "resumeAfter";
      }
      if (cond.resumeBefore && now > new Date(cond.resumeBefore).getTime()) {
        reason = "expired (resumeBefore)";
      }

      if (reason) {
        await this._performResumption(cont, null, reason);

        const entry = this.pending.get(id);
        if (entry?.timeoutId) clearTimeout(entry.timeoutId);

        this.pending.delete(id);
      }
    }
  }

  async _performResumption(continuation, triggeringEvent, reason, payload = {}) {
    // According to spec §5.5.3, the Scheduler "invokes the designated handler"
    // In this minimal implementation we publish a well-formed resumption message.
    // A real handler runtime would subscribe to this and execute.

    let finalContinuation = continuation;
    let resumeReason = reason;

    // New operational retry support (including delayed retries via resumeAfter)
    const isRetryTrigger =
      reason === "event-match" ||
      reason?.includes("failure") ||
      reason === "retry" ||
      reason === "resumeAfter"; // time-based delayed retry

    if (continuation.retry && isRetryTrigger) {
      const { prepareRetry, markMaxRetriesReached } = await import("./continuation.js");
      const retryDecision = prepareRetry(continuation);

      if (retryDecision.obsolete) {
        finalContinuation = continuation;
        resumeReason = `obsolete (${retryDecision.obsolescenceReason})`;
      } else if (retryDecision.shouldRetry) {
        finalContinuation = retryDecision.updatedContinuation;
        resumeReason = retryDecision.hasDelay
          ? `delayed-retry-attempt-${retryDecision.nextAttempt}`
          : `retry-attempt-${retryDecision.nextAttempt}`;

        // Re-register (if it has delay from exponential backoff, the time-based evaluator will wake it later)
        this.register(finalContinuation);
      } else {
        finalContinuation = markMaxRetriesReached(continuation);
        resumeReason = "max-retries-exhausted";
      }
    }

    const resumeMsg = {
      type: "cop.continuation.resume",
      source: "cop-scheduler",
      data: {
        continuationId: finalContinuation.continuationId,
        resumeTo: finalContinuation.resumeTo,
        resumeIntent: finalContinuation.resumeIntent,
        state: finalContinuation.state,
        triggeringEvent,
        reason: resumeReason,
        retry: finalContinuation.retry || null,
        ...payload,
      },
    };

    // Publish resumption on the appropriate per-topic sub-bus when we have context
    const topicId =
      finalContinuation.topicId || finalContinuation.meta?.topicId || finalContinuation.taskId;

    const effectiveBus = topicId ? this.getBusForTopic(topicId) : this.bus;

    await effectiveBus.publish(resumeMsg);

    let execution = null;
    if (this.handlerResolver) {
      try {
        execution = await executeContinuation({
          continuation: finalContinuation,
          handlerResolver: this.handlerResolver,
          readOnlyStore: this.readOnlyStore,
          triggeringEvent,
          reason: resumeReason,
          payload,
        });
      } catch (error) {
        await effectiveBus.publish({
          type: "cop.continuation.execution_failed",
          source: "cop-scheduler",
          data: {
            continuationId: finalContinuation.continuationId,
            resumeTo: finalContinuation.resumeTo,
            reason: error?.message || String(error),
          },
        });
        throw error;
      }
    }

    console.log(`[COPScheduler] Resumed ${finalContinuation.continuationId} (${resumeReason})`);
    return { continuation: finalContinuation, resumeMessage: resumeMsg, execution };
  }

  getPendingContinuations() {
    return Array.from(this.pending.values()).map((e) => e.continuation);
  }
}

export const defaultScheduler = new COPScheduler();
