import { PROVIDERS } from "../edge-functions/lib/lib/oauthProviders.js";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { loadInstanceConfig, getConfig } from "../../common/config/instanceConfig.backend.js";

export const handler = async (event) => {
  // Charger la configuration
  await loadInstanceConfig();

  const { provider } = event.queryStringParameters;
  const conf = PROVIDERS[provider];

  if (!conf) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid provider" }),
    };
  }

  const appBaseUrl = getConfig("app_base_url", "http://localhost:8888");
  const redirectUri = `${appBaseUrl}${conf.redirectPath}`;

  // Enforce Authorization header (Supabase session access token)
  const authHeader =
    (event.headers && (event.headers.authorization || event.headers.Authorization)) || "";
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { statusCode: 401, body: JSON.stringify({ error: "Authorization header required" }) };
  }
  const accessToken = authHeader.split(" ")[1];

  // Validate session token and extract user id
  const SUPABASE_URL = getConfig("supabase_url");
  const SUPABASE_SERVICE_ROLE_KEY = getConfig("supabase_service_role_key");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Server misconfigured: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing",
      }),
    };
  }
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  let sessionUserId;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
    if (error || !data?.user) {
      return { statusCode: 401, body: JSON.stringify({ error: "Invalid Supabase session token" }) };
    }
    sessionUserId = data.user.id;
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to validate Supabase session token" }),
    };
  }

  // Generate secure random state and persist in user's metadata under metadata.oauth.<provider>
  const state = crypto.randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString(); // 1 hour
  try {
    // Read existing metadata
    const { data: existingUser, error: getErr } = await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("id", sessionUserId)
      .maybeSingle();
    if (getErr) {
      console.error("Failed to fetch user metadata", getErr);
      return { statusCode: 500, body: JSON.stringify({ error: "Failed to fetch user metadata" }) };
    }
    const metadata = (existingUser && existingUser.metadata) || {};
    metadata.oauth = metadata.oauth || {};
    metadata.oauth[provider] = { state, createdAt: now.toISOString(), expiresAt, redirectUri };
    // Log the user consent request for this provider (last consent request timestamp and scopes)
    const providerScopes = conf.scopes || [];
    metadata[`${provider}_consent`] = {
      scopes: providerScopes,
      requestedAt: now.toISOString(),
    };
    const { error: updateErr } = await supabaseAdmin
      .from("users")
      .update({ metadata })
      .eq("id", sessionUserId);
    if (updateErr) {
      console.error("Failed to persist oauth state", updateErr);
      return { statusCode: 500, body: JSON.stringify({ error: "Failed to persist oauth state" }) };
    }
    // Debug logging removed in production; saving state persisted to user metadata
  } catch (err) {
    console.error("Failed to persist oauth state", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Failed to persist oauth state" }) };
  }

  // Get client_id using the config key format (e.g., GITHUB_CLIENT_ID -> github_client_id)
  const clientIdConfigKey = conf.clientIdEnv.toLowerCase();
  const params = new URLSearchParams({
    client_id: getConfig(clientIdConfigKey),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: conf.scopes.join(" "),
    state: state,
  });

  // Google requires access_type=offline to get refresh token if needed,
  // but for just avatar we might not need it.
  // However, include_granted_scopes=true is good practice for Google.
  if (provider === "google") {
    params.append("include_granted_scopes", "true");
  }

  const authUrl = `${conf.authorizeUrl}?${params.toString()}`;
  // Removed debug logs; authUrl is returned to client in response

  return {
    statusCode: 200,
    body: JSON.stringify({ authUrl }),
  };
};
