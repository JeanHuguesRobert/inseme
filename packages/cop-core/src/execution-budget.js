/**
 * Reference execution-budget reservation ledger.
 *
 * A grant names the active hard dimensions. Omitted dimensions are outside
 * that budget: they are not zero usage and they are not materialized as zero.
 * Demand and settlement for one ledger use exactly the active set.
 *
 * Production stores must offer the same reserve/settle/release atomicity over
 * durable COP events before consequential handlers are connected.
 */

const DIMENSIONS = Object.freeze([
  "max_steps",
  "max_tool_calls",
  "max_subagents",
  "max_elapsed_ms",
  "max_external_effects",
]);

function normalizeForecasts(value = []) {
  if (!Array.isArray(value)) throw new TypeError("forecasts must be an array");
  return structuredClone(value);
}

function requireText(value, name) {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${name} is required`);
  return value;
}

export function activeHardDimensions(limits) {
  if (!limits || typeof limits !== "object" || Array.isArray(limits)) return [];
  return DIMENSIONS.filter((dimension) => Object.hasOwn(limits, dimension));
}

function denseZero() {
  return Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, 0]));
}

function zeros(active) {
  return Object.fromEntries(active.map((dimension) => [dimension, 0]));
}

function add(left, right, active) {
  return Object.fromEntries(
    active.map((dimension) => [dimension, left[dimension] + right[dimension]])
  );
}

function subtract(left, right, active) {
  return Object.fromEntries(
    active.map((dimension) => [dimension, left[dimension] - right[dimension]])
  );
}

function exceeds(left, right, active) {
  return active.find((dimension) => left[dimension] > right[dimension]) || null;
}

/**
 * Accept a non-empty subset of the known hard dimensions.
 * An omitted dimension is not part of the grant.
 */
function normalizeGrantLimits(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} is required`);
  }
  for (const key of Object.keys(value)) {
    if (!DIMENSIONS.includes(key)) {
      throw new TypeError(`${name}.${key} is not a known execution-budget dimension`);
    }
  }
  const out = {};
  for (const dimension of DIMENSIONS) {
    if (!Object.hasOwn(value, dimension)) continue;
    const amount = value[dimension];
    if (!Number.isInteger(amount) || amount < 0) {
      throw new TypeError(`${name}.${dimension} must be a non-negative integer`);
    }
    out[dimension] = amount;
  }
  if (Object.keys(out).length === 0) {
    throw new TypeError(`${name} must name at least one hard dimension`);
  }
  return out;
}

/**
 * Demand and usage must name exactly the active hard dimensions.
 * Missing is not zero, and an extra dimension does not extend the grant.
 */
export function matchHardUsage(usage, template) {
  return normalizeExactVector(usage, "usage", template);
}

function normalizeExactVector(value, name, template) {
  const active = activeHardDimensions(template);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      ok: false,
      error: "invalid_hard_budget_vector",
      dimension: null,
      reason: `${name} is required`,
    };
  }
  for (const key of Object.keys(value)) {
    if (!DIMENSIONS.includes(key)) {
      return {
        ok: false,
        error: "unknown_hard_dimension",
        dimension: key,
        reason: `${name}.${key} is not a known execution-budget dimension`,
      };
    }
    if (!active.includes(key)) {
      return {
        ok: false,
        error: "inactive_hard_dimension",
        dimension: key,
        reason: `${name}.${key} is not an active hard dimension`,
      };
    }
  }
  const vector = {};
  for (const dimension of active) {
    if (!Object.hasOwn(value, dimension)) {
      return {
        ok: false,
        error: "missing_active_hard_dimension",
        dimension,
        reason: `${name}.${dimension} must be a non-negative integer`,
      };
    }
    const amount = value[dimension];
    if (!Number.isInteger(amount) || amount < 0) {
      return {
        ok: false,
        error: "invalid_hard_dimension",
        dimension,
        reason: `${name}.${dimension} must be a non-negative integer`,
      };
    }
    vector[dimension] = amount;
  }
  return { ok: true, vector };
}

function readActive(value, template, name) {
  const parsed = normalizeExactVector(value, name, template);
  if (!parsed.ok)
    throw new TypeError(parsed.reason || `${name} does not match the active hard dimensions`);
  return parsed.vector;
}

