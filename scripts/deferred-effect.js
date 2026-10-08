import {createHash} from "node:crypto";
/** Durable, provider-neutral description of a deferred effect, never an authority grant. */
export function classifyEffectFailure({code,transient=false,retryAfter=null,attempt=1,maxAttempts=5}={}){
 if(typeof code!=="string"||!code.trim())throw Error("failure_code_required");
 if(!Number.isInteger(attempt)||attempt<1||!Number.isInteger(maxAttempts)||maxAttempts<1)throw Error("invalid_attempts");
 const retryable=transient&&attempt<maxAttempts;
 return {schema:"cop.effect-failure/v1",code,retryability:retryable?"retryable":"terminal",
  retry_after:retryable?retryAfter:null,attempt,max_attempts:maxAttempts,
  next_action:retryable?"store_and_forward":"return_to_handler"};
}
export function createDeferredEffect({effectId,capability,operation,target,inputs,failure,preconditions=[],mandateRef,budgetRef,validUntil=null,expectedTargetRevision,expectedPacketGeneration}={}){
 if(!effectId||!capability||!operation||!target||!failure||failure.schema!=="cop.effect-failure/v1")throw Error("invalid_deferred_effect");
 if(!mandateRef||!budgetRef)throw Error("explicit_authority_refs_required");
 const payload={capability,operation,target,inputs,preconditions,mandate_ref:mandateRef,budget_ref:budgetRef,valid_until:validUntil,...(expectedTargetRevision!==undefined?{expected_target_revision:expectedTargetRevision}:{}),...(expectedPacketGeneration!==undefined?{expected_packet_generation:expectedPacketGeneration}:{})};
 const digest=createHash("sha256").update(JSON.stringify(payload)).digest("hex");
 return {schema:"cop.deferred-effect/v1",effect_id:effectId,idempotency_key:effectId,
  payload,content_sha256:digest,failure,state:failure.retryability==="retryable"?"pending":"blocked",
  // A handler MUST revalidate mandate, budget, target version and coordination fencing at execution time.
  reauthorization_required:true};
}

/**
 * A stored intent is not automatically a currently desirable Act.
 * This is a conservative preflight, not a distributed atomic commit.
 * Every factual field must be obtained from a fresh authoritative observation.
 */
export function evaluateDeferredEffect(effect,{
 now=new Date().toISOString(),currentGeneration,latestTargetRevision,
 observedTargetRevision,alreadySatisfied=false,supersededBy=null,
 mandateValid=false,budgetAvailable=false,claimCurrent=false,
 observationCurrent=false,
}={}){
 if(effect?.schema!=="cop.deferred-effect/v1")throw Error("invalid_deferred_effect");
 const p=effect.payload;
 const expiresAt=p.valid_until??null;
 if(expiresAt&&Date.parse(now)>=Date.parse(expiresAt))return {decision:"obsolete",reason:"expired",effect_id:effect.effect_id};
 if(supersededBy)return {decision:"obsolete",reason:"superseded",superseded_by:supersededBy,effect_id:effect.effect_id};
 if(alreadySatisfied)return {decision:"satisfied_elsewhere",reason:"desired_state_already_present",effect_id:effect.effect_id};
 if(effect.failure.retryability!=="retryable")return {decision:"blocked",reason:"not_retryable",effect_id:effect.effect_id};
 if(effect.failure.retry_after&&Date.parse(now)<Date.parse(effect.failure.retry_after))return {decision:"deferred",reason:"retry_after_not_reached",effect_id:effect.effect_id};
 if(!observationCurrent)return {decision:"deferred",reason:"fresh_observation_required",effect_id:effect.effect_id};
 if(p.expected_target_revision!==undefined&&p.expected_target_revision!==latestTargetRevision)return {decision:"reconcile",reason:"target_revision_changed",effect_id:effect.effect_id};
 if(p.expected_packet_generation!==undefined&&p.expected_packet_generation!==currentGeneration)return {decision:"reconcile",reason:"packet_generation_changed",effect_id:effect.effect_id};
 if(!mandateValid||!budgetAvailable||!claimCurrent)return {decision:"blocked",reason:"authority_or_coordination_missing",effect_id:effect.effect_id};
 return {decision:"eligible_preflight_only",effect_id:effect.effect_id,atomic_effect_check_required:true};
}
