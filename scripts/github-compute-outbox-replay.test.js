import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";

function run(mode){
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"outbox-replay-test-"));
 const bin=path.join(tmp,"bin");fs.mkdirSync(bin);
 const gh=path.join(bin,"gh");
 fs.writeFileSync(gh,`#!/bin/sh
case "$*" in
 *actions/artifacts*) 
   if [ "$MOCK_MODE" = "provider-fail" ]; then echo 'api unavailable' >&2; exit 9; fi
   echo '{"artifacts":[]}'; exit 0;;
esac
echo "unexpected command" >&2
exit 20
`);
 fs.chmodSync(gh,0o755);
 const p=spawnSync(process.execPath,["scripts/github-compute-outbox-replay.js"],{
  encoding:"utf8",cwd:process.cwd(),timeout:10000,
  env:{...process.env,GITHUB_REPOSITORY:"JeanHuguesRobert/inseme",MOCK_MODE:mode,
   PATH:bin+path.delimiter+process.env.PATH}
 });
 fs.rmSync(tmp,{recursive:true,force:true});return p;
}
test("empty outbox completes without posting",()=>{
 const p=run("empty");assert.equal(p.status,0,p.stderr);
 assert.deepEqual(JSON.parse(p.stdout.trim()),{
  schema:"cop.outbox-replay-summary/v1",scanned:0,replayed:0,already:0,failed:0});
});
test("provider unavailability remains observable",()=>{
 const p=run("provider-fail");assert.notEqual(p.status,0);
 assert.match(p.stderr,/api unavailable/);
});