function rejectedVector(parsed, snapshot) {
  return {
    ok: false,
    error: parsed.error,
    dimension: parsed.dimension,
    reason: parsed.reason,
    snapshot,
  };
}

/**
 * Create one budget ledger. Calls are synchronous so reserve is atomic within
 * this reference process; a persistent adapter must preserve that invariant.
 */
export function createMemoryExecutionBudgetLedger({ budget_id, limits } = {}) {
  requireText(budget_id, "budget_id");
  const maximum = normalizeGrantLimits(limits, "limits");
  const active = activeHardDimensions(maximum);
  const reservations = new Map();
  const idempotency = new Map();
  let reserved = zeros(active);
  let settled = zeros(active);
  let version = 1;

  function snapshot() {
    return {
      budget_id,
      version,
      limits: { ...maximum },
      reserved: { ...reserved },
      settled: { ...settled },
      available: subtract(maximum, add(reserved, settled, active), active),
    };
  }

  return {
    reserve({ idempotency_key, expected_version, demand, forecasts = [] } = {}) {
      requireText(idempotency_key, "idempotency_key");
      const parsed = normalizeExactVector(demand, "demand", maximum);
      if (!parsed.ok) return rejectedVector(parsed, snapshot());
      const requested = parsed.vector;
      const existingId = idempotency.get(idempotency_key);
      if (existingId) {
        return {
          ok: true,
          duplicate: true,
          reservation: structuredClone(reservations.get(existingId)),
          snapshot: snapshot(),
        };
      }
      if (!Number.isInteger(expected_version) || expected_version !== version) {
        return { ok: false, error: "budget_version_conflict", snapshot: snapshot() };
      }

      const next = add(add(reserved, settled, active), requested, active);
      const exceeded = exceeds(next, maximum, active);
      if (exceeded) {
        return { ok: false, error: "budget_exhausted", dimension: exceeded, snapshot: snapshot() };
      }
      const reservation = {
        reservation_id: `reservation:${budget_id}:${reservations.size + 1}`,
        budget_id,
        idempotency_key,
        demand: requested,
        forecasts: normalizeForecasts(forecasts),
        status: "reserved",
        settled: zeros(active),
      };
      reservations.set(reservation.reservation_id, reservation);
      idempotency.set(idempotency_key, reservation.reservation_id);
      reserved = add(reserved, requested, active);
      version += 1;
      return {
        ok: true,
        duplicate: false,
        reservation: structuredClone(reservation),
        snapshot: snapshot(),
      };
    },

    settle({ reservation_id, expected_version, usage } = {}) {
      requireText(reservation_id, "reservation_id");
      const reservation = reservations.get(reservation_id);
      if (!reservation) return { ok: false, error: "unknown_reservation", snapshot: snapshot() };
      const parsed = normalizeExactVector(usage, "usage", reservation.demand);
      if (!parsed.ok) return rejectedVector(parsed, snapshot());
      const observed = parsed.vector;
      if (reservation.status !== "reserved") {
        return { ok: false, error: "reservation_not_active", snapshot: snapshot() };
      }
      if (!Number.isInteger(expected_version) || expected_version !== version) {
        return { ok: false, error: "budget_version_conflict", snapshot: snapshot() };
      }
      const exceeded = exceeds(observed, reservation.demand, active);
      if (exceeded) {
        return {
          ok: false,
          error: "usage_exceeds_reservation",
          dimension: exceeded,
          snapshot: snapshot(),
        };
      }
      reservation.status = "settled";
      reservation.settled = observed;
      reserved = subtract(reserved, reservation.demand, active);
      settled = add(settled, observed, active);
      version += 1;
      return {
        ok: true,
        reservation: structuredClone(reservation),
        released: subtract(reservation.demand, observed, active),
        snapshot: snapshot(),
      };
    },

    release({ reservation_id, expected_version } = {}) {
      requireText(reservation_id, "reservation_id");
      const reservation = reservations.get(reservation_id);
      if (!reservation) return { ok: false, error: "unknown_reservation", snapshot: snapshot() };
      if (reservation.status !== "reserved") {
        return { ok: false, error: "reservation_not_active", snapshot: snapshot() };
      }
      if (!Number.isInteger(expected_version) || expected_version !== version) {
        return { ok: false, error: "budget_version_conflict", snapshot: snapshot() };
      }
      reservation.status = "released";
      reserved = subtract(reserved, reservation.demand, active);
      version += 1;
      return { ok: true, reservation: structuredClone(reservation), snapshot: snapshot() };
    },

    snapshot,
  };
}

