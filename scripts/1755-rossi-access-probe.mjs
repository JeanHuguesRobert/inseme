import fs from 'node:fs/promises';
const endpoints=[
['ia-title','https://archive.org/advancedsearch.php?q=title%3A%28%22Osservazioni%20storiche%20sopra%20la%20Corsica%22%29&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=creator&rows=30&page=1&output=json'],
['ia-rossi','https://archive.org/advancedsearch.php?q=%22Ambrogio%20Rossi%22%20AND%20Corsica&fl%5B%5D=identifier&fl%5B%5D=title&rows=30&page=1&output=json'],
['bnf-candidate-catalogue','https://catalogue.bnf.fr/ark:/12148/cb31248785r'],
['gallica-ark','https://gallica.bnf.fr/ark:/12148/bpt6k4801726'],
['iiif-info','https://gallica.bnf.fr/iiif/ark:/12148/bpt6k4801726/manifest.json']
];const out=[];for(const [name,url] of endpoints){const item={name,url};try{const c=new AbortController();const t=setTimeout(()=>c.abort(),12000);let r;try{r=await fetch(url,{redirect:'manual',signal:c.signal})}finally{clearTimeout(t)}item.status=r.status;item.redirect=r.headers.get('location');if(r.status===200){const body=(await r.text()).slice(0,55000);if(name.startsWith('ia-')){const j=JSON.parse(body);item.numFound=j.response?.numFound;item.docs=j.response?.docs?.slice(0,30)}else{item.title=(body.match(/<title>(.*?)<\/title>/si)||[])[1];item.length=body.length;}}}catch(e){item.error=String(e)}out.push(item)}await fs.writeFile('scripts/1755-rossi-access-probe.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out).slice(0,12000));