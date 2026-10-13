import fs from 'node:fs/promises';
const urls=[
 ['fontana_meta','https://archive.org/metadata/ConstitutionPaoliCorse'],
 ['fontana_ocr','https://archive.org/download/ConstitutionPaoliCorse/ConstitutionPaoliCorse_djvu.txt'],
 ['rossi_meta','https://archive.org/metadata/IA41555227_0091'],
 ['rossi_search','https://archive.org/advancedsearch.php?q=%22Osservazioni+storiche+sopra+la+Corsica%22+AND+%22Livre+X%22&fl%5B%5D=identifier&fl%5B%5D=title&rows=20&output=json']
];
const out=[];for(const [id,url] of urls){const entry={id,url};try{const c=new AbortController();const t=setTimeout(()=>c.abort(),18000);let r;try{r=await fetch(url,{signal:c.signal})}finally{clearTimeout(t)}entry.status=r.status;const data=(await r.text()).slice(0,750000);entry.bytes=data.length;if(id==='fontana_ocr'&&r.ok){const i=data.toLowerCase().indexOf('appendice');entry.excerpt=data.slice(i>=0?i:0,(i>=0?i:0)+6000);entry.matches=(data.match(/La Dieta.{0,220}/gi)||[]).slice(0,5)}else entry.preview=data.slice(0,3000)}catch(err){entry.error=String(err)}out.push(entry)}
await fs.writeFile('scripts/1755-retrieval-report.json',JSON.stringify({schema:'museum-janus.retrieval/v1',results:out},null,2));console.log(JSON.stringify(out.map(({id,status,bytes,error,matches})=>({id,status,bytes,error,matches}))).slice(0,7500));