function executionBudgetTopic(budgetId) {
  return `execution-budget:${budgetId}`;
}

function listTopicEvents(store, topic) {
  if (typeof store?.listTopic === "function") return store.listTopic(topic);
  if (typeof store?.replay === "function") {
    return store.replay().filter((event) => event?.topic?.id === topic);
  }
  throw new TypeError("COP event store must provide listTopic() or replay()");
}

function zeroLike(template) {
  const active = activeHardDimensions(template);
  return zeros(active.length > 0 ? active : DIMENSIONS);
}

function projectEventLedger({ budget_id, limits, events, require_authority_grant = false }) {
  const relevant = [];
  let version = 0;
  let authority_version = 0;
  let mandate_ref = null;
  let authoritative_limits = null;
  let has_grant = false;

  for (const event of events) {
    version = Math.max(version, event.topic?.seq || 0);
    const payload = event.payload || {};
    if (payload.budget_id !== budget_id) continue;
    relevant.push(event);
    if (event.event_type === "ExecutionBudgetGrant" || payload.kind === "ExecutionBudgetGrant") {
      has_grant = true;
      mandate_ref = payload.mandate_ref || mandate_ref;
      authority_version = Math.max(authority_version, payload.authority_version || 1);
      authoritative_limits = normalizeGrantLimits(payload.limits, "grant.limits");
    }
  }

  // No grant under require_authority_grant is absence of authority, so every
  // dimension of the supplied fallback has zero capacity. That is not an
  // omitted dimension of a sparse grant.
  const effectiveLimits = authoritative_limits
    ? { ...authoritative_limits }
    : require_authority_grant
      ? zeroLike(limits)
      : limits
        ? { ...limits }
        : denseZero();
  const active = activeHardDimensions(effectiveLimits);
  const reservations = new Map();
  let reserved = zeros(active);
  let settled = zeros(active);

  for (const event of relevant) {
    const payload = event.payload || {};
    if (event.event_type === "ExecutionBudgetGrant" || payload.kind === "ExecutionBudgetGrant") {
      continue;
    }
    if (event.event_type === "ExecutionBudgetReservation") {
      if (reservations.has(payload.reservation?.reservation_id)) continue;
      const reservation = structuredClone(payload.reservation);
      reservations.set(reservation.reservation_id, reservation);
      reserved = add(
        reserved,
        readActive(reservation.demand, effectiveLimits, "reservation.demand"),
        active
      );
      continue;
    }
    const reservation = reservations.get(payload.reservation_id);
    if (!reservation || reservation.status !== "reserved") continue;
    if (event.event_type === "ExecutionBudgetSettlement") {
      const usage = readActive(payload.usage, effectiveLimits, "settlement.usage");
      reservation.status = "settled";
      reservation.settled = usage;
      reserved = subtract(
        reserved,
        readActive(reservation.demand, effectiveLimits, "reservation.demand"),
        active
      );
      settled = add(settled, usage, active);
    } else if (event.event_type === "ExecutionBudgetRelease") {
      reservation.status = "released";
      reserved = subtract(
        reserved,
        readActive(reservation.demand, effectiveLimits, "reservation.demand"),
        active
      );
    }
  }

  return {
    reservations,
    snapshot: {
      budget_id,
      version,
      authority_version,
      mandate_ref,
      has_grant,
      limits: { ...effectiveLimits },
      reserved,
      settled,
      available: subtract(effectiveLimits, add(reserved, settled, active), active),
    },
  };
}

/**
 * Record an authoritative execution-budget grant into the durable event store.
 *
 * @param {object} store - COP store with .append()
 * @param {object} input
 * @param {string} input.budget_id
 * @param {string} input.mandate_ref
 * @param {string} input.principal_ref
 * @param {object} input.limits
 * @param {number} [input.authority_version]
 * @param {string} [input.topic_id]
 * @param {string} [input.reason]
 */
