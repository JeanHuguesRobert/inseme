/**
 * One-time owner-admin bootstrap, NOT a generic identity claim or mandate issuer.
 * The owner explicitly directs the scoped host administration over their
 * existing authenticated SSH channel; this code does not assert that an SSH
 * bearer is a cryptographic human identity. Account lookup is a corroborating
 * directory check, not a second approval, and never selects the smoke user.
 * Keep this path separate from principal-enrollment.js (user-session flow).
 */
import {JHN_VAULT_INSTANCE_ID} from './vault-catalog.js';

const OWNER_EMAIL='jhr@baronsmariani.org';
const refuse=reason=>Object.freeze({ok:false,reason,changed:false});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createJhnOwnerSshEnrollment({adminClient}={}) {
  return Object.freeze({
    async claim({ownerConfirmed=false,sshOwnerSession=false}={}) {
      if(ownerConfirmed!==true||sshOwnerSession!==true)return refuse('owner_confirmation_required');
      if(typeof adminClient?.auth?.admin?.listUsers!=='function'||typeof adminClient.from!=='function')
        return refuse('admin_directory_unavailable');
      try {
        // Do not silently accept an incomplete paginated response: if there
        // are more users than one page, fail rather than guess uniqueness.
        const {data, error}=await adminClient.auth.admin.listUsers({page:1,perPage:1000});
        if(error||!Array.isArray(data?.users)||data.users.length>1000||
            (Number.isInteger(data.total)&&data.total>data.users.length)||
            (Number.isInteger(data.lastPage)&&data.lastPage>1))
          return refuse('owner_auth_directory_unavailable');
        const owner=data.users.filter(u=>u.email?.toLowerCase()===OWNER_EMAIL);
        if(owner.length!==1||!UUID.test(owner[0].id)||!owner[0].email_confirmed_at||owner[0].is_anonymous)
          return refuse('owner_auth_identity_not_unique_or_unconfirmed');
        const userId=owner[0].id;
        const {data:profile,error:profileError}=await adminClient.from('users')
          .select('id,email,role').eq('id',userId).maybeSingle();
        if(profileError||profile?.id!==userId||profile?.email?.toLowerCase()!==OWNER_EMAIL||profile.role!=='admin')
          return refuse('owner_admin_profile_not_confirmed');
        const {data:instance,error:instanceError}=await adminClient.from('instances')
          .select('id,canonical_slug,status,subject_kind,subject_ref,twin_root_ref,principal_id')
          .eq('id',JHN_VAULT_INSTANCE_ID).maybeSingle();
        if(instanceError||instance?.id!==JHN_VAULT_INSTANCE_ID||instance.canonical_slug!=='jhn'||
            instance.status!=='autonomous'||instance.subject_kind!=='living_person'||
            instance.subject_ref!=='subject:jhn'||instance.twin_root_ref!=='twin:jhn')
          return refuse('jhn_instance_identity_invalid');
        if(instance.principal_id===userId)return Object.freeze({ok:true,changed:false,already_bound:true,instance:'jhn',principal_ref:'principal:jhn'});
        if(instance.principal_id!==null)return refuse('instance_already_claimed');
        const result=await adminClient.from('instances').update({principal_id:userId})
          .eq('id',JHN_VAULT_INSTANCE_ID).is('principal_id',null)
          .eq('status','autonomous').eq('subject_kind','living_person')
          .select('id,principal_id');
        if(result.error||result.data?.length!==1||result.data[0].id!==JHN_VAULT_INSTANCE_ID||
            result.data[0].principal_id!==userId)return refuse('claim_conflict_or_unverified');
        const {data:verified,error:verificationError}=await adminClient.from('instances')
          .select('principal_id').eq('id',JHN_VAULT_INSTANCE_ID).maybeSingle();
        if(verificationError||verified?.principal_id!==userId)return refuse('claim_readback_failed');
        return Object.freeze({ok:true,changed:true,instance:'jhn',principal_ref:'principal:jhn'});
      } catch {return refuse('owner_enrollment_unavailable');}
    }
  });
}
