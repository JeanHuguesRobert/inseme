import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readPendingAccounting,runPendingAccounting,savePendingAccounting,registerPendingAccounting } from "../cop/githubComputeAccountingQueue.js";
import { githubCommentResultFetcher, runAccountingTick } from "../../scripts/run-github-accounting-tick.js";

test("ONA-style tick is disabled by default and dormant without queue",async()=>{
 assert.deepEqual(await runAccountingTick({env:{}}),{status:"disabled"});
});
test("durable pending job settles at most once after a crash-safe write",async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),"accounting-ona-"));
 const file=path.join(dir,"pending.json");
 const job={epoch_id:"z0",budget_ref:"b",unit:"runner_wall_seconds",
  computation_id:"job1",run_id:"12",repository:"JeanHuguesRobert/inseme",source_ref:"a".repeat(40),
  issue_number:85,actor:"instance:fracta2",usage_dimension:"runner_wall_seconds",
  reservation_key:"github-compute:job1:12",reserved:true,nextAtMs:0};
 const result={schema:"cop.compute-result/v1",computation_id:"job1",
  source:{repository:job.repository,ref:job.source_ref},
  execution_binding:{provider_ref:"provider:github-actions",provider_execution_id:"12"},
  execution_receipt:{terminal:true,binding:{provider_execution_id:"12"}},
  resource_accounting:{usage:{runner_wall_seconds:{status:"observed",unit:"runner_wall_seconds",value:1.75}}}};
 let settlements=0;
 const lifecycle={reserve:async()=>{},settle:async()=>{settlements++;return {duplicate:false};}};
 try{
  await savePendingAccounting(file,[job]);
  const first=await runPendingAccounting({jobs:await readPendingAccounting(file),fetchResult:async()=>result,lifecycle,nowMs:100});
  await savePendingAccounting(file,first.jobs);
  const second=await runPendingAccounting({jobs:await readPendingAccounting(file),fetchResult:async()=>result,lifecycle,nowMs:200});
  assert.equal(settlements,1);
  assert.equal(second.jobs[0].state,"settled");
 }finally{await rm(dir,{recursive:true,force:true});}
});
test("trusted GitHub comment parser rejects unrelated author",async()=>{
 const body='<!-- cop-compute-result:job1 -->\n\`\`\`json\n'+JSON.stringify({computation_id:"job1",execution_binding:{provider_execution_id:"12"}})+'\n\`\`\`';
 const fetch=githubCommentResultFetcher({exec:()=>JSON.stringify([{user:{login:"stranger"},body}])});
 await assert.rejects(()=>fetch({computation_id:"job1",run_id:"12",repository:"JeanHuguesRobert/inseme",issue_number:85}),/NOT_READY/);
});

test("registration rejects unreserved work and conflicting replay",async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),"accounting-register-"));
 const file=path.join(dir,"queue.json");
 const base={reserved:true,epoch_id:"z0",budget_ref:"budget",unit:"runner_wall_seconds",
  computation_id:"c1",run_id:"42",issue_number:85,repository:"JeanHuguesRobert/inseme",
  source_ref:"a".repeat(40),actor:"instance:fracta2",usage_dimension:"runner_wall_seconds",
  reservation_key:"github-compute:c1:42"};
 try {
  await assert.rejects(()=>registerPendingAccounting(file,{...base,reserved:false}),/UNRESERVED/);
  assert.deepEqual(await registerPendingAccounting(file,base),{duplicate:false});
  assert.deepEqual(await registerPendingAccounting(file,base),{duplicate:true});
  await assert.rejects(()=>registerPendingAccounting(file,{...base,source_ref:"b".repeat(40)}),/IDENTITY_CONFLICT/);
  assert.equal((await readPendingAccounting(file)).length,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
