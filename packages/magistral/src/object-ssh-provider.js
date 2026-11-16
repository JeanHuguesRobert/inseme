/**
 * Magistral SSH object provider.
 *
 * A transport adapter, not a cognitive component, daemon or new cloud service.
 * The remote Python bridge accepts only probe, immutable put and verified get.
 */
import { spawn } from "node:child_process";
import { assertObjectRef, hashObject } from "./object-memory.js";

const DEFAULT_MAX_BYTES = 64 * 1024 * 1024;
const ASCII_SAFE = /^[a-zA-Z0-9_./:\\-]+$/;

export function createSshObjectProvider({
  id,
  alias,
  python,
  script,
  maxObjectBytes = DEFAULT_MAX_BYTES,
  networkCostVerified = false,
  timeoutMs = 30000,
  invoke = null,
} = {}) {
  if (typeof id !== "string" || !/^[a-zA-Z0-9_.-]+$/.test(id)) {
    throw new TypeError("invalid SSH provider id");
  }
  if (typeof alias !== "string" || !/^[a-zA-Z0-9_][a-zA-Z0-9_.-]*$/.test(alias)) {
    throw new TypeError("invalid SSH alias");
  }
  if (![python, script].every((value) =>
    typeof value === "string" && value.length >= 2 &&
    ASCII_SAFE.test(value) && !value.includes("..") && !value.startsWith("-")
  )) {
    throw new TypeError("invalid SSH Python or bridge path");
  }
  if (!Number.isSafeInteger(maxObjectBytes) || maxObjectBytes < 1 ||
      maxObjectBytes > DEFAULT_MAX_BYTES) {
    throw new TypeError("invalid SSH object size limit");
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000) {
    throw new TypeError("invalid SSH timeout");
  }
  if (invoke !== null && typeof invoke !== "function") {
    throw new TypeError("invalid SSH invoke hook");
  }
  const billing = networkCostVerified === true ? "none" : "unknown";
  const storage_location = "ssh:" + alias + ":" + script;

  async function remote(operation, ref, bytes) {
    if (invoke) return invoke({ operation, ref, bytes });
    return new Promise((resolve, reject) => {
      const args = [
        "-T", "-o", "BatchMode=yes", "-o", "NumberOfPasswordPrompts=0",
        "-o", "ConnectTimeout=6", "-o", "ServerAliveInterval=8",
        "-o", "ServerAliveCountMax=2",
        alias, python, script, operation,
      ];
      if (ref !== null) args.push(ref);
      const proc = spawn("ssh", args, { stdio: ["pipe", "pipe", "pipe"] });
      const received = [];
      let length = 0;
      let oversized = false;
      let closed = false;
      const killTimer = setTimeout(() => proc.kill("SIGKILL"), timeoutMs);
      proc.stdout.on("data", (chunk) => {
        length += chunk.length;
        if (length > maxObjectBytes + 8192) {
          oversized = true;
          proc.kill("SIGKILL");
          return;
        }
        received.push(chunk);
      });
      // Suppress remote shell paths, usernames and credentials in errors.
      proc.stderr.on("data", () => {});
      proc.stdin.on("error", () => {});
      proc.on("error", () => {
        if (!closed) {
          closed = true;
          clearTimeout(killTimer);
          reject(new Error("ssh_transport_unavailable"));
        }
      });
      proc.on("close", (code) => {
        if (closed) return;
        closed = true;
        clearTimeout(killTimer);
        if (oversized) {
          reject(new Error("ssh_object_size_exceeded"));
        } else if (operation === "get" && code === 4) {
          resolve({ missing: true });
        } else if (code !== 0) {
          reject(new Error("ssh_peer_unavailable_or_refused"));
        } else {
          resolve({ data: Buffer.concat(received) });
        }
      });
      proc.stdin.end(bytes || undefined);
    });
  }

  async function verifyRemote(ref) {
    const response = await remote("verify", ref, null);
    if (response.missing) return null;
    let receipt;
    try {
      receipt = JSON.parse(response.data?.toString("utf8") || "{}");
    } catch {
      throw new Error("ssh_remote_verification_invalid");
    }
    if (receipt.ok !== true || receipt.verified !== true ||
        receipt.ref !== ref || !Number.isSafeInteger(receipt.size_bytes) ||
        receipt.size_bytes < 0 || receipt.size_bytes > maxObjectBytes) {
      throw new Error("ssh_remote_verification_invalid");
    }
    return receipt;
  }

  return Object.freeze({
    id,
    billing,
    storage_location,

    async verify(ref) {
      if (billing !== "none") throw new Error("ssh_network_cost_unverified");
      assertObjectRef(ref);
      return verifyRemote(ref);
    },

    async probe() {
      const response = await remote("probe", null, null);
      const report = JSON.parse(response.data?.toString("utf8") || "{}");
      if (report.protocol !== "magistral.ssh-cas/v0" || report.ok !== true) {
        throw new Error("ssh_peer_incompatible");
      }
      return {
        available: true,
        free_bytes: report.free_bytes,
        max_object_bytes: report.max_object_bytes,
      };
    },

    async put(ref, bytes) {
      if (billing !== "none") throw new Error("ssh_network_cost_unverified");
      assertObjectRef(ref);
      if (!(bytes instanceof Uint8Array) || bytes.length > maxObjectBytes ||
          hashObject(bytes) !== ref) {
        throw new Error("ssh_object_invalid");
      }
      // A retry must not resend an existing 32 MiB object through a
      // potentially slow relay: first verify its SHA256 at the remote disk.
      const existing = await verifyRemote(ref);
      if (existing) {
        if (existing.size_bytes !== bytes.length) {
          throw new Error("ssh_existing_size_mismatch");
        }
        return;
      }
      const response = await remote("put", ref, Buffer.from(bytes));
      const receipt = JSON.parse(response.data?.toString("utf8") || "{}");
      if (receipt.ok !== true || receipt.ref !== ref || receipt.size_bytes !== bytes.length) {
        throw new Error("ssh_put_receipt_invalid");
      }
    },

    async get(ref) {
      if (billing !== "none") throw new Error("ssh_network_cost_unverified");
      assertObjectRef(ref);
      const response = await remote("get", ref, null);
      if (response.missing) return null;
      if (!(response.data instanceof Uint8Array) ||
          response.data.length > maxObjectBytes ||
          hashObject(response.data) !== ref) {
        throw new Error("ssh_object_integrity_mismatch");
      }
      return Buffer.from(response.data);
    },
  });
}
