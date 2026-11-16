/**
 * Magistral object-memory v0: provider-neutral byte custody.
 *
 * This is NOT a cognitive memory system and performs no inference, retention
 * judgement or mandate decision. Policies are supplied by the caller.
 *
 * No network service, database, provider account or S3 API is required.
 */
import { createHash } from "node:crypto";

const SHA256_REF = /^sha256:[a-f0-9]{64}$/;

export function hashObject(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError("object bytes must be a Buffer or Uint8Array");
  }
  return "sha256:" + createHash("sha256").update(bytes).digest("hex");
}

export function assertObjectRef(ref) {
  if (typeof ref !== "string" || !SHA256_REF.test(ref)) {
    throw new TypeError("object ref must be sha256:<64 lowercase hex digits>");
  }
  return ref;
}

export class ObjectUnavailableError extends Error {
  constructor(ref, attempts) {
    super("object_unavailable: " + ref);
    this.name = "ObjectUnavailableError";
    this.code = "object_unavailable";
    this.ref = ref;
    this.attempts = attempts;
  }
}

export class ObjectReplicationError extends Error {
  constructor(ref, required, copies, attempts) {
    super("insufficient_verified_copies: " + copies.length + "/" + required);
    this.name = "ObjectReplicationError";
    this.code = "insufficient_verified_copies";
    this.ref = ref;
    this.required = required;
    this.copies = copies;
    this.attempts = attempts;
  }
}

/**
 * A provider implements {id, billing, put(ref, bytes), get(ref)}.
 * billing is one of: "none", "metered", "unknown". Unknown is NOT free.
 * put() must verify durable storage or fail; get() returns bytes or null.
 * "none" means no monetary provider billing, NOT unlimited disk capacity.
 *
 * In v0 a strict budget of zero is the only accepted monetary budget.
 * In particular, a positive max_cost does not authorize opaque charges.
 */
export function createObjectMemory({ providers = [] } = {}) {
  if (!Array.isArray(providers)) throw new TypeError("providers must be an array");
  const ids = new Set();
  const storageLocations = new Set();
  const registered = providers.map((provider) => {
    if (
      !provider ||
      typeof provider.id !== "string" ||
      !provider.id ||
      typeof provider.put !== "function" ||
      typeof provider.get !== "function" ||
      !["none", "metered", "unknown"].includes(provider.billing)
    ) {
      throw new TypeError("invalid object provider declaration");
    }
    if (ids.has(provider.id)) throw new TypeError("duplicate object provider id");
    if (provider.storage_location && storageLocations.has(provider.storage_location)) {
      throw new TypeError("duplicate object storage location");
    }
    ids.add(provider.id);
    if (provider.storage_location) storageLocations.add(provider.storage_location);
    return provider;
  });

  function eligible(max_cost) {
    if (max_cost !== 0) {
      throw new TypeError("v0 requires max_cost: 0 (no metered operations)");
    }
    return registered.filter((provider) => provider.billing === "none");
  }

  return Object.freeze({
    providers() {
      return registered.map(({ id, billing }) => ({ id, billing }));
    },

    async putObject(bytes, { min_replicas = 1, max_cost = 0 } = {}) {
      const data = normalizeBytes(bytes);
      if (!Number.isSafeInteger(min_replicas) || min_replicas < 1) {
        throw new TypeError("min_replicas must be an integer >= 1");
      }
      const candidates = eligible(max_cost);
      const ref = hashObject(data);
      // Never write a partial set if the minimum is impossible even on paper.
      if (min_replicas > candidates.length) {
        throw new ObjectReplicationError(ref, min_replicas, [], []);
      }

      const copies = [];
      const attempts = [];
      for (const provider of candidates) {
        try {
          await provider.put(ref, data);
          // Remote SSH peers can verify bytes on their own authenticated disk,
          // avoiding an expensive complete download purely for read-back.
          // Ordinary providers still return full bytes for local verification.
          if (typeof provider.verify === "function") {
            const proof = await provider.verify(ref);
            if (!proof || proof.verified !== true || proof.ref !== ref ||
                proof.size_bytes !== data.length) {
              throw new Error("stored_object_integrity_mismatch");
            }
          } else {
            const observed = await provider.get(ref);
            if (!(observed instanceof Uint8Array) || hashObject(observed) !== ref) {
              throw new Error("stored_object_integrity_mismatch");
            }
          }
          copies.push(provider.id);
        } catch (error) {
          attempts.push({ provider: provider.id, error: safeReason(error) });
        }
        if (copies.length >= min_replicas) break;
      }
      if (copies.length < min_replicas) {
        throw new ObjectReplicationError(ref, min_replicas, copies, attempts);
      }
      return Object.freeze({
        schema: "magistral.object-custody/v0",
        ref,
        size_bytes: data.length,
        verified_copies: copies,
        required_copies: min_replicas,
        max_cost: 0,
      });
    },

    async getObject(ref, { max_cost = 0 } = {}) {
      assertObjectRef(ref);
      const attempts = [];
      for (const provider of eligible(max_cost)) {
        try {
          const bytes = await provider.get(ref);
          if (bytes === null) {
            attempts.push({ provider: provider.id, error: "not_present" });
            continue;
          }
          if (!(bytes instanceof Uint8Array) || hashObject(bytes) !== ref) {
            throw new Error("object_integrity_mismatch");
          }
          return Object.freeze({
            ref,
            bytes: Buffer.from(bytes),
            provider: provider.id,
            verified: true,
          });
        } catch (error) {
          attempts.push({ provider: provider.id, error: safeReason(error) });
        }
      }
      throw new ObjectUnavailableError(ref, attempts);
    },
  });
}

function normalizeBytes(data) {
  if (!(data instanceof Uint8Array)) {
    throw new TypeError("object bytes must be a Buffer or Uint8Array");
  }
  // Own immutable copy: a caller must not mutate one provider's input while
  // subsequent replicas are being written.
  return Buffer.from(data);
}

function safeReason(error) {
  // Never leak provider credentials or raw storage endpoints through receipts.
  // Detailed internal exceptions remain available through the provider's logs.
  if (error?.code === "ENOENT") return "not_present";
  if (error?.code === "ENOSPC") return "no_space";
  if (error?.code === "EACCES" || error?.code === "EPERM") return "access_denied";
  if (error?.message === "stored_object_integrity_mismatch") return "integrity_mismatch";
  if (error?.message === "object_integrity_mismatch") return "integrity_mismatch";
  if (error?.code === "object_integrity_mismatch") return "integrity_mismatch";
  if (error?.code === "object_exceeds_limit") return "object_exceeds_limit";
  return "provider_error";
}
