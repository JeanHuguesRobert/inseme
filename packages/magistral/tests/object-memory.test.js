import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  assertObjectRef,
  createObjectMemory,
  hashObject,
  ObjectReplicationError,
  ObjectUnavailableError,
} from "../src/object-memory.js";
import { createFileObjectProvider } from "../src/object-file-provider.js";

const execute = promisify(execFile);
const sample = Buffer.from("Magistral Memory is byte custody, not cognitive judgement.\n");
const sha = createHash("sha256").update(sample).digest("hex");
const ref = "sha256:" + sha;

async function temp(testContext) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "magistral-object-v0-"));
  testContext.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test("object identity uses the canonical sha256 digest", () => {
  assert.equal(hashObject(sample), ref);
  assert.equal(assertObjectRef(ref), ref);
  assert.throws(() => hashObject("text"), /Buffer or Uint8Array/);
  for (const wrong of ["", "sha256:../evil", "SHA256:" + sha, "sha256:" + "a".repeat(63)]) {
    assert.throws(() => assertObjectRef(wrong), /sha256/);
  }
});

test("one local provider stores, verifies and retrieves bytes; duplicate PUT is idempotent", async (t) => {
  const root = await temp(t);
  const provider = createFileObjectProvider({ id: "local", directory: root });
  const service = createObjectMemory({ providers: [provider] });
  const receipt = await service.putObject(sample);
  assert.deepEqual(receipt.verified_copies, ["local"]);
  assert.equal(receipt.size_bytes, sample.length);
  assert.equal(receipt.ref, ref);
  assert.deepEqual(await readFile(provider.pathFor(ref)), sample);
  assert.equal((await service.getObject(ref)).provider, "local");
  assert.deepEqual((await service.getObject(ref)).bytes, sample);
  assert.deepEqual((await service.putObject(sample)).verified_copies, ["local"]);
  assert.deepEqual(service.providers(), [{ id: "local", billing: "none" }]);
});

test("two independent local directories satisfy an explicit two-copy policy", async (t) => {
  const root = await temp(t);
  const a = createFileObjectProvider({ id: "a", directory: path.join(root, "a") });
  const b = createFileObjectProvider({ id: "b", directory: path.join(root, "b") });
  const memory = createObjectMemory({ providers: [a, b] });
  const receipt = await memory.putObject(sample, { min_replicas: 2, max_cost: 0 });
  assert.deepEqual(receipt.verified_copies, ["a", "b"]);
  assert.deepEqual(await a.get(ref), sample);
  assert.deepEqual(await b.get(ref), sample);
  await rm(a.pathFor(ref));
  const recovered = await memory.getObject(ref);
  assert.equal(recovered.provider, "b");
  assert.deepEqual(recovered.bytes, sample);
});

test("a corrupt first copy is not served; the good second copy can still be used", async (t) => {
  const root = await temp(t);
  const a = createFileObjectProvider({ id: "a", directory: path.join(root, "a") });
  const b = createFileObjectProvider({ id: "b", directory: path.join(root, "b") });
  const memory = createObjectMemory({ providers: [a, b] });
  await memory.putObject(sample, { min_replicas: 2 });
  await writeFile(a.pathFor(ref), "corrupted");
  const result = await memory.getObject(ref);
  assert.equal(result.provider, "b");
  await assert.rejects(a.put(ref, sample), /integrity_mismatch/);
});

test("without a good copy GET fails closed and reports the attempted sources", async (t) => {
  const root = await temp(t);
  const a = createFileObjectProvider({ id: "a", directory: root });
  const memory = createObjectMemory({ providers: [a] });
  await assert.rejects(memory.getObject(ref), (e) => {
    assert.ok(e instanceof ObjectUnavailableError);
    assert.deepEqual(e.attempts, [{ provider: "a", error: "not_present" }]);
    return true;
  });
  await memory.putObject(sample);
  await writeFile(a.pathFor(ref), "corrupt");
  await assert.rejects(memory.getObject(ref), (e) => {
    assert.equal(e.attempts[0].error, "integrity_mismatch");
    return true;
  });
});

test("an unsatisfiable replica policy fails without writing a partial object", async (t) => {
  const root = await temp(t);
  const provider = createFileObjectProvider({ id: "local", directory: root });
  const memory = createObjectMemory({ providers: [provider] });
  await assert.rejects(memory.putObject(sample, { min_replicas: 2 }), (e) => {
    assert.ok(e instanceof ObjectReplicationError);
    assert.equal(e.required, 2);
    assert.deepEqual(e.copies, []);
    return true;
  });
  assert.equal(await provider.get(ref), null);
});

