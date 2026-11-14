import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createSqliteCopEventStore} from '../src/sqlite-cop-event-store.js';
import {createFractalogActRecord,fractalogRecordToCopEnvelope} from '../src/fractalog.js';

function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'cop-audit-'));
 const filename=join(dir,'cop.db');
 const store=createSqliteCopEventStore(filename);
 const record=createFractalogActRecord({record_id:'r1',act_id:'act:sample',
   act_kind:'test',owner_instance_ref:'instance:test',act_phase:'observed'});
 assert.equal(store.appendBatch([
   {event_type:'Act',topic:{id:'a'},idempotency_key:'a1',payload:{a:1}},
   {event_type:'Act',topic:{id:'a'},idempotency_key:'a2',payload:{a:2}},
   fractalogRecordToCopEnvelope(record),
 ]).ok,true);
 return {dir,filename,store};
}
function mutate(f,sql,args=[]){
 f.store.close();const db=new DatabaseSync(f.filename);
 try{db.prepare(sql).run(...args);}finally{db.close()}
 f.store=createSqliteCopEventStore(f.filename);
}
function cleanup(f){f.store.close();rmSync(f.dir,{recursive:true,force:true});}

test('COP topic and FractaLog document commitments pass a cold read audit',()=>{
 const f=fixture();try{
  const audit=f.store.auditCommitments();
  assert.equal(audit.ok,true,JSON.stringify(audit));
  assert.equal(audit.topics_checked,2);
  assert.equal(audit.events_checked,3);
  assert.equal(f.store.auditTopicCommitment('a').ok,true);
 }finally{cleanup(f)}
});
test('audit detects tampered event without mutating it',()=>{
 const f=fixture();try{
  mutate(f,"UPDATE cop_events SET envelope=replace(envelope, '\"a\":2', '\"a\":9') WHERE idem='a2'");
  const audit=f.store.auditCommitments();
  assert.equal(audit.ok,false);
  assert.ok(audit.failures.some(t=>t.topic==='a'&&t.errors.includes('commitment_mismatch')));
 }finally{cleanup(f)}
});
test('audit detects missing middle event and stale commitment',()=>{
 const f=fixture();try{
  mutate(f,"DELETE FROM cop_events WHERE idem='a1'");
  const state=f.store.auditTopicCommitment('a');
  assert.equal(state.ok,false);
  assert.ok(state.errors.some(e=>e.startsWith('sequence_gap')));
 }finally{cleanup(f)}
});
test('audit detects forged FractaLog document hash',()=>{
 const f=fixture();try{
  mutate(f,`UPDATE cop_events SET envelope=json_set(envelope,
    '$.payload.integrity.document_hash', 'sha256:forged')
    WHERE json_extract(envelope,'$.event_type')='fractalog.act-record/v1'`);
  const audit=f.store.auditCommitments();
  assert.equal(audit.ok,false);
  assert.ok(audit.failures.some(t=>t.errors.some(e=>e.startsWith('fractalog_document_hash_mismatch'))));
 }finally{cleanup(f)}
});
