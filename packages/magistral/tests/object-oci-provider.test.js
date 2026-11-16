import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { createObjectMemory, hashObject } from "../src/object-memory.js";
import { createOciObjectProvider } from "../src/object-oci-provider.js";

const payload = Buffer.from("magistral::oracle::offline-contract-test\n");
const ref = hashObject(payload);
const python = "/fake/path/to/sdk-python";
const offlineBudget = {
  monthlyRequestCap: 500,
  requestBudgetDb: path.join(tmpdir(), "magistral-oci-offline-test-budget.sqlite"),
};
const execute = promisify(execFile);

function fakeBackend() {
  const objects = new Map();
  const calls = [];
  const invoke = async ({ operation, ref: key, file }) => {
    calls.push(operation);
    if (operation === "probe") {
      return { ok: true, namespace_available: true };
    }
    if (operation === "put") {
      const content = await readFile(file);
      if (hashObject(content) !== key) throw new Error("unexpected digest");
      if (!objects.has(key)) objects.set(key, content);
      return { ok: true, ref: key, size_bytes: content.length, verified: true };
    }
    if (operation === "get") {
      if (!objects.has(key)) return { ok: true, found: false };
      const content = objects.get(key);
      await writeFile(file, content, { flag: "wx" });
      return { ok: true, found: true, ref: key, size_bytes: content.length };
    }
    throw new Error("unknown operation");
  };
  return { invoke, objects, calls };
}

test("OCI provider is billing-unknown and blocks GET/PUT by default", async () => {
  const f = fakeBackend();
  const provider = createOciObjectProvider({
    bucket: "existing-private", python, invoke: f.invoke,
  });
  assert.equal(provider.billing, "unknown");
  assert.deepEqual((await provider.probe()).namespace_available, true);
  await assert.rejects(provider.get(ref), /free_tier_unverified/);
  await assert.rejects(provider.put(ref, payload), /free_tier_unverified/);
  const memory = createObjectMemory({ providers: [provider] });
  await assert.rejects(memory.putObject(payload), /insufficient_verified_copies/);
  assert.deepEqual(f.calls, ["probe"]);
});

test("after explicit off-line attestation, OCI conforms to Magistral memory contract", async () => {
  const f = fakeBackend();
  const provider = createOciObjectProvider({
    bucket: "existing-private", region: "eu-marseille-1",
    python, freeTierVerified: true, ...offlineBudget, invoke: f.invoke,
  });
  const memory = createObjectMemory({ providers: [provider] });
  assert.equal(provider.billing, "none");
  const custody = await memory.putObject(payload, { max_cost: 0 });
  assert.equal(custody.ref, ref);
  assert.deepEqual(custody.verified_copies, ["oci"]);
  assert.deepEqual((await memory.getObject(ref)).bytes, payload);
  await memory.putObject(payload);
  assert.equal(f.objects.size, 1);
});

test("a missing OCI object is unavailable, not fabricated", async () => {
  const f = fakeBackend();
  const provider = createOciObjectProvider({
    bucket: "existing-private", python, freeTierVerified: true, ...offlineBudget, invoke: f.invoke,
  });
  const memory = createObjectMemory({ providers: [provider] });
  await assert.rejects(memory.getObject(ref), (error) => {
    assert.equal(error.code, "object_unavailable");
    return true;
  });
});

test("OCI corruption never reaches a caller, even if bridge returns a good-looking receipt", async () => {
  const f = fakeBackend();
  f.objects.set(ref, Buffer.from("corrupted"));
  const provider = createOciObjectProvider({
    bucket: "existing-private", python, freeTierVerified: true, ...offlineBudget, invoke: f.invoke,
  });
  const memory = createObjectMemory({ providers: [provider] });
  await assert.rejects(memory.getObject(ref), (error) => {
    assert.equal(error.code, "object_unavailable");
    assert.equal(error.attempts[0].provider, "oci");
    return true;
  });
});

