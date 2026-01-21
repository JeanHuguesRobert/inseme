import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "https://opnotbjrbphwcezaqgim.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";

console.log("NODE_SUPABASE_URL", supabaseUrl);
console.log("NODE_SUPABASE_KEY_PREFIX", supabaseKey ? supabaseKey.slice(0, 6) : "none");
console.log("NODE_SUPABASE_KEY_LENGTH", supabaseKey ? supabaseKey.length : 0);

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
    const supabase = createClient(supabaseUrl, supabaseKey || "dummy");
    const { data, error } = await supabase.from("instance_config").select("*").limit(1);

    console.log("Client error:", error || "none");
    console.log("Client data:", data || "[]");
  } catch (e) {
    console.error("supabase-js client threw:", e);
  }
}

await testRawFetch();
await testSupabaseClient();
