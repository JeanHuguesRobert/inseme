---
title: Analyse d'impact du GIS sur la gestion des connaissances
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

# Analyse d'impact du GIS sur la gestion des connaissances

## Executive Summary

L'intégration du système GIS de transparence citoyenne impacte **6 domaines majeurs** de la
plateforme existante :

| Domaine                        | Impact    | Effort estimé                        |
| ------------------------------ | --------- | ------------------------------------ |
| Schéma PostgreSQL              | 🔴 Majeur | ~20 tables à ajouter                 |
| Système RAG (knowledge_chunks) | 🔴 Majeur | Nouveaux domains + source_types      |
| Ophélia (chatbot)              | 🟠 Moyen  | Nouveaux outils + prompts            |
| Composants React               | 🟠 Moyen  | Extension CitizenMap                 |
| Ingestion de données           | 🔴 Majeur | 13+ pipelines nouveaux               |
| Architecture globale           | 🟡 Faible | Extension du système fédéré existant |

### 0.1. Architecture multi-instances

Chaque instance (commune, EPCI, hub) dispose de sa propre base de données Supabase avec une table
`instance_config` pour sa configuration :

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE MULTI-INSTANCES                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   INSTANCE CORTE                    INSTANCE BASTIA                         │
│   corte.lepp.fr                     bastia.lepp.fr                          │
│   ┌──────────────────────┐          ┌──────────────────────┐                │
│   │ Supabase Project     │          │ Supabase Project     │                │
│   │ ┌──────────────────┐ │          │ ┌──────────────────┐ │                │
│   │ │ instance_config  │ │          │ │ instance_config  │ │                │
│   │ │ community: Corte │ │          │ │ community: Bastia│ │                │
│   │ │ insee: 2B096     │ │          │ │ insee: 2B033     │ │                │
│   │ │ region: COR      │ │          │ │ region: COR      │ │                │
│   │ │ is_hub: false    │ │          │ │ is_hub: false    │ │                │
│   │ └──────────────────┘ │          │ └──────────────────┘ │                │
│   │ + knowledge_chunks   │          │ + knowledge_chunks   │                │
│   │ + contributions      │          │ + contributions      │                │
│   └──────────────────────┘          └──────────────────────┘                │
│             │                                 │                             │
│             └───────────────┬─────────────────┘                             │
│                             │ sync                                          │
│                             ▼                                               │
│   ┌────────────────────────────────────────────────────────────────┐        │
│   │                    HUB RÉGIONAL CORSE                          │        │
│   │                    corse.lepp.fr                               │        │
│   │ ┌──────────────────────────────────────────────────────────┐   │        │
│   │ │ instance_config                                          │   │        │
│   │ │ community: Région Corse | is_hub: true | hub_type: region│   │        │
│   │ └──────────────────────────────────────────────────────────┘   │        │
│   │ + federated_contributions                                      │        │
│   │ + federated_stats                                              │        │
│   │ + federation_registry                                          │        │
│   └────────────────────────────────────────────────────────────────┘        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Clés de configuration multi-instances

| Clé                | Description            | Exemple Corte           | Exemple Hub               |
| ------------------ | ---------------------- | ----------------------- | ------------------------- |
| `community_name`   | Nom de la communauté   | "Corte"                 | "Région Corse"            |
| `community_type`   | Type                   | "municipality"          | "region"                  |
| `community_code`   | Code INSEE/SIREN       | "2B096"                 | "94"                      |
| `is_hub`           | Instance hub ?         | "false"                 | "true"                    |
| `hub_type`         | Type de hub            | null                    | "region"                  |
| `parent_hub_url`   | URL hub parent         | "https://corse.lepp.fr" | null                      |
| `federation_peers` | Instances pairs (JSON) | `[]`                    | `[{url, name, insee}...]` |

---

## 0. Architecture fédérative existante

### Principe : Une base de données par commune

L'architecture existante repose sur un **système fédératif** déjà implémenté pour les consultations
:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        RÉSEAU FÉDÉRÉ DE COMMUNES                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│   │   CORTE      │    │   BASTIA     │    │   AJACCIO    │                  │
│   │   (Hub)      │◄──►│   (Nœud)     │◄──►│   (Nœud)     │                  │
│   │              │    │              │    │              │                  │
│   │ Supabase     │    │ Supabase     │    │ Supabase     │                  │
│   │ instance     │    │ instance     │    │ instance     │                  │
│   └──────────────┘    └──────────────┘    └──────────────┘                  │
│          │                   │                   │                          │
│          └───────────────────┼───────────────────┘                          │
│                              │                                              │
│                    ┌─────────▼─────────┐                                    │
│                    │  HUB RÉGIONAL     │                                    │
│                    │  (Corse)          │                                    │
│                    └─────────┬─────────┘                                    │
│                              │                                              │
│                    ┌─────────▼─────────┐                                    │
│                    │  HUB NATIONAL     │                                    │
│                    │  (France)         │                                    │
│                    └───────────────────┘                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Code existant exploitable

#### Table `federation_registry`

```sql
-- supabase/migrations/20251204_federation_consultations.sql
CREATE TABLE public.federation_registry (
  id uuid PRIMARY KEY,
  instance_url text NOT NULL UNIQUE,      -- https://corte.survey.app
  instance_name text NOT NULL,            -- "Corte"
  instance_type text NOT NULL,            -- 'commune' | 'region' | 'national'
  commune_name text,
  commune_insee text,                     -- '2B096'
  region_name text,                       -- 'Corse'
  region_code text,                       -- 'COR'
  api_endpoint text,
  api_key_hash text,
  is_hub boolean DEFAULT false,
  status text DEFAULT 'pending',          -- 'pending' | 'active' | 'suspended'
  federation_config jsonb,
  ...
);
```

#### Module `src/lib/federation.js`

Fonctions déjà disponibles :

| Fonction                        | Description                    | Réutilisable pour GIS |
| ------------------------------- | ------------------------------ | --------------------- |
| `CURRENT_INSTANCE`              | Config de l'instance locale    | ✅ Oui                |
| `getRegisteredInstances()`      | Liste des instances du réseau  | ✅ Oui                |
| `registerWithHub()`             | S'enregistrer auprès d'un hub  | ✅ Oui                |
| `discoverRemoteConsultations()` | Découvrir ressources distantes | 🔄 À adapter          |
| `syncResponsesToSource()`       | Synchroniser vers la source    | 🔄 À adapter          |
| `getSyncStats()`                | Stats de synchronisation       | ✅ Oui                |

#### Configuration centralisée : Instance Vault

Depuis décembre 2025, toutes les configurations d'instance sont stockées dans la table
`instance_config` (vault) plutôt que dans des variables d'environnement :

```javascript
// src/lib/instanceConfig.js - Pattern de configuration centralisée

import { getConfig, loadConfig } from "./instanceConfig";

// Au démarrage de l'application
await loadConfig();

// Accès aux valeurs (avec fallback env vars → defaults)
const communeInsee = getConfig("community_code"); // '2B096'
const regionName = getConfig("region_name"); // 'Corse'
const regionCode = getConfig("region_code"); // 'COR'
const isHub = getConfig("is_hub") === "true";
```

**Table `instance_config` :**

```sql
CREATE TABLE public.instance_config (
  key text NOT NULL UNIQUE,        -- 'community_name', 'region_code', etc.
  value text,                      -- Valeur texte
  value_json jsonb,                -- Valeur JSON (pour objets complexes)
  category text DEFAULT 'general', -- 'identity', 'branding', 'secrets', 'features'
  is_secret boolean DEFAULT false, -- Masqué dans les API publiques
  is_public boolean DEFAULT false  -- Accessible sans auth
);
```

**Avantages du vault :**

- ✅ Configuration modifiable sans redéploiement
- ✅ Audit trail automatique (versioning, `previous_value`)
- ✅ Secrets chiffrés et protégés par RLS
- ✅ Interface admin pour modifier les valeurs (`/admin/vault`)
- ✅ Fallback vers variables d'environnement (migration progressive)

### Implications pour le GIS

#### ✅ Pas de `collectivite_id` dans les tables

Chaque commune a **sa propre base de données Supabase**, donc :

- **Pas besoin** de `collectivite_id` dans chaque table
- Les données sont **isolées par instance**
- La fédération gère le partage inter-communes

#### 🔄 Adaptation pour les données GIS

Le pattern existant peut s'appliquer au GIS :

| Consultations                                   | GIS Équivalent                  |
| ----------------------------------------------- | ------------------------------- |
| `consultations.scope` (local/regional/national) | `contributions.scope`           |
| `consultations.source_instance`                 | `contributions.source_instance` |
| `consultations.federation_config`               | `gis_data.federation_config`    |
| `consultation_responses.sync_status`            | `contributions.sync_status`     |
| `syncResponsesToSource()`                       | `syncContributionsToHub()`      |

#### 📊 Données à synchroniser vers les hubs

| Type de donnée           | Sync vers Hub | Direction                                       |
| ------------------------ | ------------- | ----------------------------------------------- |
| Contributions citoyennes | ✅ Oui        | Commune → Régional → National                   |
| Zonages PLU              | ❌ Non        | Local uniquement (déjà dans GPU)                |
| DVF mutations            | ❌ Non        | Local uniquement (déjà dans data.gouv)          |
| Alertes zonage           | ✅ Oui        | Commune → Hub (pour comparaison inter-communes) |
| Stats transparence       | ✅ Oui        | Agrégation nationale                            |

---

## 1. Impact sur le schéma PostgreSQL

### 1.1. Tables existantes concernées

#### `knowledge_chunks` - Extension du champ `domain`

**État actuel :**

```sql
domain text NOT NULL,  -- 'civics', 'history', 'budget', 'urbanisme'
```

**Extension requise :**

```sql
-- Nouveaux domains pour le GIS
'urbanisme'        -- Déjà prévu mais à peupler
'foncier'          -- Mutations DVF, transactions
'environnement'    -- Géorisques, Hub'Eau, qualité air
'risques'          -- ICPE, SIS, risques naturels
'marches_publics'  -- DECP, BOAMP
'elus'             -- HATVP, représentants d'intérêts
'cadastre'         -- Parcelles, zonages PLU
'agriculture'      -- RPG, exploitations
'contributions'    -- Crowdsourcing citoyen (nouveau)
```

**Impact :** Pas de modification de structure, juste enrichissement des valeurs.

#### `knowledge_chunks` - Extension du champ `source_type`

**État actuel :**

```sql
source_type text NOT NULL,  -- 'official', 'wiki_page', 'history', 'conseil_doc'
```

**Extension requise :**

```sql
-- Nouveaux source_types pour les données géographiques
'gpu_zonage'           -- Géoportail de l'Urbanisme
'dvf_mutation'         -- Demandes de Valeurs Foncières
'bodacc_annonce'       -- Annonces légales
'georisques_icpe'      -- Installations classées
'georisques_sis'       -- Sites et sols pollués
'hubeau_qualite'       -- Qualité de l'eau
'decp_marche'          -- Marchés publics
'sitadel_permis'       -- Permis de construire
'hatvp_declaration'    -- Déclarations d'intérêts
'rne_elu'              -- Répertoire national des élus
'api_carto'            -- Données IGN cadastre
'contribution_citoyen' -- Crowdsourcing
```

**Impact :** Pas de modification de structure, juste enrichissement des valeurs.

#### `document_sources` - Compatibilité confirmée

La table `document_sources` existante est parfaitement compatible :

```sql
-- Structure existante (déjà adaptée)
domain text,           -- Supporte les nouveaux domains
source_type text,      -- Supporte les nouveaux source_types
external_id text,      -- ID unique par source (ex: 'gpu:2B096:2024-03')
metadata jsonb         -- Données spécifiques par source
```

### 1.2. Nouvelles tables requises (~20 tables)

#### Tables de données brutes (import)

