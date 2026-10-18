import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
function run(mode) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"cop-delivery-"));
  const bin=path.join(dir,"bin");
  fs.mkdirSync(bin);
  const gh=path.join(bin,"gh");
  fs.writeFileSync(gh,`#!/bin/sh
if [ "$1" = "api" ] && [ "$2" = "repos/test/repo/issues/142/comments?per_page=100" ]; then
  if [ "$MOCK_GH_MODE" = "old-hop" ]; then echo '[[{"body":"<!-- cop-compute-result:failure-probe -->"}]]'; exit 0; fi
  if [ "$MOCK_GH_MODE" = "replay-unreadable" ]; then echo broken >&2; exit 7; fi
  if [ "$MOCK_GH_MODE" = "read-fail" ]; then echo 'read failure' >&2; exit 7; fi
  if [ "$MOCK_GH_MODE" = "invalid-json" ]; then echo '{broken'; exit 0; fi
  echo '[[]]'; exit 0
fi
if [ "$MOCK_GH_MODE" = "post-fail" ]; then echo 'post failure' >&2; exit 8; fi
echo '{}'
`);
  fs.chmodSync(gh,0o755);
  fs.writeFileSync(path.join(dir,"event.json"),JSON.stringify({issue:{number:142},comment:{id:123,body:'{"computation_id":"failure-probe"}'}}));
  if (mode.startsWith("replay-")) fs.writeFileSync(path.join(dir,"compute-request.json"),JSON.stringify({computation_id:"failure-probe",repository:{name:"test/repo",ref:"a".repeat(40)},operation:{kind:"probe"}}));
  else fs.writeFileSync(path.join(dir,"compute-result.json"),JSON.stringify({
    schema:"cop.compute-result/v1",computation_id:"failure-probe",
    result:{passed:true},execution_receipt:{status:"completed"}
  }));
  const p=spawnSync(process.execPath,["scripts/github-compute-finalize.js"],{
    cwd:root,encoding:"utf8",timeout:15000,
    env:{...process.env,PATH:bin+path.delimiter+process.env.PATH,MOCK_GH_MODE:mode,
      RUNNER_TEMP:dir,GITHUB_EVENT_PATH:path.join(dir,"event.json"),
      GITHUB_REPOSITORY:"test/repo",GITHUB_RUN_ID:"7",GITHUB_SHA:"a".repeat(40),
      GITHUB_SERVER_URL:"https://github.com",GITHUB_STEP_SUMMARY:path.join(dir,"summary"),
      ...(mode.startsWith("replay-")?{COMPUTE_PHASE_REQUEST:"success",COMPUTE_PHASE_REPLAY:"success",COMPUTE_PHASE_ADMISSION:"skipped",COMPUTE_PHASE_VERIFY:"skipped",COMPUTE_PHASE_EXECUTE:"skipped"}:{})}
  });
  const pending=path.join(dir,"compute-outbox/pending.json");
  const delivered=path.join(dir,"compute-outbox/delivered.json");
  const diagnostic=path.join(dir,"compute-outbox/delivery-error.json");
  const output={exit:p.status,stderr:p.stderr,pending:fs.existsSync(pending),
    delivered:fs.existsSync(delivered)?JSON.parse(fs.readFileSync(delivered,"utf8")):null,
    pendingEnvelope:fs.existsSync(pending)?JSON.parse(fs.readFileSync(pending,"utf8")):null,
    diagnostic:fs.existsSync(diagnostic)?JSON.parse(fs.readFileSync(diagnostic,"utf8")):null};
  fs.rmSync(dir,{recursive:true,force:true});
  return output;
}
for(const [mode,phase] of [["read-fail","callback_idempotency_read_failed"],
                           ["invalid-json","callback_idempotency_invalid_response"],
                           ["post-fail","callback_post_failed"]]) {
  test("finalizer preserves outbox for "+mode,()=>{
    const x=run(mode);
    assert.equal(x.exit,0,x.stderr);
    assert.equal(x.pending,true);
    assert.equal(x.diagnostic.phase,phase);
    assert.equal(x.diagnostic.computation_id,"failure-probe");
  });
}

test("old hop found by paginated Issue search prevents duplicate callback",()=>{
  const x=run("old-hop");
  assert.equal(x.exit,0,x.stderr);
  assert.equal(x.pending,false,"existing comment should be treated as delivered");
  assert.equal(x.diagnostic,null);
});

test("unverified skipped replay is blocked without red GitHub job or forged receipt",()=>{
  const x=run("replay-unverified");
  assert.equal(x.exit,0,x.stderr);
  assert.equal(x.pending,false);
  assert.ok(x.delivered);
  assert.match(x.delivered.marker,/cop-compute-hop:failure-probe:blocked:7/);
  assert.match(x.delivered.body,/"terminal": false/);
  assert.match(x.stderr,/replay blocked/i);
});

test("unreadable Issue history preserves blocked hop in outbox for later return",()=>{
  const x=run("replay-unreadable");
  assert.equal(x.exit,0,x.stderr);
  assert.equal(x.delivered,null);
  assert.equal(x.pending,true);
  assert.match(x.pendingEnvelope.marker,/cop-compute-hop:failure-probe:blocked:7/);
});
