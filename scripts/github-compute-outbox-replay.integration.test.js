import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";

test("pending artifact is published once and subsequent replay is idempotent",()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"cop-replay-integration-"));
 try{
  const bin=path.join(dir,"bin");fs.mkdirSync(bin);
  const payload={schema:"cop.compute-outbox/v1",repository:"JeanHuguesRobert/inseme",
    issue:142,computation_id:"replay-test",
    marker:"<!-- cop-compute-result:replay-test -->",
    body:"<!-- cop-compute-result:replay-test -->\n## COP compute result\n"};
  fs.writeFileSync(path.join(dir,"pending.json"),JSON.stringify(payload));
  const z=spawnSync("zip",["-q",path.join(dir,"outbox.zip"),"pending.json"],{cwd:dir,encoding:"utf8"});
  assert.equal(z.status,0,z.stderr);
  const gh=path.join(bin,"gh");
  fs.writeFileSync(gh,`#!/bin/sh
case "$*" in
 *actions/artifacts/17/zip*) cat "$MOCK_ZIP"; exit 0;;
 *actions/artifacts*) echo '{"artifacts":[{"id":17,"name":"compute-outbox-100-1","expired":false}]}'; exit 0;;
 *issues/142/comments*) 
   if [ "$MOCK_REPLAY" = "already" ]; then echo '[[{"body":"<!-- cop-compute-result:replay-test -->"}]]'; else echo '[[]]'; fi
   exit 0;;
esac
echo '{"id":1}'
`);
  fs.chmodSync(gh,0o755);
  for(const [mode,posted,already] of [["new",1,0],["already",0,1]]){
   const p=spawnSync(process.execPath,["scripts/github-compute-outbox-replay.js"],{
    cwd:process.cwd(),encoding:"utf8",
    env:{...process.env,PATH:bin+path.delimiter+process.env.PATH,
      GITHUB_REPOSITORY:"JeanHuguesRobert/inseme",MOCK_ZIP:path.join(dir,"outbox.zip"),MOCK_REPLAY:mode}
   });
   assert.equal(p.status,0,p.stderr);
   const result=JSON.parse(p.stdout.trim());
   assert.equal(result.replayed,posted);
   assert.equal(result.already,already);
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test("forward and outbox replay stay syntactically valid",()=>{
 for(const script of ["scripts/github-compute-forward.js","scripts/github-compute-outbox-replay.js"]){
  const r=spawnSync(process.execPath,["--check",script],{encoding:"utf8"});
  assert.equal(r.status,0,script+": "+r.stderr);
 }
});

test("blocked hop: unreadable Issue defers, recovery posts once, subsequent replay deduplicates",()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"cop-blocked-hop-"));
 try {
  const bin=path.join(dir,"bin");fs.mkdirSync(bin);
  const marker="<!-- cop-compute-hop:replay-test:blocked:100 -->";
  const payload={schema:"cop.compute-outbox/v1",repository:"JeanHuguesRobert/inseme",
   issue:142,computation_id:"replay-test",marker,
   body:marker+"\\n## COP compute hop (nonterminal)\\n\\n"+JSON.stringify({schema:"cop.compute-hop/v1",terminal:false,status:"blocked"})};
  fs.writeFileSync(path.join(dir,"pending.json"),JSON.stringify(payload));
  const z=spawnSync("zip",["-q",path.join(dir,"outbox.zip"),"pending.json"],{cwd:dir,encoding:"utf8"});
  assert.equal(z.status,0,z.stderr);
  const gh=path.join(bin,"gh");
  fs.writeFileSync(gh,`#!/bin/sh
case "$*" in
 *actions/artifacts/17/zip*) cat "$MOCK_ZIP"; exit 0;;
 *actions/artifacts*) echo '{"artifacts":[{"id":17,"name":"compute-outbox-100-1","expired":false}]}'; exit 0;;
 *issues/142/comments?*) 
   if [ "$MOCK_REPLAY" = "unreadable" ]; then echo unavailable >&2; exit 9; fi
   if [ "$MOCK_REPLAY" = "already" ]; then echo '[[{"body":"<!-- cop-compute-hop:replay-test:blocked:100 -->"}]]'; else echo '[[]]'; fi
   exit 0;;
esac
echo '{"id":1}'
`);
  fs.chmodSync(gh,0o755);
  for(const [mode,expected] of [["unreadable",{replayed:0,already:0,failed:1}],
                                ["new",{replayed:1,already:0,failed:0}],
                                ["already",{replayed:0,already:1,failed:0}]]){
   const p=spawnSync(process.execPath,["scripts/github-compute-outbox-replay.js"],{
    cwd:process.cwd(),encoding:"utf8",timeout:15000,
    env:{...process.env,PATH:bin+path.delimiter+process.env.PATH,
      GITHUB_REPOSITORY:"JeanHuguesRobert/inseme",MOCK_ZIP:path.join(dir,"outbox.zip"),MOCK_REPLAY:mode}
   });
   assert.equal(p.status,0,mode+": "+p.stderr);
   const result=JSON.parse(p.stdout.trim());
   for(const [key,value] of Object.entries(expected))assert.equal(result[key],value,mode+" "+key);
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
