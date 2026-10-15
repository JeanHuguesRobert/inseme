import fs from "node:fs";
import {spawnSync} from "node:child_process";
import {reconcileGithubCompute} from "./github-compute-reconcile-github.js";

function gh(route,{paginate=false}={}) {
  const args=["api",...(paginate?["--paginate","--slurp"]:[]),route];
  const r=spawnSync("gh",args,{encoding:"utf8",timeout:15000,maxBuffer:8000000});
  if(r.error || r.status!==0) throw Error("github_read_failed");
  return JSON.parse(r.stdout);
}
/** Read-only API: authentication and permissions are owned by gh/GitHub. */
export function githubReadApi() {
  return {
    async getTag(repository,name) {
      const ref=gh(`repos/${repository}/git/ref/tags/${name}`);
      if(ref?.object?.type!=="tag" || !/^[0-9a-f]{40}$/.test(ref.object.sha??""))
        throw Error("unexpected_tag_reference");
      return gh(`repos/${repository}/git/tags/${ref.object.sha}`);
    },
    async getRun(repository,id) {
      if(!/^[0-9]+$/.test(String(id))) throw Error("invalid_run_id");
      return gh(`repos/${repository}/actions/runs/${id}`);
    },
    async getComments(repository,issue) {
      const pages=gh(`repos/${repository}/issues/${issue}/comments?per_page=100`,{paginate:true});
      if(!Array.isArray(pages) || pages.some(page=>!Array.isArray(page)))
        throw Error("invalid_comment_pages");
      const all=pages.flat();
      if(all.length>2000) throw Error("reconciliation_comment_budget_exceeded");
      return all;
    }
  };
}

if(process.argv[1]?.endsWith("/github-compute-reconcile-cli.js")) {
  const [requestFile,issueString]=process.argv.slice(2);
  if(!requestFile || !/^[0-9]+$/.test(issueString??""))
    throw Error("usage: node scripts/github-compute-reconcile-cli.js REQUEST.json ISSUE");
  const request=JSON.parse(fs.readFileSync(requestFile,"utf8"));
  const result=await reconcileGithubCompute({request,issue:Number(issueString),api:githubReadApi()});
  process.stdout.write(JSON.stringify(result,null,2)+"\n");
}
