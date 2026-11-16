import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, cp, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSshObjectProvider } from "../src/object-ssh-provider.js";
import { createObjectMemory, hashObject } from "../src/object-memory.js";

const bytes = Buffer.from("immutable SSH peer custody test\n");
const ref = hashObject(bytes);
const baseConfig = {
  id: "workstation", alias: "thinkpad",
  python: "C:\\Users\\admin\\miniconda3\\python.exe",
  script: "C:\\Users\\admin\\AppData\\Local\\Magistral\\remote-cas\\ssh-object-bridge.py",
};

test("unverified SSH peer network costs fail closed", async () => {
  const calls = [];
  const provider = createSshObjectProvider({
    ...baseConfig, invoke: async (call) => { calls.push(call); return {}; },
  });
  assert.equal(provider.billing, "unknown");
  await assert.rejects(provider.put(ref,bytes), /network_cost_unverified/);
  await assert.rejects(provider.get(ref), /network_cost_unverified/);
  assert.equal(calls.length, 0);
});

test("SSH provider input validates remote alias, path and timeout", () => {
  for (const bad of ["-option", "name;rm", "../../etc/passwd", "alias with spaces"]) {
    assert.throws(() => createSshObjectProvider({ ...baseConfig, alias: bad }), /SSH alias/);
  }
  assert.throws(() => createSshObjectProvider({
    ...baseConfig, script: "../../escape",
  }), /bridge path/);
  assert.throws(() => createSshObjectProvider({
    ...baseConfig, timeoutMs: 9999999,
  }), /timeout/);
});

test("peer transports exact immutable bytes through a mock adapter", async () => {
  let stored = null;
  const provider = createSshObjectProvider({
    ...baseConfig, networkCostVerified: true,
    invoke: async ({ operation, ref: key, bytes: payload }) => {
      if (operation === "put") {
        stored = Buffer.from(payload);
        return { data: Buffer.from(JSON.stringify({
          ok: true, ref: key, size_bytes: stored.length,
        })) };
      }
      if (operation === "get") return { data: stored };
      if (operation === "verify") {
        if (stored === null) return { missing: true };
        return { data: Buffer.from(JSON.stringify({
          ok: true, verified: true, ref: key, size_bytes: stored.length,
        })) };
      }
      return { data: Buffer.from(JSON.stringify({
        protocol: "magistral.ssh-cas/v0", ok: true, free_bytes: 10000000000,
        max_object_bytes: 67108864,
      })) };
    },
  });
  const memory = createObjectMemory({ providers: [provider] });
  assert.equal((await provider.probe()).available, true);
  assert.equal((await memory.putObject(bytes)).ref, ref);
  assert.deepEqual((await memory.getObject(ref)).bytes, bytes);
  assert.equal((await provider.verify(ref)).verified, true);
});

test("a forged or inconsistent remote verification cannot be counted", async () => {
  const provider = createSshObjectProvider({
    ...baseConfig, networkCostVerified: true,
    invoke: async ({operation,ref:key,bytes:payload}) => {
      if(operation==="verify"){
        return {data:Buffer.from(JSON.stringify({
          ok:true,verified:true,ref:key,size_bytes:99999,
        }))};
      }
      return {data:Buffer.from(JSON.stringify({
        ok:true,ref:key,size_bytes:payload.length,
      }))};
    },
  });
  const memory=createObjectMemory({providers:[provider]});
  await assert.rejects(memory.putObject(bytes),(error)=>{
    assert.equal(error.code,"insufficient_verified_copies");
    return true;
  });
});

test("missing or corrupted peer copies never appear to be verified", async () => {
  const empty = createSshObjectProvider({
    ...baseConfig, networkCostVerified: true,
    invoke: async () => ({ missing: true }),
  });
  assert.equal(await empty.get(ref), null);
  const corrupted = createSshObjectProvider({
    ...baseConfig, networkCostVerified: true,
    invoke: async () => ({ data: Buffer.from("corrupt") }),
  });
  await assert.rejects(corrupted.get(ref), /integrity_mismatch/);
});

test("Termux Python without os.link uses serialized rename safely", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "magistral-termux-bridge-"));
  t.after(() => rm(root,{ recursive: true, force: true }));
  const localScript = path.resolve("src/ssh-object-bridge.py");
  const script = path.join(root,"ssh-object-bridge.py");
  await cp(localScript,script);
  const harness = [
    "import os,runpy,sys",
    "if hasattr(os,'link'):del os.link",
    "script=sys.argv[1];digest=sys.argv[2]",
    "sys.argv=['bridge','put',digest]",
    "runpy.run_path(script,run_name='__main__')",
  ].join("\\n").replaceAll("\\n","\n");
  const result=await new Promise((resolve,reject)=>{
    const proc=spawn("python3",["-c",harness,script,ref],{
      stdio:["pipe","pipe","pipe"],
    });
    const output=[];
    const errors=[];
    proc.stdout.on("data",(chunk)=>output.push(chunk));
    proc.stderr.on("data",(chunk)=>errors.push(chunk));
    proc.on("close",(code)=>resolve({
      code,output:Buffer.concat(output),error:Buffer.concat(errors),
    }));
    proc.on("error",reject);
    proc.stdin.end(bytes);
  });
  assert.equal(result.code,0,result.error.toString());
  assert.equal(JSON.parse(result.output.toString()).ref,ref);
});

test("peer content-addressed files are independent from their location", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "magistral-ssh-bridge-"));
  t.after(() => rm(root,{ recursive: true, force: true }));
  const localScript = path.resolve("src/ssh-object-bridge.py");
  const script = path.join(root,"ssh-object-bridge.py");
  await cp(localScript,script);
  const run = (operation,payload=null) => new Promise((resolve,reject) => {
    const proc=spawn("python3",[script,operation,ref],{
      stdio:["pipe","pipe","pipe"],
    });
    const chunks=[];
    const errors=[];
    proc.stdout.on("data",(chunk)=>chunks.push(chunk));
    proc.stderr.on("data",(chunk)=>errors.push(chunk));
    proc.on("error",reject);
    proc.on("close",(code)=>resolve({code,bytes:Buffer.concat(chunks),error:Buffer.concat(errors)}));
    proc.stdin.end(payload||undefined);
  });
  const first=await run("put",bytes);
  assert.equal(first.code,0);
  const repeat=await run("put",bytes);
  assert.equal(repeat.code,0);
  assert.equal(JSON.parse(repeat.bytes.toString()).existing,true);
  const get=await run("get");
  assert.equal(get.code,0);
  assert.deepEqual(get.bytes,bytes);
  const verified=await run("verify");
  assert.equal(verified.code,0);
  assert.equal(JSON.parse(verified.bytes.toString()).verified,true);
  const wrongDigest = hashObject(Buffer.from("missing"));
  const missing=await new Promise((resolve,reject)=>{
    const proc=spawn("python3",[script,"get",wrongDigest]);
    proc.on("close",(code)=>resolve(code));
    proc.on("error",reject);
  });
  assert.equal(missing,4);
});
