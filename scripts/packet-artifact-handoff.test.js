import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { verifyPacketComputeArtifact } from "./packet-artifact-handoff.js";
const bytes = Buffer.from("source-faithful content\n");
const hash = createHash("sha256").update(bytes).digest("hex");
const result = {
  schema: "cop.compute-result/v1",
  computation_id: "test-computation",
  result: {passed: true, outputs:[{path:"output.md",bytes:bytes.length,sha256:hash}]},
  execution_receipt:{status:"completed",log_refs:["https://example.test/run/1"]},
};
test("verified handoff has no delivery-specific attributes", ()=>{
  const h=verifyPacketComputeArtifact({packetRef:"github:owner/repo#120",computationId:"test-computation",result,artifactPath:"output.md",bytes});
  assert.equal(h.artifact.sha256,hash);
  assert.equal(h.state,"verified-ready-for-adapter");
  assert.equal("gmail" in h,false);
});
test("rejects mismatched invocation, failed execution and changed bytes", ()=>{
  assert.throws(()=>verifyPacketComputeArtifact({packetRef:"packet",computationId:"wrong",result,artifactPath:"output.md",bytes}),/correlation/);
  assert.throws(()=>verifyPacketComputeArtifact({packetRef:"packet",computationId:"test-computation",result:{...result,execution_receipt:{status:"failed"}},artifactPath:"output.md",bytes}),/not_completed/);
  assert.throws(()=>verifyPacketComputeArtifact({packetRef:"packet",computationId:"test-computation",result,artifactPath:"output.md",bytes:Buffer.from("changed")}),/mismatch/);
});
