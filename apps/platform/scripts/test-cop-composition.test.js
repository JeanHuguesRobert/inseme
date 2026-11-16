import test from "node:test";
import assert from "node:assert/strict";
import {
  forkChildPackets,
  copAll,
  copAllSettled,
  copRace,
  copAny,
  copQuorum,
  copFallback,
  copSequence,
} from "../../../packages/cop-core/dist/composition.js";

test("COP Composition 1: forkChildPackets preserves causal lineage and downstream tracking", () => {
  const parent = {
    packet_id: "pkt-parent-100",
    status: "dispatched",
    mandate_id: "mandate:civic:corte",
    created_at: new Date().toISOString(),
    hops: [],
    payload: { task: "parent" },
    ithaca: { return_target: "governance-chamber" },
  };

  const children = forkChildPackets(parent, [
    { kind: "subtask", intent: "audit-a", payload: { a: 1 }, spawnReason: "split-work-a" },
    { kind: "subtask", intent: "audit-b", payload: { b: 2 }, spawnReason: "split-work-b" },
  ]);

  assert.equal(children.length, 2);
  assert.equal(children[0].lineage.upstream_packet_id, "pkt-parent-100");
  assert.equal(children[1].lineage.upstream_packet_id, "pkt-parent-100");
  assert.equal(parent.lineage.downstream_packet_ids.length, 2);
});

test("COP Composition 2: copAll aggregates yields and spending, fails fast on error", async () => {
  const parent = { packet_id: "pkt-all-parent", hops: [], payload: {} };
  const children = forkChildPackets(parent, [
    { kind: "sub", intent: "sub-1", payload: { step: 1 } },
    { kind: "sub", intent: "sub-2", payload: { step: 2 } },
  ]);

  const executorSuccess = async (child) => ({
    status: "solved",
    yield: { semantic_yield: `result-${child.packet_id}` },
    spending: [
      {
        hop_index: 0,
        node_id: "node:calc",
        capability: "ai.chat",
        provider: "openai",
        model: "gpt-4o-mini",
        prompt_tokens: 10,
        completion_tokens: 10,
        provisional_cost: { coefficient: "15", scale: 5, unit: "USD" },
        rate_basis: "rate:v1",
        timestamp: new Date().toISOString(),
      },
    ],
  });

  const res = await copAll(parent, children, executorSuccess);
  assert.equal(res.ok, true);
  assert.equal(res.yields.length, 2);
  assert.equal(res.totalSpending.length, 2);

  // Failure test
  const executorFailure = async (child) => {
    if (child.packet_id.endsWith("2")) {
      return { status: "failed", error: "Compute resource quota exceeded" };
    }
    return { status: "solved", yield: { semantic_yield: "ok" } };
  };

  const resFail = await copAll(parent, children, executorFailure);
  assert.equal(resFail.ok, false);
  assert.match(resFail.error, /quota exceeded/);
});

test("COP Composition 3: copAllSettled preserves partial results and residue", async () => {
  const parent = { packet_id: "pkt-settled-parent", hops: [], payload: {} };
  const children = forkChildPackets(parent, [
    { kind: "sub", intent: "sub-1", payload: { step: 1 } },
    { kind: "sub", intent: "sub-2", payload: { step: 2 } },
  ]);

  const executor = async (child) => {
    if (child.packet_id.endsWith("2")) {
      return { status: "failed", error: "Transient network timeout" };
    }
    return { status: "solved", yield: { semantic_yield: "success-1" } };
  };

  const res = await copAllSettled(parent, children, executor);
  assert.equal(res.ok, true);
  assert.equal(res.settledItems.length, 2);
  assert.equal(res.settledItems[0].status, "solved");
  assert.equal(res.settledItems[1].status, "failed");
  assert.equal(res.residue.length, 1);
  assert.match(res.residue[0].error, /network timeout/);
});

