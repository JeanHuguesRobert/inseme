---
title: Module accounting durable — DB, plans comptables, bilans & analytique
subtitle: Map corpus + issues + path from packet spend to legal statements
date: '2026-08-13'
version: '0.1'
document_role: source
document_kind: architecture
visibility: public
lifecycle_state: working
related:
  - packages/cop-core/COP_ACCOUNTING.md
  - research/cogentia_accounting_architecture.md
  - packages/cop-kernel/docs/packet-strict-accounting-cascade.md
  - inseme#25,
classification_source: cogentia.js
classification_version: '1'
classification_rule: explicit-metadata
classification_confidence: medium
legacy_document_role: research
license: CC BY-SA 4.0
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
language: fr
update_policy: UP-DEFAULT-REVIEWED
status: working-paper
review:
  status: unreviewed
  reviewed_by: []
provenance:
  origin_type: unknown
  origin_repository: unknown
  origin_ref: unknown
  origin_date: unknown
  derived_from: []
---


# Module accounting durable — DB, plans comptables, bilans & analytique

## 1. Oui : ces pièces doivent être mémorisées

Les dépenses provisoires des Cognitive Packets (Guide, Agent John, …) ne doivent pas rester
seulement en mémoire de process. Elles doivent devenir des **faits comptables durables** :

```text
CapabilityInvocation / LLM call
  → Cognitive Packet own spend (hop + ProvisionalSpending)
  → accounting/transaction Event (balanced, idempotent)
  → Store (DB) + projections (balances, analytique)
  → (later) adapter légal → bilan / compte de résultat
```

Doctrine COP : **Event + Artifact** sont les seuls primitives durables ; bilans, CRC, balances sont
des **Views**.

## 2. Travail déjà initié (corpus & GitHub)

