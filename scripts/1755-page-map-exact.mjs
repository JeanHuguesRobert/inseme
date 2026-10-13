import fs from 'node:fs/promises';
const id='ConstitutionPaoliCorse',m=await(await fetch('https://archive.org/metadata/'+id)).json(),root='https://'+(m.d1||m.server)+m.dir+'/'+id;
const pages=await(await fetch(root+'_page_numbers.json')).json();const all=pages.pages||[];
const matched=all.filter(p=>['161','162','163','164'].includes(String(p.pageNumber))).map(p=>({leafNum:p.leafNum,pageNumber:p.pageNumber,confidence:p.confidence}));
const out={keys:Object.keys(pages),count:all.length,matched,nearby:all.filter(p=>Number(p.pageNumber)>=157&&Number(p.pageNumber)<=166).map(p=>({leafNum:p.leafNum,pageNumber:p.pageNumber}))};
await fs.writeFile('scripts/1755-page-map-exact.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out));