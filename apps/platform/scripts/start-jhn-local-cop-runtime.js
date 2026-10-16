import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJhnLocalCopRuntime } from "../mcp/cop/localRuntimeServer.js";
import { createSupabaseEpochBudgetGrant } from "../mcp/cop/supabaseEpochBudgetGrant.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultStateDirectory = path.resolve(scriptDirectory, "..", "instances", "jhn-cop-local");

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

/**
 * Opt-in only: this host's trusted process owns the service credential.
 * Neither network calls nor public configs may supply or enable the key.
 */
export async function resolveAccountingGrantAdapter({ env = process.env, createClient } = {}) {
  if (env.COP_ACCOUNTING_Z0_GRANT_ENABLED !== "1") return undefined;
  const url = env.COP_ACCOUNTING_SUPABASE_URL;
  const key = env.COP_ACCOUNTING_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("COP Accounting enabled without host-only Supabase credentials");
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url))
    throw new Error("COP Accounting Supabase URL must be an exact hosted project endpoint");
  if (typeof createClient !== "function") throw new TypeError("trusted Supabase client factory is required");
  const supabase = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  return createSupabaseEpochBudgetGrant({supabase});
}
const grantBudget = await resolveAccountingGrantAdapter({
  createClient: (await import("@supabase/supabase-js")).createClient,
});
const portArgument = argumentValue("--port");
const runtime = await createJhnLocalCopRuntime({
  stateDirectory: argumentValue("--state-dir") ?? defaultStateDirectory,
  port: portArgument === null ? 8787 : Number(portArgument),
  grantBudget,
});
const address = await runtime.listen();
console.log(`JHN COP runtime listening locally on http://${address.host}:${address.port}`);
console.log("It accepts only loopback traffic and does not load the private signing key.");

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, async () => {
    await runtime.close();
    process.exit(0);
  });
}
