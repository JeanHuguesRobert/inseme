/** Opt-in synthetic benchmark, no Supabase writes. Usage: node ... [100 1000 10000] */
import {performance} from 'node:perf_hooks';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createSqliteCopEventStore} from '../src/sqlite-cop-event-store.js';
import {createEventSourcedExecutionBudgetLedger,recordExecutionBudgetGrant} from '../src/execution-budget.js';
const disk=process.argv.includes('--disk');
for(const n of process.argv.slice(2).filter(x=>x!=='--disk').length?process.argv.slice(2).filter(x=>x!=='--disk').map(Number):[100,1000,10000]) {
 const dir=disk?mkdtempSync(join(tmpdir(),'cop-bench-')):null;
 const store=createSqliteCopEventStore(disk?join(dir,'ledger.sqlite'):':memory:');
 try {
  recordExecutionBudgetGrant(store,{budget_id:'bench',mandate_ref:'mandate:bench',principal_ref:'person:test',limits:{max_steps:n}});
  const ledger=createEventSourcedExecutionBudgetLedger({store,budget_id:'bench',limits:{max_steps:n},require_authority_grant:true});
  const t0=performance.now();
  for(let i=0;i<n;i++){
   const r=ledger.reserve({idempotency_key:`bench-${i}`,expected_version:ledger.snapshot().version,demand:{max_steps:1}});
   if(!r.ok) throw Error(`reserve: ${r.error}`);
   const s=ledger.settle({reservation_id:r.reservation.reservation_id,expected_version:r.snapshot.version,usage:{max_steps:1}});
   if(!s.ok) throw Error(`settle: ${s.error}`);
  }
  const t1=performance.now();
  const snapshot=ledger.snapshot();
  const commitment=store.topicCommitment('execution-budget:bench');
  console.log(JSON.stringify({operations:n*2,events:n*2+1,elapsed_ms:Math.round(t1-t0),ops_per_second:Math.round(n*2*1000/(t1-t0)),storage:disk?'sqlite-wal-full-disk':'memory',settled:snapshot.settled.max_steps,head_seq:commitment.seq}));
 }finally{store.close();if(dir)rmSync(dir,{recursive:true,force:true});}
}
