---
title: DHITL — Pilotes de Corte
subtitle: Constitution expérimentale par proximité, mandat réel et adhésion volontaire
author: Jean Hugues Noël Robert
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
date: '2026-07-20'
version: '0.1'
status: working-note — protocole d'expérimentation
license: CC BY-SA 4.0
canonical_url: https://github.com/JeanHuguesRobert/inseme/blob/main/research/dhitl_pilots_corte.md
document_role: source
document_kind: implementation-note
visibility: public
lifecycle_state: working
related_documents:
  - https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/transition_possibiliste_vers_une_democratie_augmentee.md
  - https://github.com/JeanHuguesRobert/cogentia/blob/main/research/ia_pour_tous_ia_pour_chacun.md
  - https://github.com/JeanHuguesRobert/marenostrum/blob/main/research/DHITL.md
  - https://github.com/JeanHuguesRobert/marenostrum/blob/main/research/dhitl-membership-and-federation.md
  - ../packages/cop-core/Invariants.md
classification_source: cogentia.js
classification_version: '1'
classification_rule: explicit-metadata
classification_confidence: medium
language: fr
update_policy: UP-DEFAULT-REVIEWED
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


# DHITL — Pilotes de Corte

## Objet

Ce document décrit une méthode provisoire pour expérimenter DHITL dans des communautés réelles
situées à Corte.

Il ne prétend pas résoudre abstraitement la question du pouvoir constituant initial. Il part d'un
constat : une institution démocratique complète ne peut pas être décrétée par son initiateur, mais
l'attente de cette institution complète empêcherait toute expérimentation susceptible d'en démontrer
la possibilité.

La stratégie est donc :

> **Commencer dans les périmètres où un mandat réel peut être obtenu, rendre l'expérience
> vérifiable, laisser l'adhésion volontaire produire l'extension et fédérer progressivement les
> expériences qui le souhaitent.**

Formule populaire : **« Qui m'aime me suive. »**

Cette formule signifie ici : personne n'est obligé de participer ; l'initiateur ne reçoit aucune
autorité implicite sur les autres ; les méthodes et résultats doivent être reprenables, contestables
et forkables.

---

## 1. Terrains initiaux

Les terrains envisagés couvrent volontairement plusieurs types de sujets et de communautés.

| Terrain | Type | Question expérimentale principale |
|---|---|---|
| Jean Hugues Noël Robert | personne physique | Une IA personnelle et plusieurs agents peuvent-ils augmenter une personne sans substituer leur jugement au sien ? |
| Copropriété du 1 cours Paoli | communauté matérielle de proximité | Les demandes, incidents, responsabilités, échéances et décisions peuvent-ils devenir plus lisibles et corrigibles ? |
| Commune de Corte | communauté politique territoriale | Une infrastructure civique ouverte peut-elle augmenter la capacité de participation et d'audit des habitants ? |
| Université de Corse | communauté de connaissance | Étudiants, chercheurs et administration peuvent-ils produire des connaissances et continuations publiques mieux traçables ? |
| Association C.O.R.S.I.C.A. | association | Les mandats, services, actes et résultats peuvent-ils être suivis sans bureaucratiser l'action ? |
| Fonds de dotation Barons Mariani | personne morale patrimoniale et doctrinale | Une personne morale peut-elle agir avec des répondants humains, des mandats explicites et une mémoire longue opposable ? |
| Fonds de dotation Les Amis de Malou | personne morale mémorielle et d'intérêt général | Comment préserver une finalité, une mémoire et des œuvres sans produire de souveraineté posthume artificielle ? |

La présence dans ce tableau n'emporte aucun accord ni mandat. Chaque expérimentation ne commence qu'après identification de l'autorité compétente et consentement explicite des participants nécessaires.

---

## 2. Invariants

Chaque pilote doit respecter au minimum :