| Table                    | Source     | Volume estimé/an | Fréquence sync |
| ------------------------ | ---------- | ---------------- | -------------- |
| `mutations_foncieres`    | DVF        | ~100-500/commune | Semestriel     |
| `annonces_bodacc`        | BODACC     | ~50-200/commune  | Quotidien      |
| `icpe`                   | Géorisques | ~10-50/commune   | Mensuel        |
| `sols_pollues`           | Géorisques | ~5-20/commune    | Mensuel        |
| `marches_publics`        | DECP       | ~50-200/commune  | Mensuel        |
| `permis_construire`      | Sitadel    | ~20-100/commune  | Mensuel        |
| `declarations_elus`      | HATVP      | ~50-200/commune  | Trimestriel    |
| `representants_interets` | HATVP      | ~100-500 natl    | Trimestriel    |
| `qualite_eau`            | Hub'Eau    | ~10-50/commune   | Mensuel        |
| `qualite_air`            | Géod'Air   | ~5-20/commune    | Mensuel        |
| `comptes_collectivites`  | DGFIP      | ~1/commune/an    | Annuel         |

#### Tables de zonage

| Table               | Contenu               | Géométrie       |
| ------------------- | --------------------- | --------------- |
| `zonage_historique` | Archive PLU/PLUi      | Polygon GeoJSON |
| `alertes_zonage`    | Détection changements | Point + Polygon |

#### Tables de crowdsourcing

| Table                      | Contenu                   | Géométrie     |
| -------------------------- | ------------------------- | ------------- |
| `contributions_citoyennes` | Signalements génériques   | Point/Polygon |
| `contributions_votes`      | Corroborations            | -             |
| `zonage_contributions`     | Reconstitution historique | Polygon       |
| `zonage_votes`             | Validation zonage         | -             |
| `enquetes_publiques`       | Enquêtes signalées        | Polygon       |
| `recours_contentieux`      | Contentieux locaux        | Point         |
| `signalements_nuisances`   | Nuisances signalées       | Point         |
| `contributeurs_stats`      | Gamification              | -             |

#### Tables de configuration GIS

| Table                    | Contenu                 |
| ------------------------ | ----------------------- |
| `map_layers`             | Catalogue des calques   |
| `user_layer_preferences` | Préférences utilisateur |

### 1.3. Conflits potentiels

#### ⚠️ Conflit : Table `recours` existante vs `recours_contentieux` GIS

**Table existante :**

```sql
CREATE TABLE public.recours (
  id uuid PRIMARY KEY,
  collectivite_id uuid REFERENCES collectivite(id),
  type recours_type,  -- GRACIEUX, CADA, HIERARCHIQUE, TA_REP, TA_PE, TA_REFERE
  demande_id uuid,
  acte_id uuid,
  ...
);
```

**Table GIS proposée :**

```sql
CREATE TABLE public.recours_contentieux (
  id uuid PRIMARY KEY,
  contribution_id uuid REFERENCES contributions_citoyennes(id),
  juridiction text,  -- TA, CAA, CE
  ...
);
```

**Résolution proposée :**

- Garder `recours` pour les recours OFFICIELS liés aux actes municipaux
- Renommer `recours_contentieux` → `contentieux_signales` pour les signalements citoyens
- Lien possible : `contentieux_signales.recours_officiel_id → recours.id` si le recours devient
  officiel

#### ⚠️ Conflit : Champ `status` sur contributions

**Table existante `collected_data` :**

```sql
status text CHECK (status IN ('draft', 'reviewed', 'published', 'archived'))
```

**Table GIS `contributions_citoyennes` :**

```sql
statut text CHECK (statut IN ('en_attente', 'corroboree', 'documentee', 'officielle', 'rejetee', 'obsolete'))
```

**Résolution :**

- OK, pas de conflit direct (tables différentes)
- Mais uniformiser la nomenclature pour cohérence globale ?

---

## 2. Impact sur le système RAG

### 2.1. Architecture RAG actuelle

```
┌─────────────────────────────────────────────┐
│           document_sources                  │
│  (external_id, fingerprint, domain, ...)    │
└─────────────────────────────────────────────┘
                    │ 1:N
                    ▼
┌─────────────────────────────────────────────┐
│           knowledge_chunks                  │
│  (text, embedding, domain, source_type,     │
│   status, layer, info_date, metadata)       │
└─────────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
   Vector Search           Full-text Search
   (embedding)             (to_tsvector)
```

### 2.2. Évolution requise

#### Nouveaux pipelines d'ingestion

Chaque source de données GIS nécessite un script d'ingestion :

```javascript
// scripts/ingest_{source}.js - Pattern commun

// 1. Télécharger les données brutes
const rawData = await fetchFromAPI('https://source.api...');

// 2. Upsert dans document_sources
const { id: sourceId } = await upsertDocumentSource({
  external_id: `${source}:${record.id}`,
  fingerprint: hashContent(record),
  domain: 'foncier',          // ← Nouveau domain
  source_type: 'dvf_mutation' // ← Nouveau source_type
});

// 3. Chunker et générer embeddings
const chunks = chunkRecord(record);
for (const chunk of chunks) {
  await insertChunk({
    source_id: sourceId,
    text: buildChunkText(chunk),
    embedding: await generateEmbedding(chunk.text),
    type: 'fact',           // fact | allegation | opinion
    status: 'confirmed',    // under_review | confirmed | refuted
    domain: 'foncier',
    source_type: 'dvf_mutation',
    info_date: record.date_mutation,
    layer: 'hot',
    metadata: { ... }
  });
}
```

#### Scripts à créer

| Script                    | Source          | Fréquence   | Priorité   |
| ------------------------- | --------------- | ----------- | ---------- |
| `ingest_dvf.js`           | DVF géolocalisé | Semestriel  | 🔴 Haute   |
| `ingest_bodacc.js`        | BODACC API      | Quotidien   | 🔴 Haute   |
| `ingest_georisques.js`    | Géorisques WFS  | Mensuel     | 🟠 Moyenne |
| `ingest_decp.js`          | DECP JSON       | Mensuel     | 🟠 Moyenne |
| `ingest_sitadel.js`       | Sitadel API     | Mensuel     | 🟡 Basse   |
| `ingest_hatvp.js`         | HATVP API       | Trimestriel | 🟡 Basse   |
| `ingest_hubeau.js`        | Hub'Eau APIs    | Mensuel     | 🟡 Basse   |
| `ingest_gpu.js`           | GPU ATOM        | Quotidien   | 🔴 Haute   |
| `ingest_contributions.js` | Crowdsourcing   | Temps réel  | 🔴 Haute   |

### 2.3. Impact sur la recherche vectorielle

#### Filtrage par domain

**Requête actuelle :**

```sql
SELECT * FROM knowledge_chunks
WHERE embedding <-> $1 < 0.7
  AND domain = 'civics'
ORDER BY embedding <-> $1
LIMIT 5;
```

**Requête étendue GIS :**

```sql
SELECT * FROM knowledge_chunks
WHERE embedding <-> $1 < 0.7
  AND domain IN ('urbanisme', 'foncier', 'environnement', 'risques')
  -- Optionnel : filtrage géographique
  AND (metadata->>'commune_code' = '2B096' OR metadata->>'commune_code' IS NULL)
ORDER BY embedding <-> $1
LIMIT 5;
```

#### Indexation recommandée

```sql
-- Index composite pour les nouveaux domains
CREATE INDEX idx_chunks_gis_domains ON knowledge_chunks
  USING btree (domain)
  WHERE domain IN ('urbanisme', 'foncier', 'environnement', 'risques', 'cadastre');

-- Index pour filtrage géographique (si fréquent)
CREATE INDEX idx_chunks_commune ON knowledge_chunks
  USING btree ((metadata->>'commune_code'))
  WHERE metadata->>'commune_code' IS NOT NULL;
```

### 2.4. Stratégie de chunking par source

| Source          | Stratégie                 | Chunk size  |
| --------------- | ------------------------- | ----------- |
| DVF             | 1 chunk = 1 mutation      | ~200 tokens |
| BODACC          | 1 chunk = 1 annonce       | ~300 tokens |
| GPU zonage      | 1 chunk = 1 zone modifiée | ~400 tokens |
| ICPE            | 1 chunk = 1 installation  | ~500 tokens |
| Marchés publics | 1 chunk = 1 marché        | ~600 tokens |
| Contributions   | 1 chunk = 1 contribution  | ~400 tokens |

---

## 3. Impact sur Ophélia (chatbot)

### 3.1. Outils existants

```javascript
// netlify/edge-functions/lib/civic-tools.js

CIVIC_TOOLS = {
  civic_acts_search, // Recherche actes municipaux
  civic_acts_sql, // Requêtes SQL actes
  civic_deadlines, // Échéances juridiques
  civic_transparency_score, // Score transparence
  civic_legal_status, // Statut juridique
  civic_demandes_status, // Demandes CRPA/CADA
};
```

### 3.2. Nouveaux outils requis

```javascript
// netlify/edge-functions/lib/gis-tools.js

export const GIS_TOOLS = {
  gis_parcelle_search: {
    name: "gis_parcelle_search",
    description: `Recherche d'informations sur une parcelle cadastrale.
Utilise pour :
- Historique des zonages PLU/PLUi
- Mutations foncières (DVF)
- Risques associés (ICPE, pollution, inondation)
- Permis de construire récents`,
    parameters: {
      type: "object",
      properties: {
        parcelle_id: { type: "string", description: "ID parcelle (ex: 2B096000AK0377)" },
        commune_code: { type: "string", description: "Code INSEE commune" },
        include: {
          type: "array",
          items: { type: "string", enum: ["zonage", "dvf", "risques", "permis"] },
        },
      },
    },
  },

  gis_zonage_history: {
    name: "gis_zonage_history",
    description: `Historique des changements de zonage urbanistique.
Permet de voir si une parcelle est devenue constructible et quand.`,
    parameters: {
      type: "object",
      properties: {
        parcelle_id: { type: "string" },
        commune_code: { type: "string" },
        date_from: { type: "string", description: "Date début YYYY-MM-DD" },
      },
    },
  },

  gis_risques_zone: {
    name: "gis_risques_zone",
    description: `Risques environnementaux dans un périmètre.
Sources : Géorisques (ICPE, SIS), Hub'Eau, Géod'Air.`,
    parameters: {
      type: "object",
      properties: {
        latitude: { type: "number" },
        longitude: { type: "number" },
        radius_m: { type: "integer", description: "Rayon en mètres" },
        risk_types: {
          type: "array",
          items: { type: "string", enum: ["icpe", "pollution", "inondation", "seisme", "eau"] },
        },
      },
    },
  },

  gis_marches_commune: {
    name: "gis_marches_commune",
    description: `Marchés publics d'une commune.
Source : DECP (données essentielles de la commande publique).`,
    parameters: {
      type: "object",
      properties: {
        commune_code: { type: "string" },
        montant_min: { type: "number" },
        date_from: { type: "string" },
        objet_search: { type: "string" },
      },
    },
  },

  gis_elus_declarations: {
    name: "gis_elus_declarations",
    description: `Déclarations d'intérêts des élus.
Source : HATVP, registre des représentants d'intérêts.`,
    parameters: {
      type: "object",
      properties: {
        commune_code: { type: "string" },
        nom_elu: { type: "string" },
        include_lobbying: { type: "boolean" },
      },
    },
  },

  gis_contributions_search: {
    name: "gis_contributions_search",
    description: `Recherche dans les contributions citoyennes.
Enquêtes publiques, contentieux, nuisances, etc. signalés par les citoyens.`,
    parameters: {
      type: "object",
      properties: {
        commune_code: { type: "string" },
        categorie: {
          type: "string",
          enum: [
            "enquete_publique",
            "recours_contentieux",
            "nuisance",
            "travaux",
            "patrimoine",
            "biodiversite",
          ],
        },
        statut: { type: "string", enum: ["en_attente", "corroboree", "documentee", "officielle"] },
      },
    },
  },
};
```

### 3.3. Extension du prompt système

**Fichier à créer : `public/prompts/gis-transparency-system.md`**

```markdown
# 🗺️ Ophélia — Module Transparence Géographique

## Capacités étendues

En plus des actes municipaux, tu peux maintenant aider sur :

### 🏠 Urbanisme et foncier

- Historique des zonages PLU/PLUi
- Détection de parcelles devenues constructibles
- Mutations foncières (qui a vendu/acheté quoi, à quel prix)
- Permis de construire récents

