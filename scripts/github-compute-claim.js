import {createHash} from "node:crypto";

/** Stable one-shot reservation key; the ID, not payload, determines exclusion. */
export function computeClaimRef({repository,computation_id}) {
  if(!/^[A-Za-z0-9._:-]{1,128}$/.test(computation_id||""))throw Error("invalid_computation_id");
  if(!/^JeanHuguesRobert\/[A-Za-z0-9._-]+$/.test(repository||""))throw Error("repository_not_allowed");
  const digest=createHash("sha256").update(repository+"\0"+computation_id).digest("hex");
  return "refs/tags/cop-compute-claim-"+digest;
}
export function computePayloadDigest(request) {
  if(!request||typeof request!=="object")throw Error("invalid_request");
  return createHash("sha256").update(JSON.stringify(request)).digest("hex");
}
/** The ref-create response is the sole winning signal. Never infer a win from a read. */
export async function reserveComputeClaim({request,createRef,readRef,runId}){
  const ref=computeClaimRef({repository:request.repository.name,computation_id:request.computation_id});
  const payload_sha256=computePayloadDigest(request);
  const identity={schema:"cop.compute-claim/v1",ref,computation_id:request.computation_id,payload_sha256,run_id:String(runId)};
  try{
    const created=await createRef(identity);
    if(created?.created===true)return {...identity,status:"claimed"};
  }catch{}
  // Distinguish collision/contended/unknown without granting execution.
  try{
    const prior=await readRef(ref);
    if(prior?.payload_sha256 && prior.payload_sha256!==payload_sha256)
      return {...identity,status:"collision",prior_run_id:prior.run_id||null};
    if(prior?.payload_sha256===payload_sha256)
      return {...identity,status:"contended",prior_run_id:prior.run_id||null};
  }catch{}
  return {...identity,status:"deferred"};
}
