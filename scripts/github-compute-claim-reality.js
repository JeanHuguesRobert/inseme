import {spawnSync} from "node:child_process";
import {reserveComputeClaim} from "./github-compute-claim.js";
const [id, payloadLabel="same"] = process.argv.slice(2);
if(!id)throw Error("missing_claim_id");
const repo=process.env.GITHUB_REPOSITORY, runId=process.env.GITHUB_RUN_ID;
if(repo!=="JeanHuguesRobert/inseme"||!runId)throw Error("invalid_reality_context");
const request={schema:"cop.compute-request/v1",computation_id:id,repository:{name:repo},
 operation:{kind:"synthetic-claim",label:payloadLabel}};
const gh=(method,path,args=[])=>{
 const r=spawnSync("gh",["api","-X",method,path,...args],{encoding:"utf8",timeout:15000,maxBuffer:100000});
 if(r.status!==0)throw Error("github_api_error:"+String(r.stderr).slice(0,200));
 return JSON.parse(r.stdout);
};
const state=await reserveComputeClaim({request,runId,
 createRef:async identity=>{
   const tag=identity.ref.slice("refs/tags/".length);
   const t=gh("POST",`repos/${repo}/git/tags`,["-f",`tag=${tag}`,"-f",`message=${JSON.stringify(identity)}`,"-f",`object=${process.env.GITHUB_SHA}`,"-f","type=commit"]);
   gh("POST",`repos/${repo}/git/refs`,["-f",`ref=${identity.ref}`,"-f",`sha=${t.sha}`]);
   return {created:true};
 },
 readRef:async ref=>{
   const name=ref.slice("refs/tags/".length);
   const entry=gh("GET",`repos/${repo}/git/ref/tags/${name}`);
   const tag=gh("GET",`repos/${repo}/git/tags/${entry.object.sha}`);
   return JSON.parse(tag.message);
 }});
const receipt={schema:"cop.compute-claim-reality-receipt/v1",...state,
 provider_run_url:`https://github.com/${repo}/actions/runs/${runId}`,effect_executed:false};
console.log(JSON.stringify(receipt));
const body="## Compute claim E5 reality test\n\n"+JSON.stringify(receipt,null,2);
try{
 gh("POST",`repos/${repo}/issues/120/comments`,["-f",`body=${body}`]);
}catch(e){console.error("receipt_delivery_failed",e.message);process.exitCode=1;}
