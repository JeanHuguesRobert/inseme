---
title: Cogentia Accounting Architecture — General, Statutory, Analytical, Budgetary, and Reconciliation Layers
author: Jean Hugues Noël Robert
language: en
date: '2026-08-08'
last_modified_at: '2026-08-08'
version: '0.1'
status: working source — human-directed, review pending
document_role: source
document_kind: architecture
visibility: public
lifecycle_state: active
update_policy: UP-DECISION-REVIEW
human_validation_required: true
canonical_url: https://github.com/JeanHuguesRobert/inseme/blob/main/research/cogentia_accounting_architecture.md
provenance:
  origin_type: conversation
  origin_repository: JeanHuguesRobert/inseme
  origin_ref: inseme#39
  origin_date: '2026-08-08'
  derived_from:
    - packages/cop-core/COP_ACCOUNTING.md
    - issues/25
    - issues/38
    - issues/39
    - https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/traceabilite_des_actes.md
review:
  status: pending-human-review
  reviewed_by: []
ai_assisted_by:
  - name: OpenAI ChatGPT
    role: AI-assisted synthesis, structuring, and corpus integration
    principal: Jean Hugues Noël Robert
    responsibility: Human principal retains validation and publication authority
tags:
  - cogentia
  - cop
  - accounting
  - analytical-accounting
  - statutory-accounting
  - budgets
  - reconciliation
  - digital-twins
  - archia
classification_source: cogentia.js
classification_version: '1'
classification_rule: explicit-metadata
classification_confidence: medium
license: CC BY-SA 4.0
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
---


# Cogentia Accounting Architecture

## 1. Decision

Cogentia accounting is not one ledger and must not be reduced to one national chart of accounts.

The architecture distinguishes four interacting but non-interchangeable layers:

```text
1. Cogentia general/resource accounting
2. statutory/general accounting of the legally accountable host
3. analytical accounting
4. budgetary / commitment accounting
```

A fifth cross-cutting function performs valuation, reconciliation, and correction when stronger evidence becomes available.

The compact rule is:

> **One statutory chart and ledger per legally accountable entity or legally relevant patrimony; one semantic accounting model shared by all Digital Twins; one multidimensional analytical model across the ecosystem.**

For governed cognitive work:

> **Legal persons determine statutory books; Twins determine situated capacities and responsibilities; packets or governed treatments determine fine-grained resource imputation.**

This note complements, but does not silently revise, the human-validated `COP_ACCOUNTING.md` v1.0 source.

## 2. Why the distinction matters

A Cogentia Digital Twin can be operationally autonomous without being a legal person.

A Twin may have:

- its own mandates;
- its own budgets;
- its own resource accounts;
- its own analytical views;
- its own projects and beneficiaries;
- its own history of acts and effects;

while its statutory financial effects are legally borne by a different subject such as a natural person, company, association, endowment fund, foundation, agricultural undertaking, public body, or another host.

Therefore:

```text
Twin identity != legal accounting entity
budget autonomy != legal personality
analytical autonomy != statutory ledger autonomy
```

This also covers hosted, incubated, delegated, or otherwise non-personified sub-instances.

## 3. Layer A — Cogentia general/resource accounting

COP/Accounting supplies a jurisdiction-neutral double-entry resource model.

It may account for:

- fiat money;
- compute;
- storage;
- bandwidth;
- energy;
- human time;
- materials;
- Kudos;
- quotas;
- rights of use;
- reservations and capacities;
- other conserved or explicitly created/destroyed resources.

This layer preserves the existing COP accounting invariants:

- exact quantities rather than binary floating point for authoritative postings;
- balanced postings inside each `(resourceType, unit, accountingDomain)`;
- explicit source/sink/transformation semantics for creation, destruction, loss, or conversion;
- actor and principal distinction;
- mandate, purpose, time, evidence, and disclosure references;
- immutable history;
- idempotency;
- deterministic replay;
- reversal and compensation rather than historical mutation.

This is a general accounting discipline in the broad computational sense. It is not automatically a statutory general ledger under any specific jurisdiction.

## 4. Layer B — statutory/general accounting

Statutory accounting belongs to the legally accountable entity or patrimony, not automatically to the Twin.

A jurisdictional adapter may map eligible COP accounting facts into the legally required chart and statements.

For example, a French deployment may need mappings toward:

