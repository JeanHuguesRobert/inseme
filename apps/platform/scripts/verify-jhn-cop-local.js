import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { createEventSourcedExecutionBudgetLedger } from "../../../packages/cop-core/src/execution-budget.js";
import { resolveMandate } from "../../../packages/cop-core/src/governed-act.js";
import { createSqliteCopRuntimeStore } from "../mcp/cop/sqliteRuntimeStore.js";
import {
  inspectJhnLocalAgentAuthority,
  JHN_AGENT_ACP_PROMPT_TIMEOUT_MS,
  JHN_AGENT_ALLOWED_CAPABILITIES,
  JHN_AGENT_BUDGET_AUTHORITY_VERSION,
  JHN_AGENT_BUDGET_ID,
  JHN_AGENT_BUDGET_LIMITS,
  JHN_AGENT_LOGICAL_AGENT_REF,
  JHN_AGENT_MANDATE_REF,
  JHN_AGENT_MANDATE_VERSION,
  JHN_AGENT_PRINCIPAL_REF,
  JHN_AGENT_TURN_DEMAND,
  JHN_TRANSPORT_GRANTEE_REF,
  JHN_TRANSPORT_MANDATE_REF,
} from "../mcp/cop/jhnLocalAgentAuthority.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultStateDirectory = path.resolve(scriptDirectory, "..", "instances", "jhn-cop-local");
const ED25519 = { name: "Ed25519" };

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

function requireObject(value, description) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${description} is invalid`);
  return value;
}

export async function verifyJhnLocalCopAuthority({ stateDirectory = defaultStateDirectory } = {}) {
  const root = path.resolve(stateDirectory);
  const [privateText, publicText] = await Promise.all([
    readFile(path.join(root, "cop-capability-private.jwk"), "utf8"),
    readFile(path.join(root, "cop-capability-public-keys.json"), "utf8"),
  ]);
  const privateJwk = requireObject(JSON.parse(privateText), "private capability key");
  const publicConfig = requireObject(JSON.parse(publicText), "public capability configuration");
  if (
    typeof publicConfig.audience !== "string" ||
    !publicConfig.keys ||
    typeof publicConfig.keys !== "object"
  ) {
    throw new Error("public capability configuration is incomplete");
  }
  const keyEntries = Object.entries(publicConfig.keys);
  if (keyEntries.length !== 1)
    throw new Error("exactly one active public capability key is required at bootstrap");
  const [keyId, publicJwk] = keyEntries[0];
  const [privateKey, publicKey] = await Promise.all([
    crypto.subtle.importKey("jwk", privateJwk, ED25519, false, ["sign"]),
    crypto.subtle.importKey("jwk", publicJwk, ED25519, false, ["verify"]),
  ]);
  const probe = crypto.getRandomValues(new Uint8Array(32));
  const signature = await crypto.subtle.sign(ED25519, privateKey, probe);
  if (!(await crypto.subtle.verify(ED25519, publicKey, signature, probe))) {
    throw new Error("private and public capability keys do not match");
  }

  const database = new DatabaseSync(path.join(root, "cop-runtime.sqlite"));
  try {
    const mandate = database
      .prepare(
        "SELECT mandate_ref, version, status, grantee_ref, permissions FROM cop_mandates WHERE mandate_ref = ?"
      )
      .get(JHN_TRANSPORT_MANDATE_REF);
    if (
      !mandate ||
      mandate.status !== "active" ||
      mandate.version !== 1 ||
      mandate.grantee_ref !== JHN_TRANSPORT_GRANTEE_REF
    ) {
      throw new Error("JHN transport mandate is missing or invalid");
    }
    const permissions = JSON.parse(mandate.permissions);
    if (!Array.isArray(permissions) || !permissions.includes("cop.events.append")) {
      throw new Error("JHN transport mandate permissions are invalid");
    }
    const eventCount = database
      .prepare("SELECT count(*) AS count FROM cop_events WHERE type = ?")
      .get("authority.local_bootstrapped").count;
    if (eventCount !== 1) throw new Error("JHN bootstrap audit event is missing or duplicated");
    const store = createSqliteCopRuntimeStore(database).eventStore;
    const authority = inspectJhnLocalAgentAuthority(store);
    if (authority.shape === "absent") {
      throw new Error(
        "Normative Agent JHN mandate or budget grant is missing. Transport state was left unchanged. Run: node apps/platform/scripts/repair-jhn-local-agent-authority.js --state-dir <directory>"
      );
    }
    if (authority.shape === "canonical_v1") {
      throw new Error(
        "Normative Agent JHN authority is still the v1 predecessor. Transport state was left unchanged. Run: node apps/platform/scripts/migrate-jhn-local-agent-read-authority.js --state-dir <directory>"
      );
    }
    if (authority.shape !== "canonical_v2" && authority.shape !== "canonical_lineage") {
      throw new Error(
        `Normative Agent JHN authority is not the canonical v2 envelope: ${authority.conflicts.join("; ")}`
      );
    }
    const normative = resolveMandate(store, JHN_AGENT_MANDATE_REF);
    if (
      !normative ||
      normative.version !== JHN_AGENT_MANDATE_VERSION ||
      normative.principal_ref !== JHN_AGENT_PRINCIPAL_REF ||
      normative.logical_agent_ref !== JHN_AGENT_LOGICAL_AGENT_REF ||
      normative.scope?.allowed_actions?.join(",") !== JHN_AGENT_ALLOWED_CAPABILITIES.join(",")
    ) {
      throw new Error("active Agent JHN mandate does not resolve to the canonical v2 envelope");
    }
    const budget = createEventSourcedExecutionBudgetLedger({
      store,
      budget_id: JHN_AGENT_BUDGET_ID,
      require_authority_grant: true,
    }).snapshot();
    const hardDimensions = Object.keys(JHN_AGENT_BUDGET_LIMITS);
    if (
      budget.authority_version !== JHN_AGENT_BUDGET_AUTHORITY_VERSION ||
      budget.mandate_ref !== JHN_AGENT_MANDATE_REF ||
      hardDimensions.some(
        (dimension) => budget.limits[dimension] !== JHN_AGENT_BUDGET_LIMITS[dimension]
      ) ||
      Object.keys(budget.limits).some((dimension) => !hardDimensions.includes(dimension))
    ) {
      throw new Error("active Agent JHN execution budget is not the canonical sparse v2 grant");
    }
    if (
      JHN_AGENT_TURN_DEMAND.max_steps !== 1 ||
      JHN_AGENT_TURN_DEMAND.max_elapsed_ms !== JHN_AGENT_ACP_PROMPT_TIMEOUT_MS
    ) {
      throw new Error("canonical per-turn demand does not match the 60000 ms ACP timeout ceiling");
    }
  } finally {
    database.close();
  }
  return {
    stateDirectory: root,
    audience: publicConfig.audience,
    keyId,
    authority_shape: "canonical",
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await verifyJhnLocalCopAuthority({
    stateDirectory: argumentValue("--state-dir") ?? defaultStateDirectory,
  });
  console.log(`JHN local COP authority verified: ${result.stateDirectory}`);
  console.log(`Audience: ${result.audience}; active key: ${result.keyId}`);
  console.log("No key material or bearer capability was printed.");
}
