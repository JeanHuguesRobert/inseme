import fs from 'node:fs/promises';
const id='ConstitutionPaoliCorse',m=await(await fetch('https://archive.org/metadata/'+id)).json(),base='https://'+(m.d1||m.server)+m.dir+'/'+id;
const j=await(await fetch(base+'_page_numbers.json')).json();const z=await(await fetch(base+'_scandata.xml')).text();
const leaves=j.pages.filter(p=>p.leafNum>=155&&p.leafNum<=185).map(p=>({leaf:p.leafNum,num:p.pageNumber,confidence:p.confidence}));
const xml=[...z.matchAll(/<page leafNum="(1[5-8]\d)">([\s\S]*?)<\/page>/g)].map(x=>({leaf:+x[1],number:(x[2].match(/<pageNumber>([^<]*)/)||[])[1]||null,type:(x[2].match(/<pageType>([^<]*)/)||[])[1]||null}));const out={leaves,xml};await fs.writeFile('scripts/1755-page-map-inspect.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out));