test("unknown and metered billing are not treated as free under zero budget", async () => {
  let calls = 0;
  const provider = (id, billing) => ({
    id, billing,
    put: async () => { calls++; },
    get: async () => { calls++; return sample; },
  });
  const memory = createObjectMemory({
    providers: [provider("unknown", "unknown"), provider("paid", "metered")],
  });
  await assert.rejects(memory.putObject(sample), ObjectReplicationError);
  await assert.rejects(memory.getObject(ref), ObjectUnavailableError);
  await assert.rejects(memory.putObject(sample, { max_cost: 1 }), /max_cost: 0/);
  assert.equal(calls, 0);
});

test("size limits and invalid roots are enforced before writing", async (t) => {
  const root = await temp(t);
  assert.throws(() => createFileObjectProvider({ id: "a", directory: "relative/path" }), /absolute/);
  const provider = createFileObjectProvider({ id: "a", directory: root, maxObjectBytes: 2 });
  await assert.rejects(provider.put(ref, sample), /object_exceeds_limit/);
  assert.equal(await provider.get(ref), null);
  const memory = createObjectMemory({ providers: [provider] });
  await assert.rejects(memory.putObject(sample), ObjectReplicationError);
});

test("a single directory cannot masquerade as two verified copies", async (t) => {
  const root = await temp(t);
  const a = createFileObjectProvider({ id: "first", directory: root });
  const b = createFileObjectProvider({ id: "second", directory: root });
  assert.throws(() => createObjectMemory({ providers: [a, b] }), /duplicate object storage/);
});

test("concurrent identical writes do not clobber immutable objects", async (t) => {
  const root = await temp(t);
  const provider = createFileObjectProvider({ id: "local", directory: root });
  const memory = createObjectMemory({ providers: [provider] });
  const attempts = await Promise.all(Array.from({ length: 12 }, () => memory.putObject(sample)));
  assert.ok(attempts.every((r) => r.ref === ref));
  assert.deepEqual(await readFile(provider.pathFor(ref)), sample);
});

test("CLI puts and retrieves the exact original bytes without overwriting targets", async (t) => {
  const root = await temp(t);
  const source = path.join(root, "input");
  const target = path.join(root, "output");
  const store = path.join(root, "store");
  const cli = path.resolve("bin/magistral-objects.js");
  await writeFile(source, sample);
  const { stdout } = await execute(process.execPath, [cli, "put", source, "--store", store], {
    cwd: path.resolve("."),
  });
  assert.equal(JSON.parse(stdout).ref, ref);
  const fetched = await execute(process.execPath, [cli, "get", ref, target, "--store", store], {
    cwd: path.resolve("."),
  });
  assert.equal(JSON.parse(fetched.stdout).verified, true);
  assert.deepEqual(await readFile(target), sample);
  await assert.rejects(execute(process.execPath, [cli, "get", ref, target, "--store", store], {
    cwd: path.resolve("."),
  }));
});

test("CLI refuses unverified remote custody before writing even to local replicas", async (t) => {
  const root = await temp(t);
  const source = path.join(root, "source");
  const store = path.join(root, "local");
  const config = path.join(root, "oci-profile.json");
  await writeFile(source, sample);
  await writeFile(config, JSON.stringify({
    schema: "magistral.oci-object-profile/v1",
    bucket: "magistral-objects",
    region: "eu-marseille-1",
    auth: "instance_principal",
    python: "/nonexistent/python",
    freeTierVerified: false,
  }));
  const cli = path.resolve("bin/magistral-objects.js");
  await assert.rejects(
    execute(process.execPath, [cli, "put", source, "--store", store, "--oci-config", config]),
  );
  const { access } = await import("node:fs/promises");
  await assert.rejects(access(store));
});

test("CLI rejects malformed and relative OCI configurations without network access", async (t) => {
  const root = await temp(t);
  const source = path.join(root, "source");
  const profile = path.join(root, "bad-profile.json");
  await writeFile(source, sample);
  await writeFile(profile, JSON.stringify({ schema: "unknown-profile" }));
  const cli = path.resolve("bin/magistral-objects.js");
  await assert.rejects(
    execute(process.execPath, [cli, "put", source, "--oci-config", profile]),
  );
  await assert.rejects(
    execute(process.execPath, [cli, "put", source, "--oci-config", "relative-file.json"]),
  );
});
