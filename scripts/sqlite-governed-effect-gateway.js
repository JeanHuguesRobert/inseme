// Experimental durable, single-host, SQLite-backed authority and synthetic effect.
// SQLite BEGIN IMMEDIATE serializes writers across independent processes.
// Not a GitHub provider effect fence; direct providers can bypass this gateway.
import { DatabaseSync } from "node:sqlite";

export class SqliteGovernedEffectGateway {
  constructor(filename) {
    this.db = new DatabaseSync(filename, { timeout: 5000 });
    this.db.exec(`PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS packet_state (
        packet_ref TEXT PRIMARY KEY, holder TEXT NOT NULL, epoch INTEGER NOT NULL,
        mandate_revision INTEGER, expires_at INTEGER NOT NULL,
        version INTEGER NOT NULL, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS effect_receipt (
        packet_ref TEXT NOT NULL, idempotency_key TEXT NOT NULL, fingerprint TEXT NOT NULL,
        code TEXT NOT NULL, version INTEGER NOT NULL,
        PRIMARY KEY(packet_ref,idempotency_key));`);
  }
  close(){ this.db.close(); }
  #tx(fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try { const result=fn(); this.db.exec("COMMIT"); return result; }
    catch(err) { this.db.exec("ROLLBACK"); throw err; }
  }
  inspect(packetRef) {
    return this.db.prepare("SELECT * FROM packet_state WHERE packet_ref=?").get(packetRef) || null;
  }
  seed(packetRef,{holder,epoch,mandateRevision,expiresAt,value}) {
    return this.#tx(() => this.db.prepare(`INSERT INTO packet_state
      (packet_ref,holder,epoch,mandate_revision,expires_at,version,value)
      VALUES (?,?,?,?,?,1,?)`).run(packetRef,holder,epoch,mandateRevision,expiresAt,JSON.stringify(value)));
  }
  transfer(packetRef,{holder,epoch,mandateRevision,expiresAt}) {
    return this.#tx(()=>{
      const s=this.inspect(packetRef);
      if(!s) throw Error("unknown_packet");
      if(!Number.isInteger(epoch)||epoch<=s.epoch) throw Error("epoch_not_monotonic");
      this.db.prepare(`UPDATE packet_state SET holder=?, epoch=?, mandate_revision=?,
        expires_at=?, version=version+1 WHERE packet_ref=?`).run(holder,epoch,mandateRevision,expiresAt,packetRef);
      return this.inspect(packetRef);
    });
  }
  revoke(packetRef) {
    return this.#tx(()=>{
      const result=this.db.prepare("UPDATE packet_state SET mandate_revision=NULL,version=version+1 WHERE packet_ref=?").run(packetRef);
      if(!result.changes)throw Error("unknown_packet");
      return this.inspect(packetRef);
    });
  }
  commit({packetRef,holder,epoch,mandateRevision,expectedVersion,idempotencyKey,value,now=Date.now()}) {
    return this.#tx(()=>{
      const s=this.inspect(packetRef);
      if(!s)return {ok:false,code:"UNKNOWN_PACKET"};
      if(typeof idempotencyKey!=="string"||!idempotencyKey.trim())return {ok:false,code:"INVALID_IDEMPOTENCY_KEY"};
      const fingerprint=JSON.stringify([holder,epoch,mandateRevision,expectedVersion,value]);
      const prior=this.db.prepare("SELECT * FROM effect_receipt WHERE packet_ref=? AND idempotency_key=?").get(packetRef,idempotencyKey);
      if(prior)return prior.fingerprint===fingerprint
        ? {ok:true,code:"ALREADY_APPLIED",version:prior.version}
        : {ok:false,code:"IDEMPOTENCY_CONFLICT"};
      if(s.holder!==holder||s.epoch!==epoch||s.mandate_revision===null||
        s.mandate_revision!==mandateRevision||now>=s.expires_at)
        return {ok:false,code:"AUTHORITY_REJECTED"};
      if(s.version!==expectedVersion)return {ok:false,code:"STALE_VERSION"};
      const version=s.version+1;
      this.db.prepare("UPDATE packet_state SET value=?,version=? WHERE packet_ref=?").run(JSON.stringify(value),version,packetRef);
      this.db.prepare(`INSERT INTO effect_receipt
        (packet_ref,idempotency_key,fingerprint,code,version) VALUES (?,?,?,?,?)`)
        .run(packetRef,idempotencyKey,fingerprint,"COMMITTED",version);
      return {ok:true,code:"COMMITTED",version};
    });
  }
}
