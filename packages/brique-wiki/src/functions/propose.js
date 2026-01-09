import {
  loadInstanceConfig,
  newSupabase,
  getConfig,
} from "@inseme/cop-host";
import * as wikiFederation from "../lib/wikiFederation.js";

export default async (req, context) => {
  await loadInstanceConfig();

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    const body = await req.json();
    const slug = body.slug || body.pageKey;
    if (!slug) return new Response(JSON.stringify({ error: "slug required" }), { status: 400 });

    // Ensure page exists locally
    const localSupabase = await newSupabase();
    const { data: local, error: findErr } = await localSupabase
      .from("wiki_pages")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (findErr || !local)
      return new Response(JSON.stringify({ error: "Page not found locally" }), { status: 404 });

    // Mark as proposed upstream locally and optionally notify parent
    // Prefer vault-stored secret (server-side) for secure forwarding
    const parentApiKeyVault = await getConfig("parent_hub_api_key");
    // For security, do NOT trust client-provided API keys. Only use vault-stored keys.
    const parentApiKey = parentApiKeyVault || null;
    const res = await wikiFederation.proposeToParent({
      pageKey: slug,
      notifyParent: !!parentApiKey,
      parentApiKey,
    });
    if (!res?.success) {
      return new Response(JSON.stringify({ error: res?.error || "Could not mark proposed" }), {
        status: 500,
      });
    }

    return new Response(JSON.stringify({ success: true, forwarded: !!res.forwarded }), {
      status: 200,
    });
  } catch (err) {
    console.error("wiki-propose error", err.message || err);
    return new Response(JSON.stringify({ error: err.message || "internal" }), { status: 500 });
  }
};
