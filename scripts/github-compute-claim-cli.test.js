import test from "node:test";
import assert from "node:assert/strict";
import {claimForCompute} from "./github-compute-claim-cli.js";
const req={schema:"cop.compute-request/v1",computation_id:"gate-test",repository:{name:"JeanHuguesRobert/inseme"},operation:{kind:"sha256-file",path:"AGENTS.md"}};
const sha="a".repeat(40);
test("GitHub adapter allows exactly one of two contenders",async()=>{
 let tagMsg,refSha;let wins=0;
 const api=async(method,route,args=[])=>{
   if(route.endsWith("/git/tags")&&method==="POST"){tagMsg=args.find(x=>x.startsWith("message=")).slice(8);return {sha:"b".repeat(40)};}
   if(route.endsWith("/git/refs")&&method==="POST"){if(wins++)throw Error("ref_exists");refSha=tagMsg;return {};}
   if(route.includes("/git/ref/tags/"))return {object:{sha:"b".repeat(40)}};
   if(route.includes("/git/tags/"))return {message:refSha};
   throw Error("unexpected_api");
 };
 const a=await claimForCompute(req,{runId:1,repository:req.repository.name,refSha:sha,api});
 const b=await claimForCompute(req,{runId:2,repository:req.repository.name,refSha:sha,api});
 assert.equal(a.status,"claimed");assert.equal(b.status,"contended");
});
test("provider lookup unavailable means deferred, never execution",async()=>{
 const a=await claimForCompute(req,{runId:3,repository:req.repository.name,refSha:sha,api:async()=>{throw Error("API 503")}});
 assert.equal(a.status,"deferred");
});
