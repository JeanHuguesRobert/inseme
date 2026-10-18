import {
  PacketClaimEvent,
  createPacketClaim,
  isClaimExpired,
  projectPacketCoordination,
  validateCurrentPacketClaim,
} from "../../cop-core/src/packet-coordination.js";

function iso(ms) {
  return new Date(ms).toISOString();
}

function assertTtl(ttlMs) {
  if (!Number.isInteger(ttlMs) || ttlMs <= 0) {
    throw new TypeError("ttlMs must be a positive integer");
  }
}

function appendAndProject(events, append, event) {
  append(event);
  events.push(Object.freeze({ ...event }));
  return projectPacketCoordination(events);
}

function tryClaimTransition({
  events,
  append,
  packetRef,
  handlerRef,
  ttlMs,
  nowMs,
  makeClaimId,
}) {
  assertTtl(ttlMs);
  let projection = projectPacketCoordination(events);
  const prior = projection.active_claim;

  if (prior && !isClaimExpired(prior, new Date(nowMs))) {
    appendAndProject(events, append, {
      type: PacketClaimEvent.DENIED,
      packet_ref: packetRef,
      handler_ref: handlerRef,
      at: iso(nowMs),
      active_epoch: prior.epoch,
    });
    return {
      ok: false,
      code: "PACKET_BUSY",
      packet_ref: packetRef,
      active_claim: prior,
    };
  }

  let reclaimed = false;
  if (prior && isClaimExpired(prior, new Date(nowMs))) {
    reclaimed = true;
    projection = appendAndProject(events, append, {
      type: PacketClaimEvent.EXPIRED,
      packet_ref: packetRef,
      claim: prior,
      at: iso(nowMs),
    });
  }

  const epoch = projection.last_epoch + 1;
  const claim = createPacketClaim({
    packetRef,
    claimId: makeClaimId({ packetRef, epoch }),
    handlerRef,
    epoch,
    acquiredAt: iso(nowMs),
    expiresAt: iso(nowMs + ttlMs),
  });

  appendAndProject(events, append, {
    type: reclaimed ? PacketClaimEvent.RECLAIMED : PacketClaimEvent.GRANTED,
    packet_ref: packetRef,
    claim,
    at: iso(nowMs),
  });

  return {
    ok: true,
    code: reclaimed ? "CLAIM_RECLAIMED" : "CLAIM_GRANTED",
    packet_ref: packetRef,
    claim,
  };
}

function heartbeatTransition({
  events,
  append,
  packetRef,
  claimId,
  handlerRef,
  epoch,
  ttlMs,
  nowMs,
}) {
  assertTtl(ttlMs);
  const projection = projectPacketCoordination(events);
  const valid = validateCurrentPacketClaim(projection, {
    claimId,
    handlerRef,
    epoch,
    now: new Date(nowMs),
  });
  if (!valid.ok) {
    appendAndProject(events, append, {
      type: PacketClaimEvent.STALE_REJECTED,
      packet_ref: packetRef,
      claim_id: claimId,
      handler_ref: handlerRef,
      epoch,
      operation: "heartbeat",
      at: iso(nowMs),
    });
    return valid;
  }

  const claim = createPacketClaim({
    ...valid.claim,
    packetRef,
    claimId,
    handlerRef,
    epoch,
    acquiredAt: valid.claim.acquired_at,
    expiresAt: iso(nowMs + ttlMs),
  });
  appendAndProject(events, append, {
    type: PacketClaimEvent.RENEWED,
    packet_ref: packetRef,
    claim,
    at: iso(nowMs),
  });
  return { ok: true, code: "CLAIM_RENEWED", claim };
}

