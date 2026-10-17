import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseInternalBudgetLifecycle } from "../mcp/cop/supabaseEpochBudgetGrant.js";
import { readPendingAccounting,runPendingAccounting,savePendingAccounting } from "../mcp/cop/githubComputeAccountingQueue.js";

/** ONA script job, tick-only. No new daemon, no public listener. */
export function githubCommentResultFetcher({ exec = execFileSync }={}) {
  return async ({computation_id,repository,run_id,issue_number}) => {
    if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)
      || !/^[0-9]+$/.test(run_id)
      || !Number.isSafeInteger(issue_number) || issue_number < 1)
      throw Error("invalid_github_identity");
    const apiPath=`repos/${repository}/issues/${issue_number}/comments?per_page=100`;
    const raw=exec("gh",["api",apiPath],{encoding:"utf8",timeout:20000,maxBuffer:4*1024*1024});
    // gh --paginate can concatenate JSON arrays; --slurp creates a single array.
    // Explicitly request one page only until pagination uses a tested JSON parser.
    const comments=JSON.parse(raw);
    if(!Array.isArray(comments)) throw Error("invalid_github_comments");
    for(const comment of comments) {
      if(!["github-actions[bot]","github-actions"].includes(comment.user?.login)) continue;
      if(!comment.body?.includes(`<!-- cop-compute-result:${computation_id} -->`)) continue;
      const block=comment.body.match(/\`\`\`json\s*([\s\S]*?)\`\`\`/);
      if(!block) continue;
      const result=JSON.parse(block[1]);
      if(result.computation_id===computation_id &&
        String(result.execution_binding?.provider_execution_id)===run_id) return result;
    }
    const error=Error("COP_COMPUTE_NOT_READY");error.code="COP_COMPUTE_NOT_READY";throw error;
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
