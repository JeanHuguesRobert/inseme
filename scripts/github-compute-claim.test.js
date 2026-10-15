import test from "node:test";
import assert from "node:assert/strict";
import {reserveComputeClaim,computeClaimRef} from "./github-compute-claim.js";
const mk=(id="once",path="AGENTS.md")=>({schema:"cop.compute-request/v1",computation_id:id,repository:{name:"JeanHuguesRobert/inseme"},operation:{kind:"sha256-file",path}});
function store(){
 const data=new Map();let winners=0;
 return {data,createRef:async i=>{await Promise.resolve();if(data.has(i.ref))throw Error("already_exists");data.set(i.ref,i);winners++;return {created:true};},readRef:async ref=>data.get(ref),get winners(){return winners}};
}
test("two simultaneous attempts produce exactly one reservation owner",async()=>{
 const s=store();
 const out=await Promise.all([reserveComputeClaim({request:mk(),runId:11,...s}),reserveComputeClaim({request:mk(),runId:12,...s})]);
 assert.deepEqual(out.map(x=>x.status).sort(),["claimed","contended"]);
 assert.equal(s.winners,1);
});
test("same ID with changed payload is collision, not second claim",async()=>{
 const s=store();
 await reserveComputeClaim({request:mk(),runId:1,...s});
 const x=await reserveComputeClaim({request:mk("once","other.md"),runId:2,...s});
 assert.equal(x.status,"collision");assert.equal(s.winners,1);
});
test("transient create-ref and unavailable read is deferred",async()=>{
 const x=await reserveComputeClaim({request:mk(),runId:1,createRef:async()=>{throw Error("500")},readRef:async()=>{throw Error("503")}});
 assert.equal(x.status,"deferred");
});
test("one-shot reservation keys are deterministic and ID-isolated",()=>{
 assert.equal(computeClaimRef({repository:"JeanHuguesRobert/inseme",computation_id:"same"}),computeClaimRef({repository:"JeanHuguesRobert/inseme",computation_id:"same"}));
 assert.notEqual(computeClaimRef({repository:"JeanHuguesRobert/inseme",computation_id:"same"}),computeClaimRef({repository:"JeanHuguesRobert/inseme",computation_id:"other"}));
});

test("claimed but unfinished remains reserved: no blind retry",async()=>{
 const s=store();
 const first=await reserveComputeClaim({request:mk(),runId:101,...s});
 const afterCrash=await reserveComputeClaim({request:mk(),runId:102,...s});
 assert.equal(first.status,"claimed");
 assert.equal(afterCrash.status,"contended");
 assert.equal(afterCrash.prior_run_id,"101");
 assert.equal(s.winners,1);
});