function releaseTransition({
  events,
  append,
  packetRef,
  claimId,
  handlerRef,
  epoch,
  nowMs,
}) {
  const projection = projectPacketCoordination(events);
  const valid = validateCurrentPacketClaim(projection, {
    claimId,
    handlerRef,
    epoch,
    now: new Date(nowMs),
  });
  if (!valid.ok) {
    appendAndProject(events, append, {
      type: PacketClaimEvent.STALE_REJECTED,
      packet_ref: packetRef,
      claim_id: claimId,
      handler_ref: handlerRef,
      epoch,
      operation: "release",
      at: iso(nowMs),
    });
    return valid;
  }
  appendAndProject(events, append, {
    type: PacketClaimEvent.RELEASED,
    packet_ref: packetRef,
    claim: valid.claim,
    at: iso(nowMs),
  });
  return { ok: true, code: "CLAIM_RELEASED" };
}

function completeTransition({
  events,
  append,
  packetRef,
  claimId,
  handlerRef,
  epoch,
  resultRef,
  nowMs,
}) {
  const projection = projectPacketCoordination(events);
  const valid = validateCurrentPacketClaim(projection, {
    claimId,
    handlerRef,
    epoch,
    now: new Date(nowMs),
  });
  if (!valid.ok) {
    appendAndProject(events, append, {
      type: PacketClaimEvent.STALE_REJECTED,
      packet_ref: packetRef,
      claim_id: claimId,
      handler_ref: handlerRef,
      epoch,
      operation: "complete",
      result_ref: resultRef,
      at: iso(nowMs),
    });
    return { ok: false, code: "STALE_CLAIM" };
  }
  const after = appendAndProject(events, append, {
    type: PacketClaimEvent.COMPLETED,
    packet_ref: packetRef,
    claim: valid.claim,
    result_ref: resultRef,
    at: iso(nowMs),
  });
  return {
    ok: true,
    code: "CLAIM_COMPLETED",
    generation: after.generation,
  };
}

function packetCoordinationTopic(packetRef) {
  return `packet-coordination:${packetRef}`;
}

function envelopeToCoordinationEvent(event) {
  return event?.payload?.packet_coordination_event || null;
}

function eventEnvelope(packetRef, event) {
  return {
    event_type: event.type,
    topic_id: packetCoordinationTopic(packetRef),
    epistemic_status: "observed",
    visibility: "restricted",
    payload: {
      kind: "PacketClaimEvent",
      packet_ref: packetRef,
      packet_coordination_event: event,
    },
  };
}

export class InMemoryPacketClaimCoordinator {
  #events = new Map();
  #queue = Promise.resolve();
  #clock;
  #sequence = 0;

  constructor({ now = () => Date.now() } = {}) {
    this.#clock = now;
  }

  #serialized(fn) {
    const next = this.#queue.then(fn, fn);
    this.#queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  #packetEvents(packetRef) {
    const events = this.#events.get(packetRef);
    if (events) return events;
    const created = [];
    this.#events.set(packetRef, created);
    return created;
  }

  #append(packetRef, event) {
    const events = this.#packetEvents(packetRef);
    events.push(Object.freeze({ ...event }));
  }

  inspect(packetRef) {
    return projectPacketCoordination(this.#packetEvents(packetRef));
  }

  events(packetRef) {
    return [...this.#packetEvents(packetRef)];
  }

  async tryClaim({ packetRef, handlerRef, ttlMs = 60_000 }) {
    return this.#serialized(() => {
      const events = [...this.#packetEvents(packetRef)];
      return tryClaimTransition({
        events,
        append: (event) => this.#append(packetRef, event),
        packetRef,
        handlerRef,
        ttlMs,
        nowMs: this.#clock(),
        makeClaimId: ({ packetRef: ref }) => `${ref}:claim:${++this.#sequence}`,
      });
    });
  }

  async heartbeat({ packetRef, claimId, handlerRef, epoch, ttlMs = 60_000 }) {
    return this.#serialized(() =>
      heartbeatTransition({
        events: [...this.#packetEvents(packetRef)],
        append: (event) => this.#append(packetRef, event),
        packetRef,
        claimId,
        handlerRef,
        epoch,
        ttlMs,
        nowMs: this.#clock(),
      })
    );
  }

  async release({ packetRef, claimId, handlerRef, epoch }) {
    return this.#serialized(() =>
      releaseTransition({
        events: [...this.#packetEvents(packetRef)],
        append: (event) => this.#append(packetRef, event),
        packetRef,
        claimId,
        handlerRef,
        epoch,
        nowMs: this.#clock(),
      })
    );
  }

  async complete({ packetRef, claimId, handlerRef, epoch, resultRef = null }) {
    return this.#serialized(() =>
      completeTransition({
        events: [...this.#packetEvents(packetRef)],
        append: (event) => this.#append(packetRef, event),
        packetRef,
        claimId,
        handlerRef,
        epoch,
        resultRef,
        nowMs: this.#clock(),
      })
    );
  }
}

