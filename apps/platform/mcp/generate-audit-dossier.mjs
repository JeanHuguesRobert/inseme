import { mkdir, writeFile } from "node:fs/promises";
import { reconcileTriplets } from "../../../packages/cop-kernel/src/accounting/auditWorkingPapers.js";
const dir=process.argv[2]||"cop-audit-dossier";
await mkdir(dir,{recursive:true});
const d=(id,intent_id,cents)=>({id,intent_id,cents,evidence:"synthetic:"+id});
const audit=reconcileTriplets({
 usage:[d("u-001","intent-001",12000),d("u-002","intent-002",5500),d("u-003","intent-003",3200)],
 invoices:[d("f-001","intent-001",12000),d("f-002","intent-002",5800)],
 payments:[d("p-001","intent-001",12000),d("p-002","intent-002",2000),d("p-003","intent-004",1000)]
});
const eur=c=>(c/100).toFixed(2)+" EUR";
const lines=[
 "# Dossier COP de revue comptable — scénario fictif",
 "",
 "**NON DEPOSABLE — simulation uniquement — pas une liasse fiscale réglementaire.**",
 "",
 "Exercice fictif : 2026-demo. Entité, régime fiscal, plan comptable, soldes d'ouverture et TVA : à établir.",
 "",
 "## Tableau de rapprochement",
 "",
 "| Intention | Consommation | Facturé | Payé | Écart facture/consommation | Solde facture/paiement | Pièces |",
 "|---|---:|---:|---:|---:|---:|---|",
 ...audit.rows.map(r=>`| ${r.intent_id} | ${eur(r.usage_cents)} | ${eur(r.invoiced_cents)} | ${eur(r.paid_cents)} | ${eur(r.invoice_gap_cents)} | ${eur(r.settlement_gap_cents)} | ${r.evidence.join(", ")} |`),
 "",
 "## Postes à régulariser / rapprocher",
 "",
 ...audit.anomalies.map(a=>`- **${a.code}** — ${a.intent_id||a.id||"source"} : ${eur(a.cents||0)}`),
 "",
 "## Vérifications et pièces requises",
 "",
 ...audit.checklist.map(x=>"- "+x),
 "",
 "## Réserve d'audit",
 "",
 "Les montants sont des données fictives. Aucune facture réelle, preuve de règlement, écriture comptable, fiscalité ni conformité légale n'a été attestée. Les anomalies ne sont pas automatiquement régularisées. Aucune écriture d'ajustement n'est créée sans source autorisée.",
 "",
 "## États fiscaux cibles à confirmer",
 "",
 "Formulaires 2033-A à 2033-G (réel simplifié BIC/IS) ou 2050 à 2059-G (réel normal BIC/IS), selon entité et régime; FEC/TVA/annexes à évaluer séparément.",
 ""
];
await writeFile(dir+"/audit.json",JSON.stringify(audit,null,2)+"\n");
await writeFile(dir+"/dossier-revue.md",lines.join("\n"));
console.log(JSON.stringify({schema:"cop.audit-generation/v1",status:"completed",directory:dir,anomalies:audit.anomalies.length,ready_for_filing:false}));
