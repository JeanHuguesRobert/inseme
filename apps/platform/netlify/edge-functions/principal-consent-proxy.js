/**
 * JHN Supabase-authenticated consent bridge. Strictly forwards a same-origin
 * GET/POST to the separate Fracta2 issuer; never owns the COP journal, creates
 * a proposal, signs an approval, or puts service_role secrets into Edge.
 * The Fracta2 issuer reauthenticates the token against Supabase Auth and checks
 * the immutable challenge in the existing COP store. No proxy fallback.
 */
const FRONT='https://jhn.baronsmariani.org';
const UPSTREAM='https://browser.fractavolta.com';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json=(status,error)=>new Response(JSON.stringify({ok:false,error,grants_mandate_authority:false}),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
export default async function principalConsentProxy(request){
 const url=new URL(request.url);
 const match=/^\/api\/cop\/principal-consent\/([a-f0-9-]{36})$/.exec(url.pathname);
 if(url.origin!==FRONT||!match||!UUID.test(match[1])||url.search)return json(404,'consent_route_not_found');
 if(!['GET','POST'].includes(request.method))return json(405,'method_not_allowed');
 const bearer=request.headers.get('authorization');
 if(!bearer||!/^Bearer\s+[^\s]{10,8192}$/i.test(bearer))return json(401,'supabase_session_required');
 if(request.method==='POST'&&request.headers.get('origin')!==FRONT)return json(403,'foreign_origin_denied');
 let body;
 if(request.method==='POST'){
   body=await request.text();
   if(body.length>2048)return json(413,'consent_body_too_large');
 }
 try {
   const upstream=await fetch(UPSTREAM+url.pathname,{
     method:request.method,headers:{
       'authorization':bearer,'accept':'application/json',
       ...(request.method==='POST'?{'origin':FRONT,'content-type':'application/json'}:{})
     },...(request.method==='POST'?{body}:{}),redirect:'manual',signal:AbortSignal.timeout(8000)
   });
   const type=upstream.headers.get('content-type')||'';
   // In particular, never return Caddy Basic Auth HTML (401) or SPA HTML
   // fallback as a consent receipt. No cached/stale unsigned response.
   if(!type.toLowerCase().includes('application/json')||upstream.status>=500||upstream.status===401)
     return json(503,'canonical_consent_issuer_unavailable');
   const text=await upstream.text();
   if(text.length>16384)return json(502,'issuer_response_too_large');
   const decoded=JSON.parse(text);
   if(typeof decoded!=='object'||decoded===null||Array.isArray(decoded))return json(502,'issuer_response_invalid');
   return new Response(JSON.stringify(decoded),{status:upstream.status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
 }catch{return json(503,'canonical_consent_issuer_unavailable');}
}
export const config={path:'/api/cop/principal-consent/*'};
