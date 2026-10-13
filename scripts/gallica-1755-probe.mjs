// Bounded historical-document retrieval probe. Public Gallica URLs only; no credentials.
// Output is a technical access report, not a verified diplomatic transcription.
import fs from "node:fs/promises";
import crypto from "node:crypto";
const maxBytes=1_500_000;
const targets=[
  {id:"fontana-ocr",url:"https://gallica.bnf.fr/ark:/12148/bpt6k65627055.texteBrut"},
  {id:"fontana-iiif",url:"https://gallica.bnf.fr/iiif/ark:/12148/bpt6k65627055/manifest.json"},
  {id:"fontana-item",url:"https://gallica.bnf.fr/ark:/12148/bpt6k65627055.item"},
  {id:"fontana-bnf-api",url:"https://gallica.bnf.fr/services/OAIRecord?ark=bpt6k65627055"},
  {id:"rossi-catalog",url:"https://catalogue.bnf.fr/ark:/12148/cb31248785r"},
  {id:"fontana-catalog",url:"https://catalogue.bnf.fr/ark:/12148/cb30447547m"}
];
const result={schema:"museum-janus.gallica-access/v1",timestamp:new Date().toISOString(),targets:[]};
for(const t of targets){
 const record={id:t.id,url:t.url};
 try {
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
  let r;
  try {r=await fetch(t.url,{signal:controller.signal,headers:{"User-Agent":"MuseeJanusResearchProbe/0.1 (archival research; contact via github.com/JeanHuguesRobert/barons-Mariani)","Accept":"text/plain, application/json, text/xml, text/html;q=0.7"}});}
  finally{clearTimeout(timeout);}
  record.status=r.status;record.final_url=r.url;record.type=r.headers.get("content-type");
  const reader=r.body?.getReader();let parts=[],size=0,truncated=false;
  if(reader){while(true){const {done,value}=await reader.read();if(done)break;const room=maxBytes-size;if(value.length>room){if(room>0)parts.push(value.subarray(0,room));size+=room;truncated=true;await reader.cancel();break;}parts.push(value);size+=value.length;}}
  const bytes=Buffer.concat(parts);record.bytes=bytes.length;record.truncated=truncated;record.sha256=crypto.createHash("sha256").update(bytes).digest("hex");
  const body=bytes.toString("utf8");record.preview=body.slice(0,700);
  if(r.ok && !truncated && (/text\/plain|application\/json|text\/xml/.test(record.type||""))){
   const suffix=t.id==="fontana-ocr"?"txt":t.id==="fontana-iiif"?"json":"xml";
   await fs.writeFile(`scripts/gallica-1755-${t.id}.${suffix}`,body);
   record.saved=`scripts/gallica-1755-${t.id}.${suffix}`;
  }
 }catch(e){record.error=String(e);}
 result.targets.push(record);
}
await fs.writeFile("scripts/gallica-1755-report.json",JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify(result));
