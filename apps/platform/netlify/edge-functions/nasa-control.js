const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function subjects(value) {
  return new Set(
    String(value || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

async function loadVaultConfig() {
  const config = await import("@inseme/cop-host/config/instanceConfig.edge.js");
  await config.loadInstanceConfig();
  return { config };
}

function vaultValue(config, name) {
  const value = config.getConfig(name, undefined, "jhn");
  return typeof value === "string" ? value.trim() : "";
}

function bearerToken(request) {
  const value = request.headers.get("authorization") || "";
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

export default async function nasaControl(request) {
  if (request.method !== "GET" && request.method !== "POST") {
    return response({ error: "method_not_allowed" }, 405);
  }

  const token = bearerToken(request);
  if (!token) return response({ error: "missing_bearer_token" }, 401);

  let vault;
  try {
    vault = await loadVaultConfig();
  } catch (error) {
    console.error("NASA vault configuration failed", { message: error?.message });
    return response({ error: "nasa_vault_unavailable" }, 503);
  }

  const supabase = vault.config.newSupabase(true);
  if (!supabase) return response({ error: "jhn_auth_not_configured" }, 503);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return response({ error: "invalid_session" }, 401);

  const operators = subjects(vaultValue(vault.config, "NASA_OPERATOR_SUBJECTS"));
  const principal = vaultValue(vault.config, "NASA_PRINCIPAL_SUBJECT");
  if (!principal) {
    return response({ error: "principal_subject_unconfigured" }, 503);
  }
  const accessClass =
    data.user.id === principal ? "principal" : operators.has(data.user.id) ? "delegate" : null;
  if (!accessClass) {
    return response({ authenticated: true, authorized: false }, 403);
  }

  if (request.method === "POST") {
    // This deliberate no-op prevents an authenticated UI from becoming an accidental action plane.
    return response({ error: "action_bridge_not_configured" }, 501);
  }

  return response({
    authenticated: true,
    authorized: true,
    access_class: accessClass,
    action_bridge: "not_configured",
  });
}
