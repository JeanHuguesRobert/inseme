import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemoryCopEventStore} from '../../../../packages/cop-core/src/cop-event-spool.js';
import {ensureHostedConversationalAgent,conversationalAgentIdentity} from '../../../../packages/cop-host/src/instances/hostedConversationalAgent.js';

const root={id:'twin-uuid',canonical_slug:'marguerite-ghionga',display_name:'Marguerite Ghionga',
  subject_root_ref:'twin:marguerite-ghionga',subject_kind:'living_person',principal_id:null};
function harness(){
  const entries=[root], aliases=new Map(), logical=new Map(), store=createMemoryCopEventStore();
  store.eventByIdempotency=key=>store.replay().find(e=>e.idempotency_key===key)||null;
  store.transaction=fn=>({ok:true,value:fn(store)});
  const adapter={
    instanceBySlug:async slug=>entries.find(x=>x.canonical_slug===slug)||null,
    instanceBySubject:async ref=>entries.find(x=>x.subject_ref===ref)||null,
    logicalAgentById:async id=>logical.get(id)||null,
    aliasOwner:async alias=>aliases.get(alias)||null,
    createInstance:async x=>{const row={...x,id:'agent-uuid'};entries.push(row);return row;},
    createAlias:async x=>{aliases.set(x.alias,x.instance_id);},
    createLogicalAgent:async x=>{logical.set(x.logical_agent_id,x);},
    linkLogicalAgent:async (id,uuid)=>{logical.get(id).instance_id=uuid;}
  };
  return {entries,aliases,logical,adapter,store};
}
test('distinct permanent agent identity subordinate to Twin, not its Principal',()=>{
  const a=conversationalAgentIdentity(root);
  assert.equal(a.logical_agent_id,'agent:marguerite-ghionga:chatgpt');
  assert.equal(a.host_instance_id,root.id);
  assert.equal(a.principal_id,null);
  assert.notEqual(a.subject_root_ref,root.subject_root_ref);
});
test('plan is read-only, creates canonical event then a projected instance',async()=>{
  const h=harness();const args={adapter:h.adapter,store:h.store,twin_slug:root.canonical_slug};
  assert.equal((await ensureHostedConversationalAgent(args)).next,'create');
  assert.equal(h.entries.length,1);
  const first=await ensureHostedConversationalAgent({...args,apply:true});
  assert.equal(first.action,'created');
  assert.equal(h.entries.length,2);
  assert.equal(h.logical.get(first.logical_agent_id).active_mandate_ref,null);
  assert.equal(h.logical.get(first.logical_agent_id).status,'declared');
  assert.equal(h.logical.get(first.logical_agent_id).instance_id,first.instance_id);
  const second=await ensureHostedConversationalAgent({...args,apply:true});
  assert.equal(second.cop_duplicate,true);
  assert.equal(h.entries.length,2);
  assert.equal(h.store.listTopic(first.logical_agent_id).length,1);
});
test('detects a colliding agent alias without modifying anything',async()=>{
  const h=harness();h.aliases.set('chatgpt-marguerite-ghionga','another');
  await assert.rejects(ensureHostedConversationalAgent({adapter:h.adapter,store:h.store,twin_slug:root.canonical_slug,apply:true}),/agent_alias_collision/);
  assert.equal(h.entries.length,1);
});
test('refuses to invent a mandate for a different preexisting agent',async()=>{
  const h=harness();h.logical.set('agent:marguerite-ghionga:chatgpt',{
    logical_agent_id:'agent:marguerite-ghionga:chatgpt',twin_root_ref:'twin:marguerite-ghionga',active_mandate_ref:'mandate:unverified'});
  await assert.rejects(ensureHostedConversationalAgent({adapter:h.adapter,store:h.store,twin_slug:root.canonical_slug,apply:true}),/agent_projection_conflict/);
});
test('cannot turn a nonhuman instance into a human conversational account',()=>{
  assert.throws(()=>conversationalAgentIdentity({...root,subject_kind:'digital_native'}),/invalid_personal_twin_or_provider/);
});
