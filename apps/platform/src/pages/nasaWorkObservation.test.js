import test from 'node:test';
import assert from 'node:assert/strict';
import {readNasaWorkObservation} from './nasaWorkObservation.js';
const packet='packet:pkt-mcp-00000000-0000-5000-8000-000000000001';
const view={schema:'cogentia.nasa.work/v1',items:[{packet_ref:packet}]};
test('same origin list and exact detail with bearer, GET and no cache',async()=>{
 const calls=[];const fetchImpl=async(...a)=>{calls.push(a);return Response.json(view)};
 await readNasaWorkObservation({token:'token',fetchImpl});
 await readNasaWorkObservation({token:'token',packetRef:packet,fetchImpl});
 assert.equal(calls[0][0],'/api/cop/principal-consent/work-observation');
 assert.equal(calls[1][0],'/api/cop/principal-consent/work-observation-'+packet.slice(15));
 assert.equal(calls[0][1].headers.Authorization,'Bearer token');assert.equal(calls[0][1].method,'GET');
});
test('no arbitrary URL, no anonymous read, no mismatched result',async()=>{
 const fetchImpl=async()=>{throw Error('unexpected fetch')};
 await assert.rejects(readNasaWorkObservation({token:'x',packetRef:'https://elsewhere',fetchImpl}),/invalid_packet/);
 await assert.rejects(readNasaWorkObservation({fetchImpl}),/principal_session/);
 await assert.rejects(readNasaWorkObservation({token:'x',packetRef:packet,fetchImpl:async()=>Response.json({...view,items:[{packet_ref:'different'}]})}),/reference_mismatch/);
 await assert.rejects(readNasaWorkObservation({token:'x',fetchImpl:async()=>new Response('',{status:403})}),/403/);
});
