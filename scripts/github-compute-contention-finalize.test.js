import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
for(const status of ["contended","collision","deferred"]){
 test("claim "+status+" is not mistaken for missing replay receipt",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"claim-finalizer-"));
  try {
   fs.writeFileSync(path.join(dir,"event.json"),JSON.stringify({issue:{number:120},comment:{id:234,body:'{"computation_id":"e5-contend"}'}}));
   fs.writeFileSync(path.join(dir,"compute-request.json"),JSON.stringify({computation_id:"e5-contend",repository:{name:"JeanHuguesRobert/inseme",ref:"a".repeat(40)},operation:{kind:"sha256-file"}}));
   const p=spawnSync(process.execPath,["scripts/github-compute-finalize.js"],{cwd:process.cwd(),encoding:"utf8",env:{...process.env,RUNNER_TEMP:dir,GITHUB_EVENT_PATH:path.join(dir,"event.json"),GITHUB_REPOSITORY:"JeanHuguesRobert/inseme",GITHUB_RUN_ID:"123",COMPUTE_PHASE_REQUEST:"success",COMPUTE_PHASE_REPLAY:"success",COMPUTE_PHASE_CLAIM:status,COMPUTE_PHASE_ADMISSION:"skipped",COMPUTE_PHASE_VERIFY:"skipped",COMPUTE_PHASE_EXECUTE:"skipped"}});
   assert.equal(p.status,0,p.stderr);
   assert.match(p.stdout,new RegExp("Compute claim "+status));
   assert.ok(!fs.existsSync(path.join(dir,"compute-outbox","pending.json")));
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
 });
}