| Artifact                                                                     | Rôle                                                                     |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [`COP_ACCOUNTING.md`](../packages/cop-core/COP_ACCOUNTING.md) v1.0           | Spec humaine validée : double-entry, budgets, mandates, exact quantities |
| [`cogentia_accounting_architecture.md`](cogentia_accounting_architecture.md) | 4 couches + chart sémantique + réconciliation                            |
| [inseme#25](https://github.com/JeanHuguesRobert/inseme/issues/25)            | Day-one kernel exécutable (validator/projector) — **OPEN**               |
| [inseme#38](https://github.com/JeanHuguesRobert/inseme/issues/38)            | Usage provider-neutral, packet budgets, reconciliation — **OPEN**        |
| [inseme#39](https://github.com/JeanHuguesRobert/inseme/issues/39)            | Architecture general / statutory / analytical / budgetary — **OPEN**     |
| [inseme#45](https://github.com/JeanHuguesRobert/inseme/issues/45)            | Strict accounting / no unaccounted effects — **OPEN**                    |
| Kernel `packages/cop-kernel/src/accounting/`                                 | quantity, validator, projector, **packetAccounting** (own/consolidated)  |
| Migration `20260723080000_…_accounting_tables.sql`                           | `cop_accounting_event`, `_balance`, `_budget`                            |
| Migration `20260813120000_…_packet_and_postings.sql`                         | postings normalisés, packet_spend index, chart registry                  |
| Chart seed `charts/cogentia-core.yaml`                                       | Plan sémantique COG:EXPENSE.AI.INFERENCE …                               |
| Surface wire (cogentia)                                                      | Guide/WhatsApp → packet spend (provisoire)                               |

## 3. Les quatre couches (ne pas les confondre)

```text
A. Resource / general (COP)     — tokens, USD provisoire, Kudos, énergie…
B. Statutory / legal host       — PCG France, asso, etc.  (1 ledger / entité légale)
C. Analytical                   — packet, treatment, provider, projet, bénéficiaire…
D. Budgetary / commitment       — mandate → budget → reservation → spend
+ Reconciliation                — provisional → invoice → compensating entry
```

Règle d’or ([#39](https://github.com/JeanHuguesRobert/inseme/issues/39)) :

> **Un plan/ledger légal par entité juridiquement responsable ; un modèle sémantique partagé par
> tous les Twins ; une analytique multidimensionnelle sur l’écosystème.**

Twin ≠ personne morale. Un Twin peut avoir budgets + analytique sans bilans statutaires propres.

## 4. Plan comptable

### 4.1 Plan sémantique Cogentia (universel)

Familles : `ASSET | LIABILITY | NET | INCOME | EXPENSE | CLEARING | OFFBALANCE | MEMO`

Exemples :

```text
COG:EXPENSE.AI.INFERENCE
COG:LIABILITY.PROVIDER.PAYABLE
COG:CLEARING.PROVISIONAL.SPEND
```

Fichier : `packages/cop-kernel/src/accounting/charts/cogentia-core.yaml`

### 4.2 Mapping juridictionnel (plus tard)

```text
COG:EXPENSE.AI.INFERENCE  →  adapter fr_pcg / asso / agricole (versionné)
```

**Jamais** de PCG hardcodé dans cop-core. Le mapping est un **adapter** expert-comptable + humain.

### 4.3 Analytique (pas 10 000 comptes généraux)

Dimensions orthogonales sur postings / events :

`packet_id, treatment_id, mandate_id, twin_id, legal_host_id, provider, model, capability, surface, project_id, valuation_status`

## 5. Pièces légales (chemin réaliste)

| Document                           | Source                                                 | Statut cible                                |
| ---------------------------------- | ------------------------------------------------------ | ------------------------------------------- |
| Journal / grand livre opérationnel | `cop_accounting_event` + postings                      | Projection déterministe                     |
| Balance / trial balance            | `cop_accounting_balance`                               | Projection                                  |
| Compte de résultat opérationnel    | INCOME − EXPENSE (même unité)                          | Sketch ops (`projectOperationalStatements`) |
| Bilan opérationnel                 | ASSET / LIABILITY / NET                                | Sketch ops                                  |
| **Bilan & CRC légaux**             | Adapter host (PCG…) + jugements (amortissements, CCA…) | **Humain + expert** ; pas auto pur          |
| Analytique par packet/projet       | `cop_accounting_packet_spend` + dimensions             | Projection                                  |

Disclaimer permanent : **pas un logiciel de comptabilité certifié** tant qu’un profil légal n’est
pas validé.

## 6. Persistance DB (module accounting)

```text
cop_accounting_event          — immutable events (source of truth)
cop_accounting_posting        — lines (optional materialization)
cop_accounting_balance        — projected balances
cop_accounting_budget         — authorization ceilings
cop_accounting_packet_spend   — own-spend index by packet (not consolidated)
cop_accounting_chart_account  — semantic chart registry
```

API store : `createSupabaseAccountingStore` → `append` (idempotent) + balance projection.

Pipeline déjà prévu : `persistPacketAccountingTransaction` → `persistAccountingEvent`.

## 7. Lien packet → écriture

```text
appendPacketSpending(packet, { provider, model, tokens })
  → transactionEvent (debit expense / credit account)
  → persistAccountingEvent → cop_accounting_event
  → project balances
  → index cop_accounting_packet_spend (own only)
```

Cascade :

```text
own(packet)          = rows where packet_id = P
consolidated(P)      = own(P) + Σ consolidated(downstream)
```

Ne jamais stocker consolidated comme écriture primaire (sinon double comptage).

## 8. Roadmap bornée

| Slice                                  | Contenu                                                                  | Issue                       |
| -------------------------------------- | ------------------------------------------------------------------------ | --------------------------- |
| **S0** (done-ish)                      | Kernel in-memory + packet own/consolidated + surface Guide/WA            | #25 partial, packet cascade |
| **S1** (this note + migration + store) | Chart YAML, tables packet/posting, Supabase store, ops statements sketch | #39 implement start         |
| **S2**                                 | Wire surface → persist when SUPABASE configured; spool replay            | #38/#45                     |
| **S3**                                 | Budget reservation enforcement on packet open                            | #38                         |
| **S4**                                 | Invoice reconciliation events                                            | #38/#39                     |
| **S5**                                 | French PCG adapter profile (expert review) → export FEC-like             | #39 statutory               |
| **S6**                                 | Certified statement packaging (human sign-off)                           | legal host                  |

## 9. Env

```text
SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY   — durable store
COGENTIA_COP_ACCOUNTING_PERSIST=1         — enable DB persist from surfaces
COGENTIA_COP_SPEND_SPOOL=/path/file.ndjson — degraded offline
COGENTIA_COP_BUDGET_RESERVATION_ID=…      — optional ceiling
```

## 10. Status

Architecture **déjà** dans le corpus ; kernel **partiel** ; tables **posées** ; surface packets
**branchés** ; persistance DB + chart + sketch bilans/CRC **amorcés** dans ce slice. Suite : S2 wire
persist live + budgets.
