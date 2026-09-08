/**
 * Transport adapter for a FractaLog local outbox.
 *
 * It deliberately knows no Supabase credentials: the local node speaks to the
 * instance ingress using its dedicated capability, and only an accepted receipt
 * lets the SQLite outbox mark a document delivered.
 */

function requireText(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} is required`);
  }
  return value;
}

export function createFractalogHttpIngress({ url, capability, fetchImpl = globalThis.fetch } = {}) {
  requireText(url, "url");
  requireText(capability, "capability");
  if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl is required");

  return async function ingress(record) {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${capability}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(record),
    });
    let body = null;
    try {
      body = await response.json();
    } catch {
      // The caller distinguishes an unavailable/rejected transport from a receipt.
    }
    if (!response.ok || body?.accepted !== true) {
      return {
        accepted: false,
        status: response.status,
        error: body?.error || "fractalog_ingress_rejected",
      };
    }
    if (
      body.record_id !== record.record_id ||
      body.document_hash !== record.integrity?.document_hash
    ) {
      return { accepted: false, status: response.status, error: "fractalog_receipt_mismatch" };
    }
    return body;
  };
}
