/**
 * Idempotent repair for a local JHN state directory created before the
 * normative Agent JHN mandate existed (Inseme #97).
 *
 * Preserves the SQLite file, event history, transport mandate row, and
 * capability key material. Refuses ambiguous normative authority instead of
 * overwriting it. Does not print keys or bearer capabilities.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { createSqliteCopRuntimeStore } from "../mcp/cop/sqliteRuntimeStore.js";
import {
  ensureJhnLocalAgentAuthority,
  JHN_TRANSPORT_GRANTEE_REF,
  JHN_TRANSPORT_ISSUER_REF,
  JHN_TRANSPORT_MANDATE_REF,
} from "../mcp/cop/jhnLocalAgentAuthority.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultStateDirectory = path.resolve(scriptDirectory, "..", "instances", "jhn-cop-local");

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

function bytesEqual(left, right) {
  return Buffer.isBuffer(left) && Buffer.isBuffer(right) && left.equals(right);
}

/**
 * @param {{ stateDirectory?: string, provenance?: string }} [options]
 */
export async function repairJhnLocalAgentAuthority({
  stateDirectory = defaultStateDirectory,
  provenance = "local-admin-repair",
} = {}) {
  const root = path.resolve(stateDirectory);
  const privateKeyPath = path.join(root, "cop-capability-private.jwk");
  const publicKeysPath = path.join(root, "cop-capability-public-keys.json");
  const databasePath = path.join(root, "cop-runtime.sqlite");
  const privateBefore = await readFile(privateKeyPath);
  const publicBefore = await readFile(publicKeysPath);

  const database = new DatabaseSync(databasePath);
  try {
    const transport = database
      .prepare(
        "SELECT mandate_ref, version, status, issuer_ref, grantee_ref FROM cop_mandates WHERE mandate_ref = ?"
      )
      .get(JHN_TRANSPORT_MANDATE_REF);
    if (
      !transport ||
      transport.status !== "active" ||
      transport.version !== 1 ||
      transport.issuer_ref !== JHN_TRANSPORT_ISSUER_REF ||
      transport.grantee_ref !== JHN_TRANSPORT_GRANTEE_REF
    ) {
      return {
        ok: false,
        changed: false,
        error: "transport_mandate_invalid",
        conflicts: [
          "transport mandate mandate:jhn:runtime:1 is missing or does not match the local runtime grantee; repair will not recreate it",
        ],
        keys_preserved: true,
      };
    }

    const eventStore = createSqliteCopRuntimeStore(database).eventStore;
    const authority = ensureJhnLocalAgentAuthority(eventStore, { provenance });
    const privateAfter = await readFile(privateKeyPath);
    const publicAfter = await readFile(publicKeysPath);
    return {
      ...authority,
      stateDirectory: root,
      databasePath,
      keys_preserved:
        bytesEqual(privateBefore, privateAfter) && bytesEqual(publicBefore, publicAfter),
      transport: {
        mandate_ref: transport.mandate_ref,
        issuer_ref: transport.issuer_ref,
        grantee_ref: transport.grantee_ref,
        preserved: true,
      },
    };
  } finally {
    database.close();
  }
}

function printResult(result) {
  if (!result.ok) {
    console.error(`JHN local agent authority repair refused: ${result.error}`);
    for (const conflict of result.conflicts || []) console.error(`- ${conflict}`);
    console.error("No normative authority event was written by this refused repair.");
    return;
  }
  console.log(`Normative Agent JHN mandate: ${result.normative_mandate.action}`);
  console.log(`Mandate ref: ${result.normative_mandate.mandate_ref}`);
  console.log(`Execution budget: ${result.budget.action} (${result.budget.budget_id})`);
  console.log(
    `Transport mandate preserved: ${result.transport.mandate_ref} grantee ${result.transport.grantee_ref}`
  );
  console.log(`Keys preserved: ${result.keys_preserved ? "yes" : "no"}`);
  console.log("No key material or bearer capability was printed.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await repairJhnLocalAgentAuthority({
    stateDirectory: argumentValue("--state-dir") ?? defaultStateDirectory,
  });
  printResult(result);
  if (!result.ok || result.keys_preserved === false) process.exitCode = 1;
}
