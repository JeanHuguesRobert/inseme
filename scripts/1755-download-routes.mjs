import fs from 'node:fs/promises';
const id='ConstitutionPaoliCorse';
const m=await (await fetch('https://archive.org/metadata/'+id)).json();
const server=m.d1||m.server;const dir=m.dir||'/'+id;const filename=id+'_djvu.txt';
const routes=[
'https://archive.org/download/'+id+'/'+filename,
'https://archive.org/stream/'+id+'/'+filename,
'https://'+server+dir+'/'+filename,
'https://archive.org/download/'+id+'/'+filename+'?download=1',
'https://archive.org/download/'+id+'/'+id+'_page_numbers.json'
];
const results=[];
for(const url of routes){const e={url};try{const c=new AbortController();const timeout=setTimeout(()=>c.abort(),9000);let r;try{r=await fetch(url,{signal:c.signal,redirect:'manual'})}finally{clearTimeout(timeout)}e.status=r.status;e.location=r.headers.get('location');e.type=r.headers.get('content-type');if(r.status===200){const b=await r.arrayBuffer();e.bytes=b.byteLength;if(b.byteLength<600000){const s=new TextDecoder().decode(b);e.begin=s.slice(0,100);e.mentions_preamble=/La Dieta generale/i.test(s);const i=s.toLowerCase().indexOf('la dieta generale');if(i>=0)e.excerpt=s.slice(i,i+900);}}}catch(err){e.error=String(err)}results.push(e)}
await fs.writeFile('scripts/1755-download-routes-report.json',JSON.stringify({metadata:{server:m.server,d1:m.d1,dir:m.dir},results},null,2));console.log(JSON.stringify({metadata:{server:m.server,d1:m.d1,dir:m.dir},results}).slice(0,16000));