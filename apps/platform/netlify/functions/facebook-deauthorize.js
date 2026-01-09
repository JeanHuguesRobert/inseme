import crypto from "crypto";
import { loadInstanceConfig, getConfig } from "../../common/config/instanceConfig.backend.js";

// Variables initialisées après loadInstanceConfig
let APP_SECRET = null;
let APP_BASE_URL = null;

function base64UrlDecode(input) {
  input = input.replace(/-/g, "+").replace(/_/g, "/");
  while (input.length % 4) input += "=";
  return Buffer.from(input, "base64");
}

function parseSignedRequest(signedRequest) {
  const [encodedSig, payload] = signedRequest.split(".");
  if (!encodedSig || !payload) return null;

  const sig = base64UrlDecode(encodedSig);
  const dataBuf = base64UrlDecode(payload);
  let data;
  try {
    data = JSON.parse(dataBuf.toString("utf8"));
  } catch (e) {
    return null;
  }

  if (!APP_SECRET) {
    console.error("FACEBOOK_CLIENT_SECRET not set; rejecting deauthorize requests");
    return null;
  }

  const expected = crypto.createHmac("sha256", APP_SECRET).update(payload).digest();
  if (!crypto.timingSafeEqual(sig, expected)) {
    return null;
  }

  return data;
}

export const handler = async (event) => {
  // Charger la configuration
  await loadInstanceConfig();
  APP_SECRET = getConfig("facebook_client_secret");
  APP_BASE_URL = getConfig("app_base_url", "http://localhost:8888");

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  if (!APP_SECRET) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server misconfigured: FACEBOOK_CLIENT_SECRET missing" }),
    };
  }

  try {
    const ct = event.headers["content-type"] || event.headers["Content-Type"] || "";
    let signedRequest = null;
    if (ct.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(event.body);
      signedRequest = params.get("signed_request");
    } else {
      const body = JSON.parse(event.body || "{}");
      signedRequest = body.signed_request;
    }

    if (!signedRequest) {
      return { statusCode: 400, body: JSON.stringify({ error: "signed_request missing" }) };
    }

    const data = parseSignedRequest(signedRequest);
    if (!data) {
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid signed_request" }) };
    }

    const userId = data.user_id || data.user?.id || null;
    console.log("Facebook deauthorize for user:", userId, "payload:", data);

    const SUPABASE_URL = getConfig("supabase_url");
    const SUPABASE_SERVICE_ROLE_KEY = getConfig("supabase_service_role_key");

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && userId) {
      try {
        const possibleKeys = ["facebook_id", "facebookId", "fb_id", "facebook_user_id"];
        let foundUser = null;

        for (const key of possibleKeys) {
          const q = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/users?select=id,metadata&metadata->>${encodeURIComponent("'" + key + "'")}=eq.${encodeURIComponent(
            userId
          )}`;
          const q2 = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/users?select=id,metadata&metadata->>%22${key}%22=eq.${encodeURIComponent(userId)}`;

          let res = await fetch(q, {
            method: "GET",
            headers: {
              apikey: SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
          });

          if (!res.ok) {
            res = await fetch(q2, {
              method: "GET",
              headers: {
                apikey: SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              },
            });
          }

          if (res.ok) {
            const users = await res.json();
            if (Array.isArray(users) && users.length > 0) {
              foundUser = users[0];
              break;
            }
          }
        }

        if (foundUser) {
          const existingMetadata = foundUser.metadata || {};
          const existingConsent = existingMetadata.facebook_consent || {};
          if (existingConsent.revokedAt) {
            console.log("User already revoked Facebook consent at", existingConsent.revokedAt);
          } else {
            const newMetadata = { ...existingMetadata };
            delete newMetadata.facebookId;
            delete newMetadata.facebook_id;
            delete newMetadata.fb_id;
            delete newMetadata.facebook_user_id;
            delete newMetadata.avatarUrl;
            delete newMetadata.avatar_url;
            const consent =
              newMetadata.facebook_consent && typeof newMetadata.facebook_consent === "object"
                ? newMetadata.facebook_consent
                : {};
            consent.revokedAt = new Date().toISOString();
            newMetadata.facebook_consent = consent;

            const patchUrl = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/users?id=eq.${encodeURIComponent(foundUser.id)}`;
            const patchRes = await fetch(patchUrl, {
              method: "PATCH",
              headers: {
                apikey: SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                "Content-Type": "application/json",
                Prefer: "return=representation",
              },
              body: JSON.stringify({ metadata: newMetadata }),
            });

            if (!patchRes.ok) {
              const txt = await patchRes.text();
              console.error("Failed to update user metadata on deauthorize:", txt);
            } else {
              console.log("Cleared Facebook metadata for user id", foundUser.id);
            }
          }
        } else {
          console.log("No matching Supabase user found for facebook id", userId);
        }
      } catch (err) {
        console.error("Error updating Supabase user metadata on deauthorize:", err);
      }
    } else {
      console.warn("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set, skipping metadata update");
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (error) {
    console.error("facebook-deauthorize error", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
