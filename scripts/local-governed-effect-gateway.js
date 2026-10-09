// Research-only reference: one local authority+target mutation entrypoint.
// No GitHub credential boundary, persistent storage, or distributed transaction.
export class LocalGovernedEffectGateway {
  #packets = new Map();
  #now;
  constructor({now=()=>Date.now()}={}) { this.#now=now; }
  seed(packetRef,{holder,epoch,mandateRevision,expiresAt,value}){
    if(this.#packets.has(packetRef))throw Error("already_exists");
    this.#packets.set(packetRef,{holder,epoch,mandateRevision,expiresAt,value,version:1,receipts:new Map()});
  }
  inspect(packetRef){const s=this.#packets.get(packetRef);if(!s)return null;return Object.freeze({holder:s.holder,epoch:s.epoch,mandateRevision:s.mandateRevision,version:s.version,value:s.value});}
  transfer(packetRef,{holder,epoch,mandateRevision,expiresAt}){
    const s=this.#packets.get(packetRef);if(!s)throw Error("unknown_packet");
    if(!Number.isInteger(epoch)||epoch<=s.epoch)throw Error("epoch_not_monotonic");
    Object.assign(s,{holder,epoch,mandateRevision,expiresAt,version:s.version+1});
    return this.inspect(packetRef);
  }
  revoke(packetRef){const s=this.#packets.get(packetRef);if(!s)throw Error("unknown_packet");s.mandateRevision=null;s.version++;return this.inspect(packetRef);}
  commit({packetRef,holder,epoch,mandateRevision,expectedVersion,idempotencyKey,value}){
    const s=this.#packets.get(packetRef);
    if(!s)return {ok:false,code:"UNKNOWN_PACKET"};
    if(typeof idempotencyKey!=="string"||!idempotencyKey.trim())return {ok:false,code:"INVALID_IDEMPOTENCY_KEY"};
    const prior=s.receipts.get(idempotencyKey);
    if(prior)return prior.fingerprint===JSON.stringify([holder,epoch,mandateRevision,expectedVersion,value])
      ? {ok:true,code:"ALREADY_APPLIED",version:prior.version} : {ok:false,code:"IDEMPOTENCY_CONFLICT"};
    if(s.holder!==holder||s.epoch!==epoch||s.mandateRevision===null||s.mandateRevision!==mandateRevision||this.#now()>=s.expiresAt)
      return {ok:false,code:"AUTHORITY_REJECTED"};
    if(s.version!==expectedVersion)return {ok:false,code:"STALE_VERSION"};
    s.value=value;s.version++;
    s.receipts.set(idempotencyKey,{fingerprint:JSON.stringify([holder,epoch,mandateRevision,expectedVersion,value]),version:s.version});
    return {ok:true,code:"COMMITTED",version:s.version};
  }
}
