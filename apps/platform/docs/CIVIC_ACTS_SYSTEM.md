---
title: 📋 Système Citoyen de Contrôle des Actes Municipaux
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

# 📋 Système Citoyen de Contrôle des Actes Municipaux

## Documentation Technique v1.0

### Commune de Corte

---

## 📌 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture](#architecture)
3. [Installation](#installation)
4. [Structure des fichiers](#structure-des-fichiers)
5. [Base de données](#base-de-données)
6. [API Edge Functions](#api-edge-functions)
7. [Composants Frontend](#composants-frontend)
8. [Intégration RAG/Ophelia](#intégration-ragophelia)
9. [Human-in-the-Loop](#human-in-the-loop)
10. [Exports et Indicateurs](#exports-et-indicateurs)
11. [Routes disponibles](#routes-disponibles)
12. [Guide d'utilisation](#guide-dutilisation)

---

## 🎯 Vue d'ensemble

Ce système permet aux citoyens de **suivre, documenter et contrôler** les actes pris par la
municipalité de Corte, conformément aux principes de transparence démocratique et au droit
administratif français.

### Fonctionnalités principales

- **Suivi des actes municipaux** : Délibérations, arrêtés, décisions, procès-verbaux
- **Gestion des demandes administratives** : CRPA, CADA, recours gracieux, recours TA
- **Gestion des preuves** : Captures d'écran, PDFs, emails avec hash SHA-256
- **Calcul automatique des délais** : 15 jours transmission, 1 mois CRPA, 2 mois recours
- **Versioning complet** : Historique immuable des modifications
- **Human-in-the-Loop** : Validation avant actions externes
- **Intégration RAG** : Recherche sémantique via Ophelia chatbot
- **Exports** : PDF légaux, CSV pour analyses

### Cadre juridique

- **CGCT** : Code Général des Collectivités Territoriales
- **CRPA** : Code des Relations entre le Public et l'Administration
- **CADA** : Commission d'Accès aux Documents Administratifs
- **TA** : Tribunaux Administratifs

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend React                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  ActesDashboard │ ActesList │ ActeDetail │ Forms...  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Netlify Edge Functions                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  actes-api.js │ demandes-api.js │ update-deadlines   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase PostgreSQL                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  acte │ demande_admin │ proof │ knowledge_chunks     │   │
│  │  acte_version │ outgoing_action │ responsibility_log │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      RAG / Ophelia                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  sync-actes-rag.js │ civic-tools.js │ rag_chatbot    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📥 Installation

### Prérequis

- Node.js 18+
- Compte Supabase
- Compte Netlify
- Clé API OpenAI (pour embeddings)

### Étapes

1. **Appliquer les migrations SQL** (dans l'ordre) :

```bash
# Via Supabase CLI ou dashboard
supabase db push supabase/migrations/20251204_001_civic_acts_core.sql
supabase db push supabase/migrations/20251204_002_civic_acts_deadlines.sql
supabase db push supabase/migrations/20251204_003_civic_acts_rag.sql
supabase db push supabase/migrations/20251204_004_civic_acts_hitl.sql
```

2. **Configurer les variables d'environnement** :

```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENAI_API_KEY=sk-...
```

> **Note** : Le projet utilise un système de configuration centralisé ("vault"). Voir
> [CONFIGURATION_VAULT.md](./CONFIGURATION_VAULT.md) pour plus de détails.

3. **Déployer les Edge Functions** :

Les fichiers dans `netlify/edge-functions/` sont automatiquement déployés.

4. **Lancer le développement** :

```bash
npm install
npm run dev
```

---

## 📁 Structure des fichiers

```
src/pages/actes/
├── ActesHome.jsx             # Page d'accueil du module
├── ActesDashboard.jsx        # Dashboard principal
├── ActesList.jsx             # Liste paginée des actes
├── ActeDetail.jsx            # Détail d'un acte
├── ActeForm.jsx              # Création/modification acte
├── ActeTimeline.jsx          # Chronologie interactive
├── DemandesList.jsx          # Liste des demandes
├── DemandeDetail.jsx         # Détail d'une demande
├── DemandeForm.jsx           # Création/modification demande
├── ProofUpload.jsx           # Upload de preuves
├── OutgoingActionsQueue.jsx  # File actions sortantes (HITL)
├── VerificationQueue.jsx     # File vérification preuves
├── PublicationModeration.jsx # Modération publications
├── ResponsibilityLog.jsx     # Journal des responsabilités
├── ExportPDF.jsx             # Export PDF
├── ExportCSV.jsx             # Export CSV
└── StatsDashboard.jsx        # Tableau de bord stats

supabase/migrations/
├── 20251204_001_civic_acts_core.sql      # Phase 1: Tables core
├── 20251204_002_civic_acts_deadlines.sql # Phase 2: Délais/statuts
├── 20251204_003_civic_acts_rag.sql       # Phase 5: Intégration RAG
└── 20251204_004_civic_acts_hitl.sql      # Phase 3: HITL

netlify/edge-functions/
├── actes-api.js             # CRUD actes
├── demandes-api.js          # CRUD demandes
└── update-deadlines-cron.js # Cron mise à jour statuts

scripts/
├── sync-actes-rag.js        # Sync vers knowledge_chunks
└── civic-tools.js           # Outils RAG pour Ophelia
```

---

## 🗄️ Base de données

### Tables principales

| Table                   | Description                                     |
| ----------------------- | ----------------------------------------------- |
| `acte`                  | Actes municipaux (délibérations, arrêtés, etc.) |
| `acte_version`          | Historique des versions (immuable)              |
| `demande_admin`         | Demandes administratives (CRPA, CADA, recours)  |
| `demande_response`      | Réponses reçues aux demandes                    |
| `proof`                 | Pièces justificatives avec hash SHA-256         |
| `outgoing_action`       | Actions externes en attente de validation       |
| `publication_citoyenne` | Publications des citoyens                       |
| `responsibility_log`    | Journal d'audit des actions                     |
| `verification_queue`    | File de vérification des preuves                |

### ENUMs

```sql
-- Types d'actes
type_acte_enum: DELIBERATION, ARRETE, DECISION, PV, AUTRE

-- Statuts d'actes
statut_acte_enum: BROUILLON, PUBLIE, EXECUTABLE, ANNULE, RETIRE

-- Types de demandes
type_demande_enum: CRPA, CADA, RECOURS_GRACIEUX, RECOURS_TA, AUTRE

-- Statuts de demandes
statut_demande_enum: EN_ATTENTE, ENVOYEE, REPONSE_RECUE, SANS_REPONSE, CLOTUREE
```

### Fonctions RPC

| Fonction                       | Description                          |
| ------------------------------ | ------------------------------------ |
| `update_acte_versioned(...)`   | Mise à jour avec création de version |
| `compute_all_deadlines()`      | Calcul de tous les délais            |
| `log_responsibility(...)`      | Ajout au journal d'audit             |
| `approve_outgoing_action(...)` | Approbation d'une action externe     |
| `reject_outgoing_action(...)`  | Rejet d'une action externe           |
| `mark_action_sent(...)`        | Marquage action comme envoyée        |

---

## 🌐 API Edge Functions

### `/api/actes`

| Méthode | Endpoint         | Description               |
| ------- | ---------------- | ------------------------- |
| GET     | `/api/actes`     | Liste des actes (paginée) |
| GET     | `/api/actes/:id` | Détail d'un acte          |
| POST    | `/api/actes`     | Création d'un acte        |
| PATCH   | `/api/actes/:id` | Mise à jour (versionnée)  |
| DELETE  | `/api/actes/:id` | Suppression (soft delete) |

### `/api/demandes`

| Méthode | Endpoint                      | Description            |
| ------- | ----------------------------- | ---------------------- |
| GET     | `/api/demandes`               | Liste des demandes     |
| GET     | `/api/demandes/:id`           | Détail d'une demande   |
| POST    | `/api/demandes`               | Création d'une demande |
| PATCH   | `/api/demandes/:id`           | Mise à jour            |
| POST    | `/api/demandes/:id/responses` | Ajout réponse          |

### Authentification

Toutes les API requièrent un token Bearer :

```
Authorization: Bearer <supabase_access_token>
```

---

## ⚛️ Composants Frontend

### Pages principales

| Route                    | Composant      | Description                |
| ------------------------ | -------------- | -------------------------- |
| `/actes/accueil`         | ActesHome      | Page d'accueil du module   |
| `/actes`                 | ActesDashboard | Dashboard principal        |
| `/actes/liste`           | ActesList      | Liste paginée avec filtres |
| `/actes/nouveau`         | ActeForm       | Création d'acte            |
| `/actes/:id`             | ActeDetail     | Détail complet             |
| `/actes/:id/modifier`    | ActeForm       | Modification versionnée    |
| `/demandes`              | DemandesList   | Liste des demandes         |
| `/demandes/nouvelle`     | DemandeForm    | Création de demande        |
| `/demandes/:id`          | DemandeDetail  | Détail demande             |
| `/demandes/:id/modifier` | DemandeForm    | Modification demande       |

### Modération (HITL)

| Route                         | Composant             | Description            |
| ----------------------------- | --------------------- | ---------------------- |
| `/moderation/actions`         | OutgoingActionsQueue  | Actions à valider      |
| `/moderation/preuves`         | VerificationQueue     | Preuves à vérifier     |
| `/moderation/publications`    | PublicationModeration | Publications à modérer |
| `/moderation/responsabilites` | ResponsibilityLog     | Journal d'audit        |

### Exports

| Route                    | Composant      | Description        |
| ------------------------ | -------------- | ------------------ |
| `/exports/pdf`           | ExportPDF      | Génération PDF     |
| `/exports/csv`           | ExportCSV      | Export tabulaire   |
| `/actes/chronologie`     | ActeTimeline   | Timeline globale   |
| `/actes/:id/chronologie` | ActeTimeline   | Timeline d'un acte |
| `/actes/stats`           | StatsDashboard | Indicateurs clés   |

---

## 🤖 Intégration RAG/Ophelia

### Synchronisation

Le script `sync-actes-rag.js` synchronise les actes vers `knowledge_chunks` pour la recherche
sémantique :

```javascript
node scripts/sync-actes-rag.js
```

### Outils disponibles dans Ophelia

| Outil                  | Description                  |
| ---------------------- | ---------------------------- |
| `search_actes`         | Recherche sémantique d'actes |
| `get_acte_detail`      | Détail complet d'un acte     |
| `list_demandes_status` | Statut des demandes en cours |
| `compute_delai`        | Calcul de délai légal        |
| `get_legal_info`       | Informations juridiques      |

### Prompts

Les fichiers de prompts sont dans `public/prompts/` :

- `civic-acts-context.md` : Contexte juridique
- `civic-acts-tools.md` : Documentation des outils

---

## 👥 Human-in-the-Loop

### Principes

Aucune action externe (courrier, email, saisine) ne peut être effectuée automatiquement. Chaque
action doit être :

1. **Créée** : Génération du contenu
2. **Validée** : Approbation par un humain
3. **Envoyée** : Confirmation d'envoi avec preuve

### Workflow

```text
[Création] → [En attente] → [Approbation] → [Envoyé]
                  ↓
              [Rejet]
```

### Responsabilité

Le `responsibility_log` trace :

- Qui a effectué quelle action
- Quand (horodatage)
- Depuis où (IP, user-agent)
- Avec quelle justification

---

## 📊 Exports et Indicateurs

### Export PDF

Formats disponibles :

- Acte complet avec versions et preuves
- Dossier de demande avec historique
- Chronologie
- Dossier recours TA (modèle)
- Dossier saisine CADA (modèle)

### Export CSV

Entités exportables :

- Actes municipaux
- Demandes administratives
- Pièces justificatives
- Journal des responsabilités
- Actions externes

### Indicateurs clés

- Nombre d'actes suivis
- Demandes en cours
- Délais dépassés
- Preuves vérifiées
- Activité récente

---

## 🛣️ Routes disponibles

### Actes et Demandes

```text
/actes/accueil            # Page d'accueil du module
/actes                    # Dashboard
/actes/liste              # Liste
/actes/nouveau            # Création
/actes/:id                # Détail
/actes/:id/modifier       # Modification
/actes/chronologie        # Timeline globale
/actes/:id/chronologie    # Timeline acte
/actes/stats              # Statistiques

/demandes                 # Liste
/demandes/nouvelle        # Création
/demandes/:id             # Détail
/demandes/:id/modifier    # Modification

/preuves/ajouter          # Upload
```

### Modération

```text
/moderation/actions         # Actions externes
/moderation/preuves         # Vérification preuves
/moderation/publications    # Modération publications
/moderation/responsabilites # Journal audit
```

### Génération de documents

```text
/exports/pdf              # Génération PDF
/exports/csv              # Export CSV
```

---

## 📖 Guide d'utilisation

### 1. Ajouter un acte

1. Aller sur `/actes/nouveau`
2. Remplir les informations obligatoires
3. Enregistrer

### 2. Créer une demande CRPA

1. Aller sur `/demandes/nouvelle`
2. Sélectionner type "CRPA"
3. Lier à un acte si pertinent
4. Le délai de réponse (1 mois) est calculé automatiquement

### 3. Ajouter une preuve

1. Aller sur `/preuves/ajouter`
2. Glisser-déposer le fichier
3. Sélectionner le type et la date de constat
4. La preuve sera ajoutée à la file de vérification

### 4. Valider une action externe

1. Aller sur `/moderation/actions`
2. Examiner le contenu proposé
3. Approuver ou rejeter avec justification

### 5. Exporter des données

1. Aller sur `/exports/csv` ou `/exports/pdf`
2. Sélectionner les options
3. Télécharger

---

## 🔐 Sécurité

- **RLS (Row Level Security)** : Toutes les tables
- **Authentification** : Supabase Auth
- **Audit** : Journal des responsabilités
- **Hash SHA-256** : Intégrité des preuves
- **Versioning** : Historique immuable

---

## 📝 Licence

Ce système est développé pour l'association C.O.R.S.I.C.A. dans le cadre du contrôle citoyen des
actes municipaux de la ville de Corte.

---

**Dernière mise à jour :** Décembre 2025
