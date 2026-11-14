---
title: "COP / FractaLog — Mandats et continuité historique proportionnée"
author: "Jean Hugues Noël Robert, baron Mariani"
date: "2026-11-14"
last_modified_at: "2026-11-14"
version: "0.1"
status: "working-paper — architectural decision"
document_role: operational
document_kind: architecture-decision
visibility: public
language: fr
license: CC BY-SA 4.0
review:
  status: proposed
  reviewed_by: []
---

# COP / FractaLog — Mandats et continuité historique proportionnée

## Décision du 14 novembre 2026

**On ne réécrit pas l'histoire.** Toute correction, contestation, suspension, révocation ou réconciliation se traduit par un **nouvel événement** référencé aux faits antérieurs ; la projection de l'état courant peut évoluer sans effacer la trace de ses états passés. Le Principal lui-même ne possède pas de permission ordinaire de réécriture rétroactive des actes canoniques.

**Proportionnalité assumée.** L'objectif immédiat est un journal local horodaté, chaîné cryptographiquement, vérifiable et compatible avec les traces causales fractales. On ne requiert ni ordre total global, ni blockchain distribuée, ni preuve de travail, ni témoin ou horodatage externe obligatoire. Un attaquant contrôlant simultanément les événements, leurs engagements locaux et les clés reste capable de forger une histoire cohérente : cette limite est connue, acceptée temporairement et ne doit jamais être présentée comme une impossibilité mathématique.

## Identité, mandat et actes

1. **Provenance :** le Principal approuve une proposition précise depuis un canal d'émission indépendant du mandat qu'il accorde. La signature vérifiée contre une clé publique de confiance prouve l'usage de la clé privée ; elle ne prouve pas à elle seule la présence physique ou l'intention humaine, ni l'innocuité du poste de signature.
2. **Portée :** un mandat précise Principal, mandataire, finalité, version, durée, capacités, interdictions, délégation et plafond de ressources. Un amendement élargissant les droits demande une nouvelle preuve attachée à la proposition exacte et à sa filiation ; une sous-délégation ne crée pas de pouvoirs absents du parent.
3. **Admission :** l'existence d'un outil, d'une session MCP ou d'une signature n'est jamais une autorisation suffisante. Chaque acte exige vérification de l'identité du mandataire, de la version courante, des révocations, de la capacité, des budgets, réservations et des effets observables.
4. **Indépendance MCP :** créer, modifier, suspendre, révoquer ou expirer un mandat est une opération sur les données de contrôle, **sans redémarrage du MCP ni rechargement du connecteur**. Un déploiement de code ou une modification du schéma des outils peut nécessiter une intervention distincte.
5. **Traçabilité :** déclaration, tentative, décision, refus, effet observé, comptabilité et correction sont des événements différents. Une déclaration de succès ou un accusé de transport ne prouvent pas automatiquement l'effet réel.

## Chaînes locales, temps et causalité

Les événements COP possèdent déjà des dates (dont time.recorded_at) et peuvent référencer causation_id, parent_event_ids, correlation_id et mandate_ref. Chaque document FractaLog possède un document_hash couvrant son contenu et ses dates. La date incluse dans une empreinte résiste à une altération **isolée** ; l'horloge initiale n'est pas pour autant certifiée.

Dans le magasin SQLite COP, les engagements SHA-256 sont chaînés **par topic** dans la transaction de l'ajout d'événement. La valeur du head suivant dépend de la valeur précédente et des octets JSON de l'événement. La table cop_topic_commitments conserve séquence, empreinte de tête et date. Cela fournit un ordre local et des références causales sans exiger de séquence globale.

Le profil FractaLog distingue les faits source locaux des projections fédérées. Une projection, une copie de consultation ou un index ne devient pas un second journal d'autorité.

## Implémentation constatée au 14 novembre 2026

- Inseme : packages/cop-core/src/fractalog.js valide l'empreinte d'un document d'acte ; sqlite-cop-event-store.js écrit des engagements par topic, atomiquement. Ses méthodes auditTopicCommitment et auditCommitments recalculent les chaînes, contrôlent séquences, enveloppes et documents FractaLog ; l'audit n'est pas un témoin indépendant.
- Inseme : fractalog-spool.js permet une reprise dégradée sans imposer de synchronisation d'horloge ou d'ordre global.
- Cogentia : le Principal a effectivement signé le mandat JHN root v2 le 14 novembre, avec une seule capacité supplémentaire de retour de résultats de continuation. La filiation v1 vers v2 a été vérifiée indépendamment ; l'admission du résultat MCP lit dynamiquement la version courante et sa révocation, sans rechargement du connecteur (code et tests, **pas** preuve de déploiement de l'outil en production).
- Tests Inseme : modification d'événement, suppression intermédiaire, altération du hash FractaLog détectées sur des bases jetables ; 171 tests COP-core Vitest et 12 tests Node ciblés réussis. Pas d'audit exhaustif du stockage de production.

## Risques acceptés et limites non escamotables

Le chaînage local ne détecte pas nécessairement une réécriture **simultanée** des événements et des engagements, la suppression totale d'un topic, l'absence d'instrumentation d'un acte, le détournement de la clé de signature, ni une date volontairement fausse à l'origine. Le Principal peut techniquement disposer d'un accès administrateur capable de contourner les règles applicatives ; aucune déclaration de protection contre lui-même ne doit masquer cette dépendance.

La confidentialité, les obligations légales de conservation et d'effacement, les corrections et la traçabilité exigent de distinguer le contenu sensible de la preuve d'un acte. Une demande légitime d'effacement peut créer un événement de rectification ou d'effacement et laisser une preuve minimale lorsque la loi le permet ; aucune obligation universelle de conservation perpétuelle n'est créée ici.

## Priorités, sans perfectionnisme bloquant

**Maintenant :** renforcer les points de contrôle déjà présents, tester les chemins effectifs d'enregistrement et reprendre le déploiement de capacités utiles. **Différé :** contrôles sur instantané purement read-only, engagements anti-rollback hors stockage, attestations temporelles indépendantes, témoins et vérification inter-nœuds. Ces améliorations n'empêchent pas d'avancer.

## Paquets et documents liés

- Inseme #59 : https://github.com/JeanHuguesRobert/inseme/issues/59
- Inseme #113 : https://github.com/JeanHuguesRobert/inseme/issues/113
- Cogentia #299 : https://github.com/JeanHuguesRobert/cogentia/issues/299
- Cogentia #330 : https://github.com/JeanHuguesRobert/cogentia/issues/330
- FractaLog : docs/fractalog-act-catalog.md ; research/cop_fractalog_profile.md
- Mandat : https://github.com/JeanHuguesRobert/cogentia/blob/main/research/mandate_reasonable_agency.md
