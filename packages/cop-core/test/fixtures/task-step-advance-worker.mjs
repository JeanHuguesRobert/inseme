/** Separate Node process: verify cross-VM CAS using the real COP SQLite store. */
import {createSqliteCopEventStore} from '../../src/sqlite-cop-event-store.js';
import {advancePacketTaskStep} from '../../src/packet-task-step-cursor.js';
const [dbPath,packet_ref,task_ref,expected_step_ref,version,transition_id]=
  process.argv.slice(2);
const store=createSqliteCopEventStore(dbPath);
try{
  const result=advancePacketTaskStep(store,{packet_ref,task_ref,
    expected_step_ref,expected_version:Number(version),transition_id});
  process.stdout.write(JSON.stringify(result)+'\n');
}finally{store.close()}
