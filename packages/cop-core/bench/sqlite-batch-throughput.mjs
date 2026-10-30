/** Synthetic atomic SQLite batch benchmark; WAL FULL, disk; no production writes. */
import {performance} from 'node:perf_hooks';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createSqliteCopEventStore} from '../src/sqlite-cop-event-store.js';
const n=Number(process.argv[2]||1000);
if(!Number.isSafeInteger(n)||n<1||n>100000) throw new RangeError('invalid event count');
for(const batchSize of [1,10,50,100]) {
 const dir=mkdtempSync(join(tmpdir(),'cop-batch-bench-'));
 const store=createSqliteCopEventStore(join(dir,'events.sqlite'));
 try {
  const t0=performance.now();
  for(let i=0;i<n;i+=batchSize) {
   const entries=Array.from({length:Math.min(batchSize,n-i)},(_,j)=>({
    event_type:'Act',topic:{id:'benchmark:events',seq:i+j+1},
    epistemic_status:'observed',visibility:'restricted',
    idempotency_key:`benchmark:${i+j}`,payload:{kind:'Act',number:i+j},
   }));
   const result=store.appendBatch(entries,{maxBatchSize:batchSize});
   if(!result.ok) throw Error(`batch error: ${result.error}`);
  }
  const elapsed=performance.now()-t0;
  console.log(JSON.stringify({events:n,batchSize,elapsed_ms:Math.round(elapsed),events_per_sec:Math.round(n*1000/elapsed),durability:'WAL_FULL_disk',seq:store.topicCommitment('benchmark:events').seq}));
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
}
