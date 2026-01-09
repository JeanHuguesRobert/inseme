import crypto from "crypto";
import { loadInstanceConfig, getConfig } from "../../common/config/instanceConfig.backend.js";

// Variables initialisées après loadInstanceConfig
let APP_BASE_URL = null;
let APP_SECRET = null;

function base64UrlDecode(input) {
  input = input.replace(/-/g, "+").replace(/_/g, "/");
  // Pad with '='
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
    // Do not accept unsigned requests; require secret for verification
    console.error("FACEBOOK_CLIENT_SECRET not set; rejecting data deletion requests");
    return null;
  }

  const expected = crypto.createHmac("sha256", APP_SECRET).update(payload).digest();
  // timing-safe compare
  if (!crypto.timingSafeEqual(sig, expected)) {
    return null;
  }

  return data;
}

export const handler = async (event) => {
  // Charger la configuration
  await loadInstanceConfig();
  APP_BASE_URL = getConfig("app_base_url", "http://localhost:8888");
  APP_SECRET = getConfig("facebook_client_secret");

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
    // Facebook sends application/x-www-form-urlencoded with signed_request param
    const ct = event.headers["content-type"] || event.headers["Content-Type"] || "";
    let signedRequest = null;
    if (ct.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(event.body);
      signedRequest = params.get("signed_request");
    } else {
      // Try JSON body
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

    // Generate a confirmation code (we may reuse an existing one for idempotency)
    const confirmationCode = crypto.randomBytes(12).toString("hex");
    let confirmationToReturn = confirmationCode;

    console.log("Facebook data deletion request for user:", userId, "payload:", data);

    // Try to find a matching user in the project's `users` table using common metadata keys
    const SUPABASE_URL = getConfig("supabase_url");
    const SUPABASE_SERVICE_ROLE_KEY = getConfig("supabase_service_role_key");

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && userId) {
      try {
        const possibleKeys = ["facebook_id", "facebookId", "fb_id", "facebook_user_id"];
        let foundUser = null;

        for (const key of possibleKeys) {
          const q = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/users?select=id,metadata&metadata->>${encodeURIComponent("'" + key + "'")}=eq.${encodeURIComponent(userId)}`;
          // Some PostgREST setups accept metadata->>key=eq.value without quotes — also try that
          const q2 = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/users?select=id,metadata&metadata->>%22${key}%22=eq.${encodeURIComponent(
            userId
          )}`;

          // Try first variant
          let res = await fetch(q, {
            method: "GET",
            headers: {
              apikey: SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
          });

          if (!res.ok) {
            // try second variant
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
          // Merge deletion status into metadata (idempotent): if there's already an entry
          // with a confirmation_code, reuse it instead of creating a new one.
          const existingMetadata = foundUser.metadata || {};
          if (
            existingMetadata.facebook_data_deletion &&
            existingMetadata.facebook_data_deletion.confirmation_code
          ) {
            // Reuse existing confirmation code and requested_at, keep it idempotent
            confirmationToReturn = existingMetadata.facebook_data_deletion.confirmation_code;
            console.log(
              "Reusing existing facebook_data_deletion confirmation code",
              confirmationToReturn
            );
          } else {
            const deletionEntry = {
              facebook_data_deletion: {
                status: "requested",
                confirmation_code: confirmationToReturn,
                requested_at: new Date().toISOString(),
                facebook_user_id: userId,
              },
            };
            Object.assign(existingMetadata, deletionEntry);

            const patchUrl = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/users?id=eq.${encodeURIComponent(
              foundUser.id
            )}`;
            const patchRes = await fetch(patchUrl, {
              method: "PATCH",
              headers: {
                apikey: SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                "Content-Type": "application/json",
                Prefer: "return=representation",
              },
              body: JSON.stringify({ metadata: existingMetadata }),
            });

            if (!patchRes.ok) {
              const txt = await patchRes.text();
              console.error("Failed to update user metadata:", txt);
            } else {
              console.log("Updated user metadata for user id", foundUser.id);
            }
          }
        } else {
          console.log("No matching user found for facebook id", userId);
        }
      } catch (err) {
        console.error("Error updating Supabase user metadata:", err);
      }
    } else {
      console.warn("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set, skipping metadata update");
    }

    // Build the status url based on what confirmation code we're returning
    const statusUrl = `${APP_BASE_URL.replace(/\/$/, "")}/oauth/facebook/deletion-status?code=${confirmationToReturn}`;
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: statusUrl, confirmation_code: confirmationToReturn }),
    };
  } catch (error) {
    console.error("facebook-data-deletion error", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
