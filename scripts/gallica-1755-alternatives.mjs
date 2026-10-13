import fs from 'node:fs/promises';
const targets = [
 ['fontana-bnf','https://catalogue.bnf.fr/ark:/12148/cb30447547m'],
 ['rossi-bnf','https://catalogue.bnf.fr/ark:/12148/cb31248785r'],
 ['archive-search','https://archive.org/advancedsearch.php?q=title%3A%28constitution+generalat+pascal+paoli%29&fl%5B%5D=identifier&rows=10&output=json'],
 ['google-books','https://www.googleapis.com/books/v1/volumes?q=intitle%3Aconstitution+generalat+pascal+paoli'],
 ['google-fontana','https://books.google.com/books?q=%22La+constitution+du+generalat%22']
];
const results=[];
for(const [id,url] of targets){
 const e={id,url};
 try {
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),12000);
  let response;try{response=await fetch(url,{signal:controller.signal})}finally{clearTimeout(timer)}
  e.status=response.status; e.content_type=response.headers.get('content-type');
  const html=(await response.text()).slice(0,500000);e.bytes=html.length;
  if(id.endsWith('-bnf')){
   e.arks=Array.from(new Set(html.match(/bpt6k[a-z0-9]+/gi)||[])).slice(0,35);
   e.snippets=html.split('\n').filter(x=>x.includes('gallica.bnf.fr')||x.includes('bpt6k')).slice(0,12).map(x=>x.slice(0,400));
  }else e.preview=html.slice(0,1200);
 }catch(err){e.error=String(err)}
 results.push(e);
}
await fs.writeFile('scripts/gallica-1755-alternative-report.json',JSON.stringify({schema:'museum-janus.source-discovery/v1',results},null,2));
console.log(JSON.stringify(results).slice(0,10000));