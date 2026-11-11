import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { publicJhnBuildEnv } from "./build-jhn.js";

function jwt(role) {
 const encode=x=>Buffer.from(JSON.stringify(x)).toString("base64url");
 return [encode({alg:"HS256",typ:"JWT"}),encode({role}),"test-signature"].join(".");
}
test("JHN public build reads only URL + anon key from the repository root env",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"inseme-jhn-build-"));
 try {
  const file=join(dir,".env"),anon=jwt("anon");
  await writeFile(file,`SUPABASE_URL=https://project.supabase.co
SUPABASE_ANON_KEY="${anon}"
SUPABASE_SERVICE_ROLE_KEY=must-never-be-injected
`);
  const resolved=await publicJhnBuildEnv({rootEnvFile:file,env:{}});
  assert.deepEqual(resolved,{VITE_SUPABASE_URL:"https://project.supabase.co",VITE_SUPABASE_ANON_KEY:anon});
  assert.equal(JSON.stringify(resolved).includes("must-never-be-injected"),false);
 } finally {await rm(dir,{recursive:true,force:true});}
});
test("JHN public build refuses absent config and admin-role JWT",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"inseme-jhn-build-"));
 try {
  const file=join(dir,".env");
  await writeFile(file,"");
  await assert.rejects(publicJhnBuildEnv({rootEnvFile:file,env:{}}),/config missing/);
  await writeFile(file,`VITE_SUPABASE_URL=https://project.supabase.co
VITE_SUPABASE_ANON_KEY=${jwt("service_role")}
`);
  await assert.rejects(publicJhnBuildEnv({rootEnvFile:file,env:{}}),/anon role/);
 } finally {await rm(dir,{recursive:true,force:true});}
});
