import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureHostedPersonalTwin,JHN_ROOT_INSTANCE_ID,
  configForHostedTwin,provisionalTwinTemplate} from '../../../../packages/cop-host/src/instances/hostedPersonalTwin.js';

function input(slug='alice-demo'){
 return {instance:{canonical_slug:slug,subject_ref:'subject:'+slug,
   subject_root_ref:'twin:'+slug,display_name:'Alice Exemple',bot_name:'Ophélia'},
   aliases:[slug,'ali-demo'],services:[
     {kind:'gmail',address:'alice@example.invalid',status:'declared',access:'not_delegated'},
     {kind:'chatgpt',plan:'free',status:'declared',access:'not_delegated'},
     {kind:'unix',host:'node:fracta2',username:'hosted-alice',
      status:'verified',access:'not_delegated'},
     {kind:'hosted_browser',url:'https://browser.example.invalid',
      login:'ali',unix_user:'hosted-alice',status:'verified',access:'not_delegated'}
   ]};
}
function registry(){
 const instances=new Map([['jhn',{id:JHN_ROOT_INSTANCE_ID,canonical_slug:'jhn'}]]);
 const aliases=new Map(),configs=new Map();
 return {instances,aliases,configs,
   instanceBySlug:async s=>instances.get(s)??null,
   instanceBySubject:async r=>[...instances.values()].find(x=>x.subject_ref===r)??null,
   instanceById:async id=>[...instances.values()].find(x=>x.id===id)??null,
   aliasOwner:async a=>aliases.get(a)??null,
   createInstance:async d=>{const x={...d,id:'uuid-demo'};instances.set(d.canonical_slug,x);return x;},
   createAlias:async r=>{aliases.set(r.alias,r.instance_id);},
   configForInstance:async id=>configs.get(id)||{},
   upsertConfig:async r=>{const m=configs.get(r.instance_id)||{};
      m[r.key]=r;configs.set(r.instance_id,m);}
 };
}
test('plan + apply + repeat creates exactly one hosted provisional human Twin',async()=>{
 const db=registry(),m=input();
 const plan=await ensureHostedPersonalTwin(db,m);
 assert.equal(plan.action,'create');assert.equal(plan.instance_id,null);
 assert.equal(db.instances.size,1);
 const created=await ensureHostedPersonalTwin(db,m,{apply:true});
 assert.equal(created.action,'created');assert.equal(db.instances.size,2);
 assert.equal(created.instance_id,'uuid-demo');
 const x=db.instances.get('alice-demo');
 assert.equal(x.host_instance_id,JHN_ROOT_INSTANCE_ID);
 assert.equal(x.principal_id,null);assert.equal(x.is_claimable,true);
 assert.equal(x.status,'provisional');assert.equal(x.subject_root_ref,'twin:alice-demo');
 assert.equal(db.configs.get('uuid-demo').personal_twin_services.is_public,false);
 const result=await ensureHostedPersonalTwin(db,m,{apply:true});
 assert.equal(result.action,'reconciled');assert.equal(db.instances.size,2);
});
test('recognizes existing Twin and preserves chosen persona/identity',async()=>{
 const db=registry(),m=input();
 const x={...provisionalTwinTemplate(m),id:'existing',bot_name:'Aréopage',
   status:'provisional',metadata:{specialty:'Lettres classiques'}};
 db.instances.set('alice-demo',x);
 db.configs.set('existing',{bot_name:{value:'Aréopage',value_json:null}});
 const r=await ensureHostedPersonalTwin(db,m,{apply:true});
 assert.equal(r.action,'reconciled');assert.equal(r.instance_id,'existing');
 assert.equal(db.instances.get('alice-demo').bot_name,'Aréopage');
 assert.equal(db.configs.get('existing').bot_name.value,'Aréopage');
 assert.equal(db.configs.get('existing').personal_twin_services.value_json.schema,
   'cogentia.personal-twin-services/v1');
});
test('rejects alias and identity collisions, no silent ownership switch',async()=>{
 const db=registry(),m=input();
 db.aliases.set('ali-demo','other-instance');
 await assert.rejects(ensureHostedPersonalTwin(db,m,{apply:true}),/alias_collision/);
 db.aliases.clear();
 db.instances.set('alice-demo',{...provisionalTwinTemplate(m),
  id:'other-instance',subject_ref:'subject:someone-else'});
 await assert.rejects(ensureHostedPersonalTwin(db,m,{apply:true}),/identity_conflict/);
});
test('configuration is instance-local and does not carry credentials',()=>{
 const rows=configForHostedTwin(input(),'id-demo');
 assert.ok(rows.every(r=>r.instance_id==='id-demo'&&r.is_public===false));
 assert.ok(!JSON.stringify(rows).includes('password'));
 assert.ok(rows.some(r=>r.key==='personal_twin_maturity'));
});

test('reprovision preserves Principal-claimed maturity and previously delegated access',async()=>{
 const db=registry(),m=input();
 await ensureHostedPersonalTwin(db,m,{apply:true});
 const c=db.configs.get('uuid-demo');
 c.personal_twin_maturity.value_json.phase='claimed';
 c.personal_twin_maturity.value_json.dedicated_supabase.state='ready';
 c.personal_twin_services.value_json.services[0].access='delegated';
 await ensureHostedPersonalTwin(db,m,{apply:true});
 assert.equal(c.personal_twin_maturity.value_json.phase,'claimed');
 assert.equal(c.personal_twin_maturity.value_json.dedicated_supabase.state,'ready');
 assert.equal(c.personal_twin_services.value_json.services[0].access,'delegated');
});
