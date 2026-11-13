import test from 'node:test';
import assert from 'node:assert/strict';
import handler from './principal-consent-proxy.js';
const u='https://jhn.baronsmariani.org/api/cop/principal-consent/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
test('denies anonymous and foreign-origin POST before network',async()=>{
 assert.equal((await handler(new Request(u))).status,401);
 assert.equal((await handler(new Request(u,{method:'POST',headers:{authorization:'Bearer some-valid-looking-session',origin:'https://attacker.invalid'},body:'{}'}))).status,403);
});
test('fails closed if Caddy Basic Auth is still present upstream',async()=>{
 const previous=globalThis.fetch;
 globalThis.fetch=async()=>new Response('<html>Unauthorized</html>',{status:401,headers:{'content-type':'text/html'}});
 try{const r=await handler(new Request(u,{headers:{authorization:'Bearer some-valid-looking-session'}}));
 assert.equal(r.status,503);assert.equal((await r.json()).error,'canonical_consent_issuer_unavailable');}
 finally{globalThis.fetch=previous;}
});
test('forwards only bearer and bounded destination, preserves JSON receipt without issuer privileges',async()=>{
 const previous=globalThis.fetch;let observed;
 globalThis.fetch=async(target,options)=>{
  observed={target,options};return new Response(JSON.stringify({ok:true,grants_mandate_authority:false}),{status:200,headers:{'content-type':'application/json'}});
 };
 try{const r=await handler(new Request(u,{headers:{authorization:'Bearer some-valid-looking-session'}}));
 assert.equal(r.status,200);assert.equal((await r.json()).grants_mandate_authority,false);
 assert.equal(observed.target,'https://browser.fractavolta.com/api/cop/principal-consent/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 assert.equal(observed.options.headers.authorization,'Bearer some-valid-looking-session');
 assert.equal('cookie' in observed.options.headers,false);}
 finally{globalThis.fetch=previous;}
});
test('repository request is owner-authenticated POST only and forwarded without scope parameters',async()=>{
 const url='https://jhn.baronsmariani.org/api/cop/principal-consent/repository-request';
 assert.equal((await handler(new Request(url))).status,405);
 assert.equal((await handler(new Request(url,{method:'POST',headers:{origin:'https://jhn.baronsmariani.org'},body:'{}'}))).status,401);
 assert.equal((await handler(new Request(url,{method:'POST',headers:{origin:'https://evil.invalid',authorization:'Bearer some-valid-looking-session'},body:'{}'}))).status,403);
 const original=globalThis.fetch;let seen;
 globalThis.fetch=async(destination,options)=>{
   seen={destination,options};
   return new Response(JSON.stringify({ok:true,challenge_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',grants_mandate_authority:false}),{status:201,headers:{'content-type':'application/json'}});
 };
 try{
   const response=await handler(new Request(url,{method:'POST',headers:{origin:'https://jhn.baronsmariani.org',authorization:'Bearer some-valid-looking-session','content-type':'application/json'},body:'{}'}));
   assert.equal(response.status,201);
   assert.equal(seen.destination,'https://browser.fractavolta.com/api/cop/principal-consent/repository-request');
   assert.equal(seen.options.body,'{}');
   assert.equal(seen.options.headers.origin,'https://jhn.baronsmariani.org');
   assert.equal((await response.json()).grants_mandate_authority,false);
 }finally{globalThis.fetch=original;}
});