test("COP Composition 4: copAny returns first successful yield, fails only if all fail", async () => {
  const parent = { packet_id: "pkt-any-parent", hops: [], payload: {} };
  const children = forkChildPackets(parent, [
    { kind: "alt", intent: "fast-but-flaky", payload: {} },
    { kind: "alt", intent: "slow-and-reliable", payload: {} },
  ]);

  const executor = async (child) => {
    if (child.packet_id.endsWith("1")) {
      return { status: "failed", error: "Flaky model 500 error" };
    }
    return { status: "solved", yield: { semantic_yield: "reliable-answer" } };
  };

  const res = await copAny(parent, children, executor);
  assert.equal(res.ok, true);
  assert.equal(res.winningYield.semantic_yield, "reliable-answer");
  assert.equal(res.residue.length, 1); // Preserves flaky failure in residue
});

test("COP Composition 5: copQuorum satisfies when threshold is met, terminates early if impossible", async () => {
  const parent = { packet_id: "pkt-quorum-parent", hops: [], payload: {} };
  const children = forkChildPackets(parent, [
    { kind: "auditor", intent: "check-1", payload: {} },
    { kind: "auditor", intent: "check-2", payload: {} },
    { kind: "auditor", intent: "check-3", payload: {} },
  ]);

  // Quorum of 2 out of 3
  const executorQuorumMet = async (child) => {
    if (child.packet_id.endsWith("1") || child.packet_id.endsWith("2")) {
      return { status: "solved", yield: { semantic_yield: "valid-signature" } };
    }
    return { status: "failed", error: "Signer node unreachable" };
  };

  const res = await copQuorum(parent, children, 2, executorQuorumMet);
  assert.equal(res.ok, true);
  assert.equal(res.yields.length, 2);

  // Quorum impossible test: 2 failures out of 3 -> cannot reach 2 successes
  const executorQuorumImpossible = async (child) => {
    if (child.packet_id.endsWith("1")) {
      return { status: "solved", yield: { semantic_yield: "valid" } };
    }
    return { status: "failed", error: "Key compromised" };
  };

  const resFail = await copQuorum(parent, children, 2, executorQuorumImpossible);
  assert.equal(resFail.ok, false);
  assert.match(resFail.error, /Quorum impossible/);
});

test("COP Composition 6: copFallback progressively activates alternatives", async () => {
  const parent = { packet_id: "pkt-fallback-parent", hops: [], payload: {} };
  const candidates = forkChildPackets(parent, [
    { kind: "local", intent: "local-ollama", payload: {} },
    { kind: "cloud", intent: "cloud-mistral", payload: {} },
  ]);

  let calls = 0;
  const executor = async (candidate) => {
    calls++;
    if (candidate.packet_id.endsWith("1")) {
      // Local model is down
      return { status: "failed", error: "Ollama not responding on port 11434" };
    }
    // Cloud fallback succeeds
    return { status: "solved", yield: { semantic_yield: "Cloud answer" } };
  };

  const res = await copFallback(parent, candidates, executor);
  assert.equal(res.ok, true);
  assert.equal(res.winningYield.semantic_yield, "Cloud answer");
  assert.equal(calls, 2);
  assert.equal(res.residue.length, 1);
});

test("COP Composition 7: copSequence (Pipe) threads previous yield into next step", async () => {
  const parent = { packet_id: "pkt-seq-parent", hops: [], payload: {} };

  const steps = [
    () => ({
      packet_id: "step-1-fetch",
      hops: [],
      payload: { query: "constitution paoli corte" },
    }),
    (prevYield) => ({
      packet_id: "step-2-summarize",
      hops: [],
      payload: { sourceDoc: prevYield.semantic_yield },
    }),
  ];

  const executor = async (packet) => {
    if (packet.packet_id === "step-1-fetch") {
      return { status: "solved", yield: { semantic_yield: "Document brut Paoli 1755" } };
    }
    return {
      status: "solved",
      yield: { semantic_yield: `Synthèse concise de: ${packet.payload.sourceDoc}` },
    };
  };

  const res = await copSequence(parent, steps, executor);
  assert.equal(res.ok, true);
  assert.equal(res.yields.length, 2);
  assert.match(res.combinedYield.semantic_yield, /Synthèse concise de: Document brut Paoli 1755/);
});

