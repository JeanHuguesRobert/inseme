---
title: 🎯 Kit de Survie du Citoyen Alerte
author: Jean Hugues Noël Robert, baron Mariani
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
date: '2026-09-15'
last_modified_at: '2026-09-15'
version: '0.1'
status: working-paper
license: CC BY-SA 4.0
language: fr
document_role: archive
document_kind: software-doc
update_policy: UP-DEFAULT-REVIEWED
provenance:
  origin_type: repository
  origin_repository: unknown
  origin_ref: unknown
  origin_date: '2026-09-15'
  derived_from: []
review:
  status: unreviewed
  reviewed_by: []
---

# 🎯 Kit de Survie du Citoyen Alerte

## Guide exhaustif des services de la plateforme Kudocracy.Survey

> **Version**: 1.0 **Date**: Décembre 2025 **Objectif**: Documenter tous les outils et services
> offerts aux citoyens pour une gestion efficace de leur communauté.

---

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Participation démocratique](#1-participation-démocratique)
3. [Espace social et communautaire](#2-espace-social-et-communautaire)
4. [Transparence et contrôle citoyen](#3-transparence-et-contrôle-citoyen)
5. [Action citoyenne](#4-action-citoyenne)
6. [Information et connaissance](#5-information-et-connaissance)
7. [Assistant IA](#6-assistant-ia)
8. [Outils personnels](#7-outils-personnels)
9. [Fonctionnalités transversales](#8-fonctionnalités-transversales)
10. [Synthèse par cas d'usage](#synthèse-par-cas-dusage)

---

## Vue d'ensemble

La plateforme Kudocracy.Survey est un **commun numérique open source** qui offre aux citoyens un
ensemble complet d'outils pour :

- **Participer** aux décisions collectives
- **S'informer** sur la vie locale
- **Contribuer** à la documentation communautaire
- **Contrôler** l'action publique
- **S'organiser** pour des actions citoyennes

---

## 1. Participation démocratique

### 1.1 📊 Consultations citoyennes

**Route**: `/`, `/consultations`, `/consultation/:id`

**Description**: Système de sondages et enquêtes pour recueillir l'avis des citoyens sur des sujets
locaux, régionaux ou nationaux.

**Fonctionnalités**:

- ✅ Participation anonyme (optionnel)
- ✅ Questions à choix multiples, échelles de Likert, texte libre
- ✅ Visualisation des résultats en temps réel (graphiques)
- ✅ **Consultations fédérées** : portée locale, régionale ou nationale
- ✅ Indicateur "Vous avez déjà participé"
- ✅ Consultation vedette aléatoire en page d'accueil
- ✅ Liens vers des **pétitions externes** (Change.org, MesOpinions, Sénat, Assemblée nationale)

**Pour qui**: Tout citoyen souhaitant donner son avis

---

### 1.2 🗳️ Kudocracy — Vote et délégation

**Route**: `/kudocracy`, `/propositions/:id`

**Description**: Système de démocratie liquide permettant de voter directement ou de déléguer son
vote. La démocratie liquide combine le vote direct et la délégation : vous pouvez voter vous-même
sur chaque proposition, ou confier votre voix à une personne de confiance qui votera en votre nom.

**Fonctionnalités principales du système Kudocracy** : | Fonction | Description |
|----------|-------------| | **Voter directement** | Approuver ou désapprouver une proposition | |
**Déléguer sa voix** | Confier son vote à une personne de confiance sur un sujet | | **Créer une
proposition** | Soumettre une idée au vote de la communauté | | **Modifier son vote** | Tous les
votes sont réversibles | | **Liens pétitions** | Relier une proposition à une pétition externe |

**Onglets disponibles**:

1. **Propositions** — Liste de toutes les propositions
2. **Formuler une proposition** — Créer une nouvelle idée
3. **Vos délégations** — Gérer à qui vous confiez votre vote
4. **Votre activité** — Tableau de bord de vos votes

**Transparence**: Tous les votes sont publics pour garantir l'auditabilité.

---

## 2. Espace social et communautaire

### 2.1 ☕ Café Pertitellu — Le réseau social local

**Route**: `/social`, `/groups/:id`, `/posts/:id`

**Description**: Espace de discussion et d'échange entre citoyens, organisé par groupes thématiques.

**Types de groupes**:

- 🏘️ **Quartiers** — Discussion par zone géographique
- 🤝 **Associations** — Groupes associatifs
- 💬 **Forums** — Discussions thématiques
- 📰 **Gazettes** — Groupes éditoriaux

**Types de publications**:

- 📝 **Blogs** — Articles longs avec mise en forme
- 💬 **Discussions** — Forums classiques
- 📢 **Annonces** — Communications importantes

**Fonctionnalités sociales**:

- Commentaires imbriqués (threads)
- Réactions emoji (👍 ❤️ 😂 😮 😢 😡)
- Adhésion/sortie de groupes
- Épinglage et verrouillage de posts (modération)
- Lien vers pages Wiki ou propositions

---

### 2.2 📰 La Gazette — Journal local

**Route**: `/gazette`, `/gazette/:name`

**Description**: Publication hebdomadaire au format journal, organisée par semaines.

**Fonctionnalités**:

- Navigation par semaine (archives)
- Filtrage par Gazette (globale, liées à un groupe d'éditeurs)
- Mode éditeur pour les membres du groupe rédactionnel
- Lien vers l'agenda des événements de la semaine
- Style visuel "journal papier" (Playfair Display, Cinzel)

---

### 2.3 📆 Agenda citoyen

**Route**: `/agenda`

**Description**: Calendrier de tous les événements publiés sur la plateforme.

**Fonctionnalités**:

- Vue **liste** ou **carte** interactive
- Filtrage par Gazette (groupe d'éditeurs)
- Distinction événements à venir / passés
- Géolocalisation des événements
- Contribution citoyenne : "📍 Je sais où c'est !"
- Lien vers la discussion associée

---

### 2.4 🚨 Centre des incidents

**Route**: `/incidents`, `/incidents/:id`, `/incidents/new`

**Description**: Signalement et suivi des incidents urbains (voirie, sécurité, environnement...). Le
centre des incidents permet aux citoyens de signaler des problèmes dans leur quartier et de suivre
leur résolution.

**Fonctionnalités du centre des incidents** : | Fonction | Description | |----------|-------------|
| **Déclarer un incident** | Créer un signalement géolocalisé | | **Statuts** | Ouvert →
Investigation → Surveillance → Résolu | | **Sévérité** | Faible, Modérée, Élevée, Critique | | **Vue
carte** | Visualisation géographique des incidents | | **Contributions** | Correction/ajout de
localisation | | **Filtrage** | Par Gazette / statut |

**Champs d'un incident**:

- Titre et sous-titre
- Impact et contact
- Prochaine mise à jour prévue
- Localisation (avec géocodage)

---

## 3. Transparence et contrôle citoyen

### 3.1 🔍 Observatoire de transparence, questionaire national

**Route**: `/transparence`

**Description**: Évaluation de la transparence municipale selon 6 critères objectifs.

**Critères évalués**:

1. L'ordre du jour mentionne le lieu de réunion
2. Diffusion en direct (livestream)
3. Procès-verbaux publiés sous 7 jours
4. Délibérations en open data
5. Calendrier annuel publié
6. Possibilité de prise de parole du public

**Fonctionnalités**:

- Score de transparence (0-6)
- Comparaison avec la moyenne nationale
- Contribution citoyenne (ajouter/mettre à jour une commune)
- Tableau des communes référencées

---

### 3.2 🏛️ Contrôle des actes municipaux

**Route**: `/actes/*`, `/demandes/*`, `/moderation/*`

**Description**: Système complet de suivi des actes administratifs avec traçabilité juridique. Ce
module permet de suivre les délibérations, arrêtés et décisions de la mairie, de faire des demandes
d'accès aux documents administratifs (CRPA - Code des Relations entre le Public et
l'Administration), et de préparer des recours si nécessaire.

**Acronymes importants** :

- **CRPA** : Code des Relations entre le Public et l'Administration (droit d'accès aux documents)
- **CADA** : Commission d'Accès aux Documents Administratifs (autorité indépendante)
- **TA** : Tribunal Administratif (juridiction de recours)
- **CGCT** : Code Général des Collectivités Territoriales

#### Services pour tous les citoyens

Tous les citoyens peuvent consulter les actes municipaux et suivre les demandes administratives,
même sans être connectés :

| Route                | Service         | Description                              |
| -------------------- | --------------- | ---------------------------------------- |
| `/actes`             | Tableau de bord | Vue d'ensemble, échéances, alertes       |
| `/actes/liste`       | Liste des actes | Parcourir tous les actes enregistrés     |
| `/actes/chronologie` | Timeline        | Visualisation interactive des événements |
| `/actes/stats`       | Statistiques    | Indicateurs clés et tendances            |
| `/demandes`          | Demandes CRPA   | Suivi des demandes d'accès aux documents |

#### Services pour contributeurs (connectés)

Les utilisateurs connectés peuvent contribuer en ajoutant des actes à suivre, en faisant des
demandes CRPA, ou en téléversant des preuves :

| Route                | Service               | Description                            |
| -------------------- | --------------------- | -------------------------------------- |
| `/actes/nouveau`     | Ajouter un acte       | Enregistrer un acte à suivre           |
| `/demandes/nouvelle` | Nouvelle demande CRPA | Demander un document administratif     |
| `/preuves/ajouter`   | Ajouter une preuve    | Téléverser captures, emails, documents |
| `/exports/pdf`       | Générer un PDF        | Créer un dossier pour recours          |

#### Délais légaux à connaître

Les délais légaux pour les procédures administratives sont stricts. Voici les principaux délais à
retenir pour exercer vos droits de citoyen :

| Situation                | Délai    | Conséquence si non respecté  |
| ------------------------ | -------- | ---------------------------- |
| Transmission préfecture  | 15 jours | Acte non exécutoire          |
| Réponse demande CRPA     | 1 mois   | Saisine CADA possible        |
| Avis CADA                | 1 mois   | —                            |
| Recours gracieux         | 2 mois   | Recours contentieux possible |
| Recours contentieux (TA) | 2 mois   | Forclusion                   |

---

## 4. Action citoyenne

### 4.1 🎯 Missions bénévoles

**Route**: `/missions`, `/missions/:id`, `/missions/new`

**Description**: Plateforme d'organisation d'actions collectives pour la communauté.

**Fonctionnalités**:

- Créer une mission avec lieu, date, objectifs
- Rejoindre une mission existante
- Statuts : Ouverte, En cours, Terminée
- Filtrage : Toutes / Missions ouvertes
- Lien vers un projet de tâches Kanban

**Cas d'usage**: Nettoyage de quartier, aide aux personnes âgées, événement culturel...

---

### 4.2 📋 Gestion de projets (Kanban)

**Route**: `/tasks`, `/tasks/:id`, `/tasks/new`

**Description**: Tableaux Kanban pour organiser le travail citoyen en équipe.

**Colonnes par défaut**:

- À faire (Todo)
- En cours (In Progress)
- En revue (Review)
- Terminé (Done)
- Bloqué (Blocked)

**Fonctionnalités**:

- Création de projets
- Assignation de tâches
- Liaison avec une mission
- Statistiques par projet
- Filtres : Tous / Mes projets / Archivés

---

### 4.3 ✊ Pétitions (intégration externe)

**Description**: Liens vers les principales plateformes de pétitions, intégrés aux consultations et
propositions. La plateforme ne gère pas directement les pétitions mais permet de relier vos
consultations et propositions aux grandes plateformes de pétitions existantes.

**Plateformes de pétitions supportées** (liens externes) : | Plateforme | Portée | URL |
|------------|--------|-----| | Change.org | Internationale | change.org | | MesOpinions | France |
mesopinions.com | | Sénat | Nationale | petitions.senat.fr | | Assemblée nationale | Nationale |
petitions.assemblee-nationale.fr |

**Intégration**:

- Chaque consultation peut avoir 3 liens pétition (local, régional, national)
- Chaque proposition Kudocracy peut être liée à une pétition
- Détection automatique de la plateforme

---

## 5. Information et connaissance

### 5.1 📖 Wiki collaboratif

**Route**: `/wiki`, `/wiki/:slug`, `/wiki/new`, `/wiki/:slug/edit`

**Description**: Base de connaissances collaborative, mémoire collective de la communauté.

**Fonctionnalités**:

- Création/édition de pages en Markdown
- Recherche instantanée
- Tri par date de modification, titre, date de création
- Vue grille ou liste
- Historique des modifications
- Partage sur réseaux sociaux
- Liens internes entre pages (`[[Nom de page]]`)
- Liens externe automatique vers les domaines englobants éventuels

**Cas d'usage**: Comptes rendus, fiches pratiques, documentation de quartier, guides...

---

### 5.2 📰 Fil d'information (Le Fil)

**Route**: `/fil`, `/fil/:id`, `/fil/stories`

**Description**: Flux d'actualités et d'informations locales (type RSS enrichi).

**Fonctionnalités**:

- Création d'items d'information
- Vue stories (format court)
- Intégration avec sources externes

---

## 6. Assistant IA

### 6.1 🤖 Ophélia (aussi appelée Bob)

**Route**: `/bob`

**Description**: Ophélia est l'assistant IA conversationnel de la plateforme. Elle répond aux
questions des citoyens, en s'appuyant sur la base de connaissances locale (Wiki, consultations,
propositions, documents ingérés). Plus la communauté enrichit le contenu de la plateforme, plus
Ophélia devient pertinente et précise dans ses réponses.

**Ce qu'Ophélia peut faire pour vous** :

- Répondre à vos questions sur la vie locale
- Vous aider à formuler une idée ou une proposition
- Vous guider vers les bonnes démarches administratives
- Relire et améliorer vos propositions avant publication
- Afficher son "raisonnement" pour plus de transparence (mode Réflexion)

**Sources de connaissances d'Ophélia** (RAG - Retrieval-Augmented Generation) :

- Pages du Wiki collaboratif
- Documents officiels ingérés (procès-verbaux, délibérations...)
- Consultations citoyennes
- Propositions Kudocracy

**Comment améliorer Ophélia** : Plus la communauté enrichit le Wiki, les consultations et les
documents, plus Ophélia devient pertinente et précise dans ses réponses.

---

### 6.2 🔌 Widget intégrable

**Route**: `/widget/`

**Description**: Possibilité d'intégrer Ophélia sur des sites web externes.

---

## 7. Outils personnels

### 7.1 📊 Tableau de bord utilisateur

**Route**: `/user-dashboard`

**Description**: Vue consolidée de toute votre activité sur la plateforme. Le tableau de bord
personnel rassemble toutes vos contributions et permet de suivre votre engagement citoyen.

**Sections du tableau de bord utilisateur** :

| Section                       | Contenu                                                           |
| ----------------------------- | ----------------------------------------------------------------- |
| **Vos missions**              | Missions rejointes, statut, lieu                                  |
| **Vos tâches Kanban**         | Tâches assignées, projet, statut                                  |
| **Statistiques personnelles** | Propositions, votes, délégations, posts, commentaires, pages Wiki |
| **Distribution des votes**    | Graphique camembert (Pour/Contre/Blanc)                           |
| **Activité récente**          | Timeline des 30 derniers jours                                    |

**Actions rapides**:

- 💡 Formuler une proposition
- 🤝 Gérer les délégations
- 💬 Publier un article
- 📝 Créer une page Wiki

---

### 7.2 🔔 Abonnements et notifications

**Route**: `/subscriptions`

**Description**: Système d'abonnement universel pour suivre n'importe quel contenu.

**Types de contenus suivables**:

- 💬 Posts
- 💡 Propositions
- 📄 Pages Wiki
- 👥 Groupes
- 🎯 Missions
- 📋 Projets de tâches
- 👤 Utilisateurs
- 🏷️ Tags

**Fonctionnalités**:

- Compteur de non-lus
- Flux d'activité personnalisé
- Filtrage par type de contenu
- Gestion (désabonnement)
- Aperçu de la dernière activité

---

### 7.3 👤 Profil utilisateur

**Route**: `/profile`, `/users/:id`

**Description**: Gestion des informations personnelles et page de profil public.

**Informations**:

- Nom d'affichage
- Quartier
- Centres d'intérêt
- Avatar
- Conformité RGPD

---

## 8. Fonctionnalités transversales

### 8.1 🗺️ Cartographie citoyenne

**Composant**: `CitizenMap`

**Description**: Carte interactive utilisée dans plusieurs modules.

**Utilisations**:

- Visualisation des incidents
- Localisation des événements
- Missions géolocalisées

**Fonctionnalités**:

- Calques spécialisés (IncidentsLayer, EventsLayer)
- Contribution citoyenne de localisation
- Zoom sur un point spécifique

---

### 8.2 📱 Partage social

**Composant**: `ShareModal`

**Description**: Partage de contenus sur les réseaux sociaux.

**Plateformes**:

- Facebook
- Twitter/X
- LinkedIn
- Email
- Copie du lien

---

### 8.3 🔐 Authentification

**Description**: Système d'authentification via Supabase Auth.

**Options**:

- Email/mot de passe
- Connexion sociale Facebook (configurable)

**Niveaux de permissions**:

- Lecture publique (transparence)
- Écriture (utilisateurs authentifiés)
- Édition de son propre contenu
- Administration (modération)

---

### 8.4 📧 Contact

**Route**: `/contact`

**Description**: Formulaire de contact pour joindre l'équipe.

---

## Synthèse par cas d'usage

### 🗣️ "Je veux donner mon avis"

Plusieurs outils permettent aux citoyens d'exprimer leur opinion sur les sujets locaux :

| Besoin                     | Service         | Route            |
| -------------------------- | --------------- | ---------------- |
| Répondre à une enquête     | Consultations   | `/consultations` |
| Voter pour/contre une idée | Kudocracy       | `/kudocracy`     |
| Signer une pétition        | Liens pétitions | Via consultation |

### 📢 "Je veux m'exprimer"

La plateforme offre plusieurs espaces pour publier du contenu et partager ses idées :

| Besoin                          | Service        | Route                   |
| ------------------------------- | -------------- | ----------------------- |
| Écrire un article               | Café / Gazette | `/posts/new`            |
| Proposer une idée au vote       | Kudocracy      | `/kudocracy?tab=create` |
| Créer une page de documentation | Wiki           | `/wiki/new`             |
| Signaler un problème            | Incidents      | `/incidents/new`        |

### 🔍 "Je veux m'informer"

Pour rester informé de l'actualité locale et des décisions qui vous concernent :

| Besoin                     | Service | Route      |
| -------------------------- | ------- | ---------- |
| Lire l'actualité locale    | Gazette | `/gazette` |
| Consulter la documentation | Wiki    | `/wiki`    |
| Voir les événements        | Agenda  | `/agenda`  |
| Poser une question         | Ophélia | `/bob`     |

### ⚖️ "Je veux contrôler l'action publique"

Pour exercer votre droit de regard sur les décisions municipales et demander des comptes :

| Besoin                   | Service      | Route                |
| ------------------------ | ------------ | -------------------- |
| Évaluer la transparence  | Observatoire | `/transparence`      |
| Suivre un acte municipal | Actes        | `/actes`             |
| Demander un document     | Demande CRPA | `/demandes/nouvelle` |
| Préparer un recours      | Export PDF   | `/exports/pdf`       |

### 🤝 "Je veux m'engager"

Pour participer activement à la vie de la communauté et contribuer à des projets collectifs :

| Besoin                  | Service       | Route                        |
| ----------------------- | ------------- | ---------------------------- |
| Participer à une action | Missions      | `/missions`                  |
| Rejoindre un groupe     | Social        | `/social?tab=groups`         |
| Contribuer à un projet  | Tâches Kanban | `/tasks`                     |
| Déléguer ma voix        | Kudocracy     | `/kudocracy?tab=delegations` |

### 📊 "Je veux suivre mon activité"

Pour retrouver toutes vos contributions et suivre les contenus qui vous intéressent :

| Besoin          | Service         | Route             |
| --------------- | --------------- | ----------------- |
| Vue consolidée  | Tableau de bord | `/user-dashboard` |
| Contenus suivis | Abonnements     | `/subscriptions`  |
| Mon profil      | Profil          | `/profile`        |

---

## 📌 Récapitulatif des routes principales

```
/                          → Accueil (consultation vedette)
/consultations             → Liste des consultations
/consultation/:id          → Détail d'une consultation

/kudocracy                 → Propositions et votes
/propositions/:id          → Détail d'une proposition

/social                    → Café (groupes + posts)
/groups/:id                → Détail d'un groupe
/posts/:id                 → Détail d'une publication
/gazette                   → La Gazette
/agenda                    → Agenda des événements
/incidents                 → Centre des incidents

/transparence              → Observatoire de transparence
/actes                     → Tableau de bord actes
/actes/liste               → Liste des actes
/demandes                  → Demandes administratives

/missions                  → Missions bénévoles
/tasks                     → Projets Kanban

/wiki                      → Wiki collaboratif
/fil                       → Fil d'information

/bob                       → Assistant Ophélia

/user-dashboard            → Tableau de bord personnel
/subscriptions             → Mes abonnements
/profile                   → Mon profil

/contact                   → Contact
/admin                     → Administration (admin only)
```

---

## 🎓 Pour aller plus loin

- **README.md** — Documentation technique générale
- **SOCIAL_FEATURES.md** — Architecture du système social
- **CONTRIBUTING.md** — Comment contribuer au projet
- **docs/API.md** — Documentation API

---

_Document généré automatiquement à partir de l'analyse du code source de Kudocracy.Survey v1.3.0_
