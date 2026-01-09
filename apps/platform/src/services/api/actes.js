import { wrapFetch } from "../wrapFetch.js";

export async function listActes({ limit = 20, offset = 0, token } = {}) {
  const q = new URLSearchParams({ limit, offset });
  return wrapFetch(`/api/actes?${q.toString()}`, { token });
}

export async function getActe(id, { token } = {}) {
  return wrapFetch(`/api/actes/${id}`, { token });
}

export async function createActe(payload, { token } = {}) {
  return wrapFetch("/api/actes", { method: "POST", token, body: JSON.stringify(payload) });
}

export async function updateActe(id, payload, { token } = {}) {
  return wrapFetch(`/api/actes/${id}`, { method: "PUT", token, body: JSON.stringify(payload) });
}
