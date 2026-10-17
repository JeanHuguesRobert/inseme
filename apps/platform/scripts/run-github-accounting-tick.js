import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseInternalBudgetLifecycle } from "../mcp/cop/supabaseEpochBudgetGrant.js";
import { readPendingAccounting,runPendingAccounting,savePendingAccounting } from "../mcp/cop/githubComputeAccountingQueue.js";

/** ONA script job, tick-only. No new daemon, no public listener. */
export function githubCommentResultFetcher({ exec = execFileSync }={}) {
  return async ({computation_id,repository,run_id}) => {
    if(!/^[-\w]+\/[-\w.]+$/.test(repository) || !/^\d+$/.test(run_id))
      throw Error("invalid_github_identity");
    // Search a bounded window of comments on the run's issuing issue.
    // In production each pending job must specify issue_number (added below).
    throw Error("COP_COMPUTE_NOT_READY");
  };
}

export async function runAccountingTick({env=process.env,fetchResult}={}) {
  if(env.COP_ACCOUNTING_POLL_ENABLED!=="1") return {status:"disabled"};
  const file=env.COP_ACCOUNTING_PENDING_FILE;
  if(!file || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY && !env.SUPABASE_SERVICE_KEY)
    throw Error("accounting_tick_missing_trusted_configuration");
  const jobs=await readPendingAccounting(file);
  if(!jobs.some(j=>j.state!=="settled")) return {status:"dormant",pending:0};
  const supabase=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_SERVICE_KEY,
    {auth:{persistSession:false,autoRefreshToken:false}});
  const lifecycle=createSupabaseInternalBudgetLifecycle({supabase});
  const result=await runPendingAccounting({jobs,lifecycle,fetchResult:fetchResult||githubCommentResultFetcher()});
  await savePendingAccounting(file,result.jobs);
  return {status:"completed",outcomes:result.outcomes};
}
if(process.argv[1] && import.meta.url===new URL("file://"+process.argv[1]).href) {
  runAccountingTick().then(r=>console.log(JSON.stringify(r))).catch(e=>{
    console.error("accounting_tick_failed",String(e.code||e.message).slice(0,100));process.exitCode=1;
  });
}
