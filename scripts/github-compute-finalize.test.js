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
  if [ "$MOCK_GH_MODE" = "read-fail" ]; then echo 'read failure' >&2; exit 7; fi
  if [ "$MOCK_GH_MODE" = "invalid-json" ]; then echo '{broken'; exit 0; fi
  echo '[[]]'; exit 0
fi
if [ "$MOCK_GH_MODE" = "post-fail" ]; then echo 'post failure' >&2; exit 8; fi
echo '{}'
`);
  fs.chmodSync(gh,0o755);
  fs.writeFileSync(path.join(dir,"event.json"),JSON.stringify({issue:{number:142},comment:{id:123,body:'{"computation_id":"failure-probe"}'}}));
  fs.writeFileSync(path.join(dir,"compute-result.json"),JSON.stringify({
    schema:"cop.compute-result/v1",computation_id:"failure-probe",
    result:{passed:true},execution_receipt:{status:"completed"}
  }));
  const p=spawnSync(process.execPath,["scripts/github-compute-finalize.js"],{
    cwd:root,encoding:"utf8",timeout:15000,
    env:{...process.env,PATH:bin+path.delimiter+process.env.PATH,MOCK_GH_MODE:mode,
      RUNNER_TEMP:dir,GITHUB_EVENT_PATH:path.join(dir,"event.json"),
      GITHUB_REPOSITORY:"test/repo",GITHUB_RUN_ID:"7",GITHUB_SHA:"a".repeat(40),
      GITHUB_SERVER_URL:"https://github.com",GITHUB_STEP_SUMMARY:path.join(dir,"summary")}
  });
  const pending=path.join(dir,"compute-outbox/pending.json");
  const diagnostic=path.join(dir,"compute-outbox/delivery-error.json");
  const output={exit:p.status,stderr:p.stderr,pending:fs.existsSync(pending),
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
