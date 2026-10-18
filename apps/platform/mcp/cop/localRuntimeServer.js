import { createServer } from "node:http";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { createPortableCopRuntimeGateway } from "./portableRuntimeGateway.js";
import { createPortableCopRuntimeHandlers } from "./portableRuntimeHandlers.js";
import { createSignedCapabilityContextResolver, CopCapabilityError } from "./signedCapability.js";
import { CopAccessDeniedError } from "./portableRuntimeGateway.js";
import { createGovernedEpochBudgetGrantHandler } from "./governedEpochBudget.js";
import { createSqliteCopRuntimeStore } from "./sqliteRuntimeStore.js";

const ROUTES = new Map([
  ["/cop/handlers", "registerHandler"],
  ["/cop/logical-agents", "upsertLogicalAgent"],
  ["/cop/packets", "upsertPacket"],
  ["/cop/tasks", "upsertTask"],
  ["/cop/steps", "upsertStep"],
  ["/cop/events", "appendEvent"],
  ["/cop/artifacts", "appendArtifact"],
]);
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1"]);
const MAX_BODY_BYTES = 64 * 1024;

function json(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > MAX_BODY_BYTES) throw new TypeError("COP request body exceeds 64 KiB");
    chunks.push(chunk);
  }
  if (length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new TypeError("COP request body must be JSON");
  }
}

function listen(server, host, port) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve(server.address());
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
}

/**
 * Create the local-only JHN COP HTTP boundary. It reads only public keys; a
 * separate issuer remains responsible for the host-only private key.
 */
export async function createJhnLocalCopRuntime({
  stateDirectory,
  host = "127.0.0.1",
  port = 0,
  clock,
  grantBudget,
} = {}) {
  if (!LOOPBACK_HOSTS.has(host))
    throw new TypeError("JHN local COP runtime may bind only to 127.0.0.1 or ::1");
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new TypeError("port must be an integer from 0 to 65535");
  if (typeof stateDirectory !== "string" || stateDirectory.length === 0)
    throw new TypeError("stateDirectory is required");

  const root = path.resolve(stateDirectory);
  const publicConfig = JSON.parse(
    await readFile(path.join(root, "cop-capability-public-keys.json"), "utf8")
  );
  if (!publicConfig?.keys || typeof publicConfig.audience !== "string") {
    throw new TypeError("local COP public-key configuration is invalid");
  }
  const database = new DatabaseSync(path.join(root, "cop-runtime.sqlite"));
  const store = createSqliteCopRuntimeStore(database);
  const gateway = createPortableCopRuntimeGateway({ executor: store.executor, clock });
  const resolveContext = createSignedCapabilityContextResolver({
    publicKeys: publicConfig.keys,
    audience: publicConfig.audience,
    resolveMandate: store.resolveMandate,
    clock,
  });
  const handlers = createPortableCopRuntimeHandlers({ gateway, resolveContext });
  const budgetHandler = grantBudget ? createGovernedEpochBudgetGrantHandler({ resolveContext, grantBudget }) : null;
  const server = createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      json(response, 200, { status: "ok", scope: "loopback" });
      return;
    }
    const isBudgetGrant = request.method === "POST" && request.url === "/cop/accounting/budgets/grant";
    const handlerName = request.method === "POST" && ROUTES.get(request.url);
    if (!handlerName && !isBudgetGrant) {
      json(response, 404, { error: "COP runtime route not found", code: "COP_ROUTE_NOT_FOUND" });
      return;
    }
    try {
      const outcome = await (isBudgetGrant ? budgetHandler ?? (async () => ({status:503,body:{code:"COP_ACCOUNTING_NOT_CONFIGURED"}})) : handlers[handlerName])({
        headers: request.headers,
        body: await readJsonBody(request),
      });
      json(response, outcome.status, outcome.body);
    } catch (error) {
      const status = error instanceof CopCapabilityError ? 401 : error instanceof CopAccessDeniedError ? 403 : error instanceof TypeError ? 400 : 500;
      json(response, status, { error: error.message, code: error.code ?? (status === 500 ? "COP_RUNTIME_WRITE_FAILED" : "COP_INVALID_REQUEST") });
    }
  });

  return {
    async listen() {
      const address = await listen(server, host, port);
      return { host, port: address.port };
    },
    async close() {
      server.closeAllConnections?.();
      await close(server);
      database.close();
    },
  };
}
