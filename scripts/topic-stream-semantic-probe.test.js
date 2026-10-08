import test from "node:test";
import assert from "node:assert/strict";
const project=(events,key,seq)=>{const seen=new Set(),streams=new Map();for(const e of events){if(seen.has(e.id))continue;seen.add(e.id);const id=e[key],n=e[seq];if(!streams.has(id))streams.set(id,[]);streams.get(id).push(n)}for(const numbers of streams.values()){numbers.sort((a,b)=>a-b);assert.deepEqual(numbers,numbers.map((_,i)=>i+1))}return [...streams].sort(([a],[b])=>a.localeCompare(b))};
const events=[{id:"a1",topic:"A",topicSeq:1},{id:"b1",topic:"B",topicSeq:1},{id:"a2",topic:"A",topicSeq:2},{id:"b2",topic:"B",topicSeq:2},{id:"a2",topic:"A",topicSeq:2}];
test("Topic to streamId mapping preserves scoped order, dedup and replay",()=>{const transformed=events.map(e=>({id:e.id,streamId:e.topic,streamSeq:e.topicSeq}));assert.deepEqual(project(events,"topic","topicSeq"),project(transformed,"streamId","streamSeq"))});
test("gap in either ordering representation is rejected",()=>{const e=[{id:"x",streamId:"A",streamSeq:2}];assert.throws(()=>project(e,"streamId","streamSeq"))});
test("a stream name alone does not express independently governed lifecycle",()=>{const e={id:"a1",streamId:"A",streamSeq:1};const topicGovernance={topic:"A",policyRevision:3,retired:true};assert.equal(Object.hasOwn(e,"policyRevision"),false);assert.equal(topicGovernance.retired,true)});
