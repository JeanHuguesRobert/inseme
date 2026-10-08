import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryPacketClaimCoordinator } from "../packages/cop-kernel/src/packetCoordination.js";
import { observePacketSnapshot,checkPacketEffectFence } from "./packet-effect-fence.js";
test("F2 snapshots do not lock writers and preserve stale observed generation",async()=>{
  const c=new InMemoryPacketClaimCoordinator();
  const old=observePacketSnapshot({packetRef:"p",projection:c.inspect("p")});
  const acquired=await c.tryClaim({packetRef:"p",handlerRef:"A"});
  const done=await c.complete({packetRef:"p",claimId:acquired.claim.claim_id,handlerRef:"A",epoch:acquired.claim.epoch});
  assert.equal(old.observed_generation,1);
  assert.equal(done.generation,2);
  assert.equal(c.inspect("p").generation,2);
});
test("F4 valid claim and generation pass only effect preflight",async()=>{
 const c=new InMemoryPacketClaimCoordinator();
 const a=(await c.tryClaim({packetRef:"p",handlerRef:"A"})).claim;
 const r=checkPacketEffectFence({packetRef:"p",projection:c.inspect("p"),claim:a,expectedGeneration:1,idempotencyKey:"p:publish:1"});
 assert.equal(r.ok,true);assert.equal(r.atomic_commit_required,true);
});
test("F4 stale handler fenced after takeover",async()=>{
 let now=100000;
 const c=new InMemoryPacketClaimCoordinator({now:()=>now});
 const a=(await c.tryClaim({packetRef:"p",handlerRef:"A",ttlMs:1000})).claim;
 now+=1001;
 await c.tryClaim({packetRef:"p",handlerRef:"B",ttlMs:1000});
 const r=checkPacketEffectFence({packetRef:"p",projection:c.inspect("p"),claim:a,expectedGeneration:1,idempotencyKey:"effect:A",now:new Date(now)});
 assert.equal(r.code,"STALE_CLAIM");
});
test("F4 detects version mismatch and idempotency replay",async()=>{
 const c=new InMemoryPacketClaimCoordinator();
 const a=(await c.tryClaim({packetRef:"p",handlerRef:"A"})).claim;
 const base={packetRef:"p",projection:c.inspect("p"),claim:a,idempotencyKey:"p:draft:1"};
 assert.equal(checkPacketEffectFence({...base,expectedGeneration:2}).code,"STALE_GENERATION");
 const seen=new Map([["p:draft:1",{packet_ref:"p",generation:1,effect_ref:"draft:receipt:1"}]]);
 assert.equal(checkPacketEffectFence({...base,expectedGeneration:1,seenKeys:seen}).code,"ALREADY_APPLIED");
 assert.equal(checkPacketEffectFence({...base,expectedGeneration:2,seenKeys:seen}).code,"IDEMPOTENCY_CONFLICT");
});
