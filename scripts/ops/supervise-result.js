#!/usr/bin/env node
/**
 * Non-failing job-result supervisor for bounded commands.
 * Outcome is data, never this process exit status (except uncapturable
 * runner/platform failures). Intended for GitHub Actions.
 *
 * Usage: node scripts/ops/supervise-result.js --out DIR --phase NAME -- CMD [args...]
 * Does not invoke a shell: commands/arguments are explicit and trusted in the workflow.
 */
import {spawnSync} from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export function supervise({phase, command, args = [], outputDir, run = spawnSync}) {
  if (!phase || !command || !outputDir) throw new TypeError("phase, command and outputDir required");
  const started = new Date().toISOString();
  let status = null, signal = null, error = null, output = "";
  try {
    const result = run(command, args, {encoding:"utf8",timeout:300000,maxBuffer:8 * 1024 * 1024});
    status = Number.isInteger(result.status) ? result.status : null;
    signal = result.signal || null;
    error = result.error ? String(result.error.message || result.error) : null;
    output = String(result.stdout || "") + String(result.stderr || "");
  } catch (e) {
    error = String(e?.stack || e);
  }
  const passed = status === 0 && !signal && !error;
  const receipt = {schema:"fbf.supervised-result/v1",phase,passed,status:passed?"completed":"failed",
    exit_code:status,signal,error,started_at:started,finished_at:new Date().toISOString()};
  fs.mkdirSync(outputDir,{recursive:true});
  fs.writeFileSync(path.join(outputDir,"result.json"),JSON.stringify(receipt,null,2)+"\n");
  fs.writeFileSync(path.join(outputDir,"test.log"),output + (error ? "\n"+error+"\n" : ""));
  return receipt;
}

function main(argv) {
  const separator=argv.indexOf("--");
  const opts=separator>=0?argv.slice(0,separator):argv;
  const cmd=separator>=0?argv.slice(separator+1):[];
  const flag=(name)=>{const i=opts.indexOf(name);return i>=0?opts[i+1]:null;};
  const out=flag("--out"),phase=flag("--phase")||"execute";
  try {
    const receipt=supervise({phase,command:cmd[0],args:cmd.slice(1),outputDir:out});
    process.stdout.write(JSON.stringify(receipt)+"\n");
  } catch(e) {
    // A malformed invocation is recorded as a work error when an output
    // location is supplied. Without any location the platform log is fallback.
    const error=String(e?.stack||e);
    try {
      if(out) {
        fs.mkdirSync(out,{recursive:true});
        fs.writeFileSync(path.join(out,"result.json"),JSON.stringify({
          schema:"fbf.supervised-result/v1",phase,passed:false,status:"failed",
          exit_code:null,signal:null,error
        },null,2)+"\n");
        fs.writeFileSync(path.join(out,"test.log"),error+"\n");
      }
    } catch {}
    process.stderr.write(error+"\n");
  }
  // Never signal a domain failure through GitHub check status.
  process.exitCode=0;
}

if(process.argv[1] && import.meta.url===new URL("file://"+path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2));
}