test('COP Composition: all/allSettled retain INPUT order after reverse completion order',async()=>{
 const parent={packet_id:'pkt-order',hops:[],payload:{}};
 const children=forkChildPackets(parent,[
   {kind:'sub',intent:'slow-first',payload:{index:0}},
   {kind:'sub',intent:'fast-second',payload:{index:1}},
 ]);
 const resolver=child=>new Promise(resolve=>setTimeout(()=>resolve({status:'solved',
   yield:{semantic_yield:child.payload.index}}),child.payload.index===0?25:2));
 const all=await copAll(parent,children,resolver);
 assert.equal(all.ok,true);
 assert.deepEqual(all.yields.map(y=>y.semantic_yield),[0,1]);
 const settled=await copAllSettled(parent,children,resolver);
 assert.equal(settled.ok,true);
 assert.deepEqual(settled.settledItems.map(i=>i.yield.semantic_yield),[0,1]);
 assert.deepEqual(settled.yields.map(y=>y.semantic_yield),[0,1]);
});

test('COP Composition: default race does not abort a late worker, opt-in can cancel',async()=>{
 const parent={packet_id:'pkt-no-cancel',hops:[],payload:{}};
 const children=forkChildPackets(parent,[
   {kind:'sub',intent:'first',payload:{index:0}},
   {kind:'sub',intent:'second',payload:{index:1}},
 ]);
 const observations=[];
 const executor=(child,signal)=>new Promise(resolve=>{
   const delay=child.payload.index===0?2:25;
   setTimeout(()=>{
     observations.push({index:child.payload.index,aborted:signal?.aborted});
     resolve({status:'solved',yield:{semantic_yield:child.payload.index}});
   },delay);
 });
 const result=await copRace(parent,children,executor);
 assert.equal(result.ok,true);
 await new Promise(resolve=>setTimeout(resolve,38));
 assert.deepEqual(observations,[{index:0,aborted:false},{index:1,aborted:false}]);
 observations.length=0;
 const opt=await copRace(parent,children,executor,{cancelRemaining:true});
 assert.equal(opt.ok,true);
 await new Promise(resolve=>setTimeout(resolve,38));
 assert.deepEqual(observations,[{index:0,aborted:false},{index:1,aborted:true}]);
});

test('COP Composition: Promise.all rejects early without cancelling other children by default',async()=>{
 const parent={packet_id:'pkt-early-reject',hops:[],payload:{}};
 const children=forkChildPackets(parent,[
   {kind:'sub',intent:'fails-early',payload:{index:0}},
   {kind:'sub',intent:'keeps-running',payload:{index:1}},
 ]);
 const signals=[];
 const executor=(child,signal)=>new Promise(resolve=>setTimeout(()=>{
   signals.push({index:child.payload.index,aborted:signal?.aborted});
   resolve(child.payload.index===0?{status:'failed',error:'intentional'}:
     {status:'solved',yield:{semantic_yield:'late'}});
 },child.payload.index===0?2:27));
 const rejected=await copAll(parent,children,executor);
 assert.equal(rejected.ok,false);assert.match(rejected.error,/intentional/);
 await new Promise(resolve=>setTimeout(resolve,38));
 assert.deepEqual(signals,[{index:0,aborted:false},{index:1,aborted:false}]);
 signals.length=0;
 const opt=await copAll(parent,children,executor,{cancelRemaining:true});
 assert.equal(opt.ok,false);
 await new Promise(resolve=>setTimeout(resolve,38));
 assert.deepEqual(signals,[{index:0,aborted:false},{index:1,aborted:true}]);
});
