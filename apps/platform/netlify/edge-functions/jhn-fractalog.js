const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH = /^sha256:[0-9a-f]{64}$/;
const PHASES = new Set(["attempt", "committed", "failed", "refused", "observed"]);

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function bearerToken(request) {
  return request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] || null;
}

async function loadVaultConfig() {
  const config = await import("@inseme/cop-host/config/instanceConfig.edge.js");
  const table = await config.loadInstanceConfig();
  return { config, table };
}

function vaultValue(table, name) {
  const row = table[String(name).trim().toLowerCase()];
  const value = row?.value_json ?? row?.value;
  return typeof value === "string" ? value.trim() : "";
}

/** Keeps edge validation transport-safe; canonical hash verification remains in COP-core before send. */
export function validateFractalogIngressRecord(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return false;
  return (
    record.schema === "fractalog.act-record/v1" &&
    typeof record.record_id === "string" &&
    record.record_id.length > 0 &&
    typeof record.act_id === "string" &&
    record.act_id.length > 0 &&
    typeof record.act_kind === "string" &&
    record.act_kind.length > 0 &&
    PHASES.has(record.act_phase) &&
    UUID.test(record.owner_instance_id || "") &&
    (record.on_behalf_of_instance_id == null || UUID.test(record.on_behalf_of_instance_id)) &&
    typeof record.time?.recorded_at === "string" &&
    !Number.isNaN(Date.parse(record.time.recorded_at)) &&
    HASH.test(record.integrity?.document_hash || "")
  );
}

export default async function jhnFractalog(request) {
  if (request.method !== "POST") return response({ error: "method_not_allowed" }, 405);

  let vault;
  try {
    vault = await loadVaultConfig();
  } catch (error) {
    console.error("JHN FractaLog vault configuration failed", { message: error?.message });
    return response({ error: "fractalog_vault_unavailable" }, 503);
  }
  const capability = vaultValue(vault.table, "JHN_FRACTALOG_CAPABILITY");
  if (!capability) return response({ error: "fractalog_ingress_unconfigured" }, 503);
  if (bearerToken(request) !== capability) {
    return response({ error: "invalid_fractalog_capability" }, 401);
  }

  let record;
  try {
    record = await request.json();
  } catch {
    return response({ error: "invalid_json" }, 400);
  }
  if (!validateFractalogIngressRecord(record)) {
    return response({ error: "invalid_fractalog_record" }, 400);
  }

  const supabase = vault.config.newSupabase(true);
  if (!supabase) return response({ error: "fractalog_store_unconfigured" }, 503);
  const { data, error } = await supabase.rpc("fractalog_append", { p_document: record });
  if (error) {
    console.error("JHN FractaLog append failed", { message: error.message });
    return response({ error: "fractalog_append_failed" }, 502);
  }

  return response(
    {
      accepted: true,
      schema: "fractalog.ingress.receipt/v1",
      receipt_id: `fractalog:${data?.record_id || record.record_id}:${data?.document_hash || record.integrity.document_hash}`,
      record_id: data?.record_id || record.record_id,
      document_hash: data?.document_hash || record.integrity.document_hash,
      accepted_at: data?.accepted_at || null,
    },
    201
  );
}

export const config = { path: "/api/jhn-fractalog" };
