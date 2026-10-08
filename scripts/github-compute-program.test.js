import test from "node:test";
import assert from "node:assert/strict";
import { validateGitProgramDescriptor } from "./github-compute-program.js";
const descriptor=()=>({
  schema:"fractanet.compute-program/v1",
  program:{repository:"JeanHuguesRobert/ubikia",ref:"a".repeat(40)},
  commands:[["npm","ci"],["node","cli/text-product.js","--contract","input.yaml","--output","output.md"]],
  inputs:[{repository:"JeanHuguesRobert/barons-Mariani",ref:"b".repeat(40)}],
  outputs:["output.md","output.md.manifest.json"],
  execution:{runtime:"github-actions-ubuntu",timeout_seconds:900},
});
test("generic program descriptor is independent of document type",()=>{
  assert.equal(validateGitProgramDescriptor(descriptor()),true);
  const sim=descriptor();sim.commands=[["python","simulate.py","--steps","10"]];assert.equal(validateGitProgramDescriptor(sim),true);
});
test("descriptor has no implicit mandate, budget or permissions",()=>{
  for(const k of ["mandate","budget","permissions"]){const v=descriptor();v[k]={any:true};assert.throws(()=>validateGitProgramDescriptor(v),/must_not_grant/);}
});
test("requires immutable program and input revisions",()=>{
  for(const mutate of [v=>v.program.ref="main",v=>v.inputs[0].ref="latest",v=>v.program.repository="../../tmp"]){const v=descriptor();mutate(v);assert.throws(()=>validateGitProgramDescriptor(v));}
});
test("rejects unsafe output paths and missing resource ceilings",()=>{
  for(const mutate of [v=>v.outputs=["../../secrets"],v=>v.outputs=["/tmp/result"],v=>v.execution.timeout_seconds=999999]){const v=descriptor();mutate(v);assert.throws(()=>validateGitProgramDescriptor(v));}
});