1. **Mandat réel** — aucune action au nom d'une personne ou communauté sans source d'autorité identifiable.
2. **Adhésion volontaire** — les participants connaissent le but, les outils, les traces et les voies de sortie.
3. **Une personne vivante, une voix** — les agents et personnes morales ne reçoivent pas de voix souveraine propre.
4. **IA subordonnée** — l'IA cherche, résume, critique, simule et prépare ; les actes engageants restent validés par un humain ou un organe compétent.
5. **Séparation des capacités** — lire, rédiger, publier, dépenser, signer et agir sont des droits distincts.
6. **Trace proportionnée** — les actes significatifs sont traçables ; les micro-événements sans effet ne sont pas transformés en bureaucratie.
7. **Contestation** — toute personne affectée dispose d'une voie lisible pour objecter, demander correction ou signaler un abus.
8. **Révocabilité** — mandats, délégations, accès et agents peuvent être suspendus ou révoqués.
9. **Protection des tiers** — la souveraineté cognitive d'un participant ne donne aucun droit nouveau sur les autres.
10. **Fork et sortie** — les données et règles nécessaires à la continuité doivent être exportables selon les droits applicables.
11. **Honnêteté de maturité** — un prototype n'est pas présenté comme une garantie juridique ou un système de production achevé.
12. **Résultats publics lorsque possible** — les succès, échecs, coûts, incidents et corrections sont documentés.

---

## 3. Fiche minimale d'un pilote

```yaml
dhitl_pilot:
  id: "pilot-..."
  title: "..."
  community:
    name: "..."
    type: "person | copropriete | commune | universite | association | fonds | other"
    affected_public: []
  initiator:
    actor: "..."
    role: "..."
    authority_source: "..."
  mandate:
    purpose: "..."
    allowed_actions: []
    forbidden_actions: []
    begins_at: "..."
    expires_at: "..."
    revocation_path: "..."
  participation:
    voluntary_participants: []
    consent_record: "..."
    membership_rule: "..."
    exit_path: "..."
  problem:
    current_state: "..."
    incapacity_or_dependency: "..."
    capability_to_increase: "..."
  ai:
    agents: []
    providers: []
    read_scope: []
    draft_scope: []
    publish_scope: []
    act_scope: []
    human_validation_required_for: []
  traces:
    public: []
    private: []
    confidential: []
    retention_rule: "..."
  accountability:
    human_respondent: "..."
    objection_path: "..."
    appeal_or_review: "..."
  evaluation:
    baseline: "..."
    indicators: []
    known_risks: []
    stop_conditions: []
  status: "proposed | consent-seeking | active | suspended | completed | abandoned"
  continuation: "..."
```

---

## 4. Ce qu'il faut mesurer

Les résultats ne parlent d'eux-mêmes que si le point de départ et les transformations sont observables.

### 4.1. Gain de capacité

- temps humain libéré ;
- démarches ou décisions devenues possibles ;
- accès à des informations auparavant difficiles à trouver ;
- ressources de compute effectivement mobilisables ;
- capacité de reprendre un travail après suspension ;
- diminution d'une dépendance à un fournisseur ou intermédiaire.

### 4.2. Qualité démocratique

- personnes affectées correctement identifiées ;
- participation et abstention ;
- objections reçues et traitées ;
- décisions corrigées ;
- délégations révoquées ou renouvelées ;
- concentration de la recommandation ou de la capacité d'action ;
- capacité réelle de quitter ou forker.

### 4.3. Imputabilité

- proportion d'actes engageants ayant un mandat et un répondant ;
- délais et échéances visibles ;
- correspondance entre décision annoncée et exécution ;
- incidents, contre-événements et réparations ;
- capacité à reconstruire pourquoi une décision a été prise.

### 4.4. Coût et charge

- coût monétaire ;
- compute consommé ;
- temps de supervision ;
- fatigue ou surcharge informationnelle ;
- complexité ajoutée ;
- dépendances techniques créées.

Un pilote qui produit davantage de traces que les participants ne peuvent gouverner recrée l'opacité qu'il prétend combattre.

---

## 5. Déroulement recommandé

```text
proposition
→ identification du mandat et du public affecté
→ consentement et état initial
→ définition des capacités IA
→ expérimentation bornée
→ événements et artefacts COP
→ décisions humaines explicites
→ objections et corrections
→ mesure des résultats
→ décision : arrêter, reprendre, étendre ou fédérer
```

