import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { SqliteGovernedEffectGateway } from "./sqlite-governed-effect-gateway.js";

function fixture(fn) {
  const dir=mkdtempSync(join(tmpdir(),"inseme-sqlite-fence-"));
  const db=join(dir,"test.sqlite");
  try { return fn(db); } finally { rmSync(dir,{recursive:true,force:true}); }
}
const url=new URL("./sqlite-governed-effect-gateway.js",import.meta.url).href;
function child(db, method, args) {
  const code=`import { SqliteGovernedEffectGateway } from ${JSON.stringify(url)};
    const db = new SqliteGovernedEffectGateway(process.argv[1]);
    try { console.log(JSON.stringify(db[process.argv[2]](...JSON.parse(process.argv[3])))); }
    finally { db.close(); }`;
  const p=spawnSync(process.execPath,["--input-type=module","-e",code,db,method,JSON.stringify(args)],{encoding:"utf8",timeout:5000});
  assert.equal(p.status,0,p.stderr);
  return JSON.parse(p.stdout.trim());
}
test("different processes: old epoch denied at transaction boundary",()=>fixture(db=>{
  const g=new SqliteGovernedEffectGateway(db);
  g.seed("p",{holder:"A",epoch:1,mandateRevision:10,expiresAt:99999,value:"original"});
  const oldVersion=g.inspect("p").version;
  g.close();
  const changed=child(db,"transfer",["p",{holder:"B",epoch:2,mandateRevision:11,expiresAt:99999}]);
  assert.equal(changed.epoch,2);
  const stale=child(db,"commit",[{packetRef:"p",holder:"A",epoch:1,mandateRevision:10,
    expectedVersion:oldVersion,idempotencyKey:"old",value:"forbidden",now:100}]);
  assert.equal(stale.code,"AUTHORITY_REJECTED");
  const next=child(db,"commit",[{packetRef:"p",holder:"B",epoch:2,mandateRevision:11,
    expectedVersion:changed.version,idempotencyKey:"new",value:"accepted",now:100}]);
  assert.equal(next.code,"COMMITTED");
  const reopen=new SqliteGovernedEffectGateway(db);
  assert.equal(JSON.parse(reopen.inspect("p").value),"accepted");
  reopen.close();
}));
test("durable idempotency receipt survives process restart",()=>fixture(db=>{
  const g=new SqliteGovernedEffectGateway(db);
  g.seed("p",{holder:"B",epoch:2,mandateRevision:11,expiresAt:99999,value:null});
  g.close();
  const cmd={packetRef:"p",holder:"B",epoch:2,mandateRevision:11,
    expectedVersion:1,idempotencyKey:"once",value:"accepted",now:100};
  assert.equal(child(db,"commit",[cmd]).code,"COMMITTED");
  assert.equal(child(db,"commit",[cmd]).code,"ALREADY_APPLIED");
  assert.equal(child(db,"commit",[{...cmd,value:"changed"}]).code,"IDEMPOTENCY_CONFLICT");
}));
test("revocation and expiry fence synthetic effects",()=>fixture(db=>{
  const g=new SqliteGovernedEffectGateway(db);
  g.seed("p",{holder:"B",epoch:2,mandateRevision:11,expiresAt:99,value:"original"});
  g.close();
  const req={packetRef:"p",holder:"B",epoch:2,mandateRevision:11,
    expectedVersion:1,idempotencyKey:"expired",value:"forbidden",now:100};
  assert.equal(child(db,"commit",[req]).code,"AUTHORITY_REJECTED");
  const x=child(db,"revoke",["p"]);
  assert.equal(child(db,"commit",[{...req,expectedVersion:x.version,now:50}]).code,"AUTHORITY_REJECTED");
}));
