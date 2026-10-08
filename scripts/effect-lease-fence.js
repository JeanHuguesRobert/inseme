import {assessLeaseBudget} from "./effect-lease-accounting.js";
/** Pure fencing policy. No implicit side effects and no provider-atomicity claim. */
export function inspectEffectLease({lease,now,canonicalGeneration,canonicalRevision,targetRevision,mandateValid=false,budgetAvailable=false,desired=true,alreadySatisfied=false}={}){
 if(!lease||lease.schema!=="cop.effect-lease/v1"||!Number.isSafeInteger(lease.generation)||lease.generation<1)throw Error("invalid_lease");
 if(!Number.isSafeInteger(canonicalGeneration)||canonicalGeneration<1)return {decision:"defer",reason:"canonical_generation_unknown"};
 if(!Number.isSafeInteger(canonicalRevision)||canonicalRevision<0)return {decision:"defer",reason:"canonical_revision_unknown"};
 if(!now||!Number.isFinite(Date.parse(now))||!Number.isFinite(Date.parse(lease.expires_at)))return {decision:"defer",reason:"clock_or_expiry_unknown"};
 if(!desired)return {decision:"obsolete",reason:"intent_withdrawn"};
 if(alreadySatisfied)return {decision:"no_op",reason:"satisfied_elsewhere"};
 if(canonicalGeneration!==lease.generation)return {decision:"fenced",reason:"stale_generation"};
 if(canonicalRevision!==lease.expected_revision)return {decision:"reconcile",reason:"canonical_revision_changed"};
 if(targetRevision!==lease.expected_target_revision)return {decision:"reconcile",reason:"target_changed"};
 if(Date.parse(now)>=Date.parse(lease.expires_at))return {decision:"fenced",reason:"lease_expired"};
 if(!mandateValid||!budgetAvailable)return {decision:"blocked",reason:"authority_or_budget_missing"};
 const accounting=lease.cost?assessLeaseBudget({cost:lease.cost,budgetAuthorized:budgetAvailable,reservationRecorded:true,unknownPolicy:"authorized_bounded_unknown"}):{decision:"blocked",reason:"lease_cost_missing"};
 if(accounting.decision!=="preflight_only")return accounting;
 return {decision:"preflight_only",fencing_token:lease.generation,provider_atomic_check_required:true};
}
export function makeEffectLease({effectId,holder,generation,expectedRevision,expectedTargetRevision,expiresAt,cost}={}){
 if(!cost||cost.schema!=="cop.lease-resource-obligation/v1"||!effectId||!holder||!Number.isSafeInteger(generation)||generation<1||!Number.isSafeInteger(expectedRevision)||expectedRevision<0||!expiresAt||!Number.isFinite(Date.parse(expiresAt)))throw Error("invalid_lease_parameters");
 return {schema:"cop.effect-lease/v1",effect_id:effectId,holder,generation,expected_revision:expectedRevision,expected_target_revision:expectedTargetRevision,expires_at:expiresAt,cost};
}
