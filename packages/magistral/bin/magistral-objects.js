#!/usr/bin/env node
/**
 * Local Magistral object-memory demonstrator.
 * Requires explicit storage directories; does not contact paid providers.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createFileObjectProvider } from "../src/object-file-provider.js";
import { createObjectMemory } from "../src/object-memory.js";

function usage() {
  throw new Error(
    "Usage: magistral-objects put <file> --store <absolute-directory> [--store <absolute-directory> ...]\n" +
    "       magistral-objects get <sha256:hash> <output-file> --store <absolute-directory> [...]"
  );
}

async function main(argv) {
  const [operation, ...rest] = argv;
  const stores = [];
  const args = [];
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] === "--store") {
      if (i + 1 >= rest.length) usage();
      stores.push(rest[++i]);
    } else {
      args.push(rest[i]);
    }
  }
  if (stores.length < 1 || !stores.every(path.isAbsolute)) usage();
  if ((operation === "put" && args.length !== 1) ||
      (operation === "get" && args.length !== 2)) usage();
  if (operation !== "put" && operation !== "get") usage();

  const memory = createObjectMemory({
    providers: stores.map((directory, index) =>
      createFileObjectProvider({ id: "local-" + (index + 1), directory })
    ),
  });

  if (operation === "put") {
    const bytes = await readFile(args[0]);
    const result = await memory.putObject(bytes, {
      min_replicas: stores.length,
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