### ⚠️ Risques environnementaux

- Installations classées (ICPE) à proximité
- Sites et sols pollués (SIS)
- Risques naturels (inondation, séisme, feu de forêt)
- Qualité de l'eau et de l'air

### 💰 Finances publiques

- Marchés publics attribués
- Comptes des collectivités
- Subventions reçues

### 👥 Élus et lobbying

- Déclarations d'intérêts des élus locaux
- Activités des représentants d'intérêts
- Conflits d'intérêts potentiels

### 📋 Contributions citoyennes

- Enquêtes publiques en cours ou passées
- Contentieux signalés
- Nuisances locales (bruit, pollution)
- Informations historiques reconstituées

## Sources de données

| Source                   | Fraîcheur   | Fiabilité                        |
| ------------------------ | ----------- | -------------------------------- |
| GPU (zonage)             | Quotidien   | ⭐⭐⭐⭐⭐ Officiel              |
| DVF (mutations)          | Semestriel  | ⭐⭐⭐⭐⭐ Officiel              |
| BODACC                   | Quotidien   | ⭐⭐⭐⭐⭐ Officiel              |
| Géorisques               | Mensuel     | ⭐⭐⭐⭐⭐ Officiel              |
| DECP                     | Mensuel     | ⭐⭐⭐⭐⭐ Officiel              |
| HATVP                    | Trimestriel | ⭐⭐⭐⭐⭐ Officiel              |
| Hub'Eau                  | Mensuel     | ⭐⭐⭐⭐⭐ Officiel              |
| Contributions citoyennes | Temps réel  | ⭐⭐⭐ Variable (voir confiance) |

## Niveaux de confiance des contributions

Toujours préciser le niveau de confiance :

- **Officielle** (100%) : Confirmée par source officielle
- **Documentée** (80-99%) : Preuves documentaires fournies
- **Corroborée** (60-80%) : Confirmée par plusieurs citoyens
- **En attente** (20-40%) : Non vérifiée

## Exemples de questions GIS

1. "Cette parcelle était-elle constructible avant 2020 ?"
2. "Y a-t-il des ICPE à moins de 500m de cette adresse ?"
3. "Quels marchés publics ont été attribués à l'entreprise X ?"
4. "Le maire a-t-il des liens avec des promoteurs immobiliers ?"
5. "Y a-t-il des enquêtes publiques en cours sur le PLU ?"
```

### 3.4. Intégration dans `rag_chatbot.js`

```javascript
// Ajout dans netlify/edge-functions/rag_chatbot.js

import { GIS_TOOLS, GIS_TOOL_HANDLERS } from "./lib/gis-tools.js";

// Dans la liste des tools
const ALL_TOOLS = {
  ...TOOLS,
  ...CIVIC_TOOLS,
  ...GIS_TOOLS, // ← Ajout
};

const ALL_HANDLERS = {
  ...TOOL_HANDLERS,
  ...CIVIC_TOOL_HANDLERS,
  ...GIS_TOOL_HANDLERS, // ← Ajout
};
```

---

## 4. Impact sur les composants React

### 4.1. Composants existants

| Composant                  | Rôle actuel          | Impact GIS           |
| -------------------------- | -------------------- | -------------------- |
| `CitizenMap.jsx`           | Carte de base OSM    | 🟠 Étendre pour IGN  |
| `IncidentsLayer.jsx`       | Marqueurs incidents  | ✅ Compatible        |
| `EventsLayer.jsx`          | Marqueurs événements | ✅ Compatible        |
| `LocationPicker.jsx`       | Sélection position   | ✅ Compatible        |
| `AddressSearchControl.jsx` | Recherche adresse    | 🟠 Remplacer par IGN |
| `LocateControl.jsx`        | Géolocalisation      | ✅ Compatible        |

### 4.2. Nouveaux composants requis

#### Composants de carte

| Composant                | Rôle                     |
| ------------------------ | ------------------------ |
| `GeoportalMap.jsx`       | Carte avec extension IGN |
| `LayerSwitcher.jsx`      | Gestionnaire de calques  |
| `ZonageLayer.jsx`        | Affichage zonages PLU    |
| `RisquesLayer.jsx`       | Affichage risques        |
| `ContributionsLayer.jsx` | Contributions citoyennes |
| `DVFLayer.jsx`           | Mutations foncières      |
| `MarchesLayer.jsx`       | Marchés publics          |

#### Composants de formulaire

| Composant                    | Rôle                  |
| ---------------------------- | --------------------- |
| `ContributionForm.jsx`       | Signalement générique |
| `EnquetePubliqueForm.jsx`    | Enquête publique      |
| `ZonageContributionForm.jsx` | Zonage historique     |
| `NuisanceForm.jsx`           | Signalement nuisance  |

#### Composants d'affichage

| Composant                   | Rôle                |
| --------------------------- | ------------------- |
| `ParcelleInfoPanel.jsx`     | Infos parcelle      |
| `ContributionsList.jsx`     | Liste contributions |
| `ContributorBadges.jsx`     | Gamification        |
| `TransparencyDashboard.jsx` | Tableau de bord     |

### 4.3. Architecture proposée

```
src/components/
├── map/
│   ├── CitizenMap.jsx           # Existant (à étendre)
│   ├── GeoportalMap.jsx         # Nouveau - carte IGN
│   ├── LayerSwitcher.jsx        # Nouveau
│   ├── controls/
│   │   ├── AddressSearchControl.jsx   # Existant
│   │   ├── LocateControl.jsx          # Existant
│   │   └── DrawControl.jsx            # Nouveau
│   └── layers/
│       ├── EventsLayer.jsx      # Existant
│       ├── IncidentsLayer.jsx   # Existant
│       ├── ZonageLayer.jsx      # Nouveau
│       ├── RisquesLayer.jsx     # Nouveau
│       ├── ContributionsLayer.jsx # Nouveau
│       ├── DVFLayer.jsx         # Nouveau
│       └── MarchesLayer.jsx     # Nouveau
│
├── gis/
│   ├── contributions/
│   │   ├── ContributionForm.jsx
│   │   ├── ContributionsList.jsx
│   │   ├── ContributionDetail.jsx
│   │   └── VoteButton.jsx
│   ├── parcelle/
│   │   ├── ParcelleSearch.jsx
│   │   ├── ParcelleInfoPanel.jsx
│   │   └── ZonageHistory.jsx
│   ├── transparency/
│   │   ├── TransparencyDashboard.jsx
│   │   ├── RisquesPanel.jsx
│   │   └── MarchesPublicsTable.jsx
│   └── gamification/
│       ├── ContributorProfile.jsx
│       └── BadgesDisplay.jsx
│
└── pages/
    └── gis/                      # Nouvelles pages
        ├── GISHome.jsx
        ├── ParcelleView.jsx
        ├── ContributionsView.jsx
        └── TransparencyView.jsx
```

### 4.4. Extension de CitizenMap

```jsx
// src/components/map/CitizenMap.jsx - Version étendue

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, ZoomControl, useMap, LayersControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Extension IGN
import "geoportal-extensions-leaflet";
import "geoportal-extensions-leaflet/dist/GpPluginLeaflet.css";

// Layers
import LocateControl from "./controls/LocateControl";
import AddressSearchControl from "./controls/AddressSearchControl";

// Couches thématiques
const IGN_LAYERS = {
  planIGN: {
    url: "https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&TILEMATRIXSET=PM&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}",
    attribution: "Carte © IGN/Geoplateforme",
  },
  ortho: {
    url: "https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&TILEMATRIXSET=PM&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}",
    attribution: "Ortho © IGN/Geoplateforme",
  },
  cadastre: {
    url: "https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&TILEMATRIXSET=PM&LAYER=CADASTRALPARCELS.PARCELLAIRE_EXPRESS&STYLE=normal&FORMAT=image/png&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}",
    attribution: "Cadastre © IGN/Geoplateforme",
  },
};

export default function CitizenMap({
  center,
  zoom = 13,
  children,
  className = "h-full w-full",
  showLayerControl = false, // Nouveau
  showCadastre = false, // Nouveau
  baseLayer = "osm", // Nouveau: 'osm' | 'ign' | 'ortho'
}) {
  const defaultCenter = (import.meta.env.VITE_MAP_DEFAULT_CENTER || "42.3094,9.1490")
    .split(",")
    .map(Number);

  const getBaseLayer = () => {
    switch (baseLayer) {
      case "ign":
        return <TileLayer {...IGN_LAYERS.planIGN} />;
      case "ortho":
        return <TileLayer {...IGN_LAYERS.ortho} />;
      default:
        return (
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        );
    }
  };

  return (
    <MapContainer
      center={center || defaultCenter}
      zoom={zoom}
      scrollWheelZoom={true}
      className={className}
      style={{ minHeight: "400px", width: "100%", height: "100%" }}
    >
      {showLayerControl ? (
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked={baseLayer === "osm"} name="OpenStreetMap">
            <TileLayer
              attribution="&copy; OpenStreetMap"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer checked={baseLayer === "ign"} name="Plan IGN">
            <TileLayer {...IGN_LAYERS.planIGN} />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer checked={baseLayer === "ortho"} name="Orthophotos">
            <TileLayer {...IGN_LAYERS.ortho} />
          </LayersControl.BaseLayer>
          {showCadastre && (
            <LayersControl.Overlay name="Cadastre">
              <TileLayer {...IGN_LAYERS.cadastre} opacity={0.7} />
            </LayersControl.Overlay>
          )}
        </LayersControl>
      ) : (
        getBaseLayer()
      )}

      <LocateControl />
      <AddressSearchControl />
      {children}
    </MapContainer>
  );
}
```

---

## 5. Impact sur l'ingestion de données

### 5.1. Scripts existants

| Script                       | Source              | Statut   |
| ---------------------------- | ------------------- | -------- |
| `ingest_cortideri_chunks.js` | Corti d'Eri         | ✅ Actif |
| `ingest_wiki_pages.js`       | Wiki interne        | ✅ Actif |
| `ingest_conseils.js`         | Conseils municipaux | ✅ Actif |
| `ingest_file.js`             | Documents PDF       | ✅ Actif |
| `scrape-cortideri.js`        | Scraping            | ✅ Actif |

### 5.2. Nouveaux scripts requis

| Script                    | Priorité   | Complexité | Source            |
| ------------------------- | ---------- | ---------- | ----------------- |
| `ingest_gpu.js`           | 🔴 Haute   | Moyenne    | GPU ATOM feed     |
| `ingest_dvf.js`           | 🔴 Haute   | Moyenne    | DVF CSV/Parquet   |
| `ingest_bodacc.js`        | 🔴 Haute   | Faible     | BODACC API REST   |
| `ingest_georisques.js`    | 🟠 Moyenne | Haute      | WFS + JSON        |
| `ingest_decp.js`          | 🟠 Moyenne | Moyenne    | JSON ~800Mo       |
| `ingest_sitadel.js`       | 🟡 Basse   | Moyenne    | API               |
| `ingest_hatvp.js`         | 🟡 Basse   | Faible     | API REST          |
| `ingest_hubeau.js`        | 🟡 Basse   | Faible     | 13 APIs REST      |
| `ingest_contributions.js` | 🔴 Haute   | Faible     | Supabase realtime |

### 5.3. Pattern d'ingestion unifié

```javascript
// scripts/lib/gis-ingest-base.js

export class GISIngestBase {
  constructor(config) {
    this.sourceName = config.sourceName;
    this.sourceType = config.sourceType;
    this.domain = config.domain;
    this.supabase = config.supabase;
    this.openai = config.openai;
  }

  async fetchData() {
    throw new Error("fetchData() must be implemented");
  }

  async transformRecord(record) {
    throw new Error("transformRecord() must be implemented");
  }

  buildChunkText(record) {
    return `TYPE: fact
STATUT: confirmed
SOURCE: ${this.sourceName}
DATE: ${record.date || "N/A"}

${record.content}

${record.metadata ? `MÉTADONNÉES: ${JSON.stringify(record.metadata)}` : ""}`;
  }

