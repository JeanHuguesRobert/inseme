/**
 * Generic hosted Personal Twin provisioner, idempotent and non-claiming.
 * Registry identity is stable independently from its host and physical storage.
 * No Gmail/ChatGPT/Unix credential acquisition or implied authorization.
 */
export const JHN_ROOT_INSTANCE_ID = '00000000-0000-0000-0000-000000000001';
export const SERVICES_KEY = 'personal_twin_services';
export const MATURITY_KEY = 'personal_twin_maturity';
export const SERVICE_SCHEMA = 'cogentia.personal-twin-services/v1';
export const MATURITY_SCHEMA = 'cogentia.personal-twin-maturity/v1';

const slugOk=x=>typeof x==='string'&&/^[a-z][a-z0-9-]{2,79}$/.test(x);
const refOk=x=>typeof x==='string'&&/^[a-z][a-z0-9_.:/-]{2,255}$/.test(x);
function validate(manifest) {
  const i=manifest?.instance;
  if(!i||!slugOk(i.canonical_slug)||!refOk(i.subject_ref)||
    !i.subject_ref.startsWith('subject:')||
    i.subject_root_ref!==`twin:${i.canonical_slug}`||
    !i.display_name||typeof i.display_name!=='string'||
    typeof i.bot_name!=='string'||!i.bot_name||
    (i.host_instance_id??JHN_ROOT_INSTANCE_ID)!==JHN_ROOT_INSTANCE_ID||
    !Array.isArray(manifest.aliases)||
    !manifest.aliases.includes(i.canonical_slug)||
    !manifest.aliases.every(slugOk)||
    new Set(manifest.aliases).size!==manifest.aliases.length||
    !Array.isArray(manifest.services)||manifest.services.length<1||
    !manifest.services.every(s=>s&&typeof s==='object'&&
       ['gmail','chatgpt','unix','hosted_browser'].includes(s.kind)&&
       ['declared','verified'].includes(s.status)&&
       s.access==='not_delegated')||
    new Set(manifest.services.map(s=>s.kind)).size!==manifest.services.length)
    throw Error('invalid_hosted_personal_twin_manifest');
  const browser=manifest.services.find(s=>s.kind==='hosted_browser');
  if(browser && (typeof browser.url!=='string'||!browser.url.startsWith('https://')||
      !browser.login||!browser.unix_user))throw Error('invalid_browser_binding');
  const gmail=manifest.services.find(s=>s.kind==='gmail');
  if(gmail && (typeof gmail.address!=='string'||!gmail.address.includes('@')))
    throw Error('invalid_email_binding');
  return i;
}
const stringify=value=>JSON.stringify(value,(k,v)=>
  v&&typeof v==='object'&&!Array.isArray(v)?
  Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const onlyIdentity=x=>({
  canonical_slug:x.canonical_slug,
  subject_ref:x.subject_ref,
  subject_root_ref:x.subject_root_ref,
  host_instance_id:x.host_instance_id??JHN_ROOT_INSTANCE_ID,
  subject_kind:x.subject_kind, deployment_kind:x.deployment_kind,
  status:x.status, is_claimable:x.is_claimable, principal_id:x.principal_id??null,
});
export function provisionalTwinTemplate(manifest){
  const i=validate(manifest);
  return {
    canonical_slug:i.canonical_slug,display_name:i.display_name,
    bot_name:i.bot_name,subject_ref:i.subject_ref,
    subject_root_ref:i.subject_root_ref,
    host_instance_id:JHN_ROOT_INSTANCE_ID,
    principal_id:null,status:'provisional',deployment_kind:'personal',
    subject_kind:'living_person',is_claimable:true,
    metadata:{provisioning:'hosted_personal_twin'},
  };
}
export function configForHostedTwin(manifest, instance_id, {existingKeys=[]}={}){
  const i=validate(manifest);
  const keys=new Set(existingKeys);
  const row=(key,value,category)=>({
    instance_id,key,
    value:typeof value==='string'?value:null,
    value_json:typeof value==='string'?null:value,
    category,description:'Cogentia Personal Twin / hosted instance',
    is_public:false,is_secret:false
  });
  const configs=[
    row(SERVICES_KEY,{schema:SERVICE_SCHEMA,services:structuredClone(manifest.services)},'integrations'),
    row(MATURITY_KEY,{schema:MATURITY_SCHEMA,
      phase:'hosted_provisional',storage:{kind:'shared_supabase',
        host_instance_id:JHN_ROOT_INSTANCE_ID},
      dedicated_supabase:{state:'not_provisioned'},
      github_memory:{state:'not_provisioned'},
      principal_claim:{state:'pending'}},'lifecycle'),
  ];
  // Existing Twins may have deliberately chosen bot and community names:
  // never replace their personalizations (e.g. Frédéric / Aréopage).
  if(!keys.has('bot_name'))configs.push(row('bot_name',i.bot_name,'branding'));
  if(!keys.has('community_name'))configs.push(
    row('community_name',i.display_name+' — Cogentia Personal Twin','identity'));
  if(!keys.has('community_code'))configs.push(
    row('community_code',i.canonical_slug,'identity'));
  return configs;
}
export async function ensureHostedPersonalTwin(adapter,manifest,{apply=false}={}){
  const desired=provisionalTwinTemplate(manifest);
  const bySlug=await adapter.instanceBySlug(desired.canonical_slug);
  const bySubject=await adapter.instanceBySubject(desired.subject_ref);
  if(bySlug&&bySubject&&bySlug.id!==bySubject.id)
    throw Error('instance_identity_collision');
  const existing=bySlug||bySubject;
  if(existing){
    if(existing.canonical_slug!==desired.canonical_slug||
       existing.subject_ref!==desired.subject_ref||
       existing.subject_root_ref!==desired.subject_root_ref||
       existing.host_instance_id!==desired.host_instance_id||
       existing.subject_kind!=='living_person'||existing.deployment_kind!=='personal')
      throw Error('existing_instance_identity_conflict');
    if(existing.status==='archived')throw Error('instance_archived');
  }else{
    const root=await adapter.instanceById(JHN_ROOT_INSTANCE_ID);
    if(!root||root.canonical_slug!=='jhn')throw Error('jhn_host_missing');
  }
  const conflicts=await Promise.all(manifest.aliases.map(async alias=>{
    const owner=await adapter.aliasOwner(alias);
    return owner && owner!==existing?.id?alias:null;
  }));
  const collided=conflicts.filter(Boolean);
  if(collided.length)throw Error('instance_alias_collision:'+collided.join(','));
  const view={
    ok:true,action:existing?'reconcile_existing':'create',
    instance_id:existing?.id??null,
    canonical_slug:desired.canonical_slug,
    subject_ref:desired.subject_ref,host_instance_id:desired.host_instance_id,
    principal_bound:Boolean(existing?.principal_id),
    aliases:manifest.aliases,service_kinds:manifest.services.map(s=>s.kind)
  };
  if(!apply)return view;
  const instance=existing||await adapter.createInstance(desired);
  if(!instance?.id)throw Error('instance_insert_missing_id');
  // Verify identity after commit; never silently adopt the wrong existing row.
  const actual=onlyIdentity(instance);
  if(actual.canonical_slug!==desired.canonical_slug||
     actual.subject_ref!==desired.subject_ref||
     actual.subject_root_ref!==desired.subject_root_ref)
    throw Error('instance_postcondition_failed');
  for(const alias of manifest.aliases){
    if(!await adapter.aliasOwner(alias))
      await adapter.createAlias({alias,instance_id:instance.id,
        is_primary:alias===desired.canonical_slug,
        alias_kind:alias===desired.canonical_slug?'canonical_slug':'alternative',
        description:'Personal Twin hosted on JHN'});
  }
  const original=await adapter.configForInstance(instance.id);
  const originalKeys=Object.keys(original);
  const configRows=configForHostedTwin(manifest,instance.id,{existingKeys:originalKeys});
  // Bootstrap must not undo later maturity or previously granted integration
  // access on an existing Twin. Repeated ensure merely fills missing data.
  for(const row of configRows){
    if(row.key===MATURITY_KEY&&original[row.key])continue;
    if(row.key===SERVICES_KEY&&original[row.key]?.value_json?.services){
      const old=original[row.key].value_json;
      const existingByKind=new Map(old.services.map(s=>[s.kind,s]));
      row.value_json={...row.value_json,services:row.value_json.services.map(
        incoming=>({...incoming,...(existingByKind.get(incoming.kind)??{})}))};
    }
    if(stringify({value:original[row.key]?.value??null,
      value_json:original[row.key]?.value_json??null})===
      stringify({value:row.value,value_json:row.value_json}))continue;
    await adapter.upsertConfig(row);
  }
  return {...view,instance_id:instance.id,action:existing?'reconciled':'created',
    config_keys:configRows.map(x=>x.key),applied:true};
}
