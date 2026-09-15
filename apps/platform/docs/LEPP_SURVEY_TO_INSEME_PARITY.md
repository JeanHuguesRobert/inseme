---
title: Matrice de Parité Survey → Inseme Platform — LePP / pertitellu-corte
date: '2026-08-31'
version: 1.0.0
issue: https://github.com/JeanHuguesRobert/inseme/issues/59
instance: pertitellu-corte
canonical_domain: lepp.fr
status: active
license: CC BY-SA 4.0
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
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


# Matrice de Parité Survey → Inseme Platform (pertitellu-corte)

Ce document établit la référence opérationnelle vivante pour la migration de **LePP / Pertitellu
Corte (`lepp.fr`)** depuis le runtime historique
[`JeanHuguesRobert/survey`](https://github.com/JeanHuguesRobert/survey) vers le runtime unifié
[`apps/platform`](../README.md) dans `inseme`, conformément aux contrats du **Continuous Operation
Protocol (COP)** et à l'issue [#59](https://github.com/JeanHuguesRobert/inseme/issues/59).

---

## 1. Principes et Invariants de Migration

1. **`pertitellu-corte` est l'identité canonique** de l'instance civique (première instance
   collective et hub de la fédération Pertitellu).
2. **Preview isolée sur `fracta`** : la preview s'exécute sur le VPS `fracta` (port dédié 8893,
   `/health` explicite) sans modifier la production active `lepp.fr`.
3. **Sécurité des données / Zero write de production** : aucune écriture intempestive sur la base de
   production Survey pendant la phase preview.
4. **COP n'est pas décoratif** : les actes significatifs (Wiki, Kudocracy, délégations, décisions)
   sont traçables, imputables et idempotents.
5. **Ophélia sans autorité implicite** : les mutations suggérées par l'agent conversationnel passent
   par des Capability/Mandates contrôlés au commit boundary.
6. **Configuration par le Vault (`instance_config`)** : aucun secret applicatif dans le dépôt Git.

---

## 2. Matrice Comparative des Capacités

Légende des statuts :

- `required-for-parity` : Indispensable pour atteindre la parité fonctionnelle minimale avec
  `lepp.fr`.
- `native-better-replacement` : Remplacé avantageusement par une brique ou un contrat Inseme / COP
  natif.
- `deprecated-by-design` : Supprimé intentionnellement car non conforme ou obsolète.
- `missing` : À implémenter ou brancher dans la preview.
- `post-cutover` : Évolution différée après le basculement officiel.

