import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";

// Replays only pending COP result envelopes originating in this repository.
// A failed idempotency check is never permission to post a second result.
const repo=process.env.GITHUB_REPOSITORY;
if(!/^[\w.-]+\/[\w.-]+$/.test(repo||""))throw Error("invalid_repository");
const gh=(args,limit=1000000)=>spawnSync("gh",["api",...args],{encoding:"utf8",timeout:20000,maxBuffer:limit,env:process.env});
const fail=(where,res)=>{throw Error(where+":"+String(res.stderr||res.error?.message||res.status).slice(0,300));};
const json=(args)=>{const r=gh(args,3000000);if(r.status!==0)fail("github_api",r);return JSON.parse(r.stdout);};
const list=json([`repos/${repo}/actions/artifacts?per_page=100`]);
const candidates=(list.artifacts||[]).filter(a=>!a.expired&&/^compute-outbox-\d+-\d+$/.test(a.name)).slice(0,40);
let scanned=0,replayed=0,already=0,failed=0;
for(const a of candidates){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"cop-outbox-"));
  try{
    const archive=path.join(dir,"outbox.zip");
    const bytes=spawnSync("gh",["api",`repos/${repo}/actions/artifacts/${a.id}/zip`],{encoding:"buffer",timeout:20000,maxBuffer:10000000,env:process.env});
    if(bytes.status!==0)fail("download",bytes);
    fs.writeFileSync(archive,bytes.stdout);
    const unzip=spawnSync("unzip",["-p",archive,"pending.json"],{encoding:"utf8",timeout:5000,maxBuffer:2000000});
    if(unzip.status!==0)continue;
    const envelope=JSON.parse(unzip.stdout);
    if(envelope.schema!=="cop.compute-outbox/v1"||envelope.repository!==repo||
       !Number.isInteger(envelope.issue)||envelope.issue<1||
       !/^[A-Za-z0-9._:-]{1,128}$/.test(envelope.computation_id)|| 
       envelope.marker!==`<!-- cop-compute-result:${envelope.computation_id} -->`||
       !envelope.body?.startsWith(envelope.marker))throw Error("invalid_outbox_envelope");
    scanned++;
    const checked=gh([`repos/${repo}/issues/${envelope.issue}/comments?per_page=100`,"--paginate","--jq",".[].body"],3000000);
    if(checked.status!==0)fail("idempotency_check",checked);
    if(checked.stdout.includes(envelope.marker)){already++;continue;}
    const posted=gh([`repos/${repo}/issues/${envelope.issue}/comments`,"-f",`body=${envelope.body}`]);
    if(posted.status!==0)fail("publish",posted);
    replayed++;
  }catch(e){
    failed++;
    console.error("outbox_replay_failed",a.id,String(e.message||e).slice(0,300));
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
console.log(JSON.stringify({schema:"cop.outbox-replay-summary/v1",scanned,replayed,already,failed}));
if(failed)process.exitCode=1;
