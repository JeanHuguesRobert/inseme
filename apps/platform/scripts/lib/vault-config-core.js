/**
 * Vault Core: provider-neutral, fail-closed ingestion into an instance_config.
 *
 * This module is an internal data-plane capacity. The actual actor and COP
 * mandate must be admitted at its invoking surface before calling it.
 * No value, fingerprint, partial value or provider error text is returned.
 * An existing different value is a conflict, never a silent rotation.
 */
import {JHN_VAULT_INSTANCE_ID} from './vault-catalog.js';

const KEY=/^[a-z][a-z0-9_]{0,127}$/;
const error=(code)=>Object.assign(new Error('vault operation refused'),{code});
const fields='instance_id,key,value,is_secret,is_public,version';
export function createInstanceVaultConfigCore({client,instanceId=JHN_VAULT_INSTANCE_ID}={}) {
  if(!client||typeof client.from!=='function')throw error('VAULT_BACKEND_UNAVAILABLE');
  if(instanceId!==JHN_VAULT_INSTANCE_ID)throw error('VAULT_INSTANCE_SCOPE_INVALID');
  async function read(key) {
    if(!KEY.test(key))throw error('VAULT_REF_INVALID');
    const {data,error:dbError}=await client.from('instance_config')
      .select(fields).eq('instance_id',instanceId).eq('key',key).maybeSingle();
    if(dbError)throw error('VAULT_READ_FAILED');
    if(data && (data.instance_id!==instanceId||data.key!==key))throw error('VAULT_SCOPE_INVALID');
    return data;
  }
  async function promote({key,resolveTrustedValue}={}) {
    if(!KEY.test(key)||typeof resolveTrustedValue!=='function')throw error('VAULT_ARGUMENT_INVALID');
    // Preflight the exact existing row before importing the source secret.
    const existing=await read(key);
    let value;
    try{value=await resolveTrustedValue(key);}
    catch{throw error('VAULT_SOURCE_UNAVAILABLE');}
    if(typeof value!=='string'||!value.trim())throw error('VAULT_SOURCE_UNAVAILABLE');
    if(existing) {
      if(existing.value!==value||existing.is_secret!==true||
        existing.is_public!==false||!Number.isSafeInteger(existing.version))
        throw error('VAULT_CONFLICT');
      return {ok:true,key,instance:'jhn',status:'unchanged',
        version:existing.version,secret:true,values_exposed:false};
    }
    const {data:inserted,error:writeError}=await client.from('instance_config')
      .insert({instance_id:instanceId,key,value,category:'secrets',
        is_secret:true,is_public:false,version:1})
      .select('instance_id,key,version,is_secret,is_public').single();
    if(writeError||!inserted)throw error('VAULT_CREATE_CONFLICT_OR_UNAVAILABLE');
    if(inserted.instance_id!==instanceId||inserted.key!==key||
      inserted.is_secret!==true||inserted.is_public!==false||
      inserted.version!==1)throw error('VAULT_VERIFICATION_FAILED');
    // Even the readback is consumed exclusively in this trusted process.
    const confirmed=await read(key);
    if(!confirmed||confirmed.value!==value||confirmed.is_secret!==true||
      confirmed.is_public!==false)throw error('VAULT_VERIFICATION_FAILED');
    return {ok:true,key,instance:'jhn',status:'created',
      version:confirmed.version,secret:true,values_exposed:false};
  }
  return Object.freeze({promote});
}
