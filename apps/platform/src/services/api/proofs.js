import { wrapFetch } from "../wrapFetch.js";

export async function createProof(payload, { token } = {}) {
  // payload: { type, storage_url, original_filename, hash_sha256, date_emission?, date_reception? }
  return wrapFetch("/api/proofs", { method: "POST", token, body: JSON.stringify(payload) });
}

export async function linkProof(payload, { token } = {}) {
  // payload: { proof_id, entity_type, entity_id, role }
  return wrapFetch("/api/proof-links", { method: "POST", token, body: JSON.stringify(payload) });
}

export async function verifyProof(proofId, { token } = {}) {
  return wrapFetch(`/api/proofs/${proofId}/verify`, { method: "POST", token });
}
