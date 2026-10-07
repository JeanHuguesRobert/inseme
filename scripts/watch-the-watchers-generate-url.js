import { fileURLToPath } from "node:url";

import {
  createOpaqueToken,
  tokenRefFromToken,
} from "./watch-the-watchers.js";

export function generateAccessUrl({
  base_url,
  recipient_ref,
  context_ref = null,
  artifact_ref,
  expires_at,
  token = createOpaqueToken(),
}) {
  requireNonEmpty("base_url", base_url);
  requireNonEmpty("recipient_ref", recipient_ref);
  requireNonEmpty("artifact_ref", artifact_ref);
  requireNonEmpty("expires_at", expires_at);

  const expiry = new Date(expires_at);
  if (Number.isNaN(expiry.valueOf())) throw new Error("invalid_expires_at");
  if (expiry <= new Date()) throw new Error("expires_at_must_be_future");

  const base = new URL(base_url);
  if (!["http:", "https:"].includes(base.protocol)) throw new Error("invalid_base_url_protocol");
  base.pathname = base.pathname.replace(/\/$/, "") + "/a/" + encodeURIComponent(token);
  base.search = "";
  base.hash = "";

  const token_ref = tokenRefFromToken(token);

  return Object.freeze({
    schema: "watch-the-watchers/access-url-v1",
    url: base.toString(),
    token,
    token_ref,
    secret_bearer_capability: true,
    registration: Object.freeze({
      recipient_ref,
      context_ref,
      artifact_ref,
      expires_at: expiry.toISOString(),
    }),
  });
}

export async function registerGeneratedAccessUrl(generated, env = process.env) {
  if (!generated?.registration || !generated?.token) throw new Error("generated_access_url_required");
  const supabaseUrl = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  const [{ createClient }, { createArtifactAccessSupabaseStore }] = await Promise.all([
    import("@supabase/supabase-js"),
    import("../apps/platform/mcp/cop/artifactAccessSupabaseStore.js"),
  ]);

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const store = createArtifactAccessSupabaseStore(client);
  return store.registerToken({
    token: generated.token,
    ...generated.registration,
  });
}

function requireNonEmpty(name, value) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${name}_required`);
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === "--register") {
      args.register = true;
      continue;
    }
    if (!key.startsWith("--")) throw new Error(`unexpected_argument:${key}`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`missing_value:${key}`);
    args[key.slice(2).replaceAll("-", "_")] = value;
    index += 1;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const generated = generateAccessUrl(args);
  let registration_result = null;
  if (args.register) {
    registration_result = await registerGeneratedAccessUrl(generated);
  }

  process.stdout.write(JSON.stringify({
    ...generated,
    registration_result,
  }, null, 2) + "\n");
}

const invokedAsScript = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedAsScript) {
  main().catch((error) => {
    console.error(error?.stack || String(error));
    process.exitCode = 1;
  });
}
