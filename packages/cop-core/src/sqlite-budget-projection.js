/** Disposable SQLite projection. Source COP events remain authoritative. */
export function createSqliteBudgetProjection(db, getHead) {
  db.exec(`CREATE TABLE IF NOT EXISTS cop_budget_balances (
    topic TEXT PRIMARY KEY, seq INTEGER NOT NULL, snapshot TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS cop_budget_reservations (
    topic TEXT NOT NULL, reservation_id TEXT NOT NULL, reservation TEXT NOT NULL,
    PRIMARY KEY(topic,reservation_id));`);
  const read=db.prepare('SELECT seq,snapshot FROM cop_budget_balances WHERE topic=?');
  const write=db.prepare('INSERT INTO cop_budget_balances VALUES(?,?,?) ON CONFLICT(topic) DO UPDATE SET seq=excluded.seq,snapshot=excluded.snapshot');
  const getReservation=db.prepare('SELECT reservation FROM cop_budget_reservations WHERE topic=? AND reservation_id=?');
  const putReservation=db.prepare('INSERT INTO cop_budget_reservations VALUES(?,?,?) ON CONFLICT(topic,reservation_id) DO UPDATE SET reservation=excluded.reservation');
  const clearBalance=db.prepare('DELETE FROM cop_budget_balances WHERE topic=?');
  const clearReservations=db.prepare('DELETE FROM cop_budget_reservations WHERE topic=?');
  const adjust=(a,b,sign=1)=>Object.fromEntries(Object.keys(a).map(k=>[k,a[k]+sign*b[k]]));
  function get(topic) {
    const row=read.get(topic);
    if (!row) return null;
    return {snapshot:JSON.parse(row.snapshot),reservations:{
      get(id) {const r=getReservation.get(topic,id);return r?JSON.parse(r.reservation):undefined;}
    }};
  }
  function seed(topic,state) {
    if (!state.snapshot.has_grant) return false;
    db.exec('BEGIN IMMEDIATE');
    try {
      if (getHead(topic)?.seq!==state.snapshot.version || read.get(topic)) {
        db.exec('ROLLBACK');return false;
      }
      write.run(topic,state.snapshot.version,JSON.stringify(state.snapshot));
      for (const r of state.reservations.values()) putReservation.run(topic,r.reservation_id,JSON.stringify(r));
      db.exec('COMMIT');return true;
    } catch(e) {db.exec('ROLLBACK');throw e;}
  }
  function apply(event) {
    const topic=event.topic.id;
    if (!topic.startsWith('execution-budget:')) return;
    const row=read.get(topic);
    if (!row) return;
    const kind=event.event_type,p=event.payload;
    if (kind==='ExecutionBudgetGrant') {clearBalance.run(topic);clearReservations.run(topic);return;}
    if (row.seq!==event.topic.seq-1) throw Error('budget_projection_seq_conflict');
    const state=JSON.parse(row.snapshot);
    if (kind==='ExecutionBudgetReservation') {
      const r=p.reservation;
      if(getReservation.get(topic,r.reservation_id)) throw Error('budget_projection_duplicate_reservation');
      state.reserved=adjust(state.reserved,r.demand);
      putReservation.run(topic,r.reservation_id,JSON.stringify(r));
    } else if(kind==='ExecutionBudgetSettlement'||kind==='ExecutionBudgetRelease') {
      const found=getReservation.get(topic,p.reservation_id);
      if(!found) throw Error('budget_projection_unknown_reservation');
      const r=JSON.parse(found.reservation);
      if(r.status!=='reserved') throw Error('budget_projection_reservation_not_active');
      state.reserved=adjust(state.reserved,r.demand,-1);
      if(kind==='ExecutionBudgetSettlement') {
        r.status='settled';r.settled=p.usage;
        state.settled=adjust(state.settled,p.usage);
      } else r.status='released';
      putReservation.run(topic,r.reservation_id,JSON.stringify(r));
    } else if(kind!=='ExecutionBudgetSeal') {
      clearBalance.run(topic);clearReservations.run(topic);return;
    }
    state.version=event.topic.seq;
    state.available=Object.fromEntries(Object.keys(state.limits).map(k=>[k,state.limits[k]-state.reserved[k]-state.settled[k]]));
    write.run(topic,state.version,JSON.stringify(state));
  }
  return {get,seed,apply};
}
