/** Multi-dimensional resource obligation: monetary zero is not zero resource use. */
export function makeLeaseCost({dimensions,quote="unknown",budgetRef}={}){
 if(!budgetRef||!Array.isArray(dimensions)||dimensions.length===0)throw Error("lease_cost_dimensions_required");
 for(const d of dimensions){
  if(!d?.kind||!d.unit||!["observed","estimated","unknown"].includes(d.status))throw Error("invalid_cost_dimension");
  if(d.status==="unknown"&&d.value!==undefined)throw Error("unknown_must_not_be_zero");
  if(d.status!=="unknown"&&(!Number.isFinite(d.value)||d.value<0))throw Error("invalid_cost_value");
 }
 return {schema:"cop.lease-resource-obligation/v1",budget_ref:budgetRef,quote,dimensions,
  settlement:"pending",requires_reservation:true};
}
export function assessLeaseBudget({cost,budgetAuthorized=false,reservationRecorded=false,unknownPolicy="defer"}={}){
 if(cost?.schema!=="cop.lease-resource-obligation/v1")throw Error("lease_cost_required");
 if(!budgetAuthorized||!reservationRecorded)return {decision:"blocked",reason:"budget_authority_or_reservation_missing"};
 if(cost.dimensions.some(x=>x.status==="unknown")&&unknownPolicy!=="authorized_bounded_unknown")return {decision:"deferred",reason:"unknown_cost_requires_explicit_policy"};
 return {decision:"preflight_only",reason:"resource_accounting_present",settlement_required:true};
}
