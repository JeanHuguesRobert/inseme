import { loadInstanceConfig, getConfig } from "../../common/config/instanceConfig.backend.js";

export const handler = async (event) => {
  // Charger la configuration
  await loadInstanceConfig();

  const secret = getConfig("ngrok_control_secret");
  const SUPABASE_URL = getConfig("supabase_url");
  const SERVICE_KEY = getConfig("supabase_service_role_key");

  const auth =
    (event.headers && (event.headers.authorization || event.headers.Authorization)) || "";
  if (!secret || !auth || !auth.startsWith("Bearer ") || auth.split(" ")[1] !== secret) {
    return { statusCode: 401, body: "Unauthorized" };
  }

  // optional: update a small _last_refresh_ts to help instances pick up changes
  if (SUPABASE_URL && SERVICE_KEY) {
    try {
      // find first user id
      const usersRes = await fetch(`${SUPABASE_URL}/rest/v1/users?select=id&limit=1`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
      const users = await usersRes.json();
      if (users && users.length) {
        const id = users[0].id;
        const now = Date.now();
        const body = { metadata: { site_config: { _last_refresh_ts: now } } };
        await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${id}`, {
          method: "PATCH",
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify(body),
        });
      }
    } catch (e) {
      // ignore patch failure; still return success for control call
    }
  }

  return { statusCode: 200, body: "ok" };
};
