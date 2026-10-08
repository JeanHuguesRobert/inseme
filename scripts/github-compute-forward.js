import fs from "node:fs";
import {spawnSync} from "node:child_process";
const f=process.argv[2];if(!f)throw Error("missing_outbox_file");
const x=JSON.parse(fs.readFileSync(f,"utf8"));
if(x.schema!=="cop.compute-outbox/v1"||x.repository!==process.env.GITHUB_REPOSITORY||!Number.isInteger(x.issue)||x.issue<1||!/^<!-- cop-compute-result:[A-Za-z0-9._:-]{1,128} -->$/.test(x.marker))throw Error("invalid_outbox");
function gh(args){return spawnSync("gh",["api",...args],{encoding:"utf8",timeout:30000,maxBuffer:3e6});}
const found=gh([`repos/${x.repository}/issues/${x.issue}/comments`,"--paginate","--jq",".[].body"]);
if(found.status!==0){console.log("callback deferred: cannot query issue");process.exit(0);}
if(found.stdout.includes(x.marker)){console.log("callback already delivered");process.exit(0);}
const posted=gh([`repos/${x.repository}/issues/${x.issue}/comments`,"-f",`body=${x.body}`]);
console.log(posted.status===0?"callback delivered":"callback deferred: provider unavailable");
