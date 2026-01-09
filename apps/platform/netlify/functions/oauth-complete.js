import { PROVIDERS } from "../edge-functions/lib/lib/oauthProviders.js";
import fetch from "node-fetch"; // Netlify Functions environment usually has node-fetch or global fetch in Node 18+
import { createClient } from "@supabase/supabase-js";
import { loadInstanceConfig, getConfig } from "../../common/config/instanceConfig.backend.js";

// Helper to exchange code for token
async function exchangeCodeForToken(providerConf, code, redirectUri) {
  const params = new URLSearchParams({
    client_id: getConfig(providerConf.clientIdEnv.toLowerCase().replace(/_/g, "_")),
    client_secret: getConfig(providerConf.clientSecretEnv.toLowerCase().replace(/_/g, "_")),
    code,
    redirect_uri: redirectUri,
  });

  if (providerConf.name === "Google") {
    params.append("grant_type", "authorization_code");
    params.append("redirect_uri", redirectUri);
  }

  const response = await fetch(providerConf.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: params,
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(
      "[oauth-complete] token exchange failed for provider",
      providerConf.name,
      "redirectUri:",
      redirectUri,
      "response:",
      text
    );
    throw new Error(`Failed to exchange token: ${text}`);
  }

  return response.json();
}

// Helper to fetch profile
async function fetchProfile(providerConf, tokenData) {
  const accessToken = tokenData.access_token;
  const url = providerConf.profileUrl || providerConf.userInfoUrl;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch user profile");
  }

  return response.json();
}

// (previous storeAvatarForUser implementation removed - logic moved inline to use SUPABASE_SERVICE_ROLE_KEY to update metadata)

export const handler = async (event) => {
  // Charger la configuration
  await loadInstanceConfig();

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { provider, code, userId: postedUserId, state } = JSON.parse(event.body);
    const conf = PROVIDERS[provider];

    if (!conf) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid provider" }),
      };
    }

    const appBaseUrl = getConfig("app_base_url", "http://localhost:8888");
    // Prefer the redirectUri stored in user metadata at oauth-start, if present. This ensures
    // the token exchange uses the exact same redirect_uri used in the authorize request.
    let redirectUri = `${appBaseUrl}${conf.redirectPath}`;

    // 0. Parse Authorization header and validate Supabase session token
    const authHeader =
      (event.headers && (event.headers.authorization || event.headers.Authorization)) || "";
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { statusCode: 401, body: JSON.stringify({ error: "Authorization header required" }) };
    }
    const accessToken = authHeader.split(" ")[1];

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
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (userErr || !userData?.user) {
      return { statusCode: 401, body: JSON.stringify({ error: "Invalid Supabase session" }) };
    }
    const userId = userData.user.id; // canonical user id
    if (postedUserId && postedUserId !== userId) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "userId does not match authenticated session" }),
      };
    }

    // 1. Validate state stored in user metadata
    try {
      const { data: existingUser, error: getErr } = await supabaseAdmin
        .from("users")
        .select("metadata")
        .eq("id", userId)
        .maybeSingle();
      if (getErr) {
        console.error("Failed to fetch user metadata", getErr);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: "Failed to fetch user metadata" }),
        };
      }
      const metadata = (existingUser && existingUser.metadata) || {};
      const oauthMeta = metadata.oauth && metadata.oauth[provider];
      if (!oauthMeta || oauthMeta.state !== state) {
        // Invalid/missing state: do not expose metadata details to clients
        return {
          statusCode: 400,
          body: JSON.stringify({
            error:
              "Invalid or missing state - ensure you started the OAuth flow while signed-in in the same tab/session",
          }),
        };
      }
      if (!oauthMeta.expiresAt || new Date(oauthMeta.expiresAt) < new Date()) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "State expired - please start the OAuth process again" }),
        };
      }
      // If a redirectUri was saved at start time, use it for token exchange. This avoids
      // mismatches caused by APP_BASE_URL differences or different runtime environments.
      if (oauthMeta && oauthMeta.redirectUri) {
        if (oauthMeta.redirectUri !== `${appBaseUrl}${conf.redirectPath}`) {
          console.warn(
            "[oauth-complete] Using saved redirectUri from metadata differs from constructed appBaseUrl redirect; saved:",
            oauthMeta.redirectUri,
            "constructed:",
            `${appBaseUrl}${conf.redirectPath}`
          );
        }
        redirectUri = oauthMeta.redirectUri;
      }
    } catch (err) {
      console.error("Error validating state", err);
      return { statusCode: 500, body: JSON.stringify({ error: "Error validating state" }) };
    }

    // 2. Exchange code for token
    const tokenData = await exchangeCodeForToken(conf, code, redirectUri);

    // 2. Fetch profile
    const profile = await fetchProfile(conf, tokenData);

    // 3. Map and normalize
    const { providerUserId, username, rawAvatarUrl } = conf.mapProfile(profile);
    const normalizedAvatarUrl = conf.normalizeAvatarUrl(rawAvatarUrl);

    // 4. Store/Update metadata: facebookId + avatarUrl; remove oauth state
    const supabaseWrite = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    try {
      const { data: existingUser, error: getErr } = await supabaseWrite
        .from("users")
        .select("metadata")
        .eq("id", userId)
        .maybeSingle();
      if (getErr) {
        console.error("Failed to fetch user metadata for update", getErr);
      }
      const metadata = (existingUser && existingUser.metadata) || {};
      // Remove oauth state for provider
      if (metadata.oauth) {
        delete metadata.oauth[provider];
      }
      metadata.avatarUrl = normalizedAvatarUrl;
      metadata.facebookId = username || providerUserId;
      // mark consent grantedAt
      metadata.facebook_consent = metadata.facebook_consent || {};
      metadata.facebook_consent.grantedAt = new Date().toISOString();
      const { data: upd, error: updErr } = await supabaseWrite
        .from("users")
        .update({ metadata })
        .eq("id", userId)
        .select()
        .maybeSingle();
      if (updErr) {
        console.error("Failed to persist avatar metadata:", updErr);
      }
    } catch (err) {
      console.error("Error persisting metadata:", err);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        avatarUrl: normalizedAvatarUrl,
        sourceType: provider,
        sourceValue: username || providerUserId,
      }),
    };
  } catch (error) {
    console.error("OAuth Complete Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
