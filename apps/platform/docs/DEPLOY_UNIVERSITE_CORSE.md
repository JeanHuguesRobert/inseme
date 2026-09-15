---
title: 'Déploiement Instance : Université de Corse Pasquale Paoli'
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

# Déploiement Instance : Université de Corse Pasquale Paoli

**Objectif** : Déployer la première instance "secondaire" d'Ophélia pour la communauté universitaire
de Corte.

**Instance** : `universita.lepp.fr` (sous-domaine du déploiement multi-instance)

**Architecture** : Utilise le système multi-instance avec vault centralisé (voir
[ARCHITECTURE_MULTI_INSTANCE.md](./ARCHITECTURE_MULTI_INSTANCE.md))

---

## 🏗️ Architecture Multi-Instance

```
┌─────────────────────────────────────────────────────────────┐
│                            lepp.fr                          │
│                    (Wildcard DNS → Netlify)                 │
├─────────────────────────────────────────────────────────────┤
│  universita.lepp.fr                                         │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │ Edge Function   │───▶  instance_registry (hub Supabase)
│  │ inst...-resolver│    │ subdomain: universita           │ │
│  └─────────────────┘    │ supabase_url: xxx.supabase.co   │ │
│         │               │ supabase_anon_key: eyJ...       │ │
│         ▼               └─────────────────────────────────┘ │
│  ┌─────────────────┐                                        │
│  │ App React       │───▶ Supabase Uni-Corse
│  │ (même codebase) │    └─ instance_config (vault)          │
│  └─────────────────┘    └─ users, wiki, posts, etc.         │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Prérequis

### Comptes nécessaires

| Service               | Compte                   | Statut          |
| --------------------- | ------------------------ | --------------- |
| **Supabase Hub**      | Projet principal (Corte) | ✅ Existant     |
| **Supabase Instance** | Nouveau projet uni-corse | ⏳ À créer      |
| **Netlify**           | Team C.O.R.S.I.C.A.      | ✅ Existant     |
| **GitHub**            | JeanHuguesRobert/survey  | ✅ Existant     |
| **Domaine**           | lepp.fr (wildcard)       | ⏳ À configurer |

### Informations à collecter

| Information          | Valeur                               | Source                       |
| -------------------- | ------------------------------------ | ---------------------------- |
| Nom officiel         | Università di Corsica Pasquale Paoli | Site web                     |
| Code UAI             | 0200042H                             | Annuaire Éducation nationale |
| Adresse              | Avenue Jean Nicoli, 20250 Corte      |                              |
| Contact pilote       | ?                                    | À identifier                 |
| Email admin          | ?                                    | Présidence ou DSI            |
| **Subdomain choisi** | `universita`                         | Décision équipe              |

---

## 🚀 Étapes de Déploiement

### Phase 1 : Infrastructure (1-2h)

#### Étape 1.1 : Créer le projet Supabase pour l'instance

```bash
# Via Supabase Dashboard ou CLI
# Organisation: C.O.R.S.I.C.A.
# Projet: uni-corse-ophelia
# Région: eu-west-3 (Paris)
# Plan: Free (gratuit)
```

**Actions manuelles** :

1. Aller sur https://supabase.com/dashboard
2. Créer un nouveau projet dans l'organisation
3. Nom : `uni-corse-ophelia`
4. Mot de passe DB : générer un mot de passe fort
5. Région : `eu-west-3`

**Récupérer** :

- `SUPABASE_URL` : `https://xxx.supabase.co`
- `SUPABASE_ANON_KEY` : dans Settings > API
- `SUPABASE_SERVICE_ROLE_KEY` : dans Settings > API

#### Étape 1.2 : Enregistrer l'instance dans le registry (Hub)

**Dans le Supabase Hub (instance principale)**, insérer dans `instance_registry` :

