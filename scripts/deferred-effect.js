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
export function createDeferredEffect({effectId,capability,operation,target,inputs,failure,preconditions=[],mandateRef,budgetRef}={}){
 if(!effectId||!capability||!operation||!target||!failure||failure.schema!=="cop.effect-failure/v1")throw Error("invalid_deferred_effect");
 if(!mandateRef||!budgetRef)throw Error("explicit_authority_refs_required");
 const payload={capability,operation,target,inputs,preconditions,mandate_ref:mandateRef,budget_ref:budgetRef};
 const digest=createHash("sha256").update(JSON.stringify(payload)).digest("hex");
 return {schema:"cop.deferred-effect/v1",effect_id:effectId,idempotency_key:effectId,
  payload,content_sha256:digest,failure,state:failure.retryability==="retryable"?"pending":"blocked",
  // A handler MUST revalidate mandate, budget, target version and coordination fencing at execution time.
  reauthorization_required:true};
}