  async ingestRecord(record) {
    const sourceId = await this.upsertDocumentSource(record);
    if (!sourceId.changed) return { skipped: true };

    const chunks = await this.transformRecord(record);
    for (const chunk of chunks) {
      await this.insertChunk(sourceId.id, chunk);
    }
    return { processed: true, chunks: chunks.length };
  }

  async upsertDocumentSource(record) {
    // Pattern existant de ingest_cortideri_chunks.js
    // ...
  }

  async insertChunk(sourceId, chunk) {
    const text = this.buildChunkText(chunk);
    const textHash = this.hashText(text);

    // Déduplication
    const exists = await this.chunkExists(textHash);
    if (exists) return { skipped: true };

    // Embedding
    const embedding = await this.generateEmbedding(text);

    // Insert
    await this.supabase.from("knowledge_chunks").insert({
      source_id: sourceId,
      text,
      text_hash: textHash,
      embedding: JSON.stringify(embedding),
      type: "fact",
      status: "confirmed",
      source_type: this.sourceType,
      domain: this.domain,
      info_date: chunk.date,
      layer: "hot",
      metadata: chunk.metadata,
    });
  }
}
```

### 5.4. Estimation des coûts d'embedding

| Source        | Volume estimé     | Tokens/record | Coût mensuel |
| ------------- | ----------------- | ------------- | ------------ |
| DVF           | ~500/commune/an   | ~200          | ~$0.002      |
| BODACC        | ~100/commune/mois | ~300          | ~$0.0006     |
| GPU zonage    | ~50 modifs/an     | ~400          | ~$0.0004     |
| DECP          | ~100/commune/mois | ~600          | ~$0.0012     |
| Contributions | ~50/mois          | ~400          | ~$0.0004     |

**Total estimé :** ~$0.005/mois pour une commune moyenne

---

## 6. Impact sur les cron jobs

### 6.1. Crons existants

```javascript
// Existants (via GitHub Actions ou Netlify Scheduled Functions)
- Scraping Cortideri : hebdomadaire
- Sync conseils : hebdomadaire
```

### 6.2. Nouveaux crons requis

```javascript
// scripts/cron-gis-sync.js

const GIS_SYNC_SCHEDULE = [
  // Haute fréquence
  { name: "GPU ATOM", fn: syncGPU, cron: "0 6 * * *" }, // 6h quotidien
  { name: "BODACC", fn: syncBODACC, cron: "0 8 * * *" }, // 8h quotidien

  // Fréquence moyenne
  { name: "Géorisques ICPE", fn: syncICPE, cron: "0 3 1 * *" }, // 3h le 1er mensuel
  { name: "DECP", fn: syncDECP, cron: "0 4 1 * *" }, // 4h le 1er mensuel
  { name: "Sitadel", fn: syncSitadel, cron: "0 5 1 * *" }, // 5h le 1er mensuel
  { name: "Hub'Eau", fn: syncHubEau, cron: "0 2 15 * *" }, // 2h le 15 mensuel

  // Basse fréquence
  { name: "RNE élus", fn: syncRNE, cron: "0 2 * * 1" }, // 2h lundi
  { name: "HATVP", fn: syncHATVP, cron: "0 2 1 */3 *" }, // 2h trimestriel
  { name: "DVF", fn: syncDVF, cron: "0 3 15 4,10 *" }, // 3h 15 avril/octobre
  { name: "DGFIP comptes", fn: syncComptes, cron: "0 4 1 6 *" }, // 4h 1er juin (annuel)
];
```

---

## 7. Risques et recommandations

### 7.1. Risques identifiés

| Risque                    | Probabilité | Impact   | Mitigation               |
| ------------------------- | ----------- | -------- | ------------------------ |
| Surcharge base de données | 🟠 Moyenne  | 🔴 Élevé | Partitioning, archivage  |
| Coût embeddings explosif  | 🟡 Faible   | 🟠 Moyen | Chunking optimisé, cache |
| Incohérence données       | 🟠 Moyenne  | 🟠 Moyen | Validation schéma, tests |
| Performance RAG dégradée  | 🟠 Moyenne  | 🔴 Élevé | Index spécialisés        |
| Complexité maintenance    | 🔴 Élevée   | 🟠 Moyen | Documentation, patterns  |

### 7.2. Recommandations

#### Phase 1 : Fondations (2-3 semaines)

1. ✅ Créer les tables SQL de base (map_layers, user_layer_preferences)
2. ✅ Étendre CitizenMap avec les calques IGN
3. ✅ Implémenter `ingest_gpu.js` et `ingest_dvf.js`
4. ✅ Ajouter les outils GIS à Ophélia

#### Phase 2 : Risques et transparence (2-3 semaines)

1. Implémenter `ingest_georisques.js`
2. Implémenter `ingest_decp.js` et `ingest_hatvp.js`
3. Créer les composants RisquesLayer et MarchesLayer
4. Créer le TransparencyDashboard

#### Phase 3 : Crowdsourcing (2-3 semaines)

1. Créer les tables de contributions
2. Implémenter les formulaires de contribution
3. Système de vote et validation
4. Gamification

#### Phase 4 : Optimisation (ongoing)

1. Monitoring des performances
2. Ajustement des index
3. Archivage données anciennes
4. A/B testing UX

### 7.3. Décisions tranchées

1. ~~**Multi-tenant ?**~~ → **NON** - Chaque commune a sa propre base Supabase (architecture
   fédérative existante)

2. **Partitioning ?** → Non nécessaire avec une base par commune (volumes limités)

3. **Cache local BD TOPO ?** → Oui, recommandé pour les performances

4. **Embeddings locaux ?** → À évaluer phase 4 si les coûts deviennent significatifs

---

## 8. Extension du module de fédération pour le GIS

### 8.1. Configuration multi-instances via Vault

Chaque instance (commune ou hub) stocke sa configuration de fédération dans `instance_config` :

```sql
-- Configuration de fédération dans instance_config
INSERT INTO instance_config (key, value, category, description) VALUES
  -- Identité de l'instance
  ('community_name', 'Corte', 'identity', 'Nom de la communauté'),
  ('community_code', '2B096', 'identity', 'Code INSEE'),
  ('region_code', 'COR', 'identity', 'Code région'),

  -- Configuration fédération
  ('is_hub', 'false', 'federation', 'true si cette instance est un hub'),
  ('hub_type', 'commune', 'federation', 'Type: commune, epci, region, national'),
  ('parent_hub_url', 'https://corse.lepp.fr', 'federation', 'URL du hub parent'),

  -- Secrets fédération (chiffrés)
  ('federation_api_key', 'xxx', 'secrets', 'Clé API pour sync avec le hub'),
  ('national_api_key', 'xxx', 'secrets', 'Clé API hub national')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

#### Accès à la configuration dans le code

```javascript
// src/lib/gis-federation.js - Version avec vault

import { getConfig, loadConfig } from "./instanceConfig";

// Charger la config au démarrage
await loadConfig();

// Récupérer les valeurs de fédération
const CURRENT_INSTANCE = {
  url: getConfig("supabase_url") || import.meta.env.VITE_SUPABASE_URL,
  name: getConfig("community_name"),
  insee: getConfig("community_code"),
  regionCode: getConfig("region_code"),
  isHub: getConfig("is_hub") === "true",
  hubType: getConfig("hub_type"),
  parentHubUrl: getConfig("parent_hub_url"),
};

// Pour les secrets (côté serveur uniquement)
const federationApiKey = getConfig("federation_api_key");
```

### 8.3. Nouveau module `src/lib/gis-federation.js`

