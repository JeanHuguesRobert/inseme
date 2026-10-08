import {evaluateDeferredEffect} from "./deferred-effect.js";

// Append-only event projection. It preserves the original intent and all later
// evidence, instead of modifying a queued command in place.
const TERMINAL=new Set(["delivered","satisfied_elsewhere","obsolete","cancelled"]);
export function projectDeferredEffect(effect,events=[]){
 if(effect?.schema!=="cop.deferred-effect/v1")throw Error("invalid_deferred_effect");
 const state={effect_id:effect.effect_id,status:effect.state,events:0,superseded_by:null,completion_ref:null,revision:0};
 for(const e of events){
  if(e?.effect_id!==effect.effect_id)throw Error("foreign_effect_event");
  if(!["attempt_failed","delivered","satisfied_elsewhere","superseded","expired","cancelled"].includes(e.type))throw Error("invalid_effect_event");
  if(TERMINAL.has(state.status))throw Error("terminal_effect_event");
  if(e.type==="superseded"){if(!e.by)throw Error("missing_supersession_ref");state.superseded_by=e.by;state.status="obsolete";}
  else if(e.type==="expired")state.status="obsolete";
  else if(e.type==="cancelled")state.status="cancelled";
  else if(e.type==="delivered"||e.type==="satisfied_elsewhere"){if(!e.evidence_ref)throw Error("missing_completion_evidence");state.status=e.type;state.completion_ref=e.evidence_ref;}
  else state.status="pending";
  state.events++;state.revision++;
 }
 return state;
}

/** Pure, safe decision: no provider writes or implicit retry. */
export function planDeferredForward(effect,events=[],observation={}){
 const state=projectDeferredEffect(effect,events);
 if(TERMINAL.has(state.status))return {decision:"no_op",reason:state.status,effect_id:effect.effect_id};
 const r=evaluateDeferredEffect(effect,{...observation,supersededBy:state.superseded_by||observation.supersededBy});
 return {...r,queue_revision:state.revision,expected_target_revision:effect.payload.expected_target_revision??null,
  // Final adapter must atomically verify these, idempotency, mandate, budget and claim.
  atomic_revalidation_required:r.decision==="eligible_preflight_only"};
}
