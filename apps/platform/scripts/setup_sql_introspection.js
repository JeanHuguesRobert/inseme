
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

async function setup() {
  console.log("Setting up SQL introspection function...");
  
  const sql = `
    CREATE OR REPLACE FUNCTION exec_sql(sql_query text)
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $body$
    DECLARE
        result jsonb;
    BEGIN
        -- On force le timeout pour éviter les requêtes trop longues
        SET LOCAL statement_timeout = '10s';
        EXECUTE 'SELECT jsonb_agg(t) FROM (' || sql_query || ') t' INTO result;
        RETURN COALESCE(result, '[]'::jsonb);
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('error', SQLERRM);
    END;
    $body$;
  `;

  // Note: supabase.rpc doesn't execute arbitrary SQL. 
  // We usually need to use a migration or a direct SQL connection.
  // But wait, we can't run this SQL via the supabase-js client easily 
  // unless we have an existing RPC that runs SQL... which is what we're trying to create.
  
  console.log("Please run this SQL in your Supabase SQL Editor:");
  console.log(sql);
}

setup();
