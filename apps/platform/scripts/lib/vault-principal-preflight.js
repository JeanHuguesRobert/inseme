/**
 * Vault-backed *workload* and Principal linkage preflight, not mandate issuance.
 * Access to instance_config establishes a technical runtime boundary only.
 * The authenticated human user must be verified independently and explicitly
 * bound by public.instances.principal_id before an issuer may accept approval.
 * No secret values or user UUIDs cross the result boundary.
 */
import {JHN_VAULT_INSTANCE_ID} from './vault-catalog.js';
const failure = reason => Object.freeze({ok:false,schema:'cogentia.vault_principal_preflight.v1',
  instance:'jhn',principal_ref:null,may_issue:false,reason});

export function createVaultPrincipalPreflight({client,authenticateHuman}={}) {
  return Object.freeze({
    async inspect({session}={}) {
      if (typeof client?.from !== 'function') return failure('instance_directory_unavailable');
      let instance;
      try {
        const {data,error} = await client.from('instances')
          .select('id,canonical_slug,status,principal_id')
          .eq('id',JHN_VAULT_INSTANCE_ID).single();
        if(error) return failure('instance_directory_unavailable');
        instance=data;
      } catch{return failure('instance_directory_unavailable');}
      if (!instance || instance.id !== JHN_VAULT_INSTANCE_ID ||
          instance.canonical_slug !== 'jhn' || instance.status !== 'autonomous')
        return failure('instance_identity_invalid');
      // Do not conflate a service-role token with Supabase Auth user identity.
      if (!instance.principal_id) return failure('principal_identity_unbound');
      if (typeof authenticateHuman !== 'function') return failure('human_authenticator_unavailable');
      let authenticated;
      try {authenticated=await authenticateHuman({session});}
      catch{return failure('principal_authentication_failed');}
      if (authenticated?.verified !== true || authenticated?.user_id !== instance.principal_id ||
          authenticated?.principal_ref !== 'principal:jhn' ||
          authenticated?.audience !== 'cogentia:principal-issuer')
        return failure('principal_authentication_failed');
      return Object.freeze({ok:true,schema:'cogentia.vault_principal_preflight.v1',
        instance:'jhn',principal_ref:'principal:jhn',may_issue:false,
        authenticated:true,reason:'mandate_approval_still_required'});
    }
  });
}
