#!/usr/bin/env node
/**
 * Generic trusted-local-cache -> JHN Vault promotion.
 * Invoked from an already COP-admitted host process or the human owner's
 * authenticated workstation session. No raw secret in CLI args or output.
 *
 * Example: --keys GANDI_PAT,GANDI_ACCESS_KEY --apply
 * Default is a value-free metadata plan; --apply imports only named keys.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseEnv} from 'node:util';
import {createInstanceVaultConfigCore} from './lib/vault-config-core.js';

const args=process.argv.slice(2),at=(name)=>args.indexOf(name);
const position=at('--keys'),apply=args.includes('--apply');
if(position<0||!args[position+1]||args.some((a,i)=>
  a!=='--apply'&&a!=='--keys'&&i!==position+1)){
  console.log(JSON.stringify({ok:false,error:'usage: --keys KEY1,KEY2 [--apply]'}));
  process.exit(2);
}
const names=args[position+1].split(',').filter(Boolean);
if(!names.length||names.length>20||new Set(names).size!==names.length||
  names.some(k=>!/^[A-Z][A-Z0-9_]{0,127}$/.test(k)||
    /^(?:SUPABASE|VITE_|PUBLIC_|NEXT_PUBLIC_)/.test(k))){
  console.log(JSON.stringify({ok:false,error:'invalid_local_cache_selection'}));process.exit(2);
}
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const local=path.join(repo,'.env');
if(!fs.existsSync(local)){console.log(JSON.stringify({ok:false,error:'trusted_cache_missing'}));process.exit(2)}
const config=parseEnv(fs.readFileSync(local,'utf8')),validNames=names.every(n=>
  typeof config[n]==='string'&&config[n].trim().length>0);
if(!validNames){console.log(JSON.stringify({ok:false,error:'selected_local_value_missing'}));process.exit(2)}
const url=config.SUPABASE_URL||config.VITE_SUPABASE_URL;
const role=config.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!role||new URL(url).hostname!=='ndiysuhzmztatpxbkezn.supabase.co'){
  console.log(JSON.stringify({ok:false,error:'jhn_bootstrap_missing'}));process.exit(2);
}
const refKeys=names.map(name=>({source:name,key:name.toLowerCase()}));
if(!apply){
  console.log(JSON.stringify({ok:true,instance:'jhn',dry_run:true,
    selected:refKeys.map(x=>x.key),values_exposed:false}));
  process.exit(0);
}
// Minimal, fixed-origin PostgREST adapter; no third-party Node dependencies
// or generic URL/SQL input from the caller. This stays inside trusted runtime.
const restEndpoint=new URL('/rest/v1/instance_config',url);
function createRestClient(){
  return {
    from(table){
      if(table!=='instance_config')throw Error('invalid_vault_table');
      let method='GET',body=null,selection='*';
      const filters=new Map();
      return {
        select(columns){selection=columns;return this;},
        eq(field,value){
          if(field!=='instance_id'&&field!=='key')throw Error('invalid_vault_filter');
          filters.set(field,'eq.'+value);return this;
        },
        insert(value){method='POST';body=value;return this;},
        async maybeSingle(){return this.request();},
        async single(){return this.request();},
        async request(){
          const endpoint=new URL(restEndpoint);
          endpoint.searchParams.set('select',selection);
          for(const [k,v] of filters)endpoint.searchParams.set(k,v);
          let response;
          try{
            response=await fetch(endpoint,{
              method,signal:AbortSignal.timeout(20000),redirect:'error',
              headers:{apikey:role,Authorization:'Bearer '+role,
                Accept:'application/json',
                ...(method==='POST'?{'Content-Type':'application/json',
                  Prefer:'return=representation'}:{})},
              ...(method==='POST'?{body:JSON.stringify(body)}:{}),
            });
          }catch{return {data:null,error:{code:'VAULT_TRANSPORT_FAILED'}};}
          if(!response.ok)return {data:null,error:{code:'VAULT_HTTP_'+response.status}};
          let rows;
          try{rows=await response.json();}catch{
            return {data:null,error:{code:'VAULT_RESPONSE_INVALID'}};
          }
          if(!Array.isArray(rows)||rows.length>1)
            return {data:null,error:{code:'VAULT_RESPONSE_UNEXPECTED'}};
          return {data:rows[0]||null,error:null};
        },
      };
    },
  };
}
const client=createRestClient();
const core=createInstanceVaultConfigCore({client});
const receipts=[];
for(const {source,key} of refKeys) {
  try {receipts.push(await core.promote({key,resolveTrustedValue:()=>config[source].trim()}));}
  catch(e) {
    console.log(JSON.stringify({ok:false,error:e.code||'VAULT_PROMOTE_FAILED',
      completed:receipts,failed:key,values_exposed:false}));
    process.exit(1);
  }
}
console.log(JSON.stringify({ok:true,instance:'jhn',receipts,values_exposed:false}));
