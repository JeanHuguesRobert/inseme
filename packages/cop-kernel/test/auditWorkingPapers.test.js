import test from "node:test";
import assert from "node:assert/strict";
import { reconcileTriplets } from "../src/accounting/auditWorkingPapers.js";
const d=(id,intent_id,cents)=>({id,intent_id,cents,evidence:"synthetic:"+id});
test("fully documented triplet closes without fabricated fiscal approval",()=>{
 const r=reconcileTriplets({usage:[d("u1","i1",1000)],invoices:[d("f1","i1",1000)],payments:[d("p1","i1",1000)]});
 assert.equal(r.anomalies.length,0);assert.equal(r.ready_for_filing,false);assert.equal(r.rows[0].paid_cents,1000);
});
test("missing invoices, discrepancies, partial payments and duplicates surface",()=>{
 const r=reconcileTriplets({
 usage:[d("u1","i1",1200),d("u2","i2",300),d("u1","i1",1200)],
 invoices:[d("f1","i1",1000)],
 payments:[d("p1","i1",400)]});
 assert.deepEqual(new Set(r.anomalies.map(x=>x.code)),new Set(["DUPLICATE_SOURCE","INVOICE_MISSING","USAGE_INVOICE_MISMATCH","PAYMENT_INCOMPLETE"]));
 assert.equal(r.rows.find(x=>x.intent_id==="i1").invoice_gap_cents,-200);
});
test("invalid and orphan sources never vanish quietly",()=>{
 const r=reconcileTriplets({payments:[d("p1","i3",250),{id:"p2",intent_id:"i4",cents:0}]});
 assert.ok(r.anomalies.some(x=>x.code==="UNMATCHED_PAYMENT"));
 assert.ok(r.anomalies.some(x=>x.code==="INVALID_SOURCE"));
});

test("not-yet-constituted fund cannot own accounting ledger", () => {
 const invalid=reconcileTriplets({legal_entity:"Fonds Barons Mariani",prospective_fund_status:"not_constituted"});
 assert.ok(invalid.anomalies.some(a=>a.code==="INVALID_LEGAL_LEDGER_OWNER"));
 const hosted=reconcileTriplets({legal_entity:"C.O.R.S.I.C.A.",analytic_project:"Barons Mariani",prospective_fund_status:"not_constituted"});
 assert.equal(hosted.anomalies.length,0);
 assert.equal(hosted.legal_entity,"C.O.R.S.I.C.A.");
 assert.equal(hosted.ready_for_filing,false);
});