- the French Plan comptable général;
- nonprofit-specific accounting rules;
- agricultural accounting rules;
- or another applicable sector-specific profile.

These examples belong in jurisdictional adapters and profiles. They MUST NOT redefine universal COP semantics.

### 4.1 Not a pure export problem

Statutory accounting can introduce judgments and entries that have no direct one-to-one operational event beforehand, including for example:

- depreciation;
- accruals and deferrals;
- provisions;
- inventory adjustments;
- tax-specific entries;
- legally prescribed valuations;
- year-end closing entries.

The target architecture is therefore:

> **a federating Cogentia ledger plus bidirectionally reconcilable statutory adapters**, not a claim that statutory books are always an automatic projection of operational events.

### 4.2 Host identity

Where statutory relevance exists, an accounting event or projection should be able to carry or derive at least:

```text
subject_id
twin_id
legal_host_id
accounting_domain
principal_subject_id
actor_subject_id
mandate_id
```

A Twin may change host over time. Historical accounting must preserve which host bore each effect at the time it occurred.

## 5. Layer C — analytical accounting

Analytical accounting asks questions that a statutory chart is not designed to answer efficiently:

> Why was this resource consumed? For whom? By whom? Under which mandate? For which packet, project, provider, beneficiary, or funding source?

These questions should be represented by orthogonal dimensions, not by uncontrolled multiplication of general-ledger account numbers.

### 5.1 Candidate common dimensions

```text
legal_entity / legal_host
twin
principal
actor / logical_agent / handler where relevant
mandate
packet / treatment
project / program
funding_source
counterparty
provider
capability
model_or_resource
beneficiary
resource_type
valuation_status
evidence
disclosure_class
jurisdiction / location when materially relevant
```

A single financial charge may therefore remain one general-ledger account while being sliced analytically across many independent dimensions.

Example:

```text
General account: AI / external compute service
Legal host: FractaVolta
Twin: Agent JHN
Mandate: M-783
Packet: CPKT-12345
Project: Cogentia
Capability: llm.inference
Provider: OpenAI
Model: provider-specific model identifier
Beneficiary: JHN
Funding source: FractaVolta R&D budget
Valuation status: estimated -> invoiced -> reconciled
```

Analytical projections may aggregate by provider, model, agent, API key, project, day, month, beneficiary, or any other useful dimension. These aggregates do not become authorization mechanisms merely because they are useful reports.

## 6. Layer D — budgetary and commitment accounting

A budget is neither an asset nor an expense.

It is a bounded authorization to consume or commit resources.

The conceptual sequence is:

```text
Mandate
→ Budget
→ Reservation
→ Commitment
→ Consumption / Transaction
→ Settlement
→ Reconciliation
```

The budget attached to a governed packet or treatment is the authoritative execution ceiling when that packet is the governed unit of work.

This preserves the doctrine already recorded in `inseme#38`:

- a packet can invoke several providers and models;
- a packet can generate several calls;
- all of those calls may remain inside one governed treatment budget;
- provider/model/agent/month aggregations remain analytical views;
- provider-side spend limits are defence in depth, not the normal correctness mechanism.

## 7. A Cogentia semantic chart of accounts

Cogentia should not make one national account-numbering scheme its universal ontology.

A shared semantic chart may use stable names such as:

```text
ASSET.*
LIABILITY.*
NET.*
INCOME.*
EXPENSE.*
CLEARING.*
OFFBALANCE.*
MEMO.*
```

Example:

```text
COG:EXPENSE.AI.INFERENCE
```

This account can then be mapped through a versioned jurisdiction/profile layer where appropriate.

```text
Cogentia semantic account
        ↓
statutory adapter
        ↓
applicable jurisdictional chart/profile
```

Mappings are versioned artifacts because laws, accounting standards, sector profiles, and organizational choices evolve.

The semantic chart should remain sufficiently stable that analytical continuity survives a change in jurisdictional mapping.

## 8. Valuation, estimates, invoices, and reconciliation

Operational truth and financial truth often arrive at different times.

A provider call may immediately produce reliable physical usage evidence:

```text
input tokens
output tokens
GPU time
CPU time
storage bytes
energy
network traffic
```

while the final invoiced monetary amount arrives later.

The accounting model must therefore distinguish:

```text
measured quantity
provisional valuation
authoritative external evidence
reconciled valuation
```

