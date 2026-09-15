---
title: plan-ophelia
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

## Plan détaillé : Centralisation, ouverture et interopérabilité d’Ophélia

---

### Où est stocké ce plan ?

Le plan est stocké dans un fichier persistant dans le dossier `docs/` de votre projet, nommé
`plan-ophelia.md`.  
Vous pouvez le versionner ou le partager selon vos besoins.

---

### 1. API REST centralisée (LePP.fr)

- **Fichier** : `netlify/functions/ophelia-api.js`
- **Fonction** : Point d’entrée unique pour toutes les interfaces (Space, widget, CLI, etc.)
- **Détails** :
  - POST `/api/ophelia` (question, options, historique)
  - Authentification par clé API (en place, header `x-api-key`)
  - Rate limiting (par IP, par clé) **(à faire)**
  - Logs d’usage (Supabase, Sentry…) **(à faire)**
  - Réponse structurée `{success, answer, metadata, sources}`
  - CORS ouvert pour domaines approuvés (HF, widgets, etc.)
  - Documentation API (OpenAPI/Swagger ou markdown)
  - Tests (curl, Postman, CLI)

---

### 2. Hugging Face Space (démo publique)

- **Dossier** : dépôt Space HF (ex : `pertitellu/ophelia-space`)
- **Fonction** : Vitrine interactive, accessible à tous, sans compte
- **Détails** :
  - Interface Gradio (Python) : textbox, historique, exemples, branding
  - Appel HTTP à l’API LePP.fr (pas de logique métier dans le Space)
  - README détaillé (fonctionnement, liens, limites, licence)
  - Assets (avatar, screenshots)
  - Lien vers LePP.fr pour la version complète
  - Tests robustesse (timeouts, erreurs API)
  - Publication et promotion

---

### 3. Package npm réutilisable

- **Dossier** : `packages/ophelia` ou dépôt séparé
- **Fonction** : Permettre l’intégration d’Ophélia dans d’autres apps Node.js/JS
- **Détails** :
  - Extraction de la logique core (RAG, providers, outils)
  - API simple : `ask(question, {history, provider, ...})`, `stream(question, cb)`, `getSources()`
  - Typage TypeScript, documentation complète
  - Exemples d’intégration (CLI, Next.js, Electron…)
  - Publication sur npm
  - Maintenance et support

---

### 4. Dataset open data

- **Dossier** : `datasets/` ou dépôt HF Datasets
- **Fonction** : Valoriser la connaissance locale, permettre le fine-tuning, la recherche, la
  transparence
- **Détails** :
  - Export des données (wiki, Q&A, docs municipaux) en JSONL
  - Structuration : `wiki_pages.jsonl`, `qa_pairs.jsonl`, `council_docs.jsonl`
  - Publication sur Hugging Face Datasets (licence CC-BY)
  - Documentation structure, provenance, licence
  - Lien dataset → Space et doc API

---

### 5. Documentation et communication

- **Dossier** : `docs/` ou README central
- **Fonction** : Faciliter l’adoption, la contribution, la compréhension
- **Détails** :
  - README central (architecture, cas d’usage, limites, sécurité)
  - Guides d’intégration (API, npm, Space, widget)
  - FAQ, troubleshooting, contact
  - Communication (civic-tech, HF, LinkedIn…)
  - Tutoriels vidéo/démo (optionnel)

---

### 6. Interopérabilité et standardisation (MCP)

- **Dossier** : `mcp/` ou dépôt séparé
- **Fonction** : Préparer l’intégration avec les outils LLM modernes (Claude Desktop, Cursor,
  Continue…)
- **Détails** :
  - Prototyper un serveur MCP (Model Context Protocol)
  - Exposer les ressources (wiki, docs, Q&A) via MCP
  - Exposer les outils (search_wiki, web_search, etc.)
  - Exposer les prompts (system, audit, citoyen…)
  - Utiliser le SDK officiel MCP (Node.js ou Python)
  - Documenter l’URI MCP pour intégration dans les IDE/outils compatibles
  - Tests avec Claude Desktop, Continue, Cursor
  - Lien doc MCP → doc API

---

### 7. Widget Ophélia (web embeddable)

- **Dossier** : `widget/` ou `public/widget/`
- **Fonction** : Permettre à d’autres sites d’intégrer facilement Ophélia
- **Détails** :
  - Widget JS (iframe ou web component)
  - UI minimaliste (chatbox, branding, lien LePP.fr)
  - Appel à l’API REST centrale
  - Options de personnalisation (couleurs, logo, position)
  - Documentation d’intégration (copier-coller, npm)
  - Sécurité : CORS, rate limiting, monitoring
  - Démo sur une page publique

---

### 8. Sécurité et monitoring

- **Dossier** : `docs/security.md`, monitoring via Supabase/Sentry
- **Fonction** : Garantir la robustesse, la confidentialité, la disponibilité
- **Détails** :
  - Rate limiting strict sur l’API
  - Validation/sanitization des inputs
  - Logs d’usage et alertes (Supabase, Sentry…)
  - Monitoring uptime (Statuspage, UptimeRobot…)
  - Politique RGPD (pas de données personnelles, anonymisation)
  - Audit régulier des accès et usages

---

### 9. Extensions et alternatives

- Intégration Discord/Slack/Telegram via l’API
- Export PDF/Markdown des conversations
- Tableau de bord d’usage (statistiques API/Space)
- Space autonome (toute la logique dans HF) : déconseillé sauf besoin de décentralisation
- Intégration Streamlit Cloud (complémentaire à HF)

---

**Ce plan est stocké dans un fichier persistant. Vous pouvez le déplacer dans `docs/` ou un dépôt
dédié pour le versionner et le partager.**