```javascript
// src/lib/gis-federation.js
// Extension du système fédératif pour les données GIS

import { supabase } from "./supabase";
import { createClient } from "@supabase/supabase-js";
import { getConfig } from "./instanceConfig";

// ============================================================================
// CONFIGURATION INSTANCE (depuis le vault)
// ============================================================================

export function getCurrentInstance() {
  return {
    url: getConfig("supabase_url"),
    name: getConfig("community_name"),
    insee: getConfig("community_code"),
    regionCode: getConfig("region_code"),
    isHub: getConfig("is_hub") === "true",
    hubType: getConfig("hub_type"),
    parentHubUrl: getConfig("parent_hub_url"),
  };
}

// ============================================================================
// TYPES DE DONNÉES FÉDÉRÉES GIS
// ============================================================================

export const GIS_FEDERATION_TYPES = {
  contribution: {
    table: "contributions_citoyennes",
    syncToHub: true,
    direction: "up", // commune → hub
    description: "Contributions citoyennes (enquêtes, contentieux, etc.)",
  },
  alerte_zonage: {
    table: "alertes_zonage",
    syncToHub: true,
    direction: "up",
    description: "Alertes de changement de zonage détectées",
  },
  stats_transparence: {
    table: "v_stats_transparence_commune",
    syncToHub: true,
    direction: "up",
    description: "Indicateurs de transparence agrégés",
  },
  zonage_historique: {
    table: "zonage_historique",
    syncToHub: false, // Données locales uniquement
    description: "Archive des zonages PLU/PLUi",
  },
  mutations_foncieres: {
    table: "mutations_foncieres",
    syncToHub: false, // Données nationales déjà disponibles via DVF
    description: "Mutations foncières (DVF)",
  },
};

// ============================================================================
// SYNCHRONISATION DES CONTRIBUTIONS VERS LE HUB
// ============================================================================

/**
 * Synchronise les contributions locales vers le hub régional/national
 * @param {Object} options - Options de synchronisation
 * @returns {Promise<{success: boolean, synced: number, failed: number}>}
 */
export async function syncContributionsToHub(options = {}) {
  const {
    types = ["contribution", "alerte_zonage"],
    hubUrl = null,
    apiKey = null,
    limit = 100,
  } = options;

  const CURRENT_INSTANCE = getCurrentInstance();

  // Déterminer le hub cible (depuis le vault ou paramètre)
  const targetHub = hubUrl || (await getRegionalHub());
  if (!targetHub) {
    return { success: false, error: "Aucun hub configuré" };
  }

  // Récupérer la clé API depuis le vault si non fournie
  const hubApiKey = apiKey || getConfig("federation_api_key");

  let totalSynced = 0;
  let totalFailed = 0;

  for (const type of types) {
    const config = GIS_FEDERATION_TYPES[type];
    if (!config?.syncToHub) continue;

    // Récupérer les enregistrements en attente de sync
    const { data: pending, error: fetchError } = await supabase
      .from(config.table)
      .select("*")
      .eq("sync_status", "pending")
      .limit(limit);

    if (fetchError || !pending?.length) continue;

    // Créer client pour le hub (avec clé API du vault)
    const hubClient = createClient(targetHub.instance_url, hubApiKey || targetHub.api_key);

    for (const record of pending) {
      try {
        // Préparer les données pour le hub
        const hubData = {
          ...record,
          _source_instance: CURRENT_INSTANCE.url,
          _source_commune: CURRENT_INSTANCE.name,
          _source_insee: CURRENT_INSTANCE.insee,
          _source_id: record.id,
          _synced_at: new Date().toISOString(),
        };

        // Envoyer vers le hub
        const { error: syncError } = await hubClient
          .from(`federated_${config.table}`)
          .upsert(hubData, { onConflict: "_source_instance,_source_id" });

        if (syncError) {
          await markSyncFailed(config.table, record.id, syncError.message);
          totalFailed++;
        } else {
          await markSyncSuccess(config.table, record.id);
          totalSynced++;
        }
      } catch (err) {
        await markSyncFailed(config.table, record.id, err.message);
        totalFailed++;
      }
    }
  }

  return { success: true, synced: totalSynced, failed: totalFailed };
}

/**
 * Récupère les contributions fédérées depuis le hub
 * (pour afficher les données des autres communes)
 * @param {Object} filters - Filtres (region, type, etc.)
 * @returns {Promise<Array>}
 */
export async function fetchFederatedContributions(filters = {}) {
  const CURRENT_INSTANCE = getCurrentInstance();

  const {
    regionCode = CURRENT_INSTANCE.regionCode,
    types = ["contribution"],
    limit = 100,
  } = filters;

  const hubUrl = await getRegionalHub();
  if (!hubUrl) return [];

  // Clé API depuis le vault
  const hubApiKey = getConfig("federation_api_key");
  const hubClient = createClient(hubUrl.instance_url, hubApiKey || hubUrl.api_key);

  const results = [];

  for (const type of types) {
    const config = GIS_FEDERATION_TYPES[type];
    if (!config) continue;

    const { data, error } = await hubClient
      .from(`federated_${config.table}`)
      .select("*")
      .eq("_source_region", regionCode)
      .neq("_source_insee", CURRENT_INSTANCE.insee) // Exclure notre propre commune
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!error && data) {
      results.push(...data.map((r) => ({ ...r, _type: type })));
    }
  }

  return results;
}

// ============================================================================
// AGRÉGATION DES STATISTIQUES (pour les hubs)
// ============================================================================

/**
 * Agrège les statistiques de transparence de toutes les communes
 * (fonction pour le hub uniquement)
 * @returns {Promise<Object>}
 */
export async function aggregateRegionalStats() {
  const CURRENT_INSTANCE = getCurrentInstance();

  if (!CURRENT_INSTANCE.isHub) {
    return { error: "Cette fonction est réservée aux hubs" };
  }

  const { data: instances } = await getRegisteredInstances({
    regionCode: CURRENT_INSTANCE.regionCode,
    type: "commune",
  });

  const stats = {
    region: getConfig("region_name") || CURRENT_INSTANCE.region,
    communes_count: instances?.length || 0,
    contributions_total: 0,
    alertes_zonage_total: 0,
    score_transparence_moyen: 0,
    communes: [],
  };

  for (const instance of instances || []) {
    const { data: communeStats } = await supabase
      .from("federated_stats_transparence")
      .select("*")
      .eq("_source_insee", instance.commune_insee)
      .single();

    if (communeStats) {
      stats.contributions_total += communeStats.contributions_count || 0;
      stats.alertes_zonage_total += communeStats.alertes_count || 0;
      stats.communes.push({
        nom: instance.instance_name,
        insee: instance.commune_insee,
        score: communeStats.score_transparence,
      });
    }
  }

  // Calculer la moyenne
  if (stats.communes.length > 0) {
    stats.score_transparence_moyen =
      stats.communes.reduce((sum, c) => sum + (c.score || 0), 0) / stats.communes.length;
  }

  return stats;
}

// ============================================================================
// DÉCOUVERTE INTER-COMMUNES
// ============================================================================

/**
 * Découvre les alertes de zonage dans les communes voisines
 * (utile pour détecter des patterns régionaux)
 * @param {string} communeInsee - Code INSEE de la commune
 * @param {number} radiusKm - Rayon de recherche en km
 * @returns {Promise<Array>}
 */
export async function discoverNearbyAlerts(communeInsee, radiusKm = 50) {
  const hubUrl = await getRegionalHub();
  if (!hubUrl) return [];

  // Note: Cette requête suppose que le hub a une fonction de recherche géographique
  const response = await fetch(
    `${hubUrl.instance_url}/api/gis/nearby-alerts?insee=${communeInsee}&radius=${radiusKm}`
  );

  if (!response.ok) return [];

  return response.json();
}

// ============================================================================
// UTILITAIRES INTERNES
// ============================================================================

async function getRegionalHub() {
  // D'abord vérifier si le hub parent est configuré dans le vault
  const parentHubUrl = getConfig("parent_hub_url");
  if (parentHubUrl) {
    return { instance_url: parentHubUrl };
  }

  // Sinon, chercher dans le registre de fédération
  const CURRENT_INSTANCE = getCurrentInstance();
  const instances = await getRegisteredInstances({
    regionCode: CURRENT_INSTANCE.regionCode,
    hubOnly: true,
  });
  return instances?.[0] || null;
}

async function getRegisteredInstances(filters = {}) {
  const { data } = await supabase
    .from("federation_registry")
    .select("*")
    .eq("status", "active")
    .eq("region_code", filters.regionCode || getConfig("region_code"));

  if (filters.hubOnly) {
    return data?.filter((i) => i.is_hub) || [];
  }
  if (filters.type) {
    return data?.filter((i) => i.instance_type === filters.type) || [];
  }
  return data || [];
}

async function markSyncSuccess(table, id) {
  await supabase
    .from(table)
    .update({
      sync_status: "synced",
      synced_at: new Date().toISOString(),
      sync_error: null,
    })
    .eq("id", id);
}

async function markSyncFailed(table, id, error) {
  await supabase
    .from(table)
    .update({
      sync_status: "failed",
      sync_attempts: supabase.raw("sync_attempts + 1"),
      sync_error: error,
    })
    .eq("id", id);
}

// ============================================================================
// EXPORT
// ============================================================================

export default {
  getCurrentInstance,
  GIS_FEDERATION_TYPES,
  syncContributionsToHub,
  fetchFederatedContributions,
  aggregateRegionalStats,
  discoverNearbyAlerts,
};
```

### 8.4. Tables fédérées sur le hub

```sql
-- Tables sur le HUB RÉGIONAL/NATIONAL uniquement
-- Ces tables agrègent les données de toutes les communes

-- Contributions fédérées
CREATE TABLE public.federated_contributions_citoyennes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Données de la contribution (copie)
  categorie text NOT NULL,
  titre text NOT NULL,
  description text,
  geometry jsonb,
  statut text,
  niveau_confiance integer,

  -- Métadonnées source
  _source_instance text NOT NULL,
  _source_commune text NOT NULL,
  _source_insee text NOT NULL,
  _source_region text,
  _source_id uuid NOT NULL,
  _synced_at timestamptz NOT NULL,

  created_at timestamptz DEFAULT now(),

  UNIQUE(_source_instance, _source_id)
);

CREATE INDEX idx_federated_contrib_region ON public.federated_contributions_citoyennes(_source_region);
CREATE INDEX idx_federated_contrib_insee ON public.federated_contributions_citoyennes(_source_insee);

-- Alertes zonage fédérées
CREATE TABLE public.federated_alertes_zonage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Données de l'alerte
  parcelle_id text,
  ancien_zonage text,
  nouveau_zonage text,
  date_detection date,
  geometry jsonb,

  -- Métadonnées source
  _source_instance text NOT NULL,
  _source_commune text NOT NULL,
  _source_insee text NOT NULL,
  _source_region text,
  _source_id uuid NOT NULL,
  _synced_at timestamptz NOT NULL,

  UNIQUE(_source_instance, _source_id)
);

-- Stats transparence fédérées
CREATE TABLE public.federated_stats_transparence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Indicateurs
  contributions_count integer DEFAULT 0,
  alertes_count integer DEFAULT 0,
  score_transparence numeric,
  periode text, -- '2025-01' format YYYY-MM

  -- Métadonnées source
  _source_instance text NOT NULL,
  _source_commune text NOT NULL,
  _source_insee text NOT NULL UNIQUE,
  _source_region text,
  _synced_at timestamptz NOT NULL
);
```

### 8.5. Schéma de flux de données

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FLUX DE DONNÉES GIS FÉDÉRÉ                         │
└─────────────────────────────────────────────────────────────────────────────┘

   COMMUNE (Corte)                  HUB RÉGIONAL (Corse)           HUB NATIONAL
   ─────────────────                ────────────────────           ────────────
   ┌──────────────────┐
   │ contributions_   │
   │ citoyennes       │ ───sync───► ┌──────────────────────┐
   │                  │             │ federated_           │
   │ alertes_zonage   │ ───sync───► │ contributions        │ ───sync───► ┌─────────────┐
   │                  │             │                      │             │ federated_  │
   │ stats_commune    │ ───sync───► │ federated_alertes    │ ───sync───► │ national_*  │
   └──────────────────┘             │                      │             └─────────────┘
                                    │ federated_stats      │
   ┌──────────────────┐             └──────────────────────┘
   │ zonage_historique│                      │
   │ (local only)     │                      │
   │                  │                      ▼
   │ mutations_       │             ┌──────────────────────┐
   │ foncieres        │             │ Vue régionale        │
   │ (local only)     │             │ (toutes communes)    │
   └──────────────────┘             └──────────────────────┘


   Légende:
   ───sync───►  Synchronisation périodique (cron)
   (local only) Données non synchronisées (déjà disponibles nationalement)
