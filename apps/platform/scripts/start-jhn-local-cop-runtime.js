import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJhnLocalCopRuntime } from "../mcp/cop/localRuntimeServer.js";
import { resolveAccountingGrantAdapter } from "../mcp/cop/hostAccountingGrantConfig.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultStateDirectory = path.resolve(scriptDirectory, "..", "instances", "jhn-cop-local");

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

const grantBudget = process.env.COP_ACCOUNTING_Z0_GRANT_ENABLED === "1"
  ? resolveAccountingGrantAdapter({
      createClient: (await import("@supabase/supabase-js")).createClient,
    })
  : undefined;
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
