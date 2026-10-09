/**
 * Synthetic audit working papers; NOT an official French tax return.
 * Exact integer cents, strict provenance and unclosed exception ledger.
 */
export function reconcileTriplets({usage=[],invoices=[],payments=[]}={}) {
 const anomalies=[],rows=[],ids=new Set();
 const byId=(records,kind)=>{const out=new Map();for(const r of records){if(!r.id||!r.intent_id||!Number.isSafeInteger(r.cents)||r.cents<0||!r.evidence){anomalies.push({code:"INVALID_SOURCE",kind,id:r.id||null});continue;}if(ids.has(kind+":"+r.id)){anomalies.push({code:"DUPLICATE_SOURCE",kind,id:r.id});continue;}ids.add(kind+":"+r.id);const k=r.intent_id;out.set(k,[...(out.get(k)||[]),r]);}return out;};
 const U=byId(usage,"usage"),I=byId(invoices,"invoice"),P=byId(payments,"payment");
 const keys=[...new Set([...U.keys(),...I.keys(),...P.keys()])].sort();
 for(const key of keys){
   const u=U.get(key)||[],i=I.get(key)||[],p=P.get(key)||[];
   const sum=x=>x.reduce((a,b)=>a+b.cents,0);
   const uc=sum(u),ic=sum(i),pc=sum(p);
   const refs=[...u,...i,...p].map(x=>x.evidence);
   rows.push({intent_id:key,usage_cents:uc,invoiced_cents:ic,paid_cents:pc,
     invoice_gap_cents:ic-uc,settlement_gap_cents:ic-pc,evidence:refs});
   if(u.length&&!i.length)anomalies.push({code:"INVOICE_MISSING",intent_id:key,cents:uc});
   if(i.length&&!u.length)anomalies.push({code:"USAGE_MISSING",intent_id:key,cents:ic});
   if(ic!==uc&&i.length&&u.length)anomalies.push({code:"USAGE_INVOICE_MISMATCH",intent_id:key,cents:ic-uc});
   if(i.length&&pc<ic)anomalies.push({code:"PAYMENT_INCOMPLETE",intent_id:key,cents:ic-pc});
   if(pc>ic)anomalies.push({code:"PAYMENT_EXCESS",intent_id:key,cents:pc-ic});
   if(p.length&&!i.length)anomalies.push({code:"UNMATCHED_PAYMENT",intent_id:key,cents:pc});
 }
 return {schema:"cop.audit-working-papers/v1",synthetic:true,legal_filing:false,
   period:"2026-demo",currency:"EUR",rows,anomalies,
   checklist:["Legal entity and tax regime unidentified","Opening balances unverified",
     "VAT treatment unverified","Chart of accounts mapping missing",
     "Fiscal adjustments missing","External supporting documents not certified"],
   ready_for_filing:false};
}
