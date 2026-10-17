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
