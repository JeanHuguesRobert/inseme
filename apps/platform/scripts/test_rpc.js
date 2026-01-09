
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Testing RPC exec_sql...");
  const { data, error } = await supabase.rpc('exec_sql', {
    sql_query: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' LIMIT 5;"
  });

  if (error) {
    console.error("❌ RPC Error:", error);
  } else {
    console.log("✅ RPC Success:", data);
  }
}

test();
