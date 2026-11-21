#!/usr/bin/env node
/** Generic CLI: plan/apply/verify hosted Personal Twin manifests on JHN. */
import fs from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {ensureHostedPersonalTwin} from '../../../packages/cop-host/src/instances/hostedPersonalTwin.js';

export function adapterForSupabase(client){
  async function one(query,label){
    const {data,error}=await query.maybeSingle();
    if(error)throw Error(`supabase_${label}:${error.code||'error'}`);
    return data;
  }
  return {
    instanceBySlug:slug=>one(client.from('instances').select('*')
      .eq('canonical_slug',slug),'instance_slug'),
    instanceBySubject:ref=>one(client.from('instances').select('*')
      .eq('subject_ref',ref),'instance_subject'),
    instanceById:id=>one(client.from('instances').select('*').eq('id',id),'instance_id'),
    aliasOwner:async alias=>(await one(client.from('instance_aliases')
      .select('instance_id').eq('alias',alias),'alias'))?.instance_id??null,
    createInstance:async row=>{
      const {data,error}=await client.from('instances').insert(row).select().single();
      if(error)throw Error('supabase_create_instance:'+error.code);
      return data;
    },
    createAlias:async row=>{
      const {error}=await client.from('instance_aliases').insert(row);
      if(error)throw Error('supabase_create_alias:'+error.code);
    },
    configForInstance:async id=>{
      const {data,error}=await client.from('instance_config')
        .select('key,value,value_json').eq('instance_id',id);
      if(error)throw Error('supabase_config_read:'+error.code);
      return Object.fromEntries(data.map(x=>[x.key,x]));
    },
    upsertConfig:async row=>{
      const {error}=await client.from('instance_config')
        .upsert(row,{onConflict:'instance_id,key'});
      if(error)throw Error('supabase_config_write:'+error.code);
    }
  };
}
if(process.argv[1]&&new URL(import.meta.url).pathname===process.argv[1]){
  const argv=process.argv.slice(2),file=argv[argv.indexOf('--manifest')+1];
  const apply=argv.includes('--apply');
  if(!file||file.startsWith('--'))throw Error('usage: --manifest <private-file.json> [--apply]');
  const url=process.env.SUPABASE_URL,secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!secret)throw Error('JHN Supabase service credentials missing');
  if(!url.includes('ndiysuhzmztatpxbkezn.supabase.co'))
    throw Error('not_jhn_supabase_project');
  const manifest=JSON.parse(fs.readFileSync(file,'utf8'));
  const members=Array.isArray(manifest)?manifest:[manifest];
  const client=createClient(url,secret,{auth:{persistSession:false}});
  for(const item of members) {
    const result=await ensureHostedPersonalTwin(adapterForSupabase(client),item,{apply});
    process.stdout.write(JSON.stringify(result)+'\n');
  }
}
