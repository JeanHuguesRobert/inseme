#!/usr/bin/env node

const DEFAULT_URL =
  "https://opnotbjrbphwcezaqgim.supabase.co/rest/v1/instance_config?select=*&order=key.asc&offset=0&limit=1";

const url = process.env.TEST_SUPABASE_URL || DEFAULT_URL;

async function main() {
  console.log("[test-supabase] Fetching:", url);
  try {
    const res = await fetch(url);
    console.log("[test-supabase] Status:", res.status);
    const text = await res.text();
    console.log("[test-supabase] Body (first 400 chars):", text.slice(0, 400));
  } catch (err) {
    console.error("[test-supabase] Network error:", err);
    process.exitCode = 1;
  }
}

main();
