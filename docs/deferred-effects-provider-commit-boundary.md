---
title: "Frontière de validation des effets — garanties minimales du fournisseur"
date: "2026-10-08"
document_role: research
document_kind: semantic-probe
visibility: public
lifecycle_state: working
---

# Garanties au moment de l'effet : étude non normative

## Problème

Une autorisation observée à t0 peut être révoquée à t1, tandis que l'effet est validé à t2. Une vérification à t0, voire immédiatement avant t2, ne suffit pas si une révocation peut intervenir entre contrôle et usage (TOCTOU).

Le critère recherché n'est pas « le handler est-il autorisé selon sa mémoire ? » mais « quelles conditions le fournisseur peut-il faire respecter *au point de linéarisation de l'effet* ? ». Ce document explore des conditions sans modifier les spécifications COP.

## Tableau de garanties

| Mécanisme | Garantie possible | Non-garantie |
|---|---|---|
| Atomicité de l'écriture | modification indivisible | validité externe du mandat |
| CAS sur version de la cible | écarter un écrivain dont l'attente est périmée | révocation non répercutée dans cette version |
| Fencing de génération | écarter un titulaire antérieur si la cible vérifie le token | génération non synchronisée avec la révocation |
| Clé d'idempotence | éviter répétition de la même demande | empêcher une première écriture non autorisée |
| Transaction sérialisable englobant autorité et cible | ordonner révocation et effet dans un domaine transactionnel commun | transaction atomique avec un fournisseur extérieur non participant |
| Reçu durable | savoir ce qu'un fournisseur affirme avoir effectué | exactitude/irréversibilité automatique de tous les effets |

## Hypothèses rivales à préserver

**H1 — Domaine transactionnel unique.** L'autorité et la cible sont vérifiées/mutées dans une même transaction; les conflits conduisent à refus ou nouvelle tentative, et les actions ne sont valables qu'après commit.

**H2 — Domaine séparé avec fencing obligatoire à la cible.** Le fournisseur d'effet applique un epoch supérieur et refuse les anciennes générations. Attention : si la révocation n'est pas propagée avant la validation d'effet, le fencing seul n'impose pas nécessairement un ordre global souhaité.

**H3 — Domaine séparé, sans CAS/fencing.** Exécuter uniquement des effets à risque compatible avec cette lacune (idempotents ou compensables), ou différer/solliciter autorité, plutôt que fabriquer une garantie.

**H4 — Révocation et effets concurrents non totalement ordonnables.** Le système doit déclarer sa frontière de cohérence, les délais/partitions acceptés et les modes de récupération. « Après révocation » demande une définition opératoire : décision, publication, visibilité, ou commit dans le domaine d'autorité.

## Contrat minimal candidat, non COP

An effect attempt would carry:
- stable effect ID and idempotency key;
- issuer/principal, mandate ID and pinned mandate revision;
- target identity and expected revision;
- lease holder/epoch and expiry where relevant;
- bounded exposure and budget reservation evidence;
- requested effect, source context, provenance;
- explicit provider guarantee level and receipt.

Provider outcome should distinguish `committed`, `rejected_stale_authority`, `rejected_target_conflict`, `duplicate_satisfied`, `deferred_unknown`, `failed`. Unavailable or unknown guarantees must remain **unknown**, not be relabelled atomic.

## Important temporal counterexample

A provider enforces perfect CAS on the *target version*, but mandate revocation changes only the authority database. Since target version remains constant, CAS succeeds after revocation. Therefore target CAS alone is insufficient. Conversely, in a shared serializable transaction, a revoked mandate can be checked together with target mutation; the commit order becomes explicitly defined, provided both authority and target are in that transactional domain.

## Empirical discriminants

1. Two concurrent transactions: one revokes authority, another verifies it and writes the target. Verify committed outcomes and serial order.
2. Introduce delay after preflight but before commit; measure whether the stale writer can commit.
3. Repeat with only target CAS and separate authority store; demonstrate the mismatch.
4. Repeat with epoch at target, including delayed revocation propagation; determine exact bound.
5. Budget resource use: read/write operations, retries, locks, storage, latency, attention, partitions, unknown costs.

## Peripheral observation

The deeper issue might not be lease vs mandate, nor Topic vs stream, but **the chosen linearization boundary across independent localities**. Moving authority checks between providers can silently widen what a principal has delegated. This is a new research hypothesis rather than a new core protocol object.

## Evidence and status

