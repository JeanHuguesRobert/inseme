# COP Accounting — Barons Mariani fonds de dotation: strict target profile

**Status:** proposed, future fund; not an assertion that the legal entity already exists, is tax-exempt, may issue tax receipts, or has a commissioner.

**Purpose:** Treat the **French fonds de dotation** as the strict accounting/conformance target for COP and for issue [#133](https://github.com/JeanHuguesRobert/inseme/issues/133). A commercial-company "liasse fiscale" is **not** the default target output. The priority is the annual accounts, annexes, operating report, audit trails and documents required for this entity's actual legal and fiscal regime.

## Primary legal sources (review currency before use)

- [Article 140, law 2008-776, version in force from 27 June 2026](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038610543/) — legal status, accounts, oversight and CAC threshold.
- [Decree 2009-158](https://www.legifrance.gouv.fr/loda/id/LEGITEXT000020248532/) — minimum founder endowment, administration, submissions, CAC timeline, transparency.
- [ANC 2018-06 accounting standard](https://www.anc.gouv.fr/reglement-ndeg-2018-06-du-5-decembre-2018) and subsequent amendments — non-profit legal entities, endowments, fund accounting and appendices.
- [Ministry of Economy FAQ on fonds de dotation](https://www.economie.gouv.fr/daj/fonds-de-dotation/questions-reponses).

## Strict legal profile, operational controls

1. **15,000 EUR minimum initial capital endowment in cash during first accounting year**: do not infer from expected future gifts or in-kind contributions that this requirement is satisfied. Separate non-spendable from spendable endowment according to actual statutes/conditions.
2. **Annual accounts:** balance sheet, statement of activities (compte de resultat) and notes, using the non-profit accounting standard and applicable chart of accounts. Explicitly track endowed/non-consumable funds, consumable endowment where authorized, dedicated and deferred funds, donations/legacies, grant restrictions and investments.
3. **Annual report and publication:** annual operating report, detailed missions funded, amounts and beneficiaries, received liberalities; publication and prefectoral submission generally within six months of fiscal year end. Preserve proof of submission, publication and board approval.
4. **CAC:** mandatory under the statutory annual resource threshold (> EUR 10,000) and potentially chosen proactively from day one. When mandated, deliver annual accounts and report at least 45 days before the approval board meeting. Retain audit request/response and signed decisions.
5. **Public fundraising:** permission/authorization conditions must be checked before appeals to public generosity. If funded by it, prepare statutory resource-use statement (CER) and account by origin and destination (CROD) in notes where required.
6. **Foreign source advantages/resources:** maintain origin, payer, beneficial interests, valuation and supporting evidence for the applicable separated note statement and declarations.
7. **Tax:** donation tax relief and receipt issuance depend on specific eligibility; commercial VAT/IS obligations must be separately analyzed. Do not infer tax exemption from fonds de dotation status. Do not generate corporate BIC/IS 2033/2050 forms by default.
8. **Governance:** enforce approved mandates, conflict-of-interest declarations, independent verification and restricted use of endowment; separate fund's transactions from those of founder or related entities.

## COP control ledger: one chain per legally relevant effect

Mandate/board decision -> authorization/budget -> event/packet/execution -> claimed effect -> **verified independent evidence** -> journal entry with unique key and supporting-document reference -> bank/provider reconciliation -> immutable corrections -> accounting balances and dedicated funds -> financial statements and annexes -> audit working papers -> official approval and filing/publication receipts.

On exceptions, store **open exceptions**, including missing grant/donation proof, misdirected spend, uncertain valuation, mismatch between usage/invoice/payment, unreconciled bank flows, pledged vs received endowment, incomplete restriction metadata, missing conflict check, late/absent CAC review, incomplete fiscal eligibility, and deficient grant beneficiary evidence.

Do not hide exceptions in success status. Each exception requires ID, severity, responsible actor, source documents, amount/currency or explicit 'unknown', opened date, attempted remedies, reconciler decision, closure evidence and corrective entries. Fail closed for real effects lacking proof of authority.

## Annual audit package (working papers, not automatically certified)

- Identified fiscal year, statutes/status/governance matrix, board minutes and permissions
- Trial balance, general ledger, journal entries, chart of accounts; opening balances and year-on-year reconciliation
- Asset register / investments / endowment movements and encumbrances
- Restricted donations, endowed funds, project allocations and fund usage rollforward
- Donation/gift/grant and donor evidence registry; receipts if lawfully issuable
- Expenses, provider invoices, bank statements and per-transaction reconciliation
- Annual balance sheet, income statement and notes under ANC 2018-06
- CER, CROD, foreign-source separated note where applicable
- Annual report and reconciliation with financial statements; approval and disclosure receipts
- All unresolved issues and post-closing adjusting entries, signed-off by authorized officers
- CAC request log, attestations and findings, when applicable
- Tax status opinion, declarations if taxable and receipt eligibility separately validated

**No silent auto-closing** of exceptions; preserve signed-off immutable reconciliation actions. Accounting output is not a legal audit opinion.

## Minimal next Reality Test

Retarget the existing synthetic reconciliation dossier to a **non-profit fund fixture** with (a) initial endowment provision, (b) earmarked donation, (c) vendor expense/invoice and partial payment, (d) one incomplete source document, (e) a missing board-authorization or restriction-check observation. Produce an explicit unresolved-items inventory and a *draft non-filing* financial-statements evidence matrix. Do not fabricate balanced accounts from incomplete records; do not equate a green workflow to audit approval.

**Acceptance:** (1) each source links to one or more intended accounting effects; (2) missing evidence remains open; (3) original records untouched; (4) no false claim of initial endowment compliance, donation tax eligibility or legal publication; (5) no generic commercial tax filing mislabeled as a fund annual filing; (6) CI regression remains green.

**Scope rule:** user-selected strict target profile, not yet a statement of the fund's incorporation, statutes, activities or financial position.
