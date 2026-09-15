---
title: '**ÉCOSYSTÈME OPHÉLIA**'
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

# **ÉCOSYSTÈME OPHÉLIA**

## **Architecture ouverte pour la démocratie locale augmentée**

---

## **0. Résumé exécutif**

Ophélia est un **système d’information civique ouvert**, conçu pour aider une commune — d’abord
Corte, ensuite toute collectivité volontaire — à devenir lisible, transparente et gouvernable par
ses citoyens.

L’écosystème repose sur trois piliers :

1. **Un noyau souverain de données** : Supabase (Postgres + Auth + Storage) contenant les identités,
   les actes publics, les contenus citoyens, et l’historique décisionnel.
2. **Un réseau d’applications modulaires** : certaines intégrées (cœur critique), d’autres tierces,
   connectées soit par **API** soit par le protocole **MCP** (Model Context Protocol), garantissant
   une interopérabilité saine avec l’assistante IA Ophélia.
3. **Une “place” Hugging Face** : laboratoire public où sont publiés modèles IA, datasets civiques,
   démonstrations et outils réutilisables, garantissant transparence, auditabilité et
   reproductibilité.

L’ensemble forme une **infrastructure civique** : un socle durable, open source, documenté, dont la
commune et ses habitants peuvent se servir pour décider mieux, débattre mieux et contrôler mieux.

---

# **1. Vision d’ensemble**

Ophélia repose sur une conviction simple :

> Une démocratie locale moderne a besoin d’une **infrastructure technique ouverte**, où l’IA est un
> outil de compréhension, jamais un substitut à la délibération.

L’écosystème doit donc être :

- **Lisible** (comprendre la décision publique),
- **Vérifiable** (chaque analyse IA doit renvoyer vers les données sources),
- **Fédérable** (installable dans n’importe quelle commune),
- **Extensible** (applications tierces),
- **Auditables** (modèles, données, décisions d’IA accessibles sur Hugging Face).

---

# **2. Architecture générale (non technique)**

On peut décrire Ophélia comme une ville numérique composée de trois bâtiments :

### **A. Le “noyau civique” (Supabase)**

Le registre de la cité :

- actes municipaux, marchés publics, budgets, arrêtés ;
- identités citoyennes (compte unique Ophélia) ;
- contenus créés dans la plateforme (posts, commentaires, votes, incidents, Gazette, Le Fil) ;
- données géographiques (incidents, PLU, adresses, parcelles) ;
- journaux d’audit et de traçabilité.

### **B. Les “applications” (modules internes et tiers)**

Tout ce qui tourne autour du noyau, sans le déformer :

- Tableau de bord de transparence,
- Gazette,
- Le Fil,
- Carte des incidents,
- “Aleph municipal” (fouille d’actes),
- Outils mobilité, météo, patrimoine, démocratie directe, etc.

Chaque application a un contrat d’accès clair : **direct DB** (intégration forte) ou **API / MCP**
(tiers).

### **C. La “Place Hugging Face”**

L’espace public où Ophélia expose :

- modèles IA adaptés à la vie municipale ;
- datasets publics (anonymisés si nécessaire) ;
- démonstrations reproductibles ;
- outils pédagogiques pour journalistes, universitaires, étudiants ;
- documentation et code ouvert.

Hugging Face = vitrine + laboratoire + bibliothèque du bien commun numérique.

---

# **3. Architecture technique complète**

## **3.1. Noyau : Supabase comme fondation souveraine**

Supabase fournit :

- **Postgres** : base relationnelle structurée, versionnée, robuste.
- **Auth** : identité citoyenne unique, compatible OAuth2 / OIDC.
- **RLS** : contrôle d’accès au niveau ligne.
- **Storage** : documents municipaux, annexes, images, OCR.
- **Edge Functions** : logique sensible (calculs, notifications, règles administratives).
- **Realtime** : flux d’événements (vote, incident, commentaire).

### **Schéma minimal “core”**

Sans SQL, juste en termes conceptuels :

- `user` : identités citizens
- `group` : groupes / associations
- `post`, `comment`, `reaction`
- `act` : délibérations, arrêtés, marchés
- `market`, `subsidy`, `budget_line`
- `geo_event` : incident, alerte, chantier
- `source_file` : PDF, HTML, images
- `relation` : graphe simple (personne ↔ acte ↔ entreprise)
- `audit_log` : traçabilité

### **Contrat “noyau”**

- Versionné (core v1, v2…)
- Documenté (OpenAPI + description de schéma)
- Stable (aucune rupture non annoncée)

---

## **3.2. Les deux modes d’intégration : Direct DB vs API**

### **A. Accès direct DB (pour modules intégrés)**

- Rôles Postgres dédiés, RLS strict
- Performances maximales
- Permet des jointures complexes, des dashboards lourds
- Exemple :
  - Aleph municipal
  - Analyse budgétaire
  - Moteur interne de détection d’anomalies (Marchés publics)

### **B. Accès via API (pour modules tiers ou externes)**

API REST/GraphQL versionnées : `api.lepp.fr/v1/*`