Chaque pilote devrait commencer petit, avec un problème réel, une durée bornée et une capacité de retour en arrière.

La première réussite recherchée n'est pas l'adoption générale. C'est une boucle complète et honnête : mandat, action, trace, réaction, correction, résultat et continuation.

---

## 6. Constitution progressive

L'autorité de l'initiateur ne doit pas croître silencieusement avec le succès du système.

À chaque extension, le pilote doit préciser :

- ce qui reste sous l'autorité de l'initiateur ;
- ce qui est transféré aux participants ;
- qui peut modifier les règles ;
- comment un nouveau membre entre ou sort ;
- comment les conflits sont arbitrés ;
- à partir de quel seuil une fédération devient nécessaire ;
- comment les opérateurs techniques peuvent être remplacés.

La constitution n'apparaît pas d'un seul coup. Elle se forme par une série d'actes explicites de transfert, de limitation et de fédération.

Un succès technique ne vaut jamais transfert implicite de souveraineté.

---

## 7. Relation à COP, Archia et Inseme

- **COP** doit enregistrer et relier événements, tâches, étapes, artefacts, décisions humaines et continuations.
- **Archia** doit fournir la mémoire longue des mandats, actes, preuves, échéances, objections, corrections et résultats.
- **Inseme** doit fournir les surfaces permettant aux personnes et communautés de participer, comprendre et contester.
- **Kudocracy** peut structurer recommandations, délégations et votations révocables.
- **Cogentia** peut assister les personnes et préserver leurs continuations sans absorber leurs Corpus dans une mémoire collective.

Le pilote doit pouvoir fonctionner avec des composants incomplets et déclarer honnêtement ses modes dégradés. Il ne doit pas attendre l'achèvement de toute l'architecture pour tester une boucle simple.

---

## 8. Premières expérimentations possibles

Sans préjuger des accords nécessaires :

1. **Pilote personnel** — un acte public préparé par plusieurs agents, arbitré par Jean Hugues Noël Robert, avec mandat, objections, choix et publication tracés.
2. **C.O.R.S.I.C.A.** — registre borné de demandes ou services : responsable, bénéficiaire, échéance, preuve, résultat et retour d'expérience.
3. **1 cours Paoli** — suivi d'un incident matériel ou d'une demande de copropriété sans publier les données personnelles inutiles.
4. **Fonds Barons Mariani** — acte patrimonial ou doctrinal avec personne morale représentée, mandataire humain, bénéficiaire et justification distincts.
5. **Université de Corse** — atelier étudiant produisant une objection, un audit ou une continuation publique sur un pilote existant.
6. **Commune de Corte** — import et navigation publique d'actes déjà accessibles, avant toute proposition de processus décisionnel nouveau.
7. **Les Amis de Malou** — charte de mémoire et de continuation distinguant témoignage, simulation, décision et souveraineté des vivants.

---

## 9. Conditions d'arrêt

Un pilote doit pouvoir être suspendu si :

- son mandat devient incertain ;
- les personnes affectées n'ont pas été correctement identifiées ;
- un agent agit au-delà de son autorisation ;
- la protection des données ou des tiers n'est plus assurée ;
- les participants ne peuvent plus comprendre ou gouverner les sorties ;
- la trace devient une surveillance disproportionnée ;
- l'opérateur technique devient irremplaçable ;
- le coût dépasse manifestement le gain de capacité ;
- une objection sérieuse ne dispose d'aucune voie de traitement.

L'abandon documenté d'un pilote est un résultat utile, non un échec à cacher.

---

## Continuation

Les prochaines étapes sont :

1. choisir un premier pilote disposant déjà d'un mandat clair ;
2. remplir la fiche YAML ;
3. définir trois à cinq indicateurs mesurables ;
4. identifier les événements et artefacts COP nécessaires ;
5. tester une boucle complète sans automatisation excessive ;
6. publier un retour d'expérience ;
7. décider explicitement de l'arrêt, de la reprise, de l'extension ou de la fédération.

