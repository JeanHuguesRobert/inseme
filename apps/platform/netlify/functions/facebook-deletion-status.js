// netlify/functions/facebook-deletion-status.js
import { loadInstanceConfig, getConfig } from "../../common/config/instanceConfig.backend.js";

export const handler = async (event) => {
  try {
    // Charger la configuration
    await loadInstanceConfig();
    const SUPABASE_URL = getConfig("supabase_url");
    const SUPABASE_SERVICE_ROLE_KEY = getConfig("supabase_service_role_key");

    const code = (event.queryStringParameters && event.queryStringParameters.code) || null;
    if (!code) {
      return { statusCode: 400, body: JSON.stringify({ error: "code parameter required" }) };
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Server misconfigured: SUPABASE_URL or service key missing",
        }),
      };
    }

    // Try to find the user by querying the JSON metadata for the confirmation code
    const url = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/users?select=id,metadata&metadata->facebook_data_deletion->>confirmation_code=eq.${encodeURIComponent(
      code
    )}`;

    let res = await fetch(url, {
      method: "GET",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    if (!res.ok) {
      const txt = await res.text();
      console.warn("Supabase query failed, status", res.status, txt);
      return { statusCode: 502, body: JSON.stringify({ error: "Upstream query failed" }) };
    }

    const users = await res.json();
    if (!Array.isArray(users) || users.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: "Not found" }) };
    }

    const metadata = users[0].metadata || {};
    const entry = metadata.facebook_data_deletion || null;
    if (!entry) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "No deletion entry for this code" }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    };
  } catch (err) {
    console.error("facebook-deletion-status error", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
