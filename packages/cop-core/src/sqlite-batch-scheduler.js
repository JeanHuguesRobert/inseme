/** Bounded in-process commit scheduler for explicitly batchable events.
 * A queued event is NOT durable. Only a resolved enqueue() confirms COMMIT.
 * Consequential operations must call appendImmediate() or the ledger's normal append().
 */
export function createSqliteBatchScheduler({store,maxBatchSize=50,maxWaitMs=25}={}) {
  if(typeof store?.appendBatch!=='function'||typeof store?.append!=='function')
    throw new TypeError('durable SQLite store with append and appendBatch required');
  if(!Number.isSafeInteger(maxBatchSize)||maxBatchSize<1||maxBatchSize>1000||
     !Number.isSafeInteger(maxWaitMs)||maxWaitMs<0||maxWaitMs>60000)
    throw new RangeError('invalid scheduler bounds');
  let queue=[], timer=null, closed=false;
  const cancel=()=>{if(timer!==null){clearTimeout(timer);timer=null;}};
  function flush(){
    cancel();
    if(queue.length===0)return {ok:true,attempted:0};
    const entries=queue.splice(0,maxBatchSize);
    try {
      const outcome=store.appendBatch(entries.map(e=>e.event),{maxBatchSize});
      if(!outcome.ok) {
        for(const e of entries)e.resolve({ok:false,error:outcome.error,index:outcome.index});
      } else outcome.results.forEach((result,i)=>entries[i].resolve(result));
      if(queue.length)arm();
      return {ok:outcome.ok,attempted:entries.length,error:outcome.error};
    }catch(error){
      for(const e of entries)e.reject(error);
      if(queue.length)arm();
      return {ok:false,attempted:entries.length,error:String(error.message||error)};
    }
  }
  function arm(){
    if(timer!==null||queue.length===0)return;
    timer=setTimeout(()=>{timer=null;flush();},maxWaitMs);
  }
  function enqueue(event,{batchable=false}={}){
    if(closed)return Promise.reject(new Error('batch_scheduler_closed'));
    if(!batchable)return Promise.reject(new Error('explicit_batchable_consent_required'));
    if(event?.topic?.id?.startsWith('execution-budget:'))
      return Promise.reject(new Error('budget_events_require_immediate_commit'));
    return new Promise((resolve,reject)=>{
      queue.push({event,resolve,reject});
      if(queue.length>=maxBatchSize)flush();else arm();
    });
  }
  function appendImmediate(event){
    if(closed)throw new Error('batch_scheduler_closed');
    // Preserve per-topic append ordering. Queued entries are committed first.
    while(queue.length){const result=flush();if(!result.ok)return {ok:false,error:'queued_batch_failed',cause:result.error};}
    return store.append(event);
  }
  function close(){
    if(closed)return;
    while(queue.length)flush();
    closed=true;cancel();
  }
  return {enqueue,flush,appendImmediate,close,get pendingCount(){return queue.length;}};
}
