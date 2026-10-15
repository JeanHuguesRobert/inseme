import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const code=fs.readFileSync(new URL("./github-compute-finalize.js",import.meta.url),"utf8");
test("contended holder does not enter completed-replay verifier",()=>{
 assert.match(code,/if \(replaySkipped && !process\.env\.COMPUTE_PHASE_CLAIM\)/);
 assert.match(code,/if \(request && process\.env\.COMPUTE_PHASE_CLAIM !== "claimed"\)/);
 assert.ok(code.indexOf('if (request && process.env.COMPUTE_PHASE_CLAIM !== "claimed")') > code.indexOf('if (replaySkipped && !process.env.COMPUTE_PHASE_CLAIM)'));
});
