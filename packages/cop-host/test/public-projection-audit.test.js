import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { auditPublicProjections, classifyProjection } from "../src/public-projection-audit.js";

const createRoot = (t) => {
  const root = mkdtempSync(join(tmpdir(), "cop-host-projection-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
};
const put = (root, name, text) => {
  const p = join(root, name);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
  return p;
};

test("identical, metadata-only and changed prompt bodies are distinct", () => {
  const original = "---\nstatus: published\n---\nSame body\n";
  assert.equal(classifyProjection(original, original), "exact");
  assert.equal(classifyProjection(original, "---\nstatus: working-paper\n---\nSame body\n"), "metadata_only");
  assert.equal(classifyProjection(original, "---\nstatus: published\n---\nChanged\n"), "content_drift");
});

test("report distinguishes source, public projection and generated registry without writes", t => {
  const root = createRoot(t);
  const src = "packages/brique-ophelia/public/prompts/origin.md";
  const proj = "apps/inseme/public/briques/ophelia/prompts/origin.md";
  const source = "---\nstatus: published\n---\nShared prompt\n";
  const adapted = "---\nstatus: working-paper\n---\nShared prompt\n";
  put(root, src, source);
  const p = put(root, proj, adapted);
  put(root, "apps/inseme/src/generated/brique-registry.js",
    `export const CONSOLIDATED_PROMPTS = ${JSON.stringify({"/briques/ophelia/prompts/origin.md":source})};\nexport const BRIQUES = [];\n`);
  const report = auditPublicProjections({root, appName:"inseme", selectedBriques:[{id:"ophelia",prompts:{"identity-origin":"./public/prompts/origin.md"}}], briqueId:"ophelia"});
  const entry = report.projections[0];
  assert.equal(entry.status,"selected");
  assert.equal(entry.counts.metadata_only,1);
  assert.equal(entry.counts.registry_exact,1);
  assert.equal(entry.counts.content_drift,0);
  assert.equal(readFileSync(p,"utf8"),adapted);
});

test("out-of-profile artifacts stay classified separately, with old registry references", t => {
  const root=createRoot(t);
  put(root,"packages/brique-ophelia/public/prompts/a.md","A");
  put(root,"apps/oleole/public/briques/ophelia/prompts/a.md","A");
  put(root,"apps/oleole/src/generated/brique-registry.js",
    'export const CONSOLIDATED_PROMPTS = {"/briques/ophelia/prompts/a.md":"A"};\nexport const BRIQUES = [];\n');
  const report=auditPublicProjections({root,appName:"oleole",selectedBriques:[{id:"oleole"}],briqueId:"ophelia"});
  assert.equal(report.projections[0].status,"out_of_profile_artifact");
  assert.equal(report.projections[0].out_of_profile_registry_entries,1);
  assert.equal(report.projections[0].counts.exact,1);
});

test("changed generated registry is separately reported", t => {
  const root=createRoot(t);
  put(root,"packages/brique-ophelia/public/prompts/a.md","Current");
  put(root,"apps/inseme/public/briques/ophelia/prompts/a.md","Current");
  put(root,"apps/inseme/src/generated/brique-registry.js",
    'export const CONSOLIDATED_PROMPTS = {"/briques/ophelia/prompts/a.md":"Old"};\nexport const BRIQUES = [];\n');
  const report=auditPublicProjections({root,appName:"inseme",selectedBriques:[{id:"ophelia",prompts:{"a":"./public/prompts/a.md"}}],briqueId:"ophelia"});
  assert.equal(report.projections[0].counts.registry_drift,1);
  assert.equal(report.projections[0].counts.exact,1);
});

test("compiler projection report is a read-only command on a real deployment profile", () => {
  const script = fileURLToPath(new URL("../scripts/compile-briques.js",import.meta.url));
  const repo = fileURLToPath(new URL("../../../",import.meta.url));
  const run=spawnSync(process.execPath,[script,"--app","oleole","--profile","apps/oleole/brique-profiles/oleole.json","--check-projections","--brique","ophelia"],
    {cwd:repo,encoding:"utf8",timeout:20000});
  assert.equal(run.status,0,run.stderr);
  const report=JSON.parse(run.stdout);
  assert.equal(report.reports[0].projections[0].status,"out_of_profile_artifact");
  assert.equal(report.reports[0].projections[0].counts.exact,25);
});
