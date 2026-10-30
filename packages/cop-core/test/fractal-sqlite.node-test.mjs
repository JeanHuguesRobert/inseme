import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createSqliteCopEventStore as open } from '../src/sqlite-cop-event-store.js';
import { createEventSourcedExecutionBudgetLedger as ledger, recordExecutionBudgetGrant as grant } from '../src/execution-budget.js';
import { reserveEventSourcedDelegatedBudget as delegate } from '../src/delegated-budget.js';

const principal = 'person:p';
const limits = n => ({ max_steps:n });
const accounting = (s,id,n) => ledger({store:s,budget_id:id,limits:limits(n),require_authority_grant:true});
const allocate = (parent,account,child,id,n) => delegate({store:parent,child_store:child,parent_ledger:account,
  child_budget_id:id,child_mandate_ref:`mandate:${id}@v1`,child_source_ref:`cop://host/${id}`,principal_ref:principal,
  allocation:limits(n),idempotency_key:id});
const spend = (account,key,demand,usage) => {
  const r=account.reserve({idempotency_key:key,expected_version:account.snapshot().version,demand:limits(demand)});
  assert.equal(r.ok,true,JSON.stringify(r));
  const settled=account.settle({reservation_id:r.reservation.reservation_id,expected_version:account.snapshot().version,usage:limits(usage)});
  assert.equal(settled.ok,true,JSON.stringify(settled));
};
const verify = (child,id,receipt) => {
  const events=child.listTopic(`execution-budget:${id}`);
  const hash=`sha256:${createHash('sha256').update(JSON.stringify(events)).digest('hex')}`;
  assert.equal(receipt.evidence.source_hash,hash);
};

test('four physically separate SQLite journals, nested settlement and interrupted parent close',()=>{
  const dir=mkdtempSync(join(tmpdir(),'fractalog-tree-'));
  const paths=['root','a','b','a1','a2'].map(x=>join(dir,`${x}.sqlite`));
  const s=paths.map(open);
  try {
    const [root,a,b,a1,a2]=s;
    grant(root,{budget_id:'root',mandate_ref:'mandate:root@v1',principal_ref:principal,limits:limits(100)});
    const R=accounting(root,'root',100);
    const A=allocate(root,R,a,'a',60), B=allocate(root,R,b,'b',40);
    assert.equal(A.ok&&B.ok,true);
    const A1=allocate(a,A.child_ledger,a1,'a1',30);
    const A2=allocate(a,A.child_ledger,a2,'a2',20);
    assert.equal(A1.ok&&A2.ok,true);
    spend(A1.child_ledger,'handler:a1',25,12);
    spend(A2.child_ledger,'handler:a2',18,7);
    spend(B.child_ledger,'handler:b',15,9);
    const a1Closed=A1.close(), a2Closed=A2.close();
    assert.equal(a1Closed.ok&&a2Closed.ok,true);
    verify(a1,'a1',a1Closed);verify(a2,'a2',a2Closed);
    assert.equal(A.child_ledger.snapshot().settled.max_steps,19);
    assert.equal(A.child_ledger.snapshot().reserved.max_steps,0);
    // Crash-window simulation: seal local A, withhold parental settlement.
    const parentProxy={...R,settle:()=>({ok:false,error:'simulated_network_drop'})};
    const attempted=allocate(root,parentProxy,a,'a',60);
    assert.equal(attempted.close().error,'simulated_network_drop');
    // Close all connections, then reconstruct every ledger from local disk.
    s.forEach(db=>db.close());
    const reopened=paths.map(open);
    s.splice(0,s.length,...reopened);
    const [rr,aa,bb,aa1,aa2]=reopened;
    const recoveredRoot=accounting(rr,'root',100);
    const recoveredA=allocate(rr,recoveredRoot,aa,'a',60);
    const recoveredB=allocate(rr,recoveredRoot,bb,'b',40);
    assert.equal(recoveredA.ok&&recoveredB.ok,true);
    assert.equal(recoveredA.duplicate&&recoveredB.duplicate,true);
    const closingA=recoveredA.close();assert.equal(closingA.ok,true);
    const closingB=recoveredB.close();assert.equal(closingB.ok,true);
    verify(aa1,'a1',a1Closed);verify(aa2,'a2',a2Closed);
    verify(s[1],'a',closingA);verify(s[2],'b',closingB);
    assert.deepEqual(accounting(s[0],'root',100).snapshot().settled,limits(28));
    assert.deepEqual(accounting(s[0],'root',100).snapshot().available,limits(72));
    assert.equal(s[0].replay().filter(e=>e.payload?.kind==='Act').length,0);
    assert.equal(s[0].replay().filter(e=>e.event_type==='ExecutionBudgetSettlement').length,2);
    assert.equal(recoveredA.close().duplicate,true);
    assert.equal(accounting(s[0],'root',100).snapshot().settled.max_steps,28);
  } finally {s.forEach(x=>x.close());rmSync(dir,{recursive:true,force:true});}
});
