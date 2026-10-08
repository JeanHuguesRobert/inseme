import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryPacketClaimCoordinator } from "../packages/cop-kernel/src/packetCoordination.js";
import { planPacketResultPromotion } from "./packet-compute-coordination.js";
const artifact={path:"output.md",bytes:3,sha256:"a".repeat(64)};
const handoff={schema:"cop.packet-artifact-handoff/v1",packet_ref:"packet:test",state:"verified-ready-for-adapter",artifact};
test("compute result can be observed without a mutation claim",()=>{
 const r=planPacketResultPromotion({packetRef:"packet:test",handoff,projection:{},claim:null});
 assert.equal(r.status,"observation-only");assert.deepEqual(r.artifact,artifact);
});
test("current F1 claim is promotion preflight, not effect authorization",async()=>{
 let now=Date.parse("2026-10-08T12:00:00Z");
 const c=new InMemoryPacketClaimCoordinator({now:()=>now});
 const a=await c.tryClaim({packetRef:"packet:test",handlerRef:"scheduler:A",ttlMs:1000});
 const r=planPacketResultPromotion({packetRef:"packet:test",handoff,projection:c.inspect("packet:test"),claim:a.claim,now:new Date(now)});
 assert.equal(r.status,"promotion-preflight-passed");
 assert.equal(r.effect_boundary_recheck_required,true);
 assert.equal(r.claim_epoch,1);
});
test("expired claim cannot promote late Compute output",async()=>{
 let now=Date.parse("2026-10-08T12:00:00Z");
 const c=new InMemoryPacketClaimCoordinator({now:()=>now});
 const a=await c.tryClaim({packetRef:"packet:test",handlerRef:"scheduler:A",ttlMs:1000});
 now+=1001;
 await c.tryClaim({packetRef:"packet:test",handlerRef:"scheduler:B",ttlMs:1000});
 const r=planPacketResultPromotion({packetRef:"packet:test",handoff,projection:c.inspect("packet:test"),claim:a.claim,now:new Date(now)});
 assert.equal(r.status,"observation-only");assert.equal(r.reason,"STALE_CLAIM");
});
