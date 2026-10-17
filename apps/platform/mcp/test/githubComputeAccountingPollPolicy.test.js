import test from "node:test";
import assert from "node:assert/strict";
import {nextComputeAccountingPoll,POLL} from "../cop/githubComputeAccountingPollPolicy.js";
const at=1_000_000;
test("no pending accounting means no periodic calls",()=>assert.deepEqual(
 nextComputeAccountingPoll({nowMs:at,pendingCount:0}),{mode:"dormant",nextAtMs:null}));
test("running jobs poll every two minutes, pending completion every five",()=>{
 assert.equal(nextComputeAccountingPoll({nowMs:at,pendingCount:1,runningCount:1}).delayMs,POLL.activeMs);
 assert.equal(nextComputeAccountingPoll({nowMs:at,pendingCount:1}).delayMs,POLL.normalMs);
});
test("provider errors back off and respect retry reset",()=>{
 assert.equal(nextComputeAccountingPoll({nowMs:at,pendingCount:1,consecutiveFailures:2}).delayMs,20*60_000);
 assert.equal(nextComputeAccountingPoll({nowMs:at,pendingCount:1,consecutiveFailures:100}).delayMs,POLL.maximumBackoffMs);
 assert.equal(nextComputeAccountingPoll({nowMs:at,pendingCount:1,rateLimitResetMs:at+900_000}).delayMs,900_000);
});
test("invalid state fails closed",()=>assert.throws(
 ()=>nextComputeAccountingPoll({nowMs:at,pendingCount:-1}),/invalid poll state/));