### 8.1 Example

At execution time:

```text
observed_usage = 1,847 input tokens + 623 output tokens
estimated_cost = 0.01237 EUR
valuation_status = estimated
```

When the invoice is received:

```text
reconciled_cost = 0.01278 EUR
compensating_adjustment = +0.00041 EUR
valuation_status = invoiced/reconciled
```

The original estimate is not deleted.

The new evidence produces a new reconciliation or compensating event.

Across all packets covered by one supplier invoice, reconciled allocations should exactly equal the authoritative supplier total, except for explicitly represented rounding, unresolved discrepancy, credit-note, tax, or other reconciliation accounts.

This preserves a central corpus rule:

> **New truth corrects provisional truth by leaving an additional trace; it does not rewrite what was previously believed.**

## 9. Relationship to Archia and traceability of acts

Accounting and act traceability solve different halves of the same accountability problem.

The target chain is:

```text
Principal
→ Mandate
→ LogicalAgent / Actor
→ CapabilityInvocation
→ Act
→ Effect / Evidence
→ Accounting transaction
→ Analytical imputation
→ Reconciliation
```

Archia / traceability of acts explains:

- who acted;
- for which principal;
- under which mandate;
- what was authorized;
- what was attempted;
- what evidence and effect resulted;
- what responsibility and accountability chain applies.

COP/Accounting explains:

- which resources moved or were consumed;
- which obligations arose;
- what was reserved, committed, settled, reversed, or reconciled;
- which balances and valuations changed.

Together they make it possible to reconstruct consequential work as something stronger than an application log or narrative audit trail:

> **an attributable, evidence-backed, balanced account of acts and their resource consequences.**

## 10. Strategic consequence for Digital Twins

A normal assistant can report that it performed work.

A governed Cogentia Twin should be able to produce evidence showing, at a useful level of proportionality:

```text
who authorized the work
who or what executed it
which mandate applied
which budget was available
which resources were reserved and consumed
which external effects occurred
which evidence supports those effects
how costs were analytically imputed
how provisional estimates were reconciled to later financial truth
which corrections occurred without deleting history
```

This property is potentially important for professional, institutional, research, fiduciary, regulated, and high-accountability use cases.

It must be demonstrated by implementation and evidence before being marketed as a production capability.

## 11. Proposed implementation shape

A later bounded implementation may introduce a structure such as:

```text
accounting/
  charts/
    cogentia-core.yaml
  mappings/
    <jurisdiction>-<profile>-<version>.yaml
  analytics/
    dimensions.yaml
  policies/
    budgets.yaml
    valuation.yaml
    reconciliation.yaml
```

The exact package and file paths remain implementation decisions.

The important separation is semantic:

```text
universal resource accounting
!= jurisdictional statutory accounting
!= analytical accounting
!= budget authorization
```

while all four remain reconcilable through one governed event/evidence substrate.

## 12. Open questions

- Which semantic accounts belong in the minimal Cogentia chart rather than application profiles?
- Which analytical dimensions are mandatory for conformance and which are extensible?
- Should analytical dimensions live directly on postings, on imputation events, or in a dedicated projection schema?
- How should one invoice be allocated across packets when provider evidence does not expose perfect packet correlation?
- How are VAT, taxes, discounts, credits, minimum commitments, and tiered pricing represented without contaminating provider-neutral core semantics?
- How should statutory closing entries feed back into the federating ledger without pretending they were operational acts?
- Which evidence classes require human or accountant validation before a statutory export is considered ready?
- Which privacy rules govern cross-Twin analytical consolidation?

## 13. Relationship to current work

- `packages/cop-core/COP_ACCOUNTING.md` remains the human-validated COP/Accounting v1.0 source.
- `inseme#25` implements the day-one accounting kernel.
- `inseme#38` covers provider-neutral usage/cost evidence, packet budgets, and external spend safeguards.
- `inseme#39` is the bounded architecture issue for this note.
- The governed Act chain in `inseme#31` / `inseme#33` supplies the execution-side identity and trace that accounting must join.

## 14. Status

This note is a working source created under explicit human direction on 2026-08-08.

The architectural distinctions are intended to guide further work, but exact schema names, mandatory dimensions, jurisdictional mappings, and commercial claims require subsequent validation before being treated as stabilized protocol or production capability.
