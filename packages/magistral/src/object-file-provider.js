/**
 * A cost-free local backend for Magistral object-memory.
 * Immutable SHA-256 objects, no listing, deletion or remote credentials.
 * Files are atomically published without overwriting existing content.
 */
import { randomUUID } from "node:crypto";
import { link, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertObjectRef, hashObject } from "./object-memory.js";

const DEFAULT_MAX_OBJECT_BYTES = 64 * 1024 * 1024;

export function createFileObjectProvider({
  id,
  directory,
  maxObjectBytes = DEFAULT_MAX_OBJECT_BYTES,
} = {}) {
  if (typeof id !== "string" || !/^[a-zA-Z0-9_.-]+$/.test(id)) {
    throw new TypeError("provider id must be a nonempty portable identifier");
  }
  if (typeof directory !== "string" || !directory.trim()) {
    throw new TypeError("absolute storage directory is required");
  }
  if (!path.isAbsolute(directory)) throw new TypeError("storage directory must be absolute");
  if (!Number.isSafeInteger(maxObjectBytes) || maxObjectBytes < 1) {
    throw new TypeError("maxObjectBytes must be a positive integer");
  }

  const root = path.resolve(directory);
  function pathFor(ref) {
    assertObjectRef(ref);
    const hex = ref.slice("sha256:".length);
    return path.join(root, "sha256", hex.slice(0, 2), hex.slice(2));
  }

  async function get(ref) {
    const target = pathFor(ref);
    try {
      return await readFile(target);
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }

  async function put(ref, bytes) {
    assertObjectRef(ref);
    if (!(bytes instanceof Uint8Array) || hashObject(bytes) !== ref) {
      throw new Error("object_integrity_mismatch");
    }
    if (bytes.length > maxObjectBytes) {
      const error = new Error("object_exceeds_limit");
      error.code = "object_exceeds_limit";
      throw error;
    }
    const target = pathFor(ref);
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    const existing = await get(ref);
    if (existing !== null) {
      if (hashObject(existing) !== ref) throw new Error("object_integrity_mismatch");
      return;
    }

    // Write completely before making the final name visible. Link with
    // exclusive creation: concurrent writers cannot replace one another.
    const tmp = path.join(path.dirname(target), "." + randomUUID() + ".part");
    try {
      await writeFile(tmp, bytes, { flag: "wx", mode: 0o600 });
      try {
        await link(tmp, target);
      } catch (error) {
        if (error?.code !== "EEXIST") throw error;
        const winner = await get(ref);
        if (!(winner instanceof Uint8Array) || hashObject(winner) !== ref) {
          throw new Error("object_integrity_mismatch");
        }
      }
    } finally {
      try {
        await unlink(tmp);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
  }

  // Location remains private to the core service, not exposed in public receipts.
  return Object.freeze({
    id, billing: "none", storage_location: root, get, put, pathFor, maxObjectBytes,
  });
}
