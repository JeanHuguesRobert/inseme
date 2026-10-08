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