Related local experimental findings: [E7 synthetic revocation test](../scripts/stream-revocation-boundary.test.js), [receipt](https://github.com/JeanHuguesRobert/inseme/issues/121#issuecomment-6069284203).

External references:
- PostgreSQL transaction isolation (Serializable): https://www.postgresql.org/docs/current/transaction-iso.html
- GitHub Git References REST API: https://docs.github.com/en/rest/git/refs

No live distributed revocation test or cross-provider atomicity has been demonstrated. No existing COP normative source modified.

## Recovery and reconciliation as an alternative to impossible global atomicity

**Research hypothesis, not COP normative change:** because real social, legal, financial and organizational systems operate through correction, conciliation, restitution, compensation and repair despite imperfect synchronization, distributed agent systems may use an explicit *recovery envelope* rather than demanding universal cross-provider transactions. This might surpass some human workflows in speed, traceability, early detection and bounded cost, but improvement remains to be demonstrated.

The existing Cogentia source [Measured Risk](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/measured_risk.md) already distinguishes *Reversibility Envelope*, compensability, rectifiability, restitutability, repairability, recovery costs and residual harm. Do **not** reinvent these concepts as a new COP core entity.

Separate distinct operations:
- **Technical reversal**: return a machine state, when possible.
- **Rectification**: amend an inaccurate claim or record without erasing the historical act.
- **Restitution**: return property, capability, access or value to the affected party.
- **Compensation**: address loss that cannot be undone, with legitimate authority and proportional valuation.
- **Repair**: restore function, trust or capability as far as realistically possible.
- **Conciliation**: negotiate among principals whose interests or interpretations conflict; an algorithm must not silently decide rights.
- **Residual-harm acknowledgement**: explicitly retain the part no remedy removes.

Candidate workflow (non-prescriptive): trace original act → detect contradiction/revocation/harm → contain further propagation → identify affected parties, mandates and rights → enumerate remedies and residuals → seek appropriate human judgment/conciliation when needed → enact authorized remedies idempotently → obtain receipt → reassess effect and cost. A compensating act does not delete the original event; it creates new causal evidence.

### Rival hypotheses and failure cases

- H1: bounded compensating effects can make a multi-provider workflow *effectively recoverable* without global atomicity.
- H2: compensation can conceal unacceptable rights violations or irrecoverable third-party harm; stronger preventive exclusion is necessary.
- H3: a hybrid selects prevention, recovery or both according to exposure and reversibility envelope.

Tests must distinguish technical restoration from repair of social/legal consequences. Measure completion time, correctness, residual harm, unconsented externalities, cost (including attention and unknowns), repeatability and ability to challenge a remedy. No guarantee of "exactly once" is implied.

Peripheral observation: the target may not be *absence of mistakes* but **governed error detection, contestation, and effective repair**, with consequences visible to all affected principals. This is an experimentally testable candidate, not a theorem.

## Optimistic Locking as governing posture, not only versioned CAS

The Corpus already defines a broader doctrine in [Optimistic Mainline Governance](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/optimistic_mainline_governance.md): allow small, scoped, attributable acts under explicit mandate and measured Exposure when a credible correction or recovery path exists; observe real effects and reconcile. A version comparison is an instrument, **not** the whole doctrine. [Agent Working Conventions](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/agent_working_conventions.md) adds the important rule that in-flight agents refresh, compare baseline with live work, and reconcile rather than freeze the living Corpus.

This changes the research question. The goal is **not** universal pre-emptive locking. It is to classify effect boundaries by actual Exposure and recovery envelope, selecting the least restrictive justified safeguards while maintaining mandate, traceability, rights and budget.

Working alternatives:
1. **Optimistic, cheap-to-repair act:** act on current snapshot and visible delta, use CAS if relevant, inspect receipts, reconcile conflicts through successor acts.
2. **Optimistic with constrained recovery:** permit bounded provisional effects; monitor propagation; reserve cost and plausible remedy capacity; compensate, restore or conciliate when necessary.
3. **Preventive boundary:** demand stronger authorization and provider enforcement when the potential harm is irreversible, violates rights, or cannot legitimately be shifted to another principal.

No optimistic posture makes a revoked mandate valid, and recovery cannot retrospectively authorize an impermissible violation. This is a **risk-based choice of controls**, not a universal exception to authority rules.

**Hypothesis:** compared with mandatory serializable cross-provider locking everywhere, this spectrum may preserve more useful capacity, attention and serendipitous learning at tolerable harm/cost. Test outcomes and counterexamples in ordinary work before claiming improvement. The costs of locking, coordination, retries, human approval and recovery must all be accounted for, including unknown dimensions.
