import fs from "node:fs/promises";
const urls=[
["fontana-bnf","https://catalogue.bnf.fr/ark:/12148/cb30447547m"],
["rossi-bnf","https://catalogue.bnf.fr/ark:/12148/cb31248785r"],
["archive-search","https://archive.org/advancedsearch.php?q=title%3A%28constitution+generalat+pascal+paoli%29&fl%5B%5D=identifier&fl%5B%5D=title&rows=10&page=1&output=json"],
["google-books","https://www.googleapis.com/books/v1/volumes?q=intitle%3Aconstitution+generalat+pascal+paoli"],
["google-fontana","https://books.google.com/books?q=%22La+constitution+du+g%C3%A9n%C3%A9ralat%22"]
];
const out=[];
for(const [id,url] of urls){const e={id,url};try{const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),12000);let r;try{r=await fetch(url,{signal:ctrl.signal,headers:{Accept:"text/html,application/json"}})}finally{clearTimeout(t)}e.status=r.status;e.type=r.headers.get("content-type");const html=(await r.text()).slice(0,500000);e.bytes_read=html.length;if(id.endsWith("-bnf")){e.arks=[...new Set([...html.matchAll(/(?:https?:\\/\\/)?(?:gallica\\.bnf\\.fr\\/ark:\\/12148\\/)?bpt6k[a-z0-9]+/gi)].map(m=>m[0]))].slice(0,35);e.links=[...new Set([...html.matchAll(/href=["']([^"']+?)(?:["'])/gi)].map(m=>m[1]).filter(s=>/gallica|bpt6k|consult/i.test(s)))].slice(0,20);}else e.preview=html.slice(0,2200);}catch(err){e.error=String(err)}out.push(e)}
await fs.writeFile("scripts/gallica-1755-alternative-report.json",JSON.stringify({schema:"museum-janus.source-discovery/v1",generated_at:new Date().toISOString(),results:out},null,2));
console.log(JSON.stringify(out).slice(0,9500));