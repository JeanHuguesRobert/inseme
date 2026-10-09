import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, open, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCapabilityCatalog } from "@inseme/magistral/capabilities";
import { COPBus } from "../../../../packages/cop-kernel/src/bus.js";
import { COPScheduler } from "../../../../packages/cop-kernel/src/scheduler.js";
import { createMagistralCapabilityResolver, MAGISTRAL_CAPABILITY_RESOLUTION } from "../cop/magistralCapabilityResolver.js";

const offer = {
  id:"capability:c5:synthetic", runtime_id:"runtime:c5:synthetic",
  host_ref:"host:c5", handler_instance_ref:"handler:c5",
  capability:"validate.frontmatter", execution_surface:"simulated",
  context_inheritance:"none",
};
async function runAttempt(dir, attempt) {
  const outcome = {schema:"cop.c5.outcome/v1", attempt, continuation_id:"c5-replay-same-intent", status:"error"};
  try {
    let observedEffect = 0;
    const client = {
      list: () => [{id:offer.runtime_id,host_ref:offer.host_ref,
        handler_instance_ref:offer.handler_instance_ref,
        execution_surface:"simulated",capabilities:["validate.frontmatter"]}],
      invoke: async () => {
        // Explicit provider-side atomic fence, NOT a built-in COP guarantee.
        let fd;
        try {
          fd = await open(join(dir,"effect-once"),"wx");
        } catch (e) {
          if (e.code !== "EEXIST") throw e;
          return {status:"completed",text:"duplicate suppressed by provider"};
        }
        try {
          await fd.writeFile("synthetic effect for c5-replay-same-intent\n");
          observedEffect++;
          return {status:"completed",text:"synthetic effect applied"};
        } finally {await fd.close();}
      },
    };
    const scheduler = new COPScheduler(new COPBus({name:"c5-"+attempt}),{
      handlerResolver:createMagistralCapabilityResolver({
        capabilityCatalog:createCapabilityCatalog({offers:[offer]}),hostRuntimeClient:client,
      }),
    });
    const result = await scheduler.execute({
      continuationId:outcome.continuation_id,
      resumeTo:MAGISTRAL_CAPABILITY_RESOLUTION,
      state:{capability_request:{
        requirement:{capability:"validate.frontmatter"},
        prompt:"C5 identical synthetic intent",working_directory:process.cwd(),
      }},
    });
    scheduler.stop();
    assert.equal(result.execution.result.execution_receipt.status,"completed");
    outcome.status="completed";
    outcome.effect_applied=observedEffect;
  } catch(e) {outcome.error=e.message;}
  await writeFile(join(dir,attempt+".json"),JSON.stringify(outcome));
}
if (process.argv[2] === "attempt") {
  await runAttempt(process.argv[3],process.argv[4]);
} else {
  const launch = (dir,id) => new Promise((resolve,reject) => {
    const child=spawn(process.execPath,[new URL(import.meta.url).pathname,"attempt",dir,id],{stdio:"ignore"});
    child.on("error",reject);
    child.on("exit",code=>code===0?resolve():reject(Error("child exited "+code)));
  });
  test("C5: two independent retries yield one provider-fenced synthetic effect",async()=>{
    const dir=await mkdtemp(join(tmpdir(),"c5-effect-"));
    try {
      await Promise.all([launch(dir,"attempt-a"),launch(dir,"attempt-b")]);
      const results=await Promise.all(["attempt-a","attempt-b"].map(async id=>
        JSON.parse(await readFile(join(dir,id+".json"),"utf8"))));
      assert.deepEqual(results.map(x=>x.status),["completed","completed"]);
      assert.equal(results[0].continuation_id,results[1].continuation_id);
      assert.equal(results.reduce((sum,x)=>sum+x.effect_applied,0),1);
      assert.equal((await readFile(join(dir,"effect-once"),"utf8")).trim(),
        "synthetic effect for c5-replay-same-intent");
    } finally {await rm(dir,{recursive:true,force:true});}
  });
}
