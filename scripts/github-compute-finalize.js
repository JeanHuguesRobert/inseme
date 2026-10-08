import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { recoverComputeFailure } from "./github-compute-failure.js";

const load = p => { try { return JSON.parse(fs.readFileSync(p,"utf8")); } catch { return null; } };
const runGh = args => spawnSync("gh",["api",...args],{encoding:"utf8",timeout:15000,maxBuffer:2e6,env:process.env});
const event=load(process.env.GITHUB_EVENT_PATH)||{};
const issue=Number(event.issue?.number);
const repository=process.env.GITHUB_REPOSITORY;
const request=load(process.env.RUNNER_TEMP+"/compute-request.json");
const original=String(event.comment?.body||"");
const idFromBody=original.match(/"computation_id"\s*:\s*"([A-Za-z0-9._:-]{1,128})"/)?.[1];
const computationId=request?.computation_id||idFromBody||`unparsed-${event.comment?.id||process.env.GITHUB_RUN_ID||"unknown"}`;
const marker=`<!-- cop-compute-result:${computationId} -->`;
const resultFile=process.env.RUNNER_TEMP+"/compute-result.json";
let result=load(resultFile);
const runUrl=`${process.env.GITHUB_SERVER_URL||"https://github.com"}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`;
if (!result || result.schema!=="cop.compute-result/v1") {
  const fallback=request||{
    computation_id:computationId,
    repository:{name:repository,ref:process.env.GITHUB_SHA||"unavailable"},
    operation:{kind:"unparsed"},
  };
  result=recoverComputeFailure({
    request:fallback,runId:process.env.GITHUB_RUN_ID,runUrl,
    reason:request?"compute_pipeline_interrupted":"compute_request_not_admitted_or_invalid",
  });
}
const outbox=path.join(process.env.RUNNER_TEMP,"compute-outbox");
fs.mkdirSync(outbox,{recursive:true});
const envelope={schema:"cop.compute-outbox/v1",repository,issue,computation_id:computationId,marker,body:["<!-- cop-compute-result:"+computationId+" -->","## COP compute result","","```json",JSON.stringify(result,null,2),"```"].join("\n")};
fs.writeFileSync(path.join(outbox,"pending.json"),JSON.stringify(envelope,null,2));
if (!Number.isInteger(issue)||issue<1||!repository) {
  console.log("Compute callback unavailable: cannot identify originating Issue");
  process.exit(0);
}
const list=runGh([`repos/${repository}/issues/${issue}/comments?per_page=100`]);
if(list.status===0){
  try {
    if(JSON.parse(list.stdout).some(c=>String(c.body).includes(marker))) {
      fs.renameSync(path.join(outbox,"pending.json"),path.join(outbox,"delivered.json"));
      console.log("Compute receipt already published");process.exit(0);
    }
  }catch{}
}
const comment=envelope.body;
const posted=runGh([`repos/${repository}/issues/${issue}/comments`,"-f",`body=${comment}`]);
if(posted.status===0){
 fs.renameSync(path.join(outbox,"pending.json"),path.join(outbox,"delivered.json"));
 console.log(`Compute result published to issue #${issue}`);process.exit(0);
}
const summary=process.env.GITHUB_STEP_SUMMARY;
if(summary) fs.appendFileSync(summary,`\nCompute result callback temporarily unavailable for ${computationId}. Run: ${runUrl}.\n`);
console.log("Compute result publication unavailable; diagnostic left in workflow summary");
// GitHub provider unavailability cannot be transformed into a durable callback.
