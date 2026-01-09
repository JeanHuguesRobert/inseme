import { wrapFetch } from "../wrapFetch.js";

export async function listDemandes({ limit = 20, offset = 0, token } = {}) {
  const q = new URLSearchParams({ limit, offset });
  return wrapFetch(`/api/demandes?${q.toString()}`, { token });
}

export async function getDemande(id, { token } = {}) {
  return wrapFetch(`/api/demandes/${id}`, { token });
}

export async function createDemande(payload, { token } = {}) {
  return wrapFetch("/api/demandes", { method: "POST", token, body: JSON.stringify(payload) });
}

export async function updateDemande(id, payload, { token } = {}) {
  return wrapFetch(`/api/demandes/${id}`, { method: "PUT", token, body: JSON.stringify(payload) });
}
