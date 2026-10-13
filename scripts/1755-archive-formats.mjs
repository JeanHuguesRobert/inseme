import fs from 'node:fs/promises';
const ids=['ConstitutionPaoliCorse','IA41555227_0091'];
const out=[];
for(const id of ids){
 const m=await fetch('https://archive.org/metadata/'+id).then(r=>r.json());
 const files=(m.files||[]).filter(x=>/ocr|djvu|hocr|abbyy|pdf|page_numbers|jp2|scandata/i.test(x.name)).map(x=>({name:x.name,size:x.size,format:x.format,source:x.source}));
 out.push({id,title:m.metadata?.title,creator:m.metadata?.creator,files});
}
const id='ConstitutionPaoliCorse';const names=['ConstitutionPaoliCorse_djvu.txt','ConstitutionPaoliCorse_hocr.html'];
for(const name of names){let e={id:name};try{const c=new AbortController(),t=setTimeout(()=>c.abort(),13000);let r;try{r=await fetch('https://archive.org/download/'+id+'/'+name,{signal:c.signal})}finally{clearTimeout(t)}e.status=r.status;e.type=r.headers.get('content-type');const b=await r.text();e.bytes=b.length;e.contains_italian=/la dieta generale/i.test(b);const indices=[...b.matchAll(/La Dieta generale|APPENDICE I|Appendice I/gi)].slice(-8).map(m=>m.index);e.matches=indices.map(i=>b.slice(Math.max(0,i-100),i+650));}catch(err){e.error=String(err)}out.push(e)}
await fs.writeFile('scripts/1755-archive-formats-report.json',JSON.stringify({results:out},null,2));console.log(JSON.stringify(out).slice(0,11000));