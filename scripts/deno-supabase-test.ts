import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "npm:@supabase/supabase-js@2.35.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "https://opnotbjrbphwcezaqgim.supabase.co";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

console.log("DENO_SUPABASE_URL", supabaseUrl);
console.log("DENO_SUPABASE_KEY_PREFIX", supabaseKey ? supabaseKey.slice(0, 6) : "none");
console.log("DENO_SUPABASE_KEY_LENGTH", supabaseKey ? supabaseKey.length : 0);

async function testRawFetch() {
  console.log("RAW fetch /rest/v1/instance_config");
  const url = `${supabaseUrl}/rest/v1/instance_config?select=1&limit=1`;

  try {
    const res = await fetch(url, {
      headers: {
        apikey: supabaseKey,
        Authorization: supabaseKey ? `Bearer ${supabaseKey}` : "",
        "Content-Type": "application/json",
      },
    });

    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Body:", text);
  } catch (e) {
    console.error("RAW fetch error:", e);
  }
}

async function testSupabaseClient() {
  console.log("supabase-js from('instance_config')");

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data, error } = await supabase.from("instance_config").select("*").limit(1);

    console.log("Client error:", error || "none");
    console.log("Client data:", data || "[]");
  } catch (e) {
    console.error("supabase-js client threw:", e);
  }
}

await testRawFetch();
await testSupabaseClient();
