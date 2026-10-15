import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const s=fs.readFileSync(new URL("../.github/workflows/compute-batch-reality-test.yml",import.meta.url),"utf8");
const section=s.split("  typed-compute-request:")[1];
test("only winning E5 holder reaches source checkout, compute and callback",()=>{
 assert.ok(section,"typed job exists");
 const steps=section.split(/\n      - name: /);
 for(const name of ["Checkout exact requested source commit","Verify exact source commit","Execute allowlisted computation","Upload generic program outputs"]){
  const step=steps.find(x=>x.startsWith(name));
  assert.ok(step,name+" exists");
  assert.match(step,/steps.claim.outputs.outcome == 'claimed'/,name+" gated");
 }
 assert.match(section,/COMPUTE_PHASE_CLAIM: \$\{\{ steps.claim.outputs.outcome \}\}/);
});
test("claim runs only after validated request and sequential replay check",()=>{
 const step=section.split(/\n      - name: /).find(x=>x.startsWith("Reserve atomic computation identity"));
 assert.match(step,/steps.replay.outcome == 'success'/);
 assert.match(step,/steps.replay.outputs.skip != 'true'/);
 assert.ok(section.indexOf("Reserve atomic computation identity")<section.indexOf("Snapshot provider quota"));
});
test("write token scoped to typed compute job",()=>{
 assert.match(section,/permissions:\n      contents: write/);
 assert.match(s.split("jobs:")[0],/permissions:\n  contents: read/);
});
