import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "https://opnotbjrbphwcezaqgim.supabase.co";
const supabaseKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const origin = Deno.env.get("BRIDGE_ORIGIN") ?? "http://127.0.0.1:8888";
const proxyUrl = `${origin}/.netlify/functions/fetch-proxy`;
const targetUrl = `${supabaseUrl}/rest/v1/instance_config?select=*&limit=1`;

async function testGoogleConnectivity() {
  console.log("=== Direct Deno fetch to https://www.google.com ===");
  try {
    const res = await fetch("https://www.google.com");
    console.log("Google status:", res.status, res.statusText);
  } catch (e) {
    console.error("Google fetch error:", e);
  }
}

async function testDirectBridgeConnectivity() {
  console.log("=== Direct Deno fetch to bridge origin ===");
  console.log("Origin URL:", origin);
  try {
    const res = await fetch(origin);
    console.log("Direct status:", res.status, res.statusText);
  } catch (e) {
    console.error("Direct fetch error:", e);
  }
}

const proxyFetch = async (input: Request | string | URL, init?: RequestInit) => {
  let url: string;
  let options: RequestInit = init ?? {};

  if (typeof input === "string") {
    url = input;
  } else if (input instanceof URL) {
    url = input.toString();
  } else {
    url = input.url;
    options = {
      method: input.method,
      headers: input.headers,
      body: input.body as any,
      ...init,
    };
  }

  const headersObj: Record<string, string> = {};
  if (options.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((v, k) => {
        headersObj[k] = v;
      });
    } else if (Array.isArray(options.headers)) {
      for (const [k, v] of options.headers as any) {
        headersObj[k] = v;
      }
    } else {
      Object.assign(headersObj, options.headers as any);
    }
  }

  const payload = {
    url,
    method: options.method || "GET",
    headers: headersObj,
    body: options.body ?? null,
  };

  const res = await fetch(proxyUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return res;
};

async function testRawProxy() {
  console.log("=== RAW proxy fetch ===");
  console.log("Proxy URL:", proxyUrl);
  console.log("Target URL:", targetUrl);
  console.log("Supabase key prefix:", supabaseKey ? supabaseKey.slice(0, 6) : "none");

  const payload = {
    url: targetUrl,
    method: "GET",
    headers: {
      apikey: supabaseKey,
      Authorization: supabaseKey ? `Bearer ${supabaseKey}` : "",
      "Content-Type": "application/json",
    },
    body: null as string | null,
  };

  try {
    const start = Date.now();
    const res = await fetch(proxyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const duration = Date.now() - start;

    console.log(`✅ Succès ! Durée: ${duration}ms, Status: ${res.status} ${res.statusText}`);
    console.log("Response headers:");
    for (const [k, v] of res.headers.entries()) {
      console.log(`  ${k}: ${v}`);
    }

    const text = await res.text();
    console.log("Body:", text);
  } catch (e) {
    console.error("Proxy fetch error:", e);
  }
}

async function testSupabaseClientViaProxy() {
  console.log("=== Supabase client via proxy fetch ===");

  if (!supabaseUrl || !supabaseKey) {
    console.log("Missing SUPABASE_URL or SUPABASE_*KEY in env");
    return;
  }

  const client = createClient(supabaseUrl, supabaseKey, {
    global: {
      fetch: proxyFetch as any,
    },
  });

  try {
    const { data, error } = await client.from("instance_config").select("*").limit(1);
    console.log("Client error:", error || "none");
    console.log("Client data:", data || "[]");
  } catch (e) {
    console.error("Supabase client via proxy error:", e);
  }
}

async function testSupabaseClientDirect() {
  console.log("=== Supabase client DIRECT (no proxy) ===");

  if (!supabaseUrl || !supabaseKey) {
    console.log("Missing SUPABASE_URL or SUPABASE_*KEY in env");
    return;
  }

  // Client STANDARD sans proxy global
  const client = createClient(supabaseUrl, supabaseKey);

  try {
    const { data, error } = await client.from("instance_config").select("*").limit(1);
    console.log("Direct Client error:", error || "none");
    console.log("Direct Client data:", data ? "OK (got data)" : "[]");
  } catch (e) {
    console.error("Supabase client DIRECT error:", e);
  }
}

await testGoogleConnectivity();
await testDirectBridgeConnectivity();
await testRawProxy();
await testSupabaseClientViaProxy();
await testSupabaseClientDirect();
