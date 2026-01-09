import { loadInstanceConfig, getConfig } from "../../common/config/instanceConfig.backend.js";

export const handler = async function (event) {
  const params = event.queryStringParameters || {};
  const facebookId = params.facebookId || params.id;

  if (!facebookId) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "facebookId query parameter is required" }),
    };
  }

  // Load instance config

  await loadInstanceConfig();

  const appId = getConfig("facebook_app_id");
  const clientSecret = getConfig("facebook_app_client_secret");
  const token = configToken || (appId && clientSecret ? `${appId}|${clientSecret}` : null);

  if (!token) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "No Facebook token configured on server" }),
    };
  }

  try {
    // Use the Graph API to get a non-redirecting picture URL
    const graphUrl = `https://graph.facebook.com/v17.0/${encodeURIComponent(
      facebookId
    )}/picture?redirect=false&height=320&width=320&access_token=${encodeURIComponent(token)}`;

    const res = await fetch(graphUrl);
    const data = await res.json();

    if (!res.ok) {
      return {
        statusCode: res.status || 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: data.error || "Facebook API error", details: data }),
      };
    }

    if (data && data.data && data.data.url) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: data.data.url,
          width: data.data.width,
          height: data.data.height,
        }),
      };
    }

    return {
      statusCode: 404,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "No picture found" }),
    };
  } catch (err) {
    console.error("facebook-avatar error", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
