---
title: "COP/Accounting — Instant Zéro de développement"
date: "2026-10-15"
document_role: operational
document_kind: design-decision
status: proposed
related: ["#161", "#162", "#163", "#164"]
---

# Instant Zéro : frontière de comptabilité expérimentale

## Décision de conception

Pendant le développement, un nouveau registre COP expérimental peut commencer avec un **Instant Zéro (Z0)** explicite, sans reprise des écritures et soldes antérieurs dans ses projections. Il ne s'agit ni d'une suppression de traces, ni d'une remise à zéro des obligations légales éventuelles : les données historiques restent consultables dans une archive technique indépendante et leur provenance est conservée.

Le `Z0` n'est **pas** une date implicite. C'est un événement durable `accounting.epoch.opened`, muni d'un `epoch_id` stable, d'un `effective_at`, d'une référence de mandat, d'un schéma et d'un identifiant idempotent. Son instant ne doit pas être antidaté. La première écriture du nouveau registre vient après cet événement.

## Invariants minimaux

1. Toute écriture, réservation, projection, dépense et imputation du nouveau registre porte un `epoch_id`. Les requêtes de solde et de disponibilité sont explicitement filtrées par cet identifiant. Aucun mélange inter-époques.
2. Le nouveau registre est initialisé avec des soldes opérationnels **nuls seulement si aucune ressource réelle préexistante n'y est représentée**. Le zéro comptable expérimental ne signifie pas absence de dettes, coûts ou engagements externes. Les budgets sont des **grants explicites**, jamais déduits du zéro.
3. Les événements antérieurs à Z0 sont préservés pour la Traçabilité des Actes et les enquêtes Janus, mais exclus des nouveaux soldes et budgets. L'archive peut contenir des incohérences historiques sans bloquer le nouveau départ.
4. Les enregistrements nouveaux sont append-only et idempotents. Les projections sont reconstructibles depuis les événements **de la même époque**. L'atomicité des réservations et des écritures concurrentes reste une exigence P0/P1 : Z0 ne répare pas les races.
5. Le `mandate_ref`, `budget_ref`, `packet_id`, `act_ref`, les unités et leur mesure (observed/estimated/unknown) restent explicitement imputables dès Z0. Les coûts inconnus ne deviennent pas zéro.
6. Pour un futur Z1, ouvrir un nouveau registre isolé, sans écraser Z0. Toute reprise d'engagement réel requiert un **événement de transfert explicite**, sinon l'ancien état est archivé sans report.
7. Toute interprétation fiscale, légale ou statutaire relève de l'entité concernée, distincte de ce reset **strictement technique**.

## Plan FBF modifié

- **#162 P0** : privilégier une migration/structure `epoch_id` et un nouveau projecteur transactionnel, plutôt que réparer immédiatement la base historique. Tester les frontières entre époques, crash, concurrence et reconstruction. Conserver une requête d'audit historique comme diagnostic non bloquant.
- **#163 P1** : ouvrir un budget de développement et établir une réservation atomique au sein de Z0 ; budgets/mandats effectifs, même en expérimentation.
- **#164 P2** : rattacher GitHub Compute aux écritures de Z0. Le calcul historique #120 reste une étude Janus, sans entrée automatique dans les soldes du nouveau registre.

## Critère de bascule

Le système ne déclare Z0 **effectif** qu'après persistance vérifiée de l'événement d'ouverture et test de lecture/écriture/rejeu de sa première opération. Tant que ce test n'a pas eu lieu, Z0 n'est qu'une convention proposée.