- `/acts/search`
- `/markets/by-company`
- `/subsidies/by-beneficiary`
- `/geo/incidents`
- `/gazette/articles`
- `/fil/posts`

API authentifiée par OAuth2 :

- scopes : `read_public`, `write_incident`, `read_budget`, `admin_local`, etc.

**Plus jamais d’accès SQL brut** pour des tiers.

---

## **3.3. Le protocole MCP comme norme d’intégration IA**

MCP = Model Context Protocol.

Il permet à l’assistante IA Ophélia d’interagir **de manière standardisée** avec toutes les
applications.

### **Serveurs MCP (par domaine)**

1. **Acts Server**
   - Tools :
     - `search_acts(query, filters)`
     - `get_act(id)`
     - `summarize_act(id)`
     - `explain_decision_flow(id)`

2. **Markets Server**
   - Tools :
     - `search_markets(company, year)`
     - `risk_score(market_id)`
     - `list_companies(frequency)`

3. **Incidents Server**
   - Tools :
     - `report_incident(lat, lon, type, description)`
     - `list_incidents(bbox, range)`

4. **Gazette / Fil Server**
   - Tools :
     - `list_articles(tag)`
     - `post_comment(article_id, text)`

### **Pourquoi MCP change tout**

- Découplage complet entre **LLM** et **backend**.
- Standardisation des interactions.
- Derrière la façade MCP, tu peux migrer de Supabase à autre chose sans cassure.
- Les modules tiers peuvent **eux-mêmes** exposer un serveur MCP.

Ophélia devient une IA **fédératrice**, pas centralisatrice.

---

## **3.4. La “Place Hugging Face”**

### **Ce que tu y publies**

- **Modèles spécialisés** :
  - OCR municipal,
  - NER juridique / administratif,
  - embeddings optimisés pour les textes d’actes,
  - modèles de résumé législatif,
  - détecteurs de motifs (économie, urbanisme, finances).

- **Datasets** :
  - corpus de documents publics (délibérations, PLU, budgets),
  - extraits anonymisés de conversations citoyennes,
  - jeux de test pour évaluer transparence / cohérence des algorithmes.

- **Spaces (démos)** :
  - mini-rag sur les délibérations,
  - détection automatique de conflits d’intérêts,
  - cartographie interactive d’incidents,
  - pipeline Supabase → HF → LLM.

### **Intention politique et journalistique**

Hugging Face sert de :

- **preuve de transparence** (on montre nos modèles, leurs limites, leurs biais),
- **outil d’éducation civique**,
- **espace de coopération inter-communes**,
- **base documentaire pour les journalistes**.

---

# **4. Circulation de l’information**

### **Flux 1 : ingestion → noyau**

Scrapers, fichiers, OCR → normalisation → stockage Supabase → index vectoriel → audit log.

### **Flux 2 : noyau → API / MCP**

Les modules consommateurs reçoivent :

- données structurées via API,
- opérations intelligentes via MCP.

### **Flux 3 : noyau → HF (anonymisé)**

Snapshot ou extraction anonymisée → dataset HF → fine-tuning → modèles publiés.

### **Flux 4 : HF → IA → MCP → utilisateur**

Les modèles HF alimentent l’IA Ophélia, qui utilise MCP pour interroger les données réelles.

---

# **5. Gouvernance, transparence, éthique**

### **Principes**

1. **Lisibilité des décisions de l’IA**
   - Pour chaque réponse : liste des documents consultés (via MCP).
   - Jamais de déduction implicite sans preuve.

2. **Auditabilité des modèles**
   - Versions publiées sur HF.
   - Datasets d’entraînement décrits.

3. **Indépendance technique**
   - Le cœur (Supabase) reste souverain.
   - HF n’héberge jamais les données identifiantes.

4. **Interopérabilité**
   - MCP permet de brancher n’importe quel outil externe.

---

# **6. Positionnement stratégique (journalistes + communes + devs)**

### **Pour un journaliste**

Ophélia = **machine à rendre visibles les décisions locales**.

- Pourquoi ce marché ?
- Quelles entreprises sont récurrentes ?
- Quels délais de publication des actes ?
- Quels motifs dans les budgets ?

### **Pour un développeur**

Ophélia = **cadre modulaire**.

- API documentée,
- serveurs MCP,
- datasets publics d’entraînement,
- schémas stables,
- sandbox.

### **Pour une commune**

Ophélia = **infrastructure clé-en-main** pour :

- transparence,
- participation,
- archivage,
- analyse,
- IA assistive.

Tu peux en déployer plusieurs : Corte → autres communes corses → France.

---

# **7. Message final**

Ophélia n’est pas une application. C’est **une architecture civique** conçue pour durer 30 ans,
évoluer, être reprise, forkée, améliorée, auditée.

C’est une **colonne vertébrale numérique** pour les communes qui veulent cesser d’être opaques par
inertie plutôt que par malveillance.

Et c’est aussi une manière de montrer que l’IA, quand elle est bien conçue, peut servir la
démocratie **sans jamais s’y substituer**.