/**
 * Durable PacketClaim coordinator backed by a COP Event Store.
 *
 * The store remains the only persistence primitive: PacketClaim state is a
 * projection of append-only COP events. Atomic claim decisions rely on the
 * store's transaction boundary (SQLite uses BEGIN IMMEDIATE).
 */
export class EventStorePacketClaimCoordinator {
  #store;
  #clock;

  constructor({ store, now = () => Date.now() } = {}) {
    if (
      !store ||
      typeof store.transaction !== "function" ||
      typeof store.listTopic !== "function"
    ) {
      throw new TypeError("store must provide transaction() and listTopic()");
    }
    this.#store = store;
    this.#clock = now;
  }

  #coordinationEvents(reader, packetRef) {
    return reader
      .listTopic(packetCoordinationTopic(packetRef))
      .map(envelopeToCoordinationEvent)
      .filter(Boolean);
  }

  #transaction(packetRef, transition) {
    const result = this.#store.transaction((tx) => {
      const events = this.#coordinationEvents(tx, packetRef);
      const append = (event) => {
        const persisted = tx.append(eventEnvelope(packetRef, event));
        if (!persisted?.ok) {
          throw new Error(
            `packet_claim_event_append_failed:${persisted?.error || "unknown"}`
          );
        }
      };
      return transition(events, append);
    });

    if (!result?.ok) {
      throw new Error(`packet_claim_transaction_failed:${result?.error || "unknown"}`);
    }
    return result.value;
  }

  inspect(packetRef) {
    return projectPacketCoordination(this.events(packetRef));
  }

  events(packetRef) {
    return this.#coordinationEvents(this.#store, packetRef);
  }

  async tryClaim({ packetRef, handlerRef, ttlMs = 60_000 }) {
    return this.#transaction(packetRef, (events, append) =>
      tryClaimTransition({
        events,
        append,
        packetRef,
        handlerRef,
        ttlMs,
        nowMs: this.#clock(),
        makeClaimId: ({ packetRef: ref, epoch }) => `${ref}:claim:${epoch}`,
      })
    );
  }

  async heartbeat({ packetRef, claimId, handlerRef, epoch, ttlMs = 60_000 }) {
    return this.#transaction(packetRef, (events, append) =>
      heartbeatTransition({
        events,
        append,
        packetRef,
        claimId,
        handlerRef,
        epoch,
        ttlMs,
        nowMs: this.#clock(),
      })
    );
  }

  async release({ packetRef, claimId, handlerRef, epoch }) {
    return this.#transaction(packetRef, (events, append) =>
      releaseTransition({
        events,
        append,
        packetRef,
        claimId,
        handlerRef,
        epoch,
        nowMs: this.#clock(),
      })
    );
  }

  async complete({ packetRef, claimId, handlerRef, epoch, resultRef = null }) {
    return this.#transaction(packetRef, (events, append) =>
      completeTransition({
        events,
        append,
        packetRef,
        claimId,
        handlerRef,
        epoch,
        resultRef,
        nowMs: this.#clock(),
      })
    );
  }
}
