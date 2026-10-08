import fs from "node:fs";

/**
 * Convert a failed compute subprocess or runner timeout into a durable,
 * machine-readable failed result rather than an unhandled GitHub job failure.
 * Called only after a validated typed request has been persisted.
 */
export function recoverComputeFailure({ request, priorResult = null, runId = "local", runUrl = null, reason = "compute_execution_interrupted" }) {
  if (priorResult?.schema === "cop.compute-result/v1" && priorResult.computation_id === request.computation_id) return priorResult;
  const safeReason = String(reason).slice(0, 200).replace(/[\r\n]/g, " ");
  const binding = {
    schema:"magistral.execution-binding/v1",
    requirement_ref:`requirement:compute-request:${request.computation_id}`,
    offer_id:"offer:github-actions:typed-compute-v1",
    runtime_id:"runtime:github-actions:ubuntu-latest",
    handler_instance_ref:`handler:github-actions:${runId}`,
    execution_surface:"batch",
    provider_ref:"provider:github-actions",
    provider_execution_id:String(runId),
  };
  return {
    schema:"cop.compute-result/v1",
    computation_id:request.computation_id,
    source:{repository:request.repository.name,ref:request.repository.ref},
    result:{operation:request.operation.kind,passed:false,error_class:"compute_exception",error:safeReason},
    execution_binding:binding,
    execution_receipt:{
      schema:"magistral.execution-receipt/v1",binding,status:"failed",terminal:true,
      artifact_refs:[],result_refs:[],log_refs:runUrl?[runUrl]:[],error:safeReason,
    },
  };
}

if (process.argv[1]?.endsWith("/github-compute-failure.js")) {
  const [requestFile,resultFile,runId,runUrl,reason] = process.argv.slice(2);
  if (!requestFile || !resultFile) throw Error("missing_recovery_paths");
  const request=JSON.parse(fs.readFileSync(requestFile,"utf8"));
  let existing=null;
  try {existing=JSON.parse(fs.readFileSync(resultFile,"utf8"));} catch {}
  fs.writeFileSync(resultFile,JSON.stringify(recoverComputeFailure({request,priorResult:existing,runId,runUrl,reason}),null,2));
}
