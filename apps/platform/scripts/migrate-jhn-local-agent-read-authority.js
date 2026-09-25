/**
 * Explicit administrative migration of a local JHN state directory from the
 * exact #97 v1 Agent JHN envelope to the approved v2 read-only envelope
 * (Inseme #103).
 *
 * Preserves the SQLite file, event history, transport mandate row, and
 * capability key material. Appends the v2 declaration and sparse v2 grant
 * once, in one SQLite transaction. A second run against exact v2, including
 * the v1→v2 lineage, appends nothing. Refuses absent, partial, revoked,
 * suspended, or divergent authority. Does not print keys or bearer
 * capabilities.
 *
 * `--check` inspects the same state and writes nothing.
 *
 * Ordinary conversational startup must not invoke this command.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { createSqliteCopRuntimeStore } from "../mcp/cop/sqliteRuntimeStore.js";
import {
  JHN_TRANSPORT_GRANTEE_REF,
  JHN_TRANSPORT_ISSUER_REF,
  JHN_TRANSPORT_MANDATE_REF,
  classifyJhnAuthorityMigrationCheck,
  inspectJhnLocalAgentAuthority,
  migrateJhnLocalAgentReadAuthority,
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

const TRANSPORT_CONFLICT =
  "transport mandate mandate:jhn:runtime:1 is missing or does not match the local runtime grantee; migration will not recreate it";

function readTransportMandate(database) {
  const transport = database
    .prepare(
      "SELECT mandate_ref, version, status, issuer_ref, grantee_ref FROM cop_mandates WHERE mandate_ref = ?"
    )
    .get(JHN_TRANSPORT_MANDATE_REF);
  const valid = Boolean(
    transport &&
    transport.status === "active" &&
    transport.version === 1 &&
    transport.issuer_ref === JHN_TRANSPORT_ISSUER_REF &&
    transport.grantee_ref === JHN_TRANSPORT_GRANTEE_REF
  );
  return { valid, transport, reason: valid ? null : TRANSPORT_CONFLICT };
}

/**
 * @param {{ stateDirectory?: string, provenance?: string, failBeforeAppend?: string|null }} [options]
 */
export async function migrateJhnLocalAgentReadAuthorityDirectory({
  stateDirectory = defaultStateDirectory,
  provenance = "local-admin-migration",
  failBeforeAppend = null,
} = {}) {
  const root = path.resolve(stateDirectory);
  const privateKeyPath = path.join(root, "cop-capability-private.jwk");
  const publicKeysPath = path.join(root, "cop-capability-public-keys.json");
  const databasePath = path.join(root, "cop-runtime.sqlite");
  const privateBefore = await readFile(privateKeyPath);
  const publicBefore = await readFile(publicKeysPath);

  const database = new DatabaseSync(databasePath);
  try {
    const transport = readTransportMandate(database);
    if (!transport.valid) {
      return {
        ok: false,
        changed: false,
        error: "transport_mandate_invalid",
        conflicts: [transport.reason],
        keys_preserved: true,
        stateDirectory: root,
      };
    }

    const eventStore = createSqliteCopRuntimeStore(database).eventStore;
    const authority = migrateJhnLocalAgentReadAuthority(eventStore, {
      provenance,
      failBeforeAppend,
    });
    const privateAfter = await readFile(privateKeyPath);
    const publicAfter = await readFile(publicKeysPath);
    return {
      ...authority,
      stateDirectory: root,
      databasePath,
      keys_preserved:
        bytesEqual(privateBefore, privateAfter) && bytesEqual(publicBefore, publicAfter),
      transport: {
        mandate_ref: transport.transport.mandate_ref,
        issuer_ref: transport.transport.issuer_ref,
        grantee_ref: transport.transport.grantee_ref,
        preserved: true,
      },
    };
  } finally {
    database.close();
  }
}

/**
 * Classify a local directory without appending, reserving, or rotating keys.
 * The SQLite file is opened read-only.
 *
 * @param {{ stateDirectory?: string }} [options]
 */
