export const githubCapabilities=Object.freeze({target_cas:"verified",atomic_authority_and_target:"unsupported",durable_idempotency:"unknown",provider_enforced_epoch:"unsupported",reconcile_receipt:"verified"});
export function routePacketEffect({request,capabilities,authorityCurrent}){
 if(!request||request.mode!=="MUTATE"||!request.packet_ref||!request.idempotency_key||!request.target?.expected_version||!request.claim?.handler_ref||!Number.isInteger(request.claim.epoch)||!request.authority?.mandate_ref)return {ok:false,code:"INVALID_REQUEST"};
 if(authorityCurrent!==true)return {ok:false,code:"AUTHORITY_NOT_CONFIRMED"};
 if(request.require_atomic_authority===true && (capabilities.atomic_authority_and_target!=="verified"||capabilities.provider_enforced_epoch!=="verified"))return {ok:false,code:"ATOMIC_AUTHORITY_UNAVAILABLE"};
 if(capabilities.target_cas!=="verified")return {ok:false,code:"CAS_NOT_VERIFIED"};
 return {ok:true,code:"PREFLIGHT_ONLY",guarantee:"target-cas-only",must_reconcile:true};
}