| Domaine           | Capacité Survey (Legacy)                       | État `apps/platform` / Briques Inseme                                      | Statut Parité               | Cible & Notes d'implémentation                                                                |
| :---------------- | :--------------------------------------------- | :------------------------------------------------------------------------- | :-------------------------- | :-------------------------------------------------------------------------------------------- |
| **Identité**      | Auth Supabase classique (email / mot de passe) | Supabase Auth + gestion des rôles / membership                             | `required-for-parity`       | Séparation explicite compte / Subject / rôle / mandat.                                        |
| **Identité**      | Connexion Facebook OAuth legacy                | Intégration Supabase Auth générique                                        | `deprecated-by-design`      | Remplacé par auth standard sans couplage rigide à un tiers.                                   |
| **Identité**      | Profil utilisateur éditable en base            | `@inseme/ui` / `UserProfile.jsx` + instance config                         | `native-better-replacement` | Données de profil sanitizées et rattachées au Subject.                                        |
| **Consultation**  | Consultation Quasquara (locale Corte)          | `apps/platform/src/pages/consultations/ConsultationQuasquara.jsx`          | `required-for-parity`       | Module de consultation locale nativement supporté.                                            |
| **Consultation**  | Baromètre Démocratie Locale (national)         | `@inseme/brique-communes` / `ConsultationDemocratieLocale.jsx`             | `required-for-parity`       | Fédération des consultations avec agrégation hub.                                             |
| **Consultation**  | Questionnaires modulaires dynamiques           | `apps/platform/src/pages/DataCollector.jsx`                                | `required-for-parity`       | Questionnaire configurable par schéma.                                                        |
| **Consultation**  | Synthèses & graphiques de restitution          | `GlobalDashboard.jsx`, `VotingDashboard.jsx`                               | `required-for-parity`       | Restitution visuelle et anonymisation des réponses.                                           |
| **Wiki**          | Wiki collaboratif / Markdown / GFM             | `@inseme/brique-wiki` (`Wiki.jsx`, `WikiPage.jsx`, `WikiEdit.jsx`)         | `native-better-replacement` | Wiki modulaire avec support des WikiWords, projections et traces COP.                         |
| **Wiki**          | Révisions & historique de modification         | Event/Artifact/Projection COP (`brique-wiki`)                              | `native-better-replacement` | Traçabilité des versions et attribution des révisions.                                        |
| **Kudocracy**     | Liste et consultation des propositions         | `@inseme/brique-kudocracy` (`PropositionList`, `VotingDashboard`)          | `required-for-parity`       | Filtrage par tags, état (active, closed, draft).                                              |
| **Kudocracy**     | Création de proposition citoyenne              | `@inseme/brique-kudocracy` (`PropositionCreate`, `Proposition.jsx`)        | `required-for-parity`       | Validation au commit boundary et idempotence des créations.                                   |
| **Kudocracy**     | Vote direct (Pour / Contre / Neutre)           | `@inseme/brique-kudocracy` / `tool-vote-proposition.js`                    | `required-for-parity`       | Traitement idempotent des votes pour éviter les doubles effets.                               |
| **Kudocracy**     | Démocratie liquide & délégation thématique     | `@inseme/brique-kudocracy` (`governance.js`, `manage_delegation`)          | `native-better-replacement` | Délégations révocables, auditables et reconstructibles.                                       |
| **Assistant**     | Chatbot "Bob" non gouverné                     | Dérivé Agent John / `@inseme/brique-ophelia` (persona Ophélia)             | `deprecated-by-design`      | Remplacé par l'Agent Ophélia, dérivé direct de la _reasoning loop_ gouvernée de l'Agent John. |
| **Assistant**     | RAG / Contexte Wiki & Actes                    | `brique-ophelia` (`tool-search-wiki`, `capability-democracy`, `sql_query`) | `native-better-replacement` | Contexte borné, sourcé depuis les projections durables et les données attestées.              |
| **Assistant**     | Propositions d'actions depuis le chat          | `brique-ophelia` + Capability / Mandates (#55)                             | `native-better-replacement` | Modèle gouverné dérivé de John : Suggestion -> Autorisation -> Commit boundary -> Receipt.    |
| **Transparence**  | Vitrine de transparence municipale             | `Transparence.jsx`, `TransparenceVitrine.jsx`                              | `required-for-parity`       | Consultation publique des engagements et indicateurs.                                         |
| **Actes**         | Répertoire des actes & délibérations           | `@inseme/brique-actes` (`ActesHome`, `ActesList`, `ActeDetail`)            | `native-better-replacement` | Brique d'actes administratifs avec recherche et timeline.                                     |
| **Social / Café** | Espace Café / sessions citoyennes              | `CafePage.jsx`, `CafeSessionPage.jsx`, `Social.jsx`                        | `required-for-parity`       | Discussions civiques et feed communautaire.                                                   |
| **Territoire**    | Cartographie & signalements locaux             | `@inseme/brique-map`, `Incidents.jsx`, `IncidentEditor.jsx`                | `required-for-parity`       | Cartographie OpenStreetMap / Géoportail intégrée.                                             |
| **Agenda**        | Agenda citoyen des événements                  | `Agenda.jsx`                                                               | `required-for-parity`       | Consultation des réunions publiques et dates clés.                                            |
| **Missions**      | Bourse de missions & projets d'action          | `@inseme/brique-tasks` (`ProjectList`, `TaskDetail`)                       | `required-for-parity`       | Gestion de tâches citoyennes collaboratives.                                                  |
| **Ops / Vault**   | `.env` partagé contenant tous les secrets      | `instance_config` (Vault Supabase) + bootstrap minimal                     | `native-better-replacement` | Séparation stricte secrets / config publique conforme #41.                                    |

---

## 3. Schémas et Stratégie de Données (Hébergement sur la base Agent John)

### Modèle d'hébergement multi-instance :