export function recordExecutionBudgetGrant(store, input) {
  if (!store || typeof store.append !== "function") {
    throw new TypeError("COP event store must provide append()");
  }
  requireText(input?.budget_id, "budget_id");
  requireText(input?.mandate_ref, "mandate_ref");
  requireText(input?.principal_ref, "principal_ref");
  const normalizedLimits = normalizeGrantLimits(input.limits, "limits");
  const topic = input.topic_id || executionBudgetTopic(input.budget_id);
  const version =
    Number.isInteger(input.authority_version) && input.authority_version > 0
      ? input.authority_version
      : 1;

  const result = store.append({
    event_type: "ExecutionBudgetGrant",
    topic_id: topic,
    epistemic_status: "normative",
    actor_ref: input.principal_ref,
    subject_ref: input.mandate_ref,
    mandate_ref: input.mandate_ref,
    visibility: "restricted",
    payload: {
      kind: "ExecutionBudgetGrant",
      budget_id: input.budget_id,
      mandate_ref: input.mandate_ref,
      principal_ref: input.principal_ref,
      limits: normalizedLimits,
      authority_version: version,
      reason: input.reason || null,
      granted_at: new Date().toISOString(),
    },
    idempotency_key: `execution-budget:grant:${input.budget_id}:v${version}`,
  });

  if (!result.ok) {
    throw new Error(`execution_budget_grant_append_failed:${result.error}`);
  }

  return {
    ok: true,
    budget_id: input.budget_id,
    mandate_ref: input.mandate_ref,
    authority_version: version,
    limits: normalizedLimits,
    event: result.event,
  };
}

/**
 * Project an execution-budget ledger from append-only COP events.
 *
 * The event store's topic sequence is the optimistic-lock version. A stale
 * writer therefore records nothing and receives the current snapshot; an
 * uncertain forecast stays evidence on a reservation, never a capacity claim.
 * The supplied store must durably make `append()` and the expected topic
 * sequence atomic before this adapter is used for consequential work.
 */