```

---

## 9. Modèle associatif : Financement par dons

### 9.1. Philosophie du projet

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ASSOCIATION C.O.R.S.I.C.A.                               │
│          Collectif Ouvert pour la Résilience et la Souveraineté             │
│              Informatique des Citoyens et Administrations (sic)             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   🎯 MISSION                                                                │
│   Développer et maintenir des outils numériques de transparence             │
│   démocratique, gratuits et open source, pour les communes françaises.      │
│                                                                             │
│   💡 VALEURS
│   • 100% Open Source (licence MIT/AGPL)                                     │
│   • 100% Transparent (code, finances, gouvernance)                          │
│   • 100% Bénévole (aucun salarié, aucun actionnaire)                        │
│   • 100% Indépendant (aucun lien politique ou commercial)                   │
│                                                                             │
│   🏛️ STATUT                                                                 │
│   Association loi 1901, bientôt reconnue d'intérêt général                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.2. Modèle de financement : Dons uniquement

Inspiré par le modèle **HelloAsso** (plateforme 100% gratuite financée par pourboires volontaires),
le projet est financé exclusivement par la générosité des citoyens et des collectivités.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SOURCES DE FINANCEMENT                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   💚 DONS CITOYENS                                                          │
│   ├── HelloAsso (principal)                                                 │
│   ├── Open Collective                                                       │
│   ├── Liberapay                                                             │
│   └── Virement direct                                                       │
│                                                                             │
│   🏛️ SOUTIENS COLLECTIVITÉS (dons, pas achats)                              │
│   ├── Subventions (Région, Département, État)                               │
│   ├── Mécénat de compétences                                                │
│   └── Prêt de ressources (serveurs, etc.)                                   │
│                                                                             │
│   🎓 SOUTIENS ACADÉMIQUES                                                   │
│   ├── Crédits recherche (Université de Corse)                               │
│   ├── Stages, projets étudiants                                             │
│   └── Partenariats CNRS/INRIA                                               │
│                                                                             │
│   🌍 FINANCEMENTS EUROPÉENS                                                 │
│   ├── Fonds NGI (Next Generation Internet)                                  │
│   ├── Horizon Europe - Civic Tech                                           │
│   └── FEDER Numérique                                                       │
│                                                                             │
│   ❌ CE QUE NOUS REFUSONS                                                   │
│   ├── Abonnements payants                                                   │
│   ├── Publicité                                                             │
│   ├── Revente de données                                                    │
│   └── Financement politique                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.3. Budget prévisionnel (fonctionnement minimal)

| Poste                       | Coût annuel    | Notes                       |
| --------------------------- | -------------- | --------------------------- |
| **Hébergement Supabase**    | ~500€          | Plan gratuit + Pro pour hub |
| **Hébergement Netlify**     | ~200€          | Plan gratuit + extras       |
| **Nom de domaine**          | ~50€           | transparence-commune.fr     |
| **API OpenAI (embeddings)** | ~200€          | Usage modéré                |
| **Outils dev**              | ~100€          | GitHub Pro, Sentry          |
| **Assurance association**   | ~150€          | RC obligatoire              |
| **Frais bancaires**         | ~50€           | HelloAsso = 0€              |
| **Total minimum**           | **~1 250€/an** | **~100€/mois**              |

**Coût marginal par commune supplémentaire : ~0€** (tiers gratuits Supabase/Netlify suffisants pour
petites communes)

### 9.4. Paliers de dons (HelloAsso)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SOUTENIR LE PROJET                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ☕ CAFÉ CITOYEN          🌿 SOUTIEN              🌳 MÉCÈNE                │
│   5€ ponctuel             10€/mois                 50€/mois                 │
│                           (120€/an)                (600€/an)                │
│                                                                             │
│   • Merci !               • Merci !                • Merci !                │
│   • Badge donateur        • Badge donateur         • Badge mécène           │
│   • Newsletter            • Newsletter             • Newsletter             │
│                           • Nom au générique       • Nom au générique       │
│                                                    • Accès Discord privé    │
│                                                    • Vote sur priorités     │
│                                                                             │
│   🏛️ COMMUNE PARTENAIRE                                                     │
│   Don libre (suggéré : 200-500€/an)                                         │
│                                                                             │
│   • Logo sur la page partenaires                                            │
│   • Accompagnement prioritaire au déploiement                               │
│   • Mention dans les communications                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Important** : Tous les paliers sont **suggérés**, jamais obligatoires. Toutes les fonctionnalités
restent 100% gratuites pour tous.

### 9.5. Transparence financière totale

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TRANSPARENCE DES FINANCES                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   📊 PUBLICATION MENSUELLE                                                  │
│   ├── Dons reçus (montants, sans noms)                                     │
│   ├── Dépenses détaillées (factures publiques)                             │
│   ├── Solde de trésorerie                                                  │
│   └── Projection à 6 mois                                                   │
│                                                                              │
│   📈 TABLEAU DE BORD PUBLIC                                                 │
│   └── /transparence/finances (temps réel)                                   │
│                                                                              │
│   📋 RAPPORT ANNUEL                                                         │
│   ├── Bilan financier certifié                                             │
│   ├── Rapport d'activité                                                   │
│   └── Objectifs année suivante                                              │
│                                                                              │
│   🔍 AUDIT                                                                  │
│   └── Comptes vérifiables par tout adhérent                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.6. Objectifs de collecte

| Palier            | Montant/an | Permet de...                                   |
| ----------------- | ---------- | ---------------------------------------------- |
| **Survie**        | 1 500€     | Couvrir les frais fixes (hébergement, domaine) |
| **Confort**       | 5 000€     | + API IA, monitoring, backup pro               |
| **Développement** | 15 000€    | + Prestataire ponctuel, audits sécurité        |
| **Croissance**    | 30 000€    | + Infrastructure multi-régions, support        |

### 9.7. Pourquoi pas de modèle commercial ?

| Argument                           | Notre réponse                                                           |
| ---------------------------------- | ----------------------------------------------------------------------- |
| "Un SaaS payant serait viable"     | Oui, mais crée une dépendance financière et exclut les petites communes |
| "Les communes ont des budgets"     | Marchés publics = lourdeur, inégalités, vendor lock-in                  |
| "Comment payer des développeurs ?" | Bénévolat + subventions recherche + contributions open source           |
| "Pas scalable"                     | HelloAsso : 0 salarié → 300+ salariés, toujours gratuit                 |
| "Risque de disparition"            | Open source = le code survit, fork possible                             |

### 9.8. Appel à contributions

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COMMENT CONTRIBUER ?                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   💻 DÉVELOPPEMENT                                                          │
│   └── github.com/JeanHuguesRobert/survey                                    │
│                                                                              │
│   📝 DOCUMENTATION                                                          │
│   └── Guides, traductions, tutoriels                                        │
│                                                                              │
│   🎨 DESIGN                                                                 │
│   └── UI/UX, illustrations, vidéos                                          │
│                                                                              │
│   🧪 TESTS                                                                  │
│   └── Beta-testeurs, retours utilisateurs                                   │
│                                                                              │
│   📢 COMMUNICATION                                                          │
│   └── Réseaux sociaux, articles, conférences                               │
│                                                                              │
│   💚 DONS                                                                   │
│   └── helloasso.com/associations/corsica                                    │
│                                                                              │
│   🏛️ DÉPLOIEMENT                                                           │
│   └── Proposer le projet à votre commune                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.9. Stratégie d'acquisition : Municipales 2026

Les élections municipales de mars 2026 représentent une **opportunité unique** pour positionner la
plateforme comme **LA référence** en matière de transparence communale.

#### Concept clé : Pas des promesses, des actes

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│           MUNICIPALES 2026 : LA TRANSPARENCE EN ACTES                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   🎯 PROBLÈME                                                               │
│   Les candidats font des promesses de transparence pendant la campagne,     │
│   mais comment les électeurs peuvent-ils vérifier leur sincérité ?          │
│                                                                              │
│   💡 SOLUTION                                                               │
│   Chaque liste électorale peut déployer SA propre instance de               │
│   transparence AVANT l'élection et démontrer son engagement concret.        │
│                                                                              │
│   📊 RÉSULTAT                                                               │
│   Les citoyens comparent les listes sur des ACTES MESURABLES,               │
│   pas sur des discours.                                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Multi-instances par commune

Pendant les campagnes électorales, **plusieurs instances peuvent coexister** sur une même commune :

| Acteur                 | Instance                  | Objectif                   |
| ---------------------- | ------------------------- | -------------------------- |
| Liste A "Corte Avenir" | `corte-avenir.lepp.fr`    | Montrer ses engagements    |
| Liste B "Renouveau"    | `corte-renouveau.lepp.fr` | Démontrer sa crédibilité   |
| Collectif citoyen      | `citoyens-corte.lepp.fr`  | Pousser tous les candidats |
| Mairie sortante        | `corte.lepp.fr`           | Valoriser son bilan        |

Après l'élection, la liste gagnante peut conserver son instance comme plateforme officielle.

#### La Charte Transparence

8 engagements **concrets et mesurables** que les candidats peuvent signer :

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    🏅 CHARTE TRANSPARENCE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   1. Publier l'ordre du jour des conseils 7 jours avant                     │
│   2. Diffuser les délibérations sous 48h après le conseil                   │
│   3. Rendre le budget communal lisible pour tous                            │
│   4. Répondre aux questions citoyennes sous 15 jours                        │
│   5. Publier les déclarations d'intérêts des élus                          │
│   6. Ouvrir les données des marchés publics                                │
│   7. Permettre le signalement citoyen d'anomalies                          │
│   8. Organiser au moins 2 consultations citoyennes par an                  │
│                                                                              │
│   ✍️ SIGNATAIRES PUBLICS                                                   │
│   └── Chaque signature est vérifiable et horodatée                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Landing page d'engagement

Une page dédiée `/engagement` permet de collecter les leads avec différents niveaux de maturité :

| Type de lead         | Description                    | Objectif                               |
| -------------------- | ------------------------------ | -------------------------------------- |
| 🗳️ Liste électorale  | Candidats aux municipales 2026 | Déployer une instance de démonstration |
| 🏛️ Maire/Élu         | Élus en fonction               | Passer à l'action, valoriser le bilan  |
| ✊ Collectif citoyen | Associations, comités          | Porter la transparence localement      |
| 🙋 Citoyen engagé    | Individuel motivé              | Initier le mouvement seul              |

**Niveaux de maturité :**

| Niveau | Nom        | Actions                                    |
| ------ | ---------- | ------------------------------------------ |
| 🌱 1   | Intéressé  | Recevoir la doc, être recontacté           |
| 🌿 2   | Convaincu  | Signer la charte, afficher le badge        |
| 🌳 3   | Actif      | Déployer une instance, former l'équipe     |
| 🏆 4   | Exemplaire | Publier des données, répondre aux citoyens |

#### Score de transparence automatique

Chaque instance génère un **score de transparence** calculé automatiquement :

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│              SCORE DE TRANSPARENCE - Exemple                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Délibérations publiées        ████████████████████░  95%                 │
│   Réponses aux citoyens         ████████████████░░░░░  88%                 │
│   Budget lisible                ██████████████░░░░░░░  72%                 │
│   Données ouvertes              █████████████████████  100%                │
│                                                                              │
│   SCORE GLOBAL : 89/100                                                     │
│                                                                              │
│   Comparaison :                                                             │
│   • Liste A : 89/100 ★                                                      │
│   • Liste B : 62/100                                                        │
│   • Liste C : pas d'instance (0/100)                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Calendrier stratégique

| Période                  | Action                                  |
| ------------------------ | --------------------------------------- |
| **Déc 2025 - Mars 2026** | Promotion landing page, collecte leads  |
| **Avril - Sept 2026**    | Déploiement instances listes candidates |
| **Oct 2026 - Fév 2027**  | Campagne : comparaison des scores       |
| **Mars 2027**            | Élections : victoire des transparents ! |
| **Avril 2027+**          | Transition vers instances officielles   |

#### Ressources créées

| Page               | URL                      | Description                 |
| ------------------ | ------------------------ | --------------------------- |
| Landing engagement | `/engagement`            | Formulaire de capture leads |
| Vitrine communes   | `/transparence/communes` | Liste des engagés           |
| Admin leads        | `/admin/leads`           | Gestion CRM des leads       |

---

## 10. Conclusion

### Vision : Un bien commun numérique multi-instances

L'ajout du système GIS de transparence communale transforme la plateforme d'un simple outil de
démocratie locale en un **bien commun numérique** au service de toutes les communes françaises.

**Principes fondateurs :**

1. **Gratuit pour tous** → Aucune commune exclue pour raisons financières
2. **Open source** → Code auditable, forkable, pérenne
3. **Fédéré** → Chaque commune souveraine, mais connectée
4. **Transparent** → Finances, gouvernance, code : tout est public
5. **Bénévole** → Pas d'actionnaires, pas de pression commerciale
6. **Multi-instances** → Configuration centralisée via vault, pas de variables d'environnement
   éparpillées

### Architecture multi-instances validée

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE MULTI-INSTANCES FINALE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CHAQUE INSTANCE = 1 Projet Supabase + 1 Table instance_config (vault)      │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         VAULT (instance_config)                      │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │ • Identité: community_name, community_code, region_code             │    │
│  │ • Fédération: is_hub, hub_type, parent_hub_url, federation_peers    │    │
│  │ • Branding: bot_name, primary_color, logo                           │    │
│  │ • Features: feature_wiki, feature_chatbot, feature_gis              │    │
│  │ • Secrets: supabase_url, api_keys (chiffrés, RLS protégés)         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ACCÈS UNIFIÉ:                                                              │
│  • Frontend: src/lib/instanceConfig.js                                      │
│  • Netlify Functions: netlify/lib/instanceConfig.js                         │
│  • Edge Functions: netlify/edge-functions/lib/instanceConfig.js             │
│  • Scripts CLI: scripts/lib/config.js                                       │
│  • Admin UI: /admin/vault                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Avantages du vault multi-instances

| Aspect              | Avant (env vars)      | Après (vault)            |
| ------------------- | --------------------- | ------------------------ |
| **Modification**    | Redéploiement requis  | Immédiat via UI          |
| **Audit**           | Aucun historique      | Versioning automatique   |
| **Secrets**         | En clair dans Netlify | Chiffrés, RLS protégés   |
| **Multi-instances** | Duplication manuelle  | Config par instance      |
| **Fédération**      | URLs hardcodées       | Dynamique via vault      |
| **Onboarding**      | Variables à copier    | Provisioning automatique |

Le modèle associatif, inspiré de HelloAsso, Wikipédia ou Signal, prouve qu'on peut construire des
infrastructures numériques majeures sans les contraintes du modèle commercial.

**Financement réaliste :**

- **1 500€/an** suffisent pour faire tourner le projet
- **100 donateurs à 15€/an** = objectif atteint
- Les subventions publiques (NGI, FEDER, Région) peuvent accélérer le développement

La différenciation par l'**open source** et les **prix accessibles** (10-20x moins cher que les
solutions traditionnelles) permet de cibler les petites et moyennes communes souvent délaissées par
les grands éditeurs.

L'intégration du GIS représente une **extension majeure mais naturelle** de la plateforme. Les
fondations existantes (RAG, Ophélia, composants map, système fédératif) sont **compatibles** et
nécessitent principalement des **extensions** plutôt que des refactorings.

**Points clés :**

- ✅ Schéma SQL extensible (nouveaux domains/source_types)
- ✅ Pipeline RAG réutilisable
- ✅ Architecture composants modulaire
- ✅ **Système fédératif existant réutilisable** (une base par commune)
- ✅ **Configuration vault centralisée** (pas de variables d'environnement éparpillées)
- ✅ Pas de `collectivite_id` nécessaire (isolation par instance)
- ⚠️ 13+ nouveaux scripts d'ingestion à développer
- ⚠️ Tables `federated_*` à créer sur les hubs uniquement

**Architecture validée :**

```text
COMMUNE (Supabase + Vault)          HUB RÉGIONAL              HUB NATIONAL
──────────────────────────          ────────────              ────────────
• instance_config (vault)           • instance_config         • instance_config
  - community_name: "Corte"           - is_hub: true            - is_hub: true
  - is_hub: false                     - federation_peers: [..]  - hub_type: national
  - parent_hub_url: "..."
