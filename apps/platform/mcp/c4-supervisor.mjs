import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const phase = process.argv[2];
const dir = process.argv[3] || "c4-artifact";
const report = { schema:"cop.c4.outcome/v1", phase, status:"error", stages:[], errors:[], run_id:process.env.GITHUB_RUN_ID || "local" };
await mkdir(dir,{recursive:true});
function execute(label, cmd, args) {
  const r=spawnSync(cmd,args,{encoding:"utf8",env:process.env});
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  const ok = r.status === 0 && !r.error;
  report.stages.push({label, status:ok?"completed":"error", exit_code:r.status});
  if (!ok) report.errors.push({stage:label, code:r.error?.code || "COMMAND_FAILED", message:r.error?.message || "Command exited with "+r.status});
  return ok;
}
try {
  if (!["produce","consume"].includes(phase)) throw Error("invalid phase");
  if (process.env.C4_INJECT_ERROR === "1") throw Error("C4 controlled exception test");
  if (execute("build-cop-core","pnpm",["--filter","@inseme/cop-core","run","build"])) {
    if (execute(phase,"node",["apps/platform/mcp/c4-"+(phase==="produce"?"producer":"consumer")+".mjs",dir])) {
      report.status="completed";
    }
  }
} catch (error) {
  report.errors.push({stage:"supervisor",code:error.code || "EXCEPTION",message:error.message || String(error)});
} finally {
  await writeFile(dir+"/"+(phase === "consume" ? "consumer-outcome.json" : "outcome.json"),JSON.stringify(report,null,2)+"\n");
  console.log("C4_OUTCOME "+JSON.stringify(report));
}