export function createEventSourcedExecutionBudgetLedger({
  store,
  budget_id,
  limits,
  event_context = {},
  require_authority_grant = false,
} = {}) {
  requireText(budget_id, "budget_id");
  const fallbackLimits = limits ? normalizeGrantLimits(limits, "limits") : denseZero();
  if (!store || typeof store.append !== "function") {
    throw new TypeError("COP event store must provide append()");
  }
  const topic = executionBudgetTopic(budget_id);

  function current() {
    return projectEventLedger({
      budget_id,
      limits: fallbackLimits,
      events: listTopicEvents(store, topic),
      require_authority_grant,
    });
  }

  function append(event_type, expected_version, idempotency_key, payload) {
    return store.append({
      ...event_context,
      event_type,
      topic: { id: topic, seq: expected_version + 1 },
      idempotency_key,
      epistemic_status: "observed",
      visibility: "restricted",
      payload: { budget_id, ...payload },
    });
  }

  function conflict(snapshot) {
    return { ok: false, error: "budget_version_conflict", snapshot };
  }

  return {
    reserve({ idempotency_key, expected_version, demand, forecasts = [] } = {}) {
      requireText(idempotency_key, "idempotency_key");
      const state = current();
      if (require_authority_grant && !state.snapshot.has_grant) {
        return { ok: false, error: "budget_not_authorized", snapshot: state.snapshot };
      }
      const parsed = normalizeExactVector(demand, "demand", state.snapshot.limits);
      if (!parsed.ok) return rejectedVector(parsed, state.snapshot);
      const requested = parsed.vector;
      const existing = [...state.reservations.values()].find(
        (reservation) => reservation.idempotency_key === idempotency_key
      );
      if (existing) {
        return {
          ok: true,
          duplicate: true,
          reservation: structuredClone(existing),
          snapshot: state.snapshot,
        };
      }
      if (!Number.isInteger(expected_version) || expected_version !== state.snapshot.version) {
        return conflict(state.snapshot);
      }
      const active = activeHardDimensions(state.snapshot.limits);
      const next = add(
        add(state.snapshot.reserved, state.snapshot.settled, active),
        requested,
        active
      );
      const dimension = exceeds(next, state.snapshot.limits, active);
      if (dimension) {
        return { ok: false, error: "budget_exhausted", dimension, snapshot: state.snapshot };
      }

      const reservation = {
        reservation_id: `reservation:${budget_id}:${idempotency_key}`,
        budget_id,
        idempotency_key,
        demand: requested,
        forecasts: normalizeForecasts(forecasts),
        status: "reserved",
        settled: zeros(active),
      };
      const result = append(
        "ExecutionBudgetReservation",
        expected_version,
        `execution-budget:reserve:${budget_id}:${idempotency_key}`,
        { reservation }
      );
      if (!result.ok) return conflict(current().snapshot);
      const after = current();
      return {
        ok: true,
        duplicate: Boolean(result.duplicate),
        reservation: structuredClone(after.reservations.get(reservation.reservation_id)),
        snapshot: after.snapshot,
      };
    },

    settle({ reservation_id, expected_version, usage, idempotency_key } = {}) {
      requireText(reservation_id, "reservation_id");
      const key = idempotency_key || `settle:${reservation_id}`;
      const appendKey = `execution-budget:settle:${budget_id}:${key}`;
      const state = current();
      const reservation = state.reservations.get(reservation_id);
      if (!reservation)
        return { ok: false, error: "unknown_reservation", snapshot: state.snapshot };
      const parsed = normalizeExactVector(usage, "usage", reservation.demand);
      if (!parsed.ok) return rejectedVector(parsed, state.snapshot);
      const observed = parsed.vector;
      const active = activeHardDimensions(state.snapshot.limits);
      const prior = listTopicEvents(store, topic).find(
        (event) => event.idempotency_key === appendKey
      );
      if (prior) {
        const priorUsage = readActive(
          prior.payload.usage,
          state.snapshot.limits,
          "settlement.usage"
        );
        const demand = readActive(reservation.demand, state.snapshot.limits, "reservation.demand");
        return {
          ok: true,
          duplicate: true,
          reservation: structuredClone(reservation),
          released: subtract(demand, priorUsage, active),
          snapshot: state.snapshot,
        };
      }
      if (reservation.status !== "reserved") {
        return { ok: false, error: "reservation_not_active", snapshot: state.snapshot };
      }
      if (!Number.isInteger(expected_version) || expected_version !== state.snapshot.version) {
        return conflict(state.snapshot);
      }
      const demand = readActive(reservation.demand, state.snapshot.limits, "reservation.demand");
      const dimension = exceeds(observed, demand, active);
      if (dimension) {
        return {
          ok: false,
          error: "usage_exceeds_reservation",
          dimension,
          snapshot: state.snapshot,
        };
      }
      const result = append("ExecutionBudgetSettlement", expected_version, appendKey, {
        reservation_id,
        usage: observed,
      });
      if (!result.ok) return conflict(current().snapshot);
      const after = current();
      const settledReservation = after.reservations.get(reservation_id);
      return {
        ok: true,
        duplicate: Boolean(result.duplicate),
        reservation: structuredClone(settledReservation),
        released: subtract(
          readActive(reservation.demand, state.snapshot.limits, "reservation.demand"),
          observed,
          active
        ),
        snapshot: after.snapshot,
      };
    },

    release({ reservation_id, expected_version, idempotency_key } = {}) {
      requireText(reservation_id, "reservation_id");
      const key = idempotency_key || `release:${reservation_id}`;
      const appendKey = `execution-budget:release:${budget_id}:${key}`;
      const state = current();
      const reservation = state.reservations.get(reservation_id);
      if (!reservation)
        return { ok: false, error: "unknown_reservation", snapshot: state.snapshot };
      if (listTopicEvents(store, topic).some((event) => event.idempotency_key === appendKey)) {
        return {
          ok: true,
          duplicate: true,
          reservation: structuredClone(reservation),
          snapshot: state.snapshot,
        };
      }
      if (reservation.status !== "reserved") {
        return { ok: false, error: "reservation_not_active", snapshot: state.snapshot };
      }
      if (!Number.isInteger(expected_version) || expected_version !== state.snapshot.version) {
        return conflict(state.snapshot);
      }
      const result = append("ExecutionBudgetRelease", expected_version, appendKey, {
        reservation_id,
      });
      if (!result.ok) return conflict(current().snapshot);
      const after = current();
      return {
        ok: true,
        duplicate: Boolean(result.duplicate),
        reservation: structuredClone(after.reservations.get(reservation_id)),
        snapshot: after.snapshot,
      };
    },

    snapshot() {
      return current().snapshot;
    },
  };
}

export { DIMENSIONS };
