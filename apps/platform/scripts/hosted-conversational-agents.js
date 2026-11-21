#!/usr/bin/env node
/** Generic idempotent bootstrap: each named Personal Twin gets a primary
 * ChatGPT conversation agent. COP is the append-only source of declaration;
 * Supabase is the projection. No ChatGPT account login or MCP grant occurs.
 *
 * node --env-file=/srv/cogentia/repos/inseme/.env \
 *   apps/platform/scripts/hosted-conversational-agents.js \
 *   --twins jhn,marguerite-ghionga,frederic-lecourtois
 * Repeat with --apply --store /var/lib/cogentia/cop/john-root-v1.sqlite
 */
import {createClient} from '@supabase/supabase-js';
import {createSqliteCopEventStore} from '../../../packages/cop-core/src/sqlite-cop-event-store.js';
import {adapterForSupabase} from './hosted-personal-twins.js';
import {ensureHostedConversationalAgent} from '../../../packages/cop-host/src/instances/hostedConversationalAgent.js';

export function conversationalSupabaseAdapter(client){
  const instances=adapterForSupabase(client);
  const one=async (builder,label)=>{
    const {data,error}=await builder.maybeSingle();
    if(error)throw Error('supabase_'+label+':'+error.code);
    return data;
  };
  return {...instances,
    logicalAgentById:id=>one(client.from('cop_logical_agents').select('*')
      .eq('logical_agent_id',id),'logical_agent'),
    createLogicalAgent:async row=>{
      const {error}=await client.from('cop_logical_agents').insert(row);
      if(error)throw Error('supabase_create_logical_agent:'+error.code);
    },
    linkLogicalAgent:async (id,uuid)=>{
      const {data,error}=await client.from('cop_logical_agents')
        .update({instance_id:uuid}).eq('logical_agent_id',id).is('instance_id',null).select('instance_id');
      if(error||data?.length!==1)throw Error('supabase_link_logical_agent_failed');
    },
  };
}
export async function onboard({adapter,store,twins,apply=false}={}){
  if(!Array.isArray(twins)||!twins.length||new Set(twins).size!==twins.length)
    throw Error('one_or_more_distinct_twin_slugs_required');
  // Preflight all before mutating even the first Twin.
  for(const twin_slug of twins)await ensureHostedConversationalAgent({adapter,store,twin_slug});
  const out=[];
  for(const twin_slug of twins)
    out.push(await ensureHostedConversationalAgent({adapter,store,twin_slug,apply}));
  return out;
}
if(process.argv[1]&&new URL(import.meta.url).pathname===process.argv[1]){
  const argv=process.argv.slice(2);
  const twins=argv[argv.indexOf('--twins')+1]?.split(',').map(s=>s.trim());
  const apply=argv.includes('--apply');
  const storePath=argv[argv.indexOf('--store')+1];
  if(!twins||!twins.length||twins.some(x=>!x||x.startsWith('--')))
    throw Error('usage: --twins <slug[,slug...]> [--apply --store <canonical-path>]');
  if(apply&&(!storePath||storePath.startsWith('--')))
    throw Error('canonical_COP_store_required_for_apply');
  const url=process.env.SUPABASE_URL,secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!secret)throw Error('JHN Supabase configuration unavailable');
  if(new URL(url).hostname!=='ndiysuhzmztatpxbkezn.supabase.co')
    throw Error('unexpected_Supabase_project');
  const adapter=conversationalSupabaseAdapter(createClient(url,secret,{auth:{persistSession:false}}));
  const store=apply?createSqliteCopEventStore(storePath):null;
  try {const results=await onboard({adapter,store,twins,apply});
    results.forEach(x=>process.stdout.write(JSON.stringify(x)+'\n'));
  } finally {store?.close();}
}
