import fs from "node:fs";
import {spawnSync} from "node:child_process";
const f=process.argv[2];if(!f)throw Error("missing_outbox_file");
const x=JSON.parse(fs.readFileSync(f,"utf8"));
const validId=/^[A-Za-z0-9._:-]{1,128}$/.test(x.computation_id||"");
const terminalMarker=`<!-- cop-compute-result:${x.computation_id} -->`;
const blockedPrefix=`<!-- cop-compute-hop:${x.computation_id}:blocked:`;
const isBlocked=typeof x.marker==="string" && x.marker.startsWith(blockedPrefix) &&
  /^[A-Za-z0-9._:-]{1,128}$/.test(x.marker.slice(blockedPrefix.length,-4)) && x.marker.endsWith(" -->");
if(x.schema!=="cop.compute-outbox/v1"||x.repository!==process.env.GITHUB_REPOSITORY||
  !Number.isInteger(x.issue)||x.issue<1||!validId||
  !(x.marker===terminalMarker||isBlocked)||!x.body?.startsWith(x.marker))
  throw Error("invalid_outbox");
function gh(args){return spawnSync("gh",["api",...args],{encoding:"utf8",timeout:30000,maxBuffer:3e6});}
const found=gh([`repos/${x.repository}/issues/${x.issue}/comments?per_page=100`,"--paginate","--slurp"]);
if(found.status!==0){console.log("callback deferred: cannot query issue");process.exit(0);}
let comments;
try {
  const pages=JSON.parse(found.stdout);
  if (!Array.isArray(pages)||!pages.every(p=>Array.isArray(p)&&p.every(c=>typeof c?.body==="string"))) throw Error("invalid_comment_pages");
  comments=pages.flat();
} catch {
  console.log("callback deferred: invalid Issue history response");
  process.exit(0);
}
if(comments.some(c=>c.body.includes(x.marker))){console.log("callback already delivered");process.exit(0);}
const posted=gh([`repos/${x.repository}/issues/${x.issue}/comments`,"-f",`body=${x.body}`]);
console.log(posted.status===0?"callback delivered":"callback deferred: provider unavailable");
