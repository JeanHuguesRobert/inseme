import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {supervise} from "./supervise-result.js";

function withDir(fn) {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"fbf-supervisor-"));
 try{return fn(dir)}finally{fs.rmSync(dir,{force:true,recursive:true})}
}
test("success: separate completed receipt and original output",()=>withDir(dir=>{
 const x=supervise({phase:"test",command:process.execPath,args:["-e","console.log('hello')"],outputDir:dir});
 assert.equal(x.passed,true);
 assert.match(fs.readFileSync(path.join(dir,"test.log"),"utf8"),/hello/);
 assert.equal(JSON.parse(fs.readFileSync(path.join(dir,"result.json"),"utf8")).status,"completed");
}));
test("domain failure: negative exit code stored, no throw",()=>withDir(dir=>{
 const x=supervise({phase:"install",command:process.execPath,args:["-e","console.error('cause');process.exit(17)"],outputDir:dir});
 assert.equal(x.passed,false);
 assert.equal(x.exit_code,17);
 assert.match(fs.readFileSync(path.join(dir,"test.log"),"utf8"),/cause/);
}));
test("exception: unavailable executable preserved as result",()=>withDir(dir=>{
 const x=supervise({phase:"run",command:"/absent/fbf-executor-never-exists",outputDir:dir});
 assert.equal(x.passed,false);
 assert.match(x.error,/ENOENT/);
 assert.equal(x.exit_code,null);
}));
test("timeout: signal and error preserved",()=>withDir(dir=>{
 const x=supervise({phase:"probe",command:"demo",outputDir:dir,run:()=>({status:null,signal:"SIGTERM",error:new Error("ETIMEDOUT"),stderr:"partial"})});
 assert.equal(x.passed,false);
 assert.equal(x.signal,"SIGTERM");
 assert.match(fs.readFileSync(path.join(dir,"test.log"),"utf8"),/partial/);
}));
