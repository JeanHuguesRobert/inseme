import {createSupabaseEpochBudgetGrant} from "./supabaseEpochBudgetGrant.js";

/** Trusted host opt-in. Never derive authority or secrets from HTTP request. */
export function resolveAccountingGrantAdapter({env = process.env,createClient}={}) {
 if(env.COP_ACCOUNTING_Z0_GRANT_ENABLED!=="1") return undefined;
 const url=env.COP_ACCOUNTING_SUPABASE_URL;
 const key=env.COP_ACCOUNTING_SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key) throw new Error("COP Accounting enabled without host-only Supabase credentials");
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url))
  throw new Error("COP Accounting Supabase URL must be an exact hosted project endpoint");
 if(typeof createClient!=="function") throw new TypeError("trusted Supabase client factory is required");
 return createSupabaseEpochBudgetGrant({supabase:createClient(url,key,{
  auth:{persistSession:false,autoRefreshToken:false}
 })});
}