Plutôt que d'instancier un projet Supabase séparé pour `lepp.fr`, l'instance civique
`pertitellu-corte` est **hébergée directement dans la base Supabase d'Agent John
(`ndiysuhzmztatpxbkezn`)**, en s'appuyant sur l'extension multi-instance et d'héritage déjà déployée
(migration `20260827130000_hosted_instances_and_scoped_config.sql`, #57) :

1. **Enregistrement canonique** : `pertitellu-corte` est enregistrée dans `public.instances` avec
   `host_instance_id = '00000000-0000-0000-0000-000000000001'` (JHN root) et
   `deployment_kind = 'civic'`.
2. **Table `instance_aliases`** : Résolution stricte sans usurpation (`resolve_instance_id`) des
   alias `lepp`, `lepp.fr`, `pertitellu`, `corte` vers l'instance.
3. **Table `instance_config` scopée par `(instance_id, key)`** :
   - `pertitellu-corte` possède ses propres valeurs d'identité, de branding (Ophélia), de domaine et
     de paramètres de communauté.
   - **Héritage automatique des secrets et infrastructure** : La fonction RPC
     `get_effective_instance_config(p_instance_id, p_key)` hérite automatiquement des clés
     d'infrastructure (modèles IA OpenAI/Anthropic/Mistral, embeddings, etc.) définies sur l'hôte
     racine JHN sans duplication de secrets.
4. **Script de seed** :
   [`apps/platform/instances/sql/pertitellu-hosted-seed.sql`](../instances/sql/pertitellu-hosted-seed.sql).

### Protocole de migration des données historiques :

- **Production historique Survey** : Projet Supabase legacy `opnotbjrbphwcezaqgim`.
- **Phase Preview** : Lecture seule / dry-run sans écriture sur la base historique.
- **Validation sémantique** : Mapping des identifiants (propositions Kudocracy, votes,
  pages/révisions Wiki) et vérification d'intégrité vers les schémas Inseme / COP hébergés.
- **Rehearsal & Basculement** : Rejeu de la migration vers la base hébergée, puis cutover DNS
  `lepp.fr`.

---

## 4. Architecture de Déploiement Fracta Preview

```text
                                  ┌───────────────────────────────┐
                                  │      Client (Navigateur)      │
                                  └───────────────┬───────────────┘
                                                  │ HTTPS
                                                  ▼
                                  ┌───────────────────────────────┐
                                  │      Caddy (Reverse Proxy)    │
                                  │     fracta.fractavolta.com    │
                                  └───────┬───────────────┬───────┘
                                          │               │
                    /pertitellu/* (static)│               │ /api/* (reverse proxy)
                                          ▼               ▼
                      ┌─────────────────────┐   ┌─────────────────────────┐
                      │ dist-fracta-preview │   │ Deno Preview Adapter    │
                      │ (Platform Vite SPA) │   │ (pertitellu-server.ts)  │
                      │                     │   │ 127.0.0.1:8893          │
                      │                     │   │ /health -> 200 OK       │
                      └─────────────────────┘   └─────────────────────────┘
```

---

## 5. Architecture de l'Agent Ophélia — Dérivé de la Reasoning Loop d'Agent John

L'Agent Ophélia pour LePP / Pertitellu-Corte n'est pas un chatbot isolé ou un simple prompt système
statique : **il s'agit d'un dérivé direct de l'Agent John (`agent:jhn`)**, bénéficiant de
l'intégralité des innovations introduites dans sa _reasoning loop_ et le substrat COP
(`@inseme/cop-kernel`) :

### 1. Boucle par Tour Borné & Epistemic Boundary

- Chaque interaction utilisateur est bornée en un tour formel (`turn`) consignant dans le journal
  d'événements :
  - L'intention observée (`conversation.user_message` avec `epistemic_status: observed`,
    `actor_ref`, `subject_ref: collective:pertitellu-corte`).
  - La recherche de preuves attestées (FTS/Vecteurs sur `wiki_pages`, `acte`, `propositions`) via un
    contexte strictement délimité.
  - La réponse de l'assistant (`conversation.assistant_message`).

### 2. Rôles et Registre de Capacités (`CapabilityRegistry`)

- Ophélia instancie un `CapabilityRegistry` alimenté par les rôles modulaires de
  `@inseme/brique-ophelia` :
  - `mediator` : Modération et facilitation d'assemblées civiques / réunions de café citoyen
    (gestion des tours de parole, consensus, proposition formelle).
  - `analyst` : Requêtes SQL et recherche sémantique FTS dans la mémoire municipale et le Wiki.
  - `oracle` : Restitution factuelle des archives, délibérations et délais légaux sans spéculation.
  - `scribe` : Génération automatisée de procès-verbaux (PV) et synthèses d'assemblée.

### 3. Frontière d'Action et de Mandat (Commit Boundary)

- Ophélia suit scrupuleusement la séparation issue de la doctrine Agent John :
  $$\text{Suggestion} \longrightarrow \text{Autorisation} \longrightarrow \text{Commit Boundary} \longrightarrow \text{Reçu (Receipt)}$$
- Aucune écriture (création de proposition Kudocracy, édition Wiki, tâche citoyenne) n'est exécutée
  clandestinement : l'agent génère un objet d'action pré-formaté et validé qui nécessite la
  signature/confirmation explicite du citoyen ou de l'assemblée.

---

## 6. Prochaines Slices Recommandées

1. **Slice 1 (Terminée)** : Matrice de parité, profil de déploiement `pertitellu-corte.json`,
   runtime adaptateur Deno sur Fracta avec `/health`, script de build dédié et templates Operium.
2. **Slice 2 (Terminée)** : Hébergement sur la base Supabase d'Agent John (`ndiysuhzmztatpxbkezn`),
   extension `instance_config` scopée avec héritage, script de seed `pertitellu-hosted-seed.sql` et
   bundle `dist-fracta-preview`.
3. **Slice 3 & 4 (Terminées)** : Schéma de données civique multi-instance pour le Wiki collaboratif
   et Kudocracy (`20260901110000_civic_wiki_and_kudocracy_baseline.sql`).
4. **Slice 5 (Phase 6)** : Intégration conversationnelle Ophélia avec persona civique, RAG
   Wiki/Actes et frontière de mandat gouverné (`Capability / Mandates`).
