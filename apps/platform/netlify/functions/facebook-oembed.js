// Returns Facebook oEmbed for a given post URL using App access token
// Uses vault config for Facebook credentials (with env var fallback)
// ES Module (Node) version: top-level imports for `node-fetch` and `cheerio`.
import fetch from "node-fetch";
import { load } from "cheerio";
import { loadInstanceConfig, getConfig } from "../../common/config/instanceConfig.backend.js";

function parseUrl(raw) {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

export function isFacebookDomain(rawUrl) {
  const u = parseUrl(rawUrl);
  if (!u) return false;
  const h = u.hostname.toLowerCase();
  return h === "facebook.com" || h.endsWith(".facebook.com");
}

export function isFacebookGroupPostUrl(rawUrl) {
  const u = parseUrl(rawUrl);
  if (!u || !isFacebookDomain(u)) return false;
  const segments = u.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  return segments[0] === "groups" && segments.includes("posts");
}

export function isPotentiallyEmbeddableFacebookPostUrl(rawUrl) {
  const u = parseUrl(rawUrl);
  if (!u || !isFacebookDomain(u)) return false;
  const segments = u.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  if (segments.length === 0) return false;
  if (segments[0] === "groups") return false; // groups are generally not embeddable via oEmbed
  // match common /{page}/posts/{id} or /{page}/permalink/{id}
  return (
    segments.includes("posts") ||
    segments.includes("permalink") ||
    /posts|permalink/.test(u.pathname)
  );
}

function getMeta($, property) {
  return (
    $(`meta[property="${property}"]`).attr("content") ||
    $(`meta[name="${property}"]`).attr("content") ||
    undefined
  );
}

export async function generateLinkPreview(targetUrl) {
  const res = await fetch(targetUrl, {
    headers: {
      // Important pour certains sites, dont Facebook
      "User-Agent": "Mozilla/5.0 (compatible; LinkPreviewBot/1.0)",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch URL: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();

  const $ = load(html);

  const ogTitle = getMeta($, "og:title");
  const ogDescription = getMeta($, "og:description");
  const ogImage = getMeta($, "og:image");
  const ogSiteName = getMeta($, "og:site_name");

  const title = ogTitle || $("title").text().trim() || targetUrl;
  const description = ogDescription || getMeta($, "description") || "";

  // favicon de base
  const favicon = $('link[rel="icon"]').attr("href") || $('link[rel="shortcut icon"]').attr("href");

  return {
    url: targetUrl,
    title,
    description,
    image: ogImage,
    siteName: ogSiteName,
    favicon,
  };
}

export const handler = async (event) => {
  try {
    const url = event.queryStringParameters?.url;
    if (!url) return { statusCode: 400, body: JSON.stringify({ error: "Missing url parameter" }) };

    const preview = await generateLinkPreview(url);

    // If not embeddable, return link preview info
    if (!isPotentiallyEmbeddableFacebookPostUrl(url)) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({
          embed_available: false,
          is_fb_post: false,
          url,
          preview,
          message: "URL not embeddable; show link preview",
        }),
      };
    }

    // Load instance config
    await loadInstanceConfig();

    const appId = getConfig("facebook_app_id");
    const clientSecret = getConfig("facebook_app_client_secret");
    const explicitToken = getConfig("facebook_app_access_token");
    const access_token =
      explicitToken || (appId && clientSecret ? `${appId}|${clientSecret}` : null);
    if (!access_token)
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Facebook app credentials not configured" }),
      };

    const oembedUrl = `https://graph.facebook.com/v17.0/oembed_post?url=${encodeURIComponent(url)}&access_token=${encodeURIComponent(access_token)}&omitscript=true`;
    const resp = await fetch(oembedUrl, { method: "GET" });

    const text = await resp.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }

    // diagnostic log for function logs
    console.log("facebook-oembed:", { url, fb_status: resp.status, fb_body: parsed });

    // Success: return oEmbed payload
    if (resp.ok) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
        body: typeof parsed === "string" ? parsed : JSON.stringify(parsed),
      };
    }

    // FB returned an error (expired token, not embeddable, etc.)
    // Return 200 so the frontend can show a normal link; include fb error for console/logging.
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({
        embed_available: false,
        url,
        is_fb_post: true,
        fb_status: resp.status,
        fb_body: parsed,
        message: "oEmbed unavailable; show link fallback",
        preview,
      }),
    };
  } catch (err) {
    console.error("facebook-oembed handler error", err);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({
        embed_available: false,
        url: event.queryStringParameters?.url || null,
        is_fb_post: true,
        error: err.message,
        message: "Handler error; show link fallback",
        preview,
      }),
    };
  }
};
