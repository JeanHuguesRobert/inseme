import {performance} from 'node:perf_hooks';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createSqliteCopEventStore} from '../src/sqlite-cop-event-store.js';
import {createSqliteBatchScheduler} from '../src/sqlite-batch-scheduler.js';
const n=Number(process.argv[2]||500);
if(!Number.isSafeInteger(n)||n<1||n>100000)throw Error('bad count');
for(const size of [1,10,50,100]){
 const dir=mkdtempSync(join(tmpdir(),'cop-latency-'));
 const store=createSqliteCopEventStore(join(dir,'events.sqlite'));
 const queue=createSqliteBatchScheduler({store,maxBatchSize:size,maxWaitMs:25});
 const times=[],promises=[],t0=performance.now();
 for(let i=0;i<n;i++){
  const start=performance.now();
  const event={event_type:'Act',topic:{id:'bench',seq:i+1},idempotency_key:`bench:${i}`,epistemic_status:'observed',visibility:'restricted',payload:{kind:'Act'}};
  promises.push(queue.enqueue(event,{batchable:true}).then(r=>{if(!r.ok)throw Error(r.error);times.push(performance.now()-start)}));
 }
 queue.flush();await Promise.all(promises);
 times.sort((a,b)=>a-b);
 const percentile=p=>Math.round(times[Math.ceil(p*times.length)-1]*100)/100;
 const elapsed=performance.now()-t0;
 console.log(JSON.stringify({storage:'WAL_FULL_disk',size,events:n,events_per_sec:Math.round(n*1000/elapsed),p50_ms:percentile(.5),p95_ms:percentile(.95),p99_ms:percentile(.99)}));
 queue.close();store.close();rmSync(dir,{recursive:true,force:true});
}