test("OCI bridge cannot be supplied unsafe bucket IDs, auth modes or implicit Python", () => {
  for (const bucket of ["", "../secret", "https://example.com", "name/name"]) {
    assert.throws(() => createOciObjectProvider({ bucket, python }), /bucket/);
  }
  assert.throws(() => createOciObjectProvider({ bucket: "ok" }), /Python/);
  assert.throws(() => createOciObjectProvider({ bucket: "ok", python, auth: "arbitrary" }), /authentication/);
  assert.throws(() => createOciObjectProvider({ bucket: "ok", python, region: "../../secret" }), /region/);
});

test("a PAYG provider cannot be enabled without a bounded durable ledger", () => {
  assert.throws(
    () => createOciObjectProvider({ bucket: "ok", python, freeTierVerified: true }),
    /monthlyRequestCap/
  );
  assert.throws(
    () => createOciObjectProvider({ bucket: "ok", python, freeTierVerified: true, monthlyRequestCap: 1001, requestBudgetDb: "/tmp/safe" }),
    /monthlyRequestCap/
  );
  assert.throws(
    () => createOciObjectProvider({ bucket: "ok", python, freeTierVerified: true, monthlyRequestCap: 500, requestBudgetDb: "relative.sqlite" }),
    /absolute requestBudgetDb/
  );
});

test("SQLite budget reserves worst-case calls before cloud access and never refunds failed attempts", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "magistral-oci-budget-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const db = path.join(directory, "requests.sqlite");
  const bridge = fileURLToPath(new URL("../src/oci-object-bridge.py", import.meta.url));
  const harness = [
    "import runpy,sys,sqlite3",
    "m=runpy.run_path(sys.argv[1])",
    "reserve=m['reserve_request_budget']",
    "budget=sys.argv[2]",
    "assert reserve(budget,10,3,'eu-marseille-1','2026-11')['reserved']==3",
    "assert reserve(budget,10,3,'eu-marseille-1','2026-11')['reserved']==6",
    "assert reserve(budget,10,2,'eu-marseille-1','2026-11')['reserved']==8",
    "try:",
    "  reserve(budget,10,3,'eu-marseille-1','2026-11')",
    "  raise AssertionError('cap bypassed')",
    "except m['RequestBudgetExceeded']:",
    "  pass",
    "assert sqlite3.connect(budget).execute('select reserved from requests').fetchone()[0]==8",
    "assert reserve(budget,10,3,'eu-marseille-1','2026-12')['reserved']==3",
    "print('budget_correct=True')",
  ].join("\n");
  const { stdout } = await execute("python3", ["-c", harness, bridge, db], { timeout: 8000 });
  assert.match(stdout, /budget_correct=True/);
});

test("concurrent OS processes cannot exceed the same persistent monthly quota", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "magistral-oci-budget-race-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const db = path.join(directory, "requests.sqlite");
  const bridge = fileURLToPath(new URL("../src/oci-object-bridge.py", import.meta.url));
  const harness = [
    "import runpy,sys",
    "m=runpy.run_path(sys.argv[1])",
    "try:",
    "  m['reserve_request_budget'](sys.argv[2],10,3,'eu-marseille-1','2026-11')",
    "except m['RequestBudgetExceeded']:",
    "  sys.exit(2)",
  ].join("\n");
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, () =>
      execute("python3", ["-c", harness, bridge, db], { timeout: 12000 })
    )
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 3);
  assert.equal(results.filter((r) => r.status === "rejected").length, 5);
});

test("separate provider names cannot double-count the exact same OCI bucket", () => {
  const a = createOciObjectProvider({ id: "a", bucket: "same", python });
  const b = createOciObjectProvider({ id: "b", bucket: "same", python });
  assert.throws(() => createObjectMemory({ providers: [a, b] }), /duplicate object storage location/);
});

test("oversized objects are rejected without reaching OCI, even when attested", async () => {
  const f = fakeBackend();
  const provider = createOciObjectProvider({
    bucket: "existing-private", python, freeTierVerified: true, ...offlineBudget, maxObjectBytes: 3,
    invoke: f.invoke,
  });
  const memory = createObjectMemory({ providers: [provider] });
  await assert.rejects(memory.putObject(payload), /insufficient_verified_copies/);
  assert.equal(f.calls.length, 0);
});
