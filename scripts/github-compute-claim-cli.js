import fs from "node:fs";
import {spawnSync} from "node:child_process";
import {reserveComputeClaim} from "./github-compute-claim.js";
export async function claimForCompute(request,{runId,repository,refSha,api}={}) {
 if(repository!==request?.repository?.name||!/^[0-9a-f]{40}$/.test(refSha||""))throw Error("invalid_claim_context");
 const call=api||((method,route,args=[])=>{
  const r=spawnSync("gh",["api","-X",method,route,...args],{encoding:"utf8",timeout:15000,maxBuffer:1e6});
  if(r.status!==0)throw Error("api_unavailable:"+String(r.stderr).slice(0,150));
  return JSON.parse(r.stdout);
 });
 return reserveComputeClaim({request,runId,
 createRef:async identity=>{
  const tag=identity.ref.slice("refs/tags/".length);
  const t=await call("POST",`repos/${repository}/git/tags`,["-f",`tag=${tag}`,"-f",`message=${JSON.stringify(identity)}`,"-f",`object=${refSha}`,"-f","type=commit"]);
  await call("POST",`repos/${repository}/git/refs`,["-f",`ref=${identity.ref}`,"-f",`sha=${t.sha}`]);
  return {created:true};
 },readRef:async ref=>{
  const tag=ref.slice("refs/tags/".length);
  const obj=await call("GET",`repos/${repository}/git/ref/tags/${tag}`);
  const t=await call("GET",`repos/${repository}/git/tags/${obj.object.sha}`);
  return JSON.parse(t.message);
 }});
}
if(process.argv[1]?.endsWith("/github-compute-claim-cli.js")){
 const [file,output]=process.argv.slice(2);
 if(!file||!output)throw Error("required_paths");
 const request=JSON.parse(fs.readFileSync(file,"utf8"));
 const outcome=await claimForCompute(request,{runId:process.env.GITHUB_RUN_ID,repository:process.env.GITHUB_REPOSITORY,refSha:process.env.GITHUB_SHA});
 fs.appendFileSync(output,`outcome=${outcome.status}\n`);
 console.log(JSON.stringify(outcome));
}