```sql
-- Exécuter sur le HUB Supabase (pas l'instance uni-corse)
INSERT INTO instance_registry (
  subdomain,
  community_name,
  community_code,
  community_type,
  supabase_url,
  supabase_anon_key,
  region,
  is_active,
  contact_email,
  metadata
) VALUES (
  'universita',
  'Università di Corsica Pasquale Paoli',
  '2B096-UNI',
  'university',
  'https://xxx.supabase.co',  -- URL du nouveau projet
  'eyJxxx...',                 -- Clé anon du nouveau projet
  'COR',
  true,
  'dsi@univ-corse.fr',
  jsonb_build_object(
    'code_uai', '0200042H',
    'address', 'Avenue Jean Nicoli, 20250 Corte',
    'map_center', ARRAY[42.3084, 9.1505]
  )
);
```

#### Étape 1.3 : Appliquer les migrations sur l'instance

```bash
# Configurer Supabase CLI pour le nouveau projet
npx supabase link --project-ref <project-id-uni-corse>

# Appliquer les migrations
npx supabase db push
```

**Migrations à appliquer** (dans l'ordre) :

1. Schema de base (users, auth)
2. Content (wiki, posts, comments)
3. Consultations
4. Transparency leads
5. **instance_config** (vault) - `20251205_instance_vault.sql`

#### Étape 1.4 : Provisionner le Vault de l'instance

Sur l'instance Supabase uni-corse, insérer la configuration dans `instance_config` :

```sql
-- Exécuter sur l'instance uni-corse
INSERT INTO instance_config (key, value, is_secret) VALUES
-- Identité
('COMMUNITY_NAME', '"Università di Corsica Pasquale Paoli"', false),
('COMMUNITY_TYPE', '"university"', false),
('CITY_NAME', '"Corte"', false),
('CITY_TAGLINE', '"UNIVERSITÉ"', false),
('MOVEMENT_NAME', '"Transparenza Universitaria"', false),
('HASHTAG', '"#UniCorseTransparente"', false),
('BOT_NAME', '"Ophélia"', false),
('CONTACT_EMAIL', '"dsi@univ-corse.fr"', false),

-- Carte
('MAP_DEFAULT_CENTER', '[42.3084, 9.1505]', false),

-- Fédération (connexion au hub)
('NATIONAL_API_URL', '"https://xxxxx.supabase.co"', false),
('NATIONAL_API_KEY', '"eyJxxx..."', true),
('COMMUNE_INSEE', '"2B096"', false),
('REGION_NAME', '"Corse"', false),
('REGION_CODE', '"COR"', false),

-- Secrets API
('OPENAI_API_KEY', '"sk-xxx..."', true),
('ANTHROPIC_API_KEY', '"sk-ant-xxx..."', true),
('MISTRAL_API_KEY', '"xxx"', true);
```

> ⚠️ **Important** : Les clés API sont stockées avec `is_secret = true` et ne sont accessibles
> qu'aux Edge Functions via `service_role_key`.

---

### Phase 2 : Configuration DNS (15 min)

#### Étape 2.1 : Vérifier le wildcard DNS

Le domaine `*.lepp.fr` doit pointer vers Netlify :

```
*.lepp.fr  CNAME  survey-main.netlify.app
```

Si le wildcard est déjà configuré, le sous-domaine `universita.lepp.fr` fonctionnera
automatiquement.

#### Étape 2.2 : Ajouter le domaine dans Netlify (optionnel)

Si vous voulez un certificat SSL spécifique :

1. Netlify Dashboard > Domain management
2. Add domain alias: `universita.lepp.fr

---

### Phase 3 : Test de l'instance (15 min)

#### Étape 3.1 : Test en développement local

```bash
# Lancer le dev server
npm run dev

# Ouvrir avec le paramètre instance
# http://localhost:5173/?instance=universita
```

Le paramètre `?instance=universita` simule l'accès via le sous-domaine.

#### Étape 3.2 : Vérifier la résolution d'instance

Ouvrir la console navigateur et vérifier :

```javascript
// Ces valeurs doivent correspondre à l'instance universita
console.log(window.__INSTANCE_CONFIG__);
// {
//   subdomain: 'universita',
//   supabase_url: 'https://xxx.supabase.co',
//   community_name: 'Università di Corsica',
//   ...
// }
```

#### Étape 3.3 : Test en production

Accéder à `https://universita.lepp.fr` et vérifier :

- [ ] L'application charge
- [ ] Le nom de la communauté s'affiche correctement
- [ ] Ophélia répond avec le contexte universitaire
- [ ] Les données sont isolées de l'instance Hub Corte

---

### Phase 4 : Personnalisation (1-2h)

#### Étape 4.1 : Les libellés s'adaptent automatiquement

Les libellés sont configurés dans `src/constants.js` et s'adaptent au `community_type: university` :

```javascript
university: {
  name: "université",
  governance: "conseil d'administration",
  meeting: "séance du CA",
  decision: "délibération",
  representative: "élu",
  citizens: "communauté universitaire",
  council: "CA",
  student_council: "CVU",
  student_union: "BDE",
}
```

#### Étape 4.2 : Personnaliser l'interface (optionnel)

Pour ajouter un logo personnalisé, mettre à jour le vault :

```sql
-- Sur l'instance uni-corse
INSERT INTO instance_config (key, value, is_secret) VALUES
('LOGO_URL', '"/images/uni-corse-logo.png"', false),
('PRIMARY_COLOR', '"#1e3a5f"', false),  -- Bleu université
('SECONDARY_COLOR', '"#c4a84b"', false); -- Or université
```

Et ajouter le fichier logo dans `public/images/`.

#### Étape 4.3 : Créer le contenu initial

**Pages Wiki à créer** :

- `/wiki/universite` : Présentation de l'université
- `/wiki/gouvernance` : CA, CFVU, CS, conseils de composantes
- `/wiki/vie-etudiante` : BDE, associations, syndicats
- `/wiki/transparence` : Pourquoi cette plateforme

**Données à ingérer** :

- Dernières délibérations du CA (PDF → OCR)
- Budget universitaire 2025
- Calendrier des conseils
- Liste des élus étudiants CVU

---

### Phase 5 : Déploiement (automatique)

#### Pas de déploiement spécifique nécessaire !

Grâce au système multi-instance :

- **Un seul déploiement Netlify** sert toutes les instances
- Le code est le même, seules les données changent
- Le sous-domaine détermine quelle base Supabase utiliser

```
git push origin main  # Déploie pour TOUTES les instances
```

#### Vérification post-configuration

- [ ] Instance visible sur `https://universita.lepp.fr`
- [ ] Données isolées (pas de mélange avec Corte)
- [ ] Vault chargé correctement (voir console)
- [ ] Ophélia fonctionne avec le contexte universitaire
- [ ] Fédération vers le hub opérationnelle

---

### Phase 6 : Activation & Communication (1 semaine)

#### Étape 6.1 : Créer le compte admin

1. S'inscrire sur `universita.lepp.fr` avec l'email admin
2. Dans Supabase **uni-corse** > Table `users` : passer `role` à `admin`

#### Étape 6.2 : Accéder à l'admin du vault

L'admin peut gérer la configuration via `/admin/vault` :

```
https://universita.lepp.fr/admin/vault
```

Permet de modifier les valeurs sans toucher au SQL.

#### Étape 6.3 : Formation utilisateurs

**Sessions de formation** :

- DSI / Admin technique : 1h
- Secrétariat général (publication délibérations) : 1h
- Élus étudiants CVU : 30 min
- BDE / Associations : 30 min

#### Étape 6.4 : Communication lancement

**Canaux** :

- Email à la communauté universitaire
- Affichage sur ENT
- Réseaux sociaux université
- Article presse locale (Corse Matin)

**Message type** :

> L'Università di Corsica dispose à présent de sa plateforme de transparence Ophélia ! Consultez les
> délibérations du CA, posez vos questions à l'IA Ophélia, et participez à la vie démocratique de
> votre campus. 👉 universita.lepp.fr

---

## 📊 Métriques de succès (M+3)

| Métrique               | Objectif |
| ---------------------- | -------- |
| Visiteurs uniques      | 500      |
| Questions Ophélia      | 100      |
| Délibérations publiées | 10       |
| Utilisateurs inscrits  | 50       |
| Satisfaction (NPS)     | > 30     |

---

## 🔧 Maintenance

### Mises à jour

Grâce au déploiement unique, toutes les instances sont mises à jour simultanément :

```bash
git pull origin main
git push  # Netlify rebuild automatique
```

### Modifier la configuration de l'instance

**Option 1 : Via l'admin UI**

```
https://universita.lepp.fr/admin/vault
```

**Option 2 : Via SQL**

```sql
-- Sur l'instance uni-corse
UPDATE instance_config
SET value = '"Nouveau nom"'
WHERE key = 'COMMUNITY_NAME';
```

### Backups

Supabase gère automatiquement les backups (plan Free : 7 jours).

### Support

- Email : jean_hugues_robert@yahoo.com
- GitHub Issues : pour les bugs techniques
- Wiki interne : pour la documentation utilisateur

---

## 📁 Architecture fichiers (Multi-Instance)

```
/survey/                        # Repo UNIQUE pour toutes instances
├── netlify.toml                # Edge functions multi-instance
├── src/
│   ├── lib/
│   │   ├── instanceResolver.js # Résolution dynamique
│   │   └── supabase.js         # Client dynamique
│   └── ...
├── netlify/
│   ├── edge-functions/
│   │   └── instance-resolver.js
│   └── functions/
│       ├── instance-lookup.js  # API /api/instance/:subdomain
│       └── instances-list.js   # API /api/instances
└── supabase/
    └── migrations/
        ├── 20251205_instance_vault.sql
        └── 20251205_instance_registry.sql
```

**Pas de clone du repo par instance !** Tout est géré dynamiquement.

---

## ⏱️ Timeline estimée

| Phase                                         | Durée          | Responsable |
| --------------------------------------------- | -------------- | ----------- |
| **Phase 1** Créer Supabase + Registry + Vault | 1h             | Dev         |
| **Phase 2** Config DNS (si wildcard déjà OK)  | 5 min          | Dev         |
| **Phase 3** Test de l'instance                | 15 min         | Dev         |
| **Phase 4** Personnalisation contenu          | 2h             | Dev + Uni   |
| **Phase 5** Déploiement                       | ❌ Automatique | -           |
| **Phase 6** Activation & Formation            | 1 semaine      | Uni + Dev   |
| **Total technique**                           | **~3h30**      |             |

---

## 🎯 Checklist Récapitulative

### Infrastructure

- [ ] Créer projet Supabase `uni-corse-ophelia`
- [ ] Appliquer migrations
- [ ] Enregistrer dans `instance_registry` (sur le hub)
- [ ] Provisionner le vault `instance_config` (sur l'instance)

### DNS & Accès

- [ ] Vérifier wildcard `*.lepp.fr`
- [ ] Tester `?instance=universita` en local
- [ ] Tester `https://universita.lepp.fr` en prod

### Contenu

- [ ] Créer pages wiki initiales
- [ ] Ingérer les premières délibérations
- [ ] Configurer le logo/couleurs (optionnel)

### Lancement

- [ ] Créer compte admin
- [ ] Former les utilisateurs clés
- [ ] Communication officielle

---

## 📚 Références

- [ARCHITECTURE_MULTI_INSTANCE.md](./ARCHITECTURE_MULTI_INSTANCE.md) - Architecture complète
- [GIS_IMPACT_ANALYSIS.md](./GIS_IMPACT_ANALYSIS.md) - Analyse d'impact fédération

---

_Document mis à jour le 6 décembre 2025 - Architecture multi-instance_ _Association C.O.R.S.I.C.A._
