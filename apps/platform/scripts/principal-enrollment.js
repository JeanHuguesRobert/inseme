/** Principal claim during Supabase instance provisioning.
 *
 * Server-only, inert until an independently trusted root-claim verifier is
 * installed. NO email matching, account import, auth.users SQL insertion,
 * password movement, or client-side service-role operation.
 *
 * `authClient.auth.getUser(accessToken)` must verify the user's current
 * project-local Auth session against the Supabase Auth service.
 * `verifyRootClaim()` must verify an independently issued, expiry-checked
 * and instance-scoped Principal approval; it must NEVER trust claims or
 * `user_metadata` supplied by the prospective registrant.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (reason) => Object.freeze({ok:false, reason, changed:false});

export function createPrincipalEnrollment({authClient,adminClient,verifyRootClaim}={}) {
  async function prepare({accessToken, instanceId, rootClaim}={}) {
    if(typeof accessToken!=='string'||!accessToken||!UUID.test(instanceId||''))return fail('invalid_enrollment_input');
    if(typeof verifyRootClaim!=='function'||!authClient?.auth?.getUser||!adminClient?.from)
      return fail('enrollment_authority_unconfigured');
    try {
      // Never derive a principal from the administrative service-role key.
      const {data,error}=await authClient.auth.getUser(accessToken);
      const user=data?.user;
      if(error||!UUID.test(user?.id||'')||!user.email_confirmed_at||user.is_anonymous)
        return fail('human_session_not_verified');
      // Claim verifier must validate issuer signature and time; equality here
      // only binds its verified decision to this specific Auth session/instance.
      const proof=await verifyRootClaim({rootClaim,subjectUserId:user.id,instanceId});
      if(proof?.verified!==true||proof?.subjectUserId!==user.id||proof?.instanceId!==instanceId||
         proof?.issuerVerified!==true || proof?.scope!=='principal-instance-claim')
        return fail('principal_claim_not_verified');
      const {data:profile,error:profileError}=await adminClient.from('users')
        .select('id').eq('id',user.id).maybeSingle();
      if(profileError||profile?.id!==user.id)return fail('public_profile_not_bound');
      const {data:instance,error:instanceError}=await adminClient.from('instances')
        .select('id,canonical_slug,principal_id,status,subject_kind').eq('id',instanceId).maybeSingle();
      if(instanceError||!instance||instance.subject_kind!=='living_person'||instance.status!=='autonomous')
        return fail('instance_not_eligible');
      if(instance.principal_id&&instance.principal_id!==user.id)return fail('instance_already_claimed');
      return Object.freeze({ok:true,changed:false,already_bound:instance.principal_id===user.id,
        instance_id:instanceId,principal_id:user.id,instance_slug:instance.canonical_slug,
        // This is NOT a COP effect grant or credential authorization.
        claim_verified:true});
    }catch{return fail('enrollment_verification_unavailable');}
  }
  async function claim(input={}) {
    const p=await prepare(input);
    if(!p.ok||p.already_bound)return p;
    try {
      // Optimistic, no-overwrite binding; repeat server-side verification
      // immediately before updating to avoid a stale preparation token.
      const result=await adminClient.from('instances').update({principal_id:p.principal_id})
        .eq('id',p.instance_id).is('principal_id',null)
        .eq('status','autonomous').eq('subject_kind','living_person')
        .select('id,principal_id');
      if(result.error||!Array.isArray(result.data)||result.data.length!==1||
         result.data[0].id!==p.instance_id||result.data[0].principal_id!==p.principal_id)
        return fail('claim_conflict_or_unverified');
      return Object.freeze({...p,changed:true});
    }catch{return fail('claim_write_failed');}
  }
  return Object.freeze({prepare,claim});
}