• knowledge_chunks                  • federated_*             • federated_*
• contributions_citoyennes  ──────► • aggregations        ──► • rankings
• alertes_zonage                    • comparaisons            • baromètre
• zonage_historique (local)
• mutations_foncieres (local)
```

**Effort total estimé :** 6-8 semaines pour une implémentation complète, en 4 phases.

---

## 11. Pilote : Communauté de Communes du Centre Corse

### 11.1. Présentation de l'intercommunalité

La **Communauté de Communes du Centre Corse** (SIREN: 242020071) constitue le terrain
d'expérimentation idéal pour valider le modèle fédératif gratuit porté par l'association
C.O.R.S.I.C.A.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│           COMMUNAUTÉ DE COMMUNES DU CENTRE CORSE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  📍 Siège : Corte                    🗺️ Superficie : 362 km²               │
│  👥 Population : ~10 000 hab.        📊 Densité : 27 hab/km²                │
│  🏔️ Caractéristique : EPCI insulaire sans façade maritime                  │
│  🛣️ Axe : Route Territoriale 20 (Ajaccio ↔ Bastia)                         │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ 10 COMMUNES MEMBRES                                                  │    │
│  ├──────────────────────┬────────────┬────────────┬────────────────────┤    │
│  │ Commune              │ Code INSEE │ Population │ Code Postal        │    │
│  ├──────────────────────┼────────────┼────────────┼────────────────────┤    │
│  │ 🏛️ Corte (siège)     │ 2B096      │ 7 737      │ 20250              │    │
│  │ Venaco               │ 2B341      │ 643        │ 20231              │    │
│  │ Vivario              │ 2B354      │ 429        │ 20219              │    │
│  │ Casanova             │ 2B074      │ 375        │ 20250              │    │
│  │ Santo-Pietro-Venaco  │ 2B315      │ 298        │ 20250              │    │
│  │ Poggio-di-Venaco     │ 2B238      │ 210        │ 20250              │    │
│  │ Riventosa            │ 2B260      │ 150        │ 20250              │    │
│  │ Rospigliani          │ 2B263      │ 70         │ 20219              │    │
│  │ Noceta               │ 2B177      │ 68         │ 20219              │    │
│  │ Muracciole           │ 2B171      │ 34         │ 20219              │    │
│  └──────────────────────┴────────────┴────────────┴────────────────────┘    │
│                                                                              │
│  📌 Corte = 77% de la population totale                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 11.2. Architecture du pilote

#### Scénario 1 : Hub intercommunal (recommandé)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE PILOTE - CENTRE CORSE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐                   │
│  │ Corte          │ │ Venaco         │ │ Vivario        │  ...7 autres     │
│  │ (2B096)        │ │ (2B341)        │ │ (2B354)        │                   │
│  │ ─────────────  │ │ ─────────────  │ │ ─────────────  │                   │
│  │ Plan Essentiel │ │ Plan Starter   │ │ Plan Starter   │  (auto-hébergé   │
│  │ Instance mgée  │ │ ou Essentiel   │ │ ou Essentiel   │   ou managé)     │
│  └───────┬────────┘ └───────┬────────┘ └───────┬────────┘                   │
│          │                  │                  │                             │
│          └──────────────────┼──────────────────┘                             │
│                             │                                                │
│                             ▼                                                │
│          ┌─────────────────────────────────────┐                            │
│          │     HUB CENTRE CORSE (EPCI)         │                            │
│          │     centre-corse.lepp.fr    │                            │
│          │     ───────────────────────────     │                            │
│          │     Plan Hub (499€/mois)            │                            │
│          │     - Agrégation 10 communes        │                            │
│          │     - Comparaisons intercommunales  │                            │
│          │     - Dashboard EPCI                │                            │
│          │     - API consolidée                │                            │
│          └──────────────────┬──────────────────┘                            │
│                             │                                                │
│                             ▼                                                │
│          ┌─────────────────────────────────────┐                            │
│          │     HUB RÉGIONAL CORSE              │                            │
│          │     corse.lepp.fr           │                            │
│          └─────────────────────────────────────┘                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Scénario 2 : Corte seul + communes en lecture

Pour démarrer plus léger, Corte peut être la seule instance active, les autres communes accédant en
lecture seule via le hub.

```text
PHASE 1 (immédiat)           PHASE 2 (3 mois)           PHASE 3 (6 mois)
─────────────────            ─────────────────          ─────────────────

┌──────────────┐             ┌──────────────┐           ┌──────────────┐
│ Corte        │             │ Corte        │           │ 10 communes  │
│ (instance)   │             │ + Venaco     │           │ + Hub EPCI   │
│              │             │ + Vivario    │           │              │
└──────────────┘             └──────────────┘           └──────────────┘
```

### 11.3. Configuration des instances via Vault

Chaque commune du pilote est configurée via sa table `instance_config` :

#### Script de provisioning avec vault

```javascript
// scripts/saas/provision-instance.js

import { createClient } from "@supabase/supabase-js";

/**
 * Provisionne une nouvelle instance avec sa configuration vault
 */
export async function provisionInstance(config) {
  const {
    communeName,
    communeInsee,
    regionCode,
    adminEmail,
    plan,
    customDomain,
    isHub = false,
    hubType = "commune",
    parentHubUrl = null,
    metadata = {},
  } = config;

  // 1. Créer le projet Supabase (API ou CLI)
  const supabaseProject = await createSupabaseProject(customDomain);

  // 2. Appliquer les migrations (incluant instance_config)
  await applyMigrations(supabaseProject.url, supabaseProject.serviceKey);

  // 3. Peupler le vault avec la configuration de l'instance
  const supabase = createClient(supabaseProject.url, supabaseProject.serviceKey);

  const vaultConfig = [
    // Identité
    { key: "community_name", value: communeName, category: "identity", is_public: true },
    {
      key: "community_type",
      value: isHub ? hubType : "municipality",
      category: "identity",
      is_public: true,
    },
    { key: "community_code", value: communeInsee, category: "identity", is_public: true },
    { key: "region_code", value: regionCode, category: "identity", is_public: true },

    // Fédération
    { key: "is_hub", value: String(isHub), category: "federation", is_public: true },
    { key: "hub_type", value: hubType, category: "federation", is_public: true },
    { key: "parent_hub_url", value: parentHubUrl || "", category: "federation", is_public: false },

    // URLs
    { key: "supabase_url", value: supabaseProject.url, category: "secrets", is_secret: true },
    {
      key: "supabase_anon_key",
      value: supabaseProject.anonKey,
      category: "secrets",
      is_secret: true,
    },

    // Métadonnées du plan
    { key: "instance_plan", value: plan, category: "general", is_public: false },
    { key: "custom_domain", value: customDomain, category: "general", is_public: true },
  ];

  // Ajouter les métadonnées supplémentaires
  for (const [key, value] of Object.entries(metadata)) {
    vaultConfig.push({
      key: `meta_${key}`,
      value: String(value),
      category: "metadata",
      is_public: false,
    });
  }

  // Insérer dans le vault
  const { error } = await supabase
    .from("instance_config")
    .upsert(vaultConfig, { onConflict: "key" });

  if (error) throw new Error(`Erreur vault: ${error.message}`);

  // 4. Créer l'admin initial
  await createAdminUser(supabase, adminEmail);

  return {
    url: supabaseProject.url,
    domain: customDomain,
    adminEmail,
    plan,
  };
}
```

#### Constantes pour chaque commune (référence)

```javascript
// scripts/saas/pilot-centre-corse.js

export const CENTRE_CORSE_COMMUNES = [
  {
    name: "Corte",
    insee: "2B096",
    population: 7737,
    postalCode: "20250",
    isHub: false,
    isSiege: true,
    plan: "essentiel",
    subdomain: "corte",
  },
  {
    name: "Venaco",
    insee: "2B341",
    population: 643,
    postalCode: "20231",
    isHub: false,
    plan: "starter",
    subdomain: "venaco",
  },
  {
    name: "Vivario",
    insee: "2B354",
    population: 429,
    postalCode: "20219",
    isHub: false,
    plan: "starter",
    subdomain: "vivario",
  },
  {
    name: "Casanova",
    insee: "2B074",
    population: 375,
    postalCode: "20250",
    isHub: false,
    plan: "starter",
    subdomain: "casanova",
  },
  {
    name: "Santo-Pietro-di-Venaco",
    insee: "2B315",
    population: 298,
    postalCode: "20250",
    isHub: false,
    plan: "starter",
    subdomain: "santo-pietro",
  },
  {
    name: "Poggio-di-Venaco",
    insee: "2B238",
    population: 210,
    postalCode: "20250",
    isHub: false,
    plan: "starter",
    subdomain: "poggio",
  },
  {
    name: "Riventosa",
    insee: "2B260",
    population: 150,
    postalCode: "20250",
    isHub: false,
    plan: "starter",
    subdomain: "riventosa",
  },
  {
    name: "Rospigliani",
    insee: "2B263",
    population: 70,
    postalCode: "20219",
    isHub: false,
    plan: "starter",
    subdomain: "rospigliani",
  },
  {
    name: "Noceta",
    insee: "2B177",
    population: 68,
    postalCode: "20219",
    isHub: false,
    plan: "starter",
    subdomain: "noceta",
  },
  {
    name: "Muracciole",
    insee: "2B171",
    population: 34,
    postalCode: "20219",
    isHub: false,
    plan: "starter",
    subdomain: "muracciole",
  },
];

export const CENTRE_CORSE_EPCI = {
  name: "Communauté de Communes du Centre Corse",
  siren: "242020071",
  siret: "24202007100014",
  regionCode: "94", // Corse
  departement: "2B",
  communes: CENTRE_CORSE_COMMUNES.map((c) => c.insee),
  siege: "2B096", // Corte
  population: 10014,
  superficie: 362, // km²
  plan: "hub",
  subdomain: "centre-corse",
};
```

### 11.4. Script de déploiement pilote (avec vault)

```javascript
// scripts/saas/deploy-pilot-centre-corse.js

import { CENTRE_CORSE_COMMUNES, CENTRE_CORSE_EPCI } from "./pilot-centre-corse.js";
import { provisionInstance } from "./provision-instance.js";

const DOMAIN_BASE = "transparence-commune.fr";
const REGIONAL_HUB_URL = "https://corse.lepp.fr";

/**
 * Déploie le pilote Centre Corse complet avec configuration vault
 */
