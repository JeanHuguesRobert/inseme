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
    return event;
  }

  inspect(packetRef) {
    return projectPacketCoordination(this.#packetEvents(packetRef));
  }

  events(packetRef) {
    return [...this.#packetEvents(packetRef)];
  }

  async tryClaim({ packetRef, handlerRef, ttlMs = 60_000 }) {
    if (!Number.isInteger(ttlMs) || ttlMs <= 0) {
      throw new TypeError("ttlMs must be a positive integer");
    }

    return this.#serialized(() => {
      const nowMs = this.#clock();
      let projection = this.inspect(packetRef);
      const prior = projection.active_claim;

      if (prior && !isClaimExpired(prior, new Date(nowMs))) {
        const result = {
          ok: false,
          code: "PACKET_BUSY",
          packet_ref: packetRef,
          active_claim: prior,
        };
        this.#append(packetRef, {
          type: PacketClaimEvent.DENIED,
          packet_ref: packetRef,
          handler_ref: handlerRef,
          at: iso(nowMs),
          active_epoch: prior.epoch,
        });
        return result;
      }

      let reclaimed = false;
      if (prior && isClaimExpired(prior, new Date(nowMs))) {
        reclaimed = true;
        this.#append(packetRef, {
          type: PacketClaimEvent.EXPIRED,
          packet_ref: packetRef,
          claim: prior,
          at: iso(nowMs),
        });
        projection = this.inspect(packetRef);
      }

      const epoch = projection.last_epoch + 1;
      const claim = createPacketClaim({
        packetRef,
        claimId: `${packetRef}:claim:${++this.#sequence}`,
        handlerRef,
        epoch,
        acquiredAt: iso(nowMs),
        expiresAt: iso(nowMs + ttlMs),
      });

      this.#append(packetRef, {
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
    });
  }

  async heartbeat({ packetRef, claimId, handlerRef, epoch, ttlMs = 60_000 }) {
    return this.#serialized(() => {
      const nowMs = this.#clock();
      const projection = this.inspect(packetRef);
      const valid = validateCurrentPacketClaim(projection, {
        claimId,
        handlerRef,
        epoch,
        now: new Date(nowMs),
      });
      if (!valid.ok) {
        this.#append(packetRef, {
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
      this.#append(packetRef, {
        type: PacketClaimEvent.RENEWED,
        packet_ref: packetRef,
        claim,
        at: iso(nowMs),
      });
      return { ok: true, code: "CLAIM_RENEWED", claim };
    });
  }

  async release({ packetRef, claimId, handlerRef, epoch }) {
    return this.#serialized(() => {
      const nowMs = this.#clock();
      const projection = this.inspect(packetRef);
      const valid = validateCurrentPacketClaim(projection, {
        claimId,
        handlerRef,
        epoch,
        now: new Date(nowMs),
      });
      if (!valid.ok) {
        this.#append(packetRef, {
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
      this.#append(packetRef, {
        type: PacketClaimEvent.RELEASED,
        packet_ref: packetRef,
        claim: valid.claim,
        at: iso(nowMs),
      });
      return { ok: true, code: "CLAIM_RELEASED" };
    });
  }

  async complete({ packetRef, claimId, handlerRef, epoch, resultRef = null }) {
    return this.#serialized(() => {
      const nowMs = this.#clock();
      const projection = this.inspect(packetRef);
      const valid = validateCurrentPacketClaim(projection, {
        claimId,
        handlerRef,
        epoch,
        now: new Date(nowMs),
      });
      if (!valid.ok) {
        this.#append(packetRef, {
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
      this.#append(packetRef, {
        type: PacketClaimEvent.COMPLETED,
        packet_ref: packetRef,
        claim: valid.claim,
        result_ref: resultRef,
        at: iso(nowMs),
      });
      return {
        ok: true,
        code: "CLAIM_COMPLETED",
        generation: this.inspect(packetRef).generation,
      };
    });
  }
}
