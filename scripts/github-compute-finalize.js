import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { recoverComputeFailure, isSkippedComputeReplay } from "./github-compute-failure.js";


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
const phaseOutcomes = [
  ["parse-event",process.env.COMPUTE_PHASE_REQUEST],
  ["idempotency-check",process.env.COMPUTE_PHASE_REPLAY],
  ["resource-admission",process.env.COMPUTE_PHASE_ADMISSION],
  ["source-verification",process.env.COMPUTE_PHASE_VERIFY],
  ["execute",process.env.COMPUTE_PHASE_EXECUTE],
];
const failedPhase = phaseOutcomes.find(([, outcome]) => outcome === "failure")?.[0];
const firstDiagnostic = load(path.join(process.env.RUNNER_TEMP, "compute-first-error.json"))
  || (failedPhase ? {schema:"cop.compute-diagnostic/v1",phase:failedPhase,
    error_code:"control_phase_failed",message:`control_phase_failed:${failedPhase}`,
    error_type:"WorkflowStepFailure",exit_code:null} : null);
const runUrl=`${process.env.GITHUB_SERVER_URL||"https://github.com"}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`;

// Replayed requests are intentionally skipped by the workflow. A skipped
// execution is NOT an interrupted computation and must not mint a failed receipt.
// Verify the prior durable callback first. Fail closed if it cannot be seen.
const replaySkipped = isSkippedComputeReplay({request,result,diagnostic:firstDiagnostic,
  phases:{request:process.env.COMPUTE_PHASE_REQUEST,replay:process.env.COMPUTE_PHASE_REPLAY,
    admission:process.env.COMPUTE_PHASE_ADMISSION,verify:process.env.COMPUTE_PHASE_VERIFY,
    execute:process.env.COMPUTE_PHASE_EXECUTE}});
if (replaySkipped) {
  const prior = runGh([`repos/${repository}/issues/${issue}/comments?per_page=100`,"--paginate","--jq",".[].body"]);
  if (prior.status === 0 && prior.stdout.includes(marker)) {
    console.log("Compute request replay: existing receipt retained; no new receipt");
    process.exit(0);
  }
  console.error("Compute replay skipped without independently verified prior receipt");
  process.exitCode = 1;
  process.exit();
}

if (!result || result.schema!=="cop.compute-result/v1") {
  const fallback=request||{
    computation_id:computationId,
    repository:{name:repository,ref:process.env.GITHUB_SHA||"unavailable"},
    operation:{kind:"unparsed"},
  };
  result=recoverComputeFailure({
    request:fallback,runId:process.env.GITHUB_RUN_ID,runUrl,
    reason:firstDiagnostic?.message || (request?"compute_pipeline_interrupted":"compute_request_not_admitted_or_invalid"),
  });
}
// The first fault remains authoritative; a downstream finalizer fault must not erase it.
if (firstDiagnostic && result.execution_receipt?.status === "failed") {
  result.result = { ...result.result, phase: firstDiagnostic.phase,
    error_code: firstDiagnostic.error_code,
    root_cause: firstDiagnostic,
    error: firstDiagnostic.message };
  result.execution_receipt = { ...result.execution_receipt,
    error: firstDiagnostic.message };
}
const outbox=path.join(process.env.RUNNER_TEMP,"compute-outbox");
const deliveryFailure = (phase, cause) => {
  const diagnostic={schema:"cop.compute-delivery-error/v1",phase,computation_id:computationId,
    error:String(cause||"unknown").slice(0,400),run_url:runUrl};
  fs.writeFileSync(path.join(outbox,"delivery-error.json"),JSON.stringify(diagnostic,null,2));
  console.error(phase,diagnostic.error);
};
fs.mkdirSync(outbox,{recursive:true});
const envelope={schema:"cop.compute-outbox/v1",repository,issue,computation_id:computationId,marker,body:["<!-- cop-compute-result:"+computationId+" -->","## COP compute result","","```json",JSON.stringify(result,null,2),"```"].join("\n")};
fs.writeFileSync(path.join(outbox,"pending.json"),JSON.stringify(envelope,null,2));
if (!Number.isInteger(issue)||issue<1||!repository) {
  console.log("Compute callback unavailable: cannot identify originating Issue");
  process.exit(0);
}
const list=runGh([`repos/${repository}/issues/${issue}/comments?per_page=100`]);
if(list.status!==0){
  deliveryFailure("callback_idempotency_read_failed",list.stderr||list.error?.message);
  if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,"\nCallback pending: idempotency read failed.\n");
  process.exit(0);
}
if(list.status===0){
  try {
    if(JSON.parse(list.stdout).some(c=>String(c.body).includes(marker))) {
      fs.renameSync(path.join(outbox,"pending.json"),path.join(outbox,"delivered.json"));
      console.log("Compute receipt already published");process.exit(0);
    }
  }catch(err){
    deliveryFailure('callback_idempotency_invalid_response',err.message);
    process.exitCode = 0;
    process.exit();
  }
}
const comment=envelope.body;
const posted=runGh([`repos/${repository}/issues/${issue}/comments`,"-f",`body=${comment}`]);
if(posted.status===0){
 fs.renameSync(path.join(outbox,"pending.json"),path.join(outbox,"delivered.json"));
 console.log(`Compute result published to issue #${issue}`);process.exit(0);
}
const summary=process.env.GITHUB_STEP_SUMMARY;
if(summary) fs.appendFileSync(summary,`\nCompute result callback temporarily unavailable for ${computationId}. Run: ${runUrl}.\n`);
deliveryFailure("callback_post_failed",posted.stderr||posted.error?.message);
// GitHub provider unavailability cannot be transformed into a durable callback.