export async function deployPilotCentreCorse(options = {}) {
  const {
    dryRun = true, // Mode simulation par défaut
    onlyCorte = false, // Déployer uniquement Corte d'abord
    skipHub = false, // Ne pas créer le hub EPCI
  } = options;

  console.log("🚀 Déploiement pilote Centre Corse (avec vault)");
  console.log(`   Mode: ${dryRun ? "SIMULATION" : "PRODUCTION"}`);
  console.log("");

  const results = {
    communes: [],
    hub: null,
    errors: [],
  };

  // 1. Déployer les communes
  const communesToDeploy = onlyCorte
    ? CENTRE_CORSE_COMMUNES.filter((c) => c.insee === "2B096")
    : CENTRE_CORSE_COMMUNES;

  for (const commune of communesToDeploy) {
    console.log(`📍 ${commune.name} (${commune.insee})...`);

    try {
      if (!dryRun) {
        const result = await provisionInstance({
          communeName: commune.name,
          communeInsee: commune.insee,
          regionCode: CENTRE_CORSE_EPCI.regionCode,
          adminEmail: `admin@${commune.subdomain}.${DOMAIN_BASE}`,
          plan: commune.plan,
          customDomain: `${commune.subdomain}.${DOMAIN_BASE}`,
          // Configuration fédération via vault
          parentHubUrl: skipHub
            ? REGIONAL_HUB_URL
            : `https://${CENTRE_CORSE_EPCI.subdomain}.${DOMAIN_BASE}`,
          metadata: {
            epci: CENTRE_CORSE_EPCI.siren,
            population: commune.population,
            postalCode: commune.postalCode,
            pilot: "centre-corse-2025",
          },
        });
        results.communes.push({ ...commune, ...result });
        console.log(`   ✅ Vault configuré: ${result.domain}`);
      } else {
        console.log(`   [DRY RUN] Would create: ${commune.subdomain}.${DOMAIN_BASE}`);
        console.log(`   [DRY RUN] Vault keys: community_name, community_code, parent_hub_url...`);
        results.communes.push({ ...commune, dryRun: true });
      }
    } catch (error) {
      console.error(`   ❌ Erreur: ${error.message}`);
      results.errors.push({ commune: commune.insee, error: error.message });
    }
  }

  // 2. Déployer le hub EPCI
  if (!skipHub && !onlyCorte) {
    console.log("");
    console.log(`🏛️ Hub EPCI: ${CENTRE_CORSE_EPCI.name}...`);

    try {
      if (!dryRun) {
        const hubResult = await provisionInstance({
          communeName: CENTRE_CORSE_EPCI.name,
          communeInsee: null, // Hub = pas de commune spécifique
          regionCode: CENTRE_CORSE_EPCI.regionCode,
          adminEmail: `admin@${CENTRE_CORSE_EPCI.subdomain}.${DOMAIN_BASE}`,
          plan: "hub",
          customDomain: `${CENTRE_CORSE_EPCI.subdomain}.${DOMAIN_BASE}`,
          isHub: true,
          hubType: "epci",
          metadata: {
            siren: CENTRE_CORSE_EPCI.siren,
            communes: CENTRE_CORSE_EPCI.communes,
            population: CENTRE_CORSE_EPCI.population,
            pilot: "centre-corse-2025",
          },
        });
        results.hub = hubResult;
      } else {
        console.log(`   [DRY RUN] Would create hub: ${CENTRE_CORSE_EPCI.subdomain}.${DOMAIN_BASE}`);
        results.hub = { dryRun: true };
      }
    } catch (error) {
      console.error(`   ❌ Erreur hub: ${error.message}`);
      results.errors.push({ hub: true, error: error.message });
    }
  }

  // 3. Résumé
  console.log("");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("                       RÉSUMÉ DÉPLOIEMENT");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`✅ Communes déployées : ${results.communes.length}`);
  console.log(`🏛️ Hub EPCI          : ${results.hub ? "Oui" : "Non"}`);
  console.log(`❌ Erreurs            : ${results.errors.length}`);
  console.log("");

  if (results.communes.length > 0) {
    console.log("URLs des instances :");
    for (const c of results.communes) {
      console.log(`  • ${c.name}: https://${c.subdomain}.${DOMAIN_BASE}`);
    }
    if (results.hub) {
      console.log(`  • HUB: https://${CENTRE_CORSE_EPCI.subdomain}.${DOMAIN_BASE}`);
    }
  }

  return results;
}

// Exécution en ligne de commande
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const dryRun = !args.includes("--production");
  const onlyCorte = args.includes("--corte-only");

  deployPilotCentreCorse({ dryRun, onlyCorte })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
```

### 11.5. Fédération intercommunale (avec vault)

```javascript
// src/lib/epci-federation.js

import { supabase } from "./supabase";
import { getConfig, loadConfig } from "./instanceConfig";

// Charger la config au démarrage
await loadConfig();

// Récupérer les infos EPCI depuis le vault du hub
const EPCI_SIREN = getConfig("meta_epci") || getConfig("community_code");

/**
 * Récupère les données agrégées de l'EPCI
 * Les URLs des instances sont stockées dans le vault du hub
 */
export async function getEpciAggregatedData(dataType) {
  // Récupérer la liste des communes depuis le vault (JSON)
  const federationPeersJson = getConfig("federation_peers");
  const peers = federationPeersJson ? JSON.parse(federationPeersJson) : [];

  const responses = [];

  for (const peer of peers) {
    try {
      const response = await fetch(`${peer.url}/api/public/${dataType}`);

      if (response.ok) {
        const data = await response.json();
        responses.push({
          insee: peer.insee,
          communeName: peer.name,
          data,
          fetchedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.warn(`[EPCI] Erreur fetch ${peer.name}:`, error.message);
    }
  }

  return {
    epci: getConfig("community_name"),
    siren: EPCI_SIREN,
    dataType,
    communes: responses,
    aggregatedAt: new Date().toISOString(),
  };
}

/**
 * Comparaison intercommunale (ex: taux de participation)
 */
export async function getIntercommunalComparison(metric) {
  const data = await getEpciAggregatedData("metrics");

  const comparison = data.communes
    .map((c) => ({
      commune: c.communeName,
      insee: c.insee,
      value: c.data?.[metric] ?? null,
      population: c.data?.population ?? 0,
    }))
    .filter((c) => c.value !== null)
    .sort((a, b) => b.value - a.value);

  const total = comparison.reduce((sum, c) => sum + c.value * c.population, 0);
  const totalPop = comparison.reduce((sum, c) => sum + c.population, 0);

  return {
    metric,
    epci: getConfig("community_name"),
    comparison,
    average: totalPop > 0 ? total / totalPop : 0,
    generatedAt: new Date().toISOString(),
  };
}
```

#### Configuration vault pour le hub EPCI

```sql
-- Configuration vault du hub Centre Corse
INSERT INTO instance_config (key, value, value_json, category, is_public) VALUES
  -- Identité du hub
  ('community_name', 'Communauté de Communes du Centre Corse', NULL, 'identity', true),
  ('community_type', 'epci', NULL, 'identity', true),
  ('community_code', '242020071', NULL, 'identity', true), -- SIREN

  -- Configuration hub
  ('is_hub', 'true', NULL, 'federation', true),
  ('hub_type', 'epci', NULL, 'federation', true),

  -- Liste des communes fédérées (JSON)
  ('federation_peers', NULL, '[
    {"name": "Corte", "insee": "2B096", "url": "https://corte.transparence-commune.fr"},
    {"name": "Venaco", "insee": "2B341", "url": "https://venaco.transparence-commune.fr"},
    {"name": "Vivario", "insee": "2B354", "url": "https://vivario.transparence-commune.fr"}
  ]', 'federation', false)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, value_json = EXCLUDED.value_json;
```

### 11.6. Administration du vault multi-instances

#### Interface d'administration

Chaque instance dispose d'une page d'administration du vault accessible à `/admin/vault` :

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  🔐 Configuration Vault - Corte                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Catégories: [Toutes ▼] [identity] [branding] [federation] [features]       │
│  Recherche: [________________________]                                       │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Clé                    │ Valeur              │ Catégorie  │ Actions  │  │
│  ├────────────────────────┼─────────────────────┼────────────┼──────────┤  │
│  │ community_name         │ Corte               │ identity   │ ✏️       │  │
│  │ community_code         │ 2B096               │ identity   │ ✏️       │  │
│  │ region_code            │ COR                 │ identity   │ ✏️       │  │
│  │ is_hub                 │ false               │ federation │ ✏️       │  │
│  │ parent_hub_url         │ https://corse...    │ federation │ ✏️       │  │
│  │ bot_name               │ Ophélia             │ branding   │ ✏️       │  │
│  │ primary_color          │ #B35A4A             │ branding   │ ✏️       │  │
│  │ feature_wiki           │ true                │ features   │ ✏️       │  │
│  │ supabase_url           │ 🔒 (secret)         │ secrets    │ —        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ⚠️ Les clés secrètes ne peuvent pas être modifiées via l'interface.       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Clés spécifiques multi-instances

| Clé                  | Description           | Modifiable UI     | Exemple                 |
| -------------------- | --------------------- | ----------------- | ----------------------- |
| `community_name`     | Nom affiché           | ✅ Oui            | "Corte"                 |
| `community_code`     | Code INSEE/SIREN      | ❌ Non (critique) | "2B096"                 |
| `is_hub`             | Instance hub          | ❌ Non (critique) | "false"                 |
| `hub_type`           | Type de hub           | ❌ Non (critique) | "commune"               |
| `parent_hub_url`     | URL hub parent        | ⚠️ Prudence       | "https://corse.lepp.fr" |
| `federation_peers`   | Liste communes (JSON) | ✅ Oui (hub only) | `[{...}]`               |
| `federation_api_key` | Clé sync              | ❌ Non (secret)   | "xxx"                   |

#### Synchronisation des configurations

Pour les déploiements multi-instances, un script permet de synchroniser certaines clés communes :

```javascript
// scripts/saas/sync-vault-config.js

import { createClient } from "@supabase/supabase-js";

/**
 * Synchronise une configuration vers toutes les instances d'un EPCI
 */
export async function syncConfigToEpci(epciHubUrl, hubServiceKey, configKey, newValue) {
  const hubClient = createClient(epciHubUrl, hubServiceKey);

  // Récupérer la liste des communes
  const { data: config } = await hubClient
    .from("instance_config")
    .select("value_json")
    .eq("key", "federation_peers")
    .single();

  const peers = config?.value_json || [];

  const results = [];

  for (const peer of peers) {
    try {
      // Chaque commune a sa propre service key dans le hub
      const peerServiceKey = await getPeerServiceKey(hubClient, peer.insee);
      const peerClient = createClient(peer.url, peerServiceKey);

      const { error } = await peerClient
        .from("instance_config")
        .update({ value: newValue })
        .eq("key", configKey);

      results.push({
        commune: peer.name,
        success: !error,
        error: error?.message,
      });
    } catch (err) {
      results.push({ commune: peer.name, success: false, error: err.message });
    }
  }

  return results;
}
```

### 11.7. Plan de déploiement pilote

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PLAN PILOTE CENTRE CORSE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SEMAINE 1-2 : Préparation                                                  │
│  ├── Finaliser script provision-instance.js                                │
│  ├── Configurer Stripe pour facturation test                               │
│  ├── Préparer templates emails (bienvenue, onboarding)                     │
│  └── Contacter mairie de Corte pour validation                             │
│                                                                              │
│  SEMAINE 3-4 : Corte (instance pilote)                                      │
│  ├── Déployer instance Corte (corte.transparence-commune.fr)               │
│  ├── Importer données existantes (consultations, docs)                     │
│  ├── Activer GIS avec couches PLU/DVF/Géorisques                          │
│  └── Formation équipe municipale                                            │
│                                                                              │
│  SEMAINE 5-6 : Extension intercommunale                                     │
│  ├── Déployer 3 communes supplémentaires (Venaco, Vivario, Casanova)       │
│  ├── Tester synchronisation fédérée                                        │
│  └── Dashboard comparatif intercommunal                                     │
│                                                                              │
│  SEMAINE 7-8 : Hub EPCI                                                     │
│  ├── Déployer hub centre-corse.transparence-commune.fr                     │
│  ├── Agrégation automatique des 4 communes                                 │
│  ├── Baromètre intercommunal                                               │
│  └── Présentation au conseil communautaire                                  │
│                                                                              │
│  MOIS 3 : Généralisation                                                    │
│  ├── Déployer les 6 communes restantes                                     │
│  ├── Collecter retours utilisateurs et améliorer UX                        │
│  └── Préparer extension régionale (autres EPCI Corse)                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 11.8. Budget pilote (modèle 100% gratuit)

Le pilote Centre Corse fonctionne sur le **modèle associatif gratuit** de C.O.R.S.I.C.A. :

| Poste                    | Coût/mois        | Notes                           |
| ------------------------ | ---------------- | ------------------------------- |
| **10 communes**          | 0€               | Tiers gratuits Supabase/Netlify |
| **Hub EPCI**             | 0€               | Instance mutualisée             |
| **Dépassement éventuel** | ~50€             | Si volumes importants           |
| **Total pilote**         | **0 à 50€/mois** | Couvert par les dons            |

**Pas de facturation aux communes.** Le projet est financé par :

- Dons citoyens via HelloAsso
- Contributions open source bénévoles
- Subventions publiques (NGI, FEDER) pour le développement

👉 Voir [FUNDING.md](FUNDING.md) pour les détails du modèle économique.
