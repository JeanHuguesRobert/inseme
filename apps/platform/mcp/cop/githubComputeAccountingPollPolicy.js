/**
 * GitHub Compute Accounting polling policy — no global polling daemon.
 * A trusted host calls this when a job is submitted or its due time arrives.
 * All times are absolute milliseconds and persisted by the caller.
 */
export const POLL = Object.freeze({
  activeMs: 2 * 60_000,
  normalMs: 5 * 60_000,
  idleMs: 15 * 60_000,
  maximumBackoffMs: 60 * 60_000,
});

export function nextComputeAccountingPoll({
  nowMs, pendingCount, runningCount = 0, consecutiveFailures = 0,
  rateLimitResetMs = null,
} = {}) {
  if (!Number.isFinite(nowMs) || !Number.isSafeInteger(pendingCount) || pendingCount < 0 ||
    !Number.isSafeInteger(runningCount) || runningCount < 0 ||
    !Number.isSafeInteger(consecutiveFailures) || consecutiveFailures < 0)
    throw new TypeError("invalid poll state");

  // No pending accounting obligation: wake on a local submission event.
  if (pendingCount === 0) return { mode: "dormant", nextAtMs: null };
  const base = runningCount > 0 ? POLL.activeMs : POLL.normalMs;
  const delay = consecutiveFailures === 0 ? base :
    Math.min(POLL.maximumBackoffMs, base * 2 ** Math.min(consecutiveFailures, 20));
  const nextAtMs = Math.max(nowMs + delay,
    Number.isFinite(rateLimitResetMs) ? rateLimitResetMs : nowMs);
  return { mode: consecutiveFailures ? "backoff" : runningCount > 0 ? "active" : "normal",
    nextAtMs, delayMs: nextAtMs - nowMs };
}
