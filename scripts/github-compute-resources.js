// Provider-neutral accounting/admission. No mandate is inferred from quotas.
const finite = n => typeof n === "number" && Number.isFinite(n) && n >= 0;
const metric = (value, unit) => ({
  unit, status: finite(value) ? "observed" : "not_estimated",
  ...(finite(value) ? { value } : {}),
});
export function computeResourceSnapshot({available={}, measured={}, timestamp=new Date().toISOString()}={}) {
  const dimensions=["actions_minutes","api_requests","storage_bytes","concurrent_runs","control_calls"];
  return {
    schema:"cop.compute-resource-snapshot/v1",observed_at:timestamp,
    available:Object.fromEntries(dimensions.map(k=>[k,metric(available[k],k)])),
    measured:Object.fromEntries(dimensions.map(k=>[k,metric(measured[k],k)])),
  };
}
// Requested ceilings and provider-available quota are different from COP mandate budgets.
export function admitComputeResources({before, required={}, reserve={}, policy="conservative"}={}) {
  if(before?.schema!=="cop.compute-resource-snapshot/v1") throw Error("invalid_resource_snapshot");
  if(!["conservative","allow_unknown"].includes(policy)) throw Error("invalid_admission_policy");
  const deficits=[],unknown=[];
  for(const [dimension,amount] of Object.entries(required)){
    if(!finite(amount)||!finite(reserve[dimension]??0))throw Error("invalid_resource_requirement");
    const m=before.available[dimension];
    if(!m||m.status==="not_estimated"){unknown.push(dimension);continue;}
    if(m.value < amount+(reserve[dimension]??0))deficits.push({dimension,required:amount,reserve:reserve[dimension]??0,available:m.value});
  }
  return {schema:"cop.compute-admission/v1",
    decision:deficits.length?"refused":unknown.length&&policy==="conservative"?"deferred":"admitted",
    deficits,unknown,policy,
    // An admitted provider quota check does not confer principal mandate/budget.
    mandate_check:"separate_required",budget_check:"separate_required"};
}
export function computeResourceReceipt({before,after,admission,executionStatus,usage={}}) {
  if(before?.schema!=="cop.compute-resource-snapshot/v1"||after?.schema!=="cop.compute-resource-snapshot/v1"||admission?.schema!=="cop.compute-admission/v1") throw Error("invalid_resource_receipt");
  if(!["completed","failed","not_started"].includes(executionStatus))throw Error("invalid_execution_status");
  return {schema:"cop.compute-resource-receipt/v1",before,after,admission,execution_status:executionStatus,
    usage:Object.fromEntries(Object.entries(usage).map(([k,v])=>[k,metric(v,k)]))};
}
