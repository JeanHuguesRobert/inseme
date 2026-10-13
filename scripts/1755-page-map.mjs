import fs from 'node:fs/promises';
const id='ConstitutionPaoliCorse',base='https://archive.org/metadata/'+id;
const m=await (await fetch(base)).json(), host='https://'+(m.d1||m.server)+(m.dir||'/'+id);
const files=['_page_numbers.json','_scandata.xml'];
const results=[];
for(const suffix of files){const u=host+'/'+id+suffix;try{const r=await fetch(u);const body=await r.text();const matches=[...body.matchAll(/(?:\"(?:pageNumber|page_number|pageType)\"\s*:\s*\"?(?:161|162|163|164)\"?|leafNum=\"\d+\"[^>]{0,180}pageNumber=\"16[1-4]\")/g)].slice(0,20).map(x=>({position:x.index,text:body.slice(x.index-180,x.index+200)}));results.push({suffix,status:r.status,length:body.length,start:body.slice(0,1400),matches});}catch(e){results.push({suffix,error:String(e)})}}
const out={host,files:results};await fs.writeFile('scripts/1755-page-map-report.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out).slice(0,14000));