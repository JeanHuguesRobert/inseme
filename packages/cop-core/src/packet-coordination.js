// Packet-level coordination primitives for Fractanet Cognitive Packets.
// F1 scope: exclusive mutation claims only. No scoped/cooperative claims yet.

export const PACKET_COORDINATION_SCHEMA = "cop.packet-coordination/v1";
export const PACKET_CLAIM_SCHEMA = "cop.packet-claim/v1";

export const PacketClaimEvent = Object.freeze({
  GRANTED: "PACKET_CLAIM_GRANTED",
  DENIED: "PACKET_CLAIM_DENIED",
  RENEWED: "PACKET_CLAIM_RENEWED",
  RELEASED: "PACKET_CLAIM_RELEASED",
  EXPIRED: "PACKET_CLAIM_EXPIRED",
  RECLAIMED: "PACKET_RECLAIMED",
  STALE_REJECTED: "STALE_CLAIM_REJECTED",
  COMPLETED: "PACKET_CLAIM_COMPLETED",
});

function assertString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

function assertEpoch(epoch) {
  if (!Number.isInteger(epoch) || epoch < 1) {
    throw new TypeError("epoch must be an integer >= 1");
  }
}

export function createExclusiveMutationPolicy({ generation = 1 } = {}) {
  if (!Number.isInteger(generation) || generation < 1) {
    throw new TypeError("generation must be an integer >= 1");
  }
  return Object.freeze({
    schema: PACKET_COORDINATION_SCHEMA,
    generation,
    policy: Object.freeze({ mutation: "exclusive" }),
  });
}

export function createPacketClaim({
  packetRef,
  claimId,
  handlerRef,
  epoch,
  acquiredAt,
  expiresAt,
}) {
  assertString(packetRef, "packetRef");
  assertString(claimId, "claimId");
  assertString(handlerRef, "handlerRef");
  assertEpoch(epoch);
  assertString(acquiredAt, "acquiredAt");
  assertString(expiresAt, "expiresAt");

  return Object.freeze({
    schema: PACKET_CLAIM_SCHEMA,
    packet_ref: packetRef,
    claim_id: claimId,
    handler_ref: handlerRef,
    mode: "MUTATE",
    scope: "packet",
    epoch,
    acquired_at: acquiredAt,
    expires_at: expiresAt,
  });
}

export function isClaimExpired(claim, now = new Date()) {
  if (!claim) return true;
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const expiryMs = new Date(claim.expires_at).getTime();
  return !Number.isFinite(expiryMs) || expiryMs <= nowMs;
}

export function validateCurrentPacketClaim(
  projection,
  { claimId, handlerRef, epoch, now = new Date() },
) {
  const active = projection?.active_claim || null;
  if (!active) return { ok: false, code: "NO_ACTIVE_CLAIM" };
  if (isClaimExpired(active, now)) return { ok: false, code: "STALE_CLAIM" };
  if (active.claim_id !== claimId) return { ok: false, code: "STALE_CLAIM" };
  if (active.handler_ref !== handlerRef) return { ok: false, code: "STALE_CLAIM" };
  if (active.epoch !== epoch) return { ok: false, code: "STALE_CLAIM" };
  return { ok: true, code: "CLAIM_CURRENT", claim: active };
}

export function projectPacketCoordination(events = []) {
  const state = {
    schema: PACKET_COORDINATION_SCHEMA,
    generation: 1,
    last_epoch: 0,
    active_claim: null,
    completed_claims: [],
  };

  for (const event of events) {
    const claim = event?.claim || null;
    switch (event?.type) {
      case PacketClaimEvent.GRANTED:
      case PacketClaimEvent.RECLAIMED:
        if (!claim) throw new Error(`${event.type} requires claim`);
        state.last_epoch = Math.max(state.last_epoch, claim.epoch);
        state.active_claim = claim;
        break;
      case PacketClaimEvent.RENEWED:
        if (
          claim &&
          state.active_claim &&
          state.active_claim.claim_id === claim.claim_id &&
          state.active_claim.epoch === claim.epoch
        ) {
          state.active_claim = claim;
        }
        break;
      case PacketClaimEvent.RELEASED:
      case PacketClaimEvent.EXPIRED:
        if (
          claim &&
          state.active_claim &&
          state.active_claim.claim_id === claim.claim_id &&
          state.active_claim.epoch === claim.epoch
        ) {
          state.active_claim = null;
        }
        break;
      case PacketClaimEvent.COMPLETED:
        if (claim) {
          state.completed_claims.push({
            claim_id: claim.claim_id,
            handler_ref: claim.handler_ref,
            epoch: claim.epoch,
            result_ref: event.result_ref || null,
          });
        }
        if (
          claim &&
          state.active_claim &&
          state.active_claim.claim_id === claim.claim_id &&
          state.active_claim.epoch === claim.epoch
        ) {
          state.active_claim = null;
          state.generation += 1;
        }
        break;
      default:
        break;
    }
  }

  return state;
}
