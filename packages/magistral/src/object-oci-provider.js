/**
 * Oracle Object Storage, opt-in as a Magistral object-memory provider.
 *
 * Supplies byte custody only; it cannot create buckets or modify IAM, and it
 * never assumes that an OCI account is free.
 */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { assertObjectRef, hashObject } from "./object-memory.js";

const exec = promisify(execFile);
const DEFAULT_BRIDGE = fileURLToPath(new URL("./oci-object-bridge.py", import.meta.url));
const MAX_OBJECT_BYTES = 64 * 1024 * 1024;

/**
 * freeTierVerified is the operator's explicit external attestation, not a
 * guarantee inferred by Magistral. Until then, GET and PUT are blocked,
 * and the provider is reported as billing="unknown".
 *
 * The invoke hook is for local off-line contract tests only.
 */
export function createOciObjectProvider({
  id = "oci",
  bucket,
  namespace = null,
  region = "eu-marseille-1",
  auth = "instance_principal",
  python,
  bridge = DEFAULT_BRIDGE,
  freeTierVerified = false,
  monthlyRequestCap = null,
  requestBudgetDb = null,
  maxObjectBytes = MAX_OBJECT_BYTES,
  invoke = null,
} = {}) {
  if (typeof id !== "string" || !/^[a-zA-Z0-9_.-]+$/.test(id)) {
    throw new TypeError("invalid provider id");
  }
  if (typeof bucket !== "string" || !/^[a-zA-Z0-9_.-]{1,255}$/.test(bucket)) {
    throw new TypeError("OCI bucket name must be explicit");
  }
  if (namespace !== null && (!namespace || !/^[a-zA-Z0-9_.-]+$/.test(namespace))) {
    throw new TypeError("invalid OCI namespace");
  }
  if (typeof region !== "string" || !/^[a-z][a-z0-9-]+$/.test(region)) {
    throw new TypeError("invalid OCI region");
  }
  if (!["instance_principal", "config"].includes(auth)) {
    throw new TypeError("invalid OCI authentication mode");
  }
  if (typeof python !== "string" || !python.trim()) {
    throw new TypeError("an explicit OCI SDK Python executable is required");
  }
  if (!Number.isSafeInteger(maxObjectBytes) || maxObjectBytes < 1) {
    throw new TypeError("invalid maxObjectBytes");
  }
  if (invoke !== null && typeof invoke !== "function") {
    throw new TypeError("invoke must be a function or null");
  }

  // Explicit attestation alone is insufficient on a PAYG account.
  // A bounded, durable, shared request ledger is also mandatory.
  if (freeTierVerified === true) {
    if (!Number.isSafeInteger(monthlyRequestCap) || monthlyRequestCap < 1 || monthlyRequestCap > 1000) {
      throw new TypeError("monthlyRequestCap must be 1..1000 when enabling OCI custody");
    }
    if (typeof requestBudgetDb !== "string" || !path.isAbsolute(requestBudgetDb)) {
      throw new TypeError("absolute requestBudgetDb is mandatory for OCI custody");
    }
  }
  const billing = freeTierVerified === true ? "none" : "unknown";
  const storage_location = ["oci", region, namespace || "auto", bucket].join(":");
  async function bridgeCommand(operation, ref, file) {
    const args = [
      bridge,
      operation,
      "--auth", auth,
      "--region", region,
      "--bucket", bucket,
      "--max-bytes", String(maxObjectBytes),
    ];
    if (operation !== "probe") {
      args.push("--monthly-request-cap", String(monthlyRequestCap));
      args.push("--request-budget-db", requestBudgetDb);
    }
    if (namespace !== null) args.push("--namespace", namespace);
    if (ref !== null) args.push("--ref", ref);
    if (file !== null) args.push("--file", file);
    let stdout;
    try {
      ({ stdout } = await exec(python, args, {
        timeout: 45000,
        maxBuffer: 8192,
        windowsHide: true,
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
      }));
    } catch (error) {
      let response;
      try {
        response = JSON.parse(error.stdout?.trim() || "{}");
      } catch {
        // Do not emit backend errors, paths, request identifiers or secrets.
      }
      if (response?.error === "RequestBudgetExceeded") {
        throw new Error("oci_request_budget_exhausted");
      }
      throw new Error("oci_backend_operation_failed");
    }
    try {
      return JSON.parse(stdout.trim());
    } catch {
      throw new Error("oci_bridge_invalid_response");
    }
  }

  async function call(operation, ref, file) {
    const result = invoke
      ? await invoke({ operation, ref, file })
      : await bridgeCommand(operation, ref, file);
    if (!result || result.ok !== true) {
      throw new Error("oci_backend_operation_failed");
    }
    return result;
  }

  function requireFreeTierAttestation() {
    if (!freeTierVerified) {
      const error = new Error("oci_free_tier_unverified");
      error.code = "oci_free_tier_unverified";
      throw error;
    }
  }

  async function withScratch(fn) {
    const directory = await mkdtemp(path.join(tmpdir(), "magistral-oci-"));
    try {
      return await fn(path.join(directory, "object.bin"));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  return Object.freeze({
    id,
    billing,
    storage_location,

    async probe() {
      // Only a read-only namespace probe; not permission for storage writes.
      return call("probe", null, null);
    },

    async put(ref, bytes) {
      requireFreeTierAttestation();
      assertObjectRef(ref);
      if (!(bytes instanceof Uint8Array) || hashObject(bytes) !== ref) {
        throw new Error("object_integrity_mismatch");
      }
      if (bytes.length > maxObjectBytes) {
        const error = new Error("object_exceeds_limit");
        error.code = "object_exceeds_limit";
        throw error;
      }
      await withScratch(async (file) => {
        await writeFile(file, bytes, { flag: "wx", mode: 0o600 });
        const result = await call("put", ref, file);
        if (result.ref !== ref || result.size_bytes !== bytes.length || result.verified !== true) {
          throw new Error("oci_put_receipt_mismatch");
        }
      });
    },

    async get(ref) {
      requireFreeTierAttestation();
      assertObjectRef(ref);
      return withScratch(async (file) => {
        const result = await call("get", ref, file);
        if (result.found === false) return null;
        if (result.found !== true || result.ref !== ref) {
          throw new Error("oci_get_receipt_mismatch");
        }
        const data = await readFile(file);
        if (data.length > maxObjectBytes || data.length !== result.size_bytes) {
          throw new Error("oci_get_size_mismatch");
        }
        if (hashObject(data) !== ref) {
          throw new Error("object_integrity_mismatch");
        }
        return data;
      });
    },
  });
}