export async function checkJhnLocalAgentReadAuthorityDirectory({
  stateDirectory = defaultStateDirectory,
} = {}) {
  const root = path.resolve(stateDirectory);
  const databasePath = path.join(root, "cop-runtime.sqlite");
  let before;
  try {
    before = await readFile(databasePath);
  } catch {
    return {
      ok: false,
      classification: "REFUSED",
      state: "absent",
      reason: "no canonical v1 predecessor; use bootstrap/repair path as appropriate",
      writes_performed: false,
      stateDirectory: root,
    };
  }

  let database;
  try {
    database = new DatabaseSync(databasePath, { readOnly: true });
  } catch {
    const after = await readFile(databasePath);
    return {
      ok: false,
      classification: "REFUSED",
      state: "transport-invalid",
      reason: "state database could not be opened read-only",
      writes_performed: !before.equals(after),
      stateDirectory: root,
    };
  }

  let report;
  try {
    const transport = readTransportMandate(database);
    const inspection = inspectJhnLocalAgentAuthority(
      createSqliteCopRuntimeStore(database).eventStore
    );
    report = classifyJhnAuthorityMigrationCheck({
      inspection,
      transportValid: transport.valid,
      transportReason: transport.reason,
    });
  } finally {
    database.close();
  }

  const after = await readFile(databasePath);
  const wrote = !before.equals(after);
  return {
    ok: !wrote && report.classification !== "REFUSED",
    classification: wrote ? "REFUSED" : report.classification,
    state: report.state,
    reason: wrote ? "read-only check changed the database file" : report.reason,
    writes_performed: wrote,
    stateDirectory: root,
    databasePath,
  };
}

function formatLimits(limits = {}) {
  return Object.entries(limits)
    .map(([dimension, amount]) => `${dimension}=${amount}`)
    .join(" ");
}

export function formatMigrationCheckReport(result) {
  const lines = [
    `JHN authority migration check: ${result.classification}`,
    `state: ${result.state}`,
  ];
  if (result.classification === "MIGRATABLE") {
    lines.push("target: mandate v2 / sparse budget authority_version 2");
  }
  if (result.reason) lines.push(`reason: ${result.reason}`);
  lines.push(`writes performed: ${result.writes_performed ? "yes" : "no"}`);
  return lines.join("\n");
}

export function formatMigrationReport(result) {
  if (!result.ok) {
    const lines = [`JHN local agent read-authority migration refused: ${result.error}`];
    for (const conflict of result.conflicts || []) lines.push(`- ${conflict}`);
    lines.push("No normative authority event was written by this refused migration.");
    return lines.join("\n");
  }
  const lines = [
    `Normative Agent JHN mandate: ${result.normative_mandate.action} (${result.normative_mandate.mandate_ref} ${result.normative_mandate.version})`,
    `Execution budget: ${result.budget.action} (${result.budget.budget_id} authority_version ${result.budget.authority_version})`,
    `Hard limits: ${formatLimits(result.budget.limits)}`,
    `Transport mandate preserved: ${result.transport.mandate_ref} grantee ${result.transport.grantee_ref}`,
    `Keys preserved: ${result.keys_preserved ? "yes" : "no"}`,
    "No key material or bearer capability was printed.",
  ];
  return lines.join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const stateDirectory = argumentValue("--state-dir") ?? defaultStateDirectory;
  if (process.argv.includes("--check")) {
    const result = await checkJhnLocalAgentReadAuthorityDirectory({ stateDirectory });
    console.log(formatMigrationCheckReport(result));
    if (!result.ok || result.writes_performed) process.exitCode = 1;
  } else {
    const result = await migrateJhnLocalAgentReadAuthorityDirectory({ stateDirectory });
    console.log(formatMigrationReport(result));
    if (!result.ok || result.keys_preserved === false) process.exitCode = 1;
  }
}
