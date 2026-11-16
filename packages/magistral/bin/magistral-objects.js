#!/usr/bin/env node
/**
 * Magistral object-memory CLI: local custody and explicitly configured OCI.
 * Every remote provider is budget-gated; no remote is selected implicitly.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createFileObjectProvider } from "../src/object-file-provider.js";
import { createOciObjectProvider } from "../src/object-oci-provider.js";
import { createSshObjectProvider } from "../src/object-ssh-provider.js";
import { createObjectMemory } from "../src/object-memory.js";

function usage() {
  throw new Error(
    "Usage: magistral-objects put <file> [--store <absolute-dir>] [--oci-config <absolute-json>] [--ssh-config <absolute-json>] [--min-replicas N]\n" +
    "       magistral-objects get <sha256:hash> <output-file> [--store <absolute-dir>] [--oci-config <absolute-json>] [--ssh-config <absolute-json>]\n" +
    "       At least one provider is required. Remote peers are explicit, opt-in and verified."
  );
}

async function main(argv) {
  const [operation, ...rest] = argv;
  const stores = [];
  let ociConfigPath = null;
  const sshConfigs = [];
  let minReplicas = null;
  const args = [];
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] === "--store") {
      if (i + 1 >= rest.length) usage();
      stores.push(rest[++i]);
    } else if (rest[i] === "--oci-config") {
      if (ociConfigPath !== null || i + 1 >= rest.length) usage();
      ociConfigPath = rest[++i];
    } else if (rest[i] === "--ssh-config") {
      if (i + 1 >= rest.length) usage();
      sshConfigs.push(rest[++i]);
    } else if (rest[i] === "--min-replicas") {
      if (minReplicas !== null || i + 1 >= rest.length) usage();
      minReplicas = Number(rest[++i]);
    } else {
      args.push(rest[i]);
    }
  }
  if ((stores.length === 0 && !ociConfigPath && sshConfigs.length === 0) ||
      !stores.every(path.isAbsolute)) usage();
  if (ociConfigPath && !path.isAbsolute(ociConfigPath)) usage();
  if (!sshConfigs.every(path.isAbsolute)) usage();
  if (minReplicas !== null && (!Number.isSafeInteger(minReplicas) || minReplicas < 1)) usage();
  if (minReplicas !== null && operation !== "put") usage();
  if ((operation === "put" && args.length !== 1) ||
      (operation === "get" && args.length !== 2)) usage();
  if (operation !== "put" && operation !== "get") usage();

  const providers = stores.map((directory, index) =>
    createFileObjectProvider({ id: "local-" + (index + 1), directory })
  );
  if (ociConfigPath) {
    const profile = JSON.parse(await readFile(ociConfigPath, "utf8"));
    if (profile?.schema !== "magistral.oci-object-profile/v1") {
      throw new TypeError("invalid_oci_object_profile");
    }
    // An OCI profile contains capability declarations, not OCI API secrets.
    providers.push(createOciObjectProvider({
      id: "oci",
      bucket: profile.bucket,
      namespace: profile.namespace ?? null,
      region: profile.region,
      auth: profile.auth,
      python: profile.python,
      freeTierVerified: profile.freeTierVerified === true,
      monthlyRequestCap: profile.monthlyRequestCap,
      requestBudgetDb: profile.requestBudgetDb,
      maxObjectBytes: profile.maxObjectBytes ?? 64 * 1024 * 1024,
    }));
  }
  for (const configPath of sshConfigs) {
    const profile = JSON.parse(await readFile(configPath, "utf8"));
    if (profile?.schema !== "magistral.ssh-object-profile/v1") {
      throw new TypeError("invalid_ssh_object_profile");
    }
    providers.push(createSshObjectProvider({
      id: profile.id,
      alias: profile.alias,
      python: profile.python,
      script: profile.script,
      networkCostVerified: profile.networkCostVerified === true,
      maxObjectBytes: profile.maxObjectBytes ?? 64 * 1024 * 1024,
      timeoutMs: profile.timeoutMs ?? 30000,
    }));
  }
  const memory = createObjectMemory({ providers });

  if (operation === "put") {
    const bytes = await readFile(args[0]);
    const result = await memory.putObject(bytes, {
      min_replicas: minReplicas ?? providers.length,
      max_cost: 0,
    });
    process.stdout.write(JSON.stringify(result) + "\n");
    return;
  }

  const result = await memory.getObject(args[0], { max_cost: 0 });
  // Never silently overwrite an existing file.
  await writeFile(args[1], result.bytes, { flag: "wx", mode: 0o600 });
  process.stdout.write(JSON.stringify({
    ref: result.ref,
    size_bytes: result.bytes.length,
    from_provider: result.provider,
    verified: result.verified,
  }) + "\n");
}

main(process.argv.slice(2)).catch((error) => {
  const code = error?.code || "object_error";
  // Paths and credentials from provider errors are deliberately not printed.
  process.stderr.write(JSON.stringify({ code, error: error.message?.startsWith("Usage:") ? error.message : code }) + "\n");
  process.exitCode = 1;
});
