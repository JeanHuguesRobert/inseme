import {describe,it,expect} from 'vitest';
import {archivePacket,restorePacket,createMemoryPacketStore,createArchivePacketStore,
 primaryPacketPlacement,type PacketStore} from '../src/packet-store.js';
import type {CognitivePacket,PacketPlacement} from '../src/packet.js';

const P='packet:archive-test';
const fixture={packet_id:P,status:'solved',created_at:'2026-11-16T00:00:00Z',
  hops:[{hop_index:0,node_id:'fracta2',timestamp:'2026-11-16T00:00:01Z'}],
  payload:{input:'source'},lineage:{upstream_packet_id:'packet:parent'},
  yield:{semantic_yield:{answer:42}},
  placements:[]} as unknown as CognitivePacket;
const copy=<T>(x:T):T=>JSON.parse(JSON.stringify(x));
function memoryStore(id:string,options:{corrupt?:boolean;failSave?:boolean;
  failDelete?:boolean;missingRead?:boolean}={}):PacketStore{
 const rows=new Map<string,CognitivePacket>();
 return {store_id:id,store_kind:'memory',
  async savePacket(packet){
    if(options.failSave)throw Error('storage-unavailable');
    const value=copy(packet);
    if(options.corrupt)value.yield={semantic_yield:{answer:'corrupted'}};
    rows.set(packet.packet_id,value);
    return {store_id:id,store_kind:'memory',locator:id+'#'+packet.packet_id,
      synchronized_at:'2026-11-16T00:00:00Z',is_primary:id==='hot'} as PacketPlacement;
  },
  async getPacket(packet_id){return options.missingRead?null:copy(rows.get(packet_id)||null);},
  async listPackets(){return [...rows.values()].map(x=>copy(x));},
  async hasPacket(packet_id){return rows.has(packet_id);},
  async deletePacket(packet_id){return options.failDelete?false:rows.delete(packet_id)},
 };
}

describe('archivePacket: verify before removal, retain history',()=>{
 it('preserves canonical primary placement when using the actual COP storage adapters',async()=>{
  const hot=createMemoryPacketStore('primary:hot');
  const cold=createArchivePacketStore('secondary:cold');
  const reactivated=createMemoryPacketStore('primary:restored');
  await hot.savePacket(fixture);
  const original=await hot.getPacket(P);
  expect(primaryPacketPlacement(original! )?.store_id).toBe('primary:hot');
  await archivePacket(P,hot,cold);
  expect(await hot.hasPacket(P)).toBe(false);
  const inCold=await cold.getPacket(P);
  expect(primaryPacketPlacement(inCold!)).toBeNull();
  const result=await restorePacket(P,cold,reactivated);
  expect(primaryPacketPlacement(result.restoredPacket)?.store_id).toBe('primary:restored');
  expect(await cold.hasPacket(P)).toBe(true);
  expect(result.restoredPacket.yield).toEqual(fixture.yield);
 });

 it('moves from hot to cold, verifies yield, and can restore without destroying cold archive',async()=>{
  const hot=memoryStore('hot'),cold=memoryStore('cold'),restored=memoryStore('new-active');
  await hot.savePacket(fixture);
  const result=await archivePacket(P,hot,cold);
  expect(result.archivedPacket.yield).toEqual(fixture.yield);
  expect(await hot.hasPacket(P)).toBe(false);
  expect(await cold.hasPacket(P)).toBe(true);
  const fromCold=await restorePacket(P,cold,restored);
  expect(fromCold.restoredPacket.lineage).toEqual(fixture.lineage);
  expect(await cold.hasPacket(P)).toBe(true);
  expect(await restored.hasPacket(P)).toBe(true);
 });
 it('refuses to delete hot source when archive target is unavailable',async()=>{
  const hot=memoryStore('hot'),cold=memoryStore('cold',{failSave:true});
  await hot.savePacket(fixture);
  await expect(archivePacket(P,hot,cold)).rejects.toThrow('storage-unavailable');
  expect(await hot.hasPacket(P)).toBe(true);
 });
 it('refuses to delete hot source when archive retrieval is missing',async()=>{
  const hot=memoryStore('hot'),cold=memoryStore('cold',{missingRead:true});
  await hot.savePacket(fixture);
  await expect(archivePacket(P,hot,cold)).rejects.toThrow('archive_copy_not_verified');
  expect(await hot.hasPacket(P)).toBe(true);
 });
 it('refuses to delete hot source if archival copy changed lineage or yield',async()=>{
  const hot=memoryStore('hot'),cold=memoryStore('cold',{corrupt:true});
  await hot.savePacket(fixture);
  await expect(archivePacket(P,hot,cold)).rejects.toThrow('archive_copy_not_verified');
  expect(await hot.hasPacket(P)).toBe(true);
 });
 it('never migrates to the same storage identifier or misreports failed cleanup',async()=>{
  const hot=memoryStore('hot'),same=memoryStore('hot'),cold=memoryStore('cold');
  await hot.savePacket(fixture);
  await expect(archivePacket(P,hot,same)).rejects.toThrow('archive_target_must_differ');
  const sticky=memoryStore('hot-sticky',{failDelete:true});
  await sticky.savePacket(fixture);
  await expect(archivePacket(P,sticky,cold)).rejects.toThrow('archive_source_cleanup_not_confirmed');
  expect(await sticky.hasPacket(P)).toBe(true);
  expect(await cold.hasPacket(P)).toBe(true);
 });
});
