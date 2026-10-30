/** Test-only checkpoint projection: neither an authority ledger nor a settlement. */
import { validateFractalogActRecord } from '../../../../packages/cop-core/src/fractalog.js';

export function createBudgetCheckpointReceiver(database) {
  database.exec(`CREATE TABLE IF NOT EXISTS budget_checkpoint_receipts (
    record_id TEXT PRIMARY KEY, document_hash TEXT NOT NULL,
    source_ref TEXT NOT NULL, budget_id TEXT NOT NULL,
    mandate_ref TEXT NOT NULL, seq INTEGER NOT NULL,
    source_hash TEXT NOT NULL, document TEXT NOT NULL,
    UNIQUE(source_ref, budget_id, seq));`);
  const byId = database.prepare('SELECT document_hash FROM budget_checkpoint_receipts WHERE record_id=?');
  const bySeq = database.prepare('SELECT document_hash FROM budget_checkpoint_receipts WHERE source_ref=? AND budget_id=? AND seq=?');
  const latest = database.prepare('SELECT MAX(seq) AS seq FROM budget_checkpoint_receipts WHERE source_ref=? AND budget_id=?');
  const insert = database.prepare('INSERT INTO budget_checkpoint_receipts VALUES (?,?,?,?,?,?,?,?)');
  function receive(doc) {
    const deny = error => ({accepted:false,error});
    if (!validateFractalogActRecord(doc).ok) return deny('invalid_checkpoint_integrity');
    if (doc.act_kind !== 'accounting.budget.checkpoint' || doc.effect?.kind !== 'provisional_budget_projection') return deny('invalid_checkpoint_kind');
    const {source_ref,source_hash,topic_seq:seq,budget_id} = doc.trace || {};
    const mandate_ref = doc.governed_chain?.mandate_ref;
    if (![source_ref,source_hash,budget_id,mandate_ref].every(x=>typeof x==='string'&&x.length) || !Number.isSafeInteger(seq)||seq<1) return deny('invalid_checkpoint_identity');
    const hash=doc.integrity.document_hash;
    database.exec('BEGIN IMMEDIATE');
    try {
      const existing = byId.get(doc.record_id);
      const clash = bySeq.get(source_ref,budget_id,seq);
      if ((existing && existing.document_hash !== hash)||(clash&&clash.document_hash!==hash)) {
        database.exec('ROLLBACK');return deny('checkpoint_divergence');
      }
      const current=latest.get(source_ref,budget_id).seq;
      // Unattested event-version intervals are visible, not necessarily lost messages. Replaying old checkpoints
      // is legal; higher-level settlement remains a separate governed act.
      const unverified_range=current!==null && seq>current+1 ? {from:current+1,to:seq-1}:null;
      if (!existing&&!clash) insert.run(doc.record_id,hash,source_ref,budget_id,mandate_ref,seq,source_hash,JSON.stringify(doc));
      database.exec('COMMIT');
      return {accepted:true,record_id:doc.record_id,document_hash:hash,duplicate:Boolean(existing||clash),unverified_range,projection_only:true};
    } catch(e) {database.exec('ROLLBACK');throw e;}
  }
  return {receive, latest:(source_ref,budget_id)=>latest.get(source_ref,budget_id).seq};
}
