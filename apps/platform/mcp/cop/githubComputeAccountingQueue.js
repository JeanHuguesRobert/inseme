import { readFile, writeFile, rename } from "node:fs/promises";
import { createGithubComputeAccountingConsumer } from "./githubComputeAccountingConsumer.js";
import { nextComputeAccountingPoll } from "./githubComputeAccountingPollPolicy.js";

export async function readPendingAccounting(file) {
  try { const parsed=JSON.parse(await readFile(file,"utf8")); if(!Array.isArray(parsed.jobs)) throw Error("invalid_queue"); return parsed.jobs; }
  catch(e) { if(e.code==="ENOENT") return []; throw e; }
}
export async function savePendingAccounting(file,jobs) {
  const temp=file+".next-"+process.pid;
  await writeFile(temp,JSON.stringify({schema:"cop.accounting.pending/v1",jobs},null,2),{mode:0o600});
  await rename(temp,file);
}
/** One serialized ONA invocation; jobs are queued only AFTER durable budget reservation. */
export async function runPendingAccounting({jobs,fetchResult,lifecycle,nowMs=Date.now()}={}) {
  const consumer=createGithubComputeAccountingConsumer({fetchResult,lifecycle});
  const updated=[], outcomes=[];
  for(const job of jobs) {
    if(job.state==="settled") {updated.push(job);continue;}
    if(!job.reserved || !job.epoch_id || !job.reservation_key ||
       consumer.reservationKey(job.computation_id,job.run_id)!==job.reservation_key) {
      throw Error("COP_ACCOUNTING_QUEUE_UNRESERVED");
    }
    if(job.nextAtMs>nowMs) {updated.push(job);continue;}
    try {
      const result=await consumer.settle(job);
      outcomes.push({computation_id:job.computation_id,status:"settled",duplicate:!!result?.duplicate});
      updated.push({...job,state:"settled",settledAtMs:nowMs,nextAtMs:null});
    } catch(e) {
      // Missing callback and missing meter are not zero-cost settlements.
      const failures=(job.failures||0)+1;
      const poll=nextComputeAccountingPoll({nowMs,pendingCount:1,
        runningCount:e.code==="COP_COMPUTE_NOT_READY"?1:0,consecutiveFailures:failures});
      updated.push({...job,failures,nextAtMs:poll.nextAtMs});
      outcomes.push({computation_id:job.computation_id,status:"pending",reason:String(e.code||e.message).slice(0,100)});
    }
  }
  return {jobs:updated,outcomes};
}

/**
 * Register a previously reserved computation, preserving a single immutable
 * binding per key. SQL reservation is the authority; this file is a replayable
 * projection for the node scheduler.
 */
export async function registerPendingAccounting(file, job) {
  const expected=`github-compute:${job.computation_id}:${job.run_id}`;
  if(job.reserved!==true || job.reservation_key!==expected ||
    !Number.isSafeInteger(job.issue_number) || job.issue_number<1)
    throw Error("COP_ACCOUNTING_UNRESERVED_REGISTRATION");
  const jobs=await readPendingAccounting(file);
  const old=jobs.find(j=>j.reservation_key===expected);
  if(old) {
    const identity=["epoch_id","budget_ref","unit","computation_id","run_id","repository",
      "source_ref","issue_number","actor","usage_dimension","reservation_key"];
    if(identity.some(k=>old[k]!==job[k])) throw Error("COP_ACCOUNTING_QUEUE_IDENTITY_CONFLICT");
    return {duplicate:true};
  }
  await savePendingAccounting(file,[...jobs,{...job,state:"pending",failures:0,nextAtMs:0}]);
  return {duplicate:false};
}
