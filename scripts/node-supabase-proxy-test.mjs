import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

const origin = process.env.BRIDGE_ORIGIN || "http://127.0.0.1:8888";
const proxyUrl = `${origin}/.netlify/functions/fetch-proxy`;
const targetUrl = `${SUPABASE_URL}/rest/v1/instance_config?select=*&limit=1`;

const proxyFetch = async (input, init = {}) => {
  let url;
  let options = init || {};

  if (typeof input === "string") {
    url = input;
  } else if (input instanceof URL) {
    url = input.toString();
  } else {
    url = input.url;
    options = {
      method: input.method,
      headers: input.headers,
      body: input.body,
      ...init,
    };
  }

  const headersObj = {};
  if (options.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((v, k) => {
        headersObj[k] = v;
      });
    } else if (Array.isArray(options.headers)) {
      for (const [k, v] of options.headers) {
        headersObj[k] = v;
      }
    } else {
      Object.assign(headersObj, options.headers);
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
  console.log("Supabase key prefix:", SUPABASE_KEY ? SUPABASE_KEY.slice(0, 6) : "none");

  const payload = {
    url: targetUrl,
    method: "GET",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: SUPABASE_KEY ? `Bearer ${SUPABASE_KEY}` : "",
      "Content-Type": "application/json",
    },
    body: null,
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

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log("Missing SUPABASE_URL or SUPABASE_*KEY in env");
    return;
  }

  const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: {
      fetch: proxyFetch,
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

async function main() {
  await testRawProxy();
  await testSupabaseClientViaProxy();
}

main();
