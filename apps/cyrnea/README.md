# 🍷 Cyrnea - L'IA au Comptoir

**Cyrnea** est l'application mobile de l'écosystème **Inseme**, conçue pour réenchanter les lieux de
convivialité (bars, cafés de village). Elle transforme le comptoir en un espace d'interaction
sociale augmenté par l'intelligence artificielle locale, **Ophélia**.

> Pour une vue d'ensemble de l'écosystème (Plateforme, Agora, IA), consultez le
> [README global du dépôt](../../README.md).

---

## 🎯 Fonctionnalités Clés

### 1. 🤖 Ophélia, l'IA du Bar

Ophélia est une intelligence artificielle contextuelle qui "habite" le bar :

- **Conversation Vocale** : Discutez avec elle de la vie du village, des actualités locales ou de
  philosophie.
- **Médiation** : Elle facilite les échanges et propose des sujets de discussion.
- **Mémoire Locale** : Elle apprend des interactions pour enrichir la culture commune du lieu.

### 2. 📰 La Gazette (Le Fil)

Un journal local généré et alimenté par la communauté :

- **Actualités Locales** : Informations hyper-locales (village, vallée).
- **Contributions** : Les clients peuvent poster des brèves ou des annonces.
- **Génération IA** : Ophélia aide à rédiger et synthétiser les nouvelles.

### 3. 📱 Expérience Client (PWA)

Une application installable (PWA) sans friction :

- **Profil Public** : Carte de visite numérique (liens réseaux sociaux, bio).
- **Messagerie de Salle** : Chat public éphémère pour interagir avec les personnes présentes.
- **Jeux & Vibe** : Quiz, sondages et météo de l'ambiance.

### 4. 🍹 Dashboard Barman

L'outil de pilotage pour le tenancier :

- **Gestion de l'Ambiance** : Contrôle de la musique et des animations.
- **Modération** : Supervision des échanges et de la Gazette.
- **Pilotage d'Ophélia** : Configuration du comportement de l'IA.

---

## 🏗️ Architecture Technique

Cyrnea est une **Progressive Web App (PWA)** moderne construite sur une architecture modulaire :

- **Frontend** : React 18 + Vite + Tailwind CSS (v4).
- **IA & Backend** :
  - **@inseme/cop-host** : Cœur du système multi-tenant (gestion des instances/bars).
  - **@inseme/brique-ophelia** : Moteur d'IA (LLM, RAG, TTS/STT).
  - **Supabase** : Base de données temps réel et authentification.
  - **Netlify Edge Functions** : Backend serverless pour les interactions IA rapides.
- **Briques Métier** :
  - `brique-cyrnea` : Logique spécifique au bar.
  - `brique-fil` : Moteur de la Gazette.
  - `brique-democracy` : Outils de vote et de gouvernance (en arrière-plan).

---

## 🛠️ Installation et Développement

### Pré-requis

- Node.js 20+
- Pnpm
- Un compte Supabase et Netlify (pour le déploiement)
- Clés API pour les modèles IA (OpenAI, Anthropic, etc.) configurées dans le Vault.

### Setup Rapide

1.  **Installez les dépendances (racine du monorepo)** :

    ```bash
    pnpm install
    ```

2.  **Lancez le serveur de développement** :

    ```bash
    pnpm run netlify:dev
    ```

    _Note : Utilisez `netlify:dev` plutôt que `vite` seul pour activer les Edge Functions (IA)._

3.  **Accédez à l'application** :
    - **URL** : `http://localhost:8888` (Port Netlify)
    - **Bar de démo** : `http://localhost:8888/bar/cyrnea`
    - **Client** : `http://localhost:8888/app/cyrnea`

---

## 🌍 Déploiement Multi-Bars

Cyrnea est conçue pour être déployée une seule fois et servir plusieurs lieux (Multi-tenant). L'URL
détermine le contexte :

- `/bar/:id` -> Charge la configuration et la mémoire du bar `:id`.
- Le système **Cop-Host** adapte dynamiquement le SEO, le thème et la personnalité d'Ophélia.

---

## 📜 Licence & Auteur

Ce projet est sous licence **MIT**.

- **Porté par** : L'association **C.O.R.S.I.C.A.** et la communauté [Inseme](https://inseme.app).
- **Philosophie** : Technologie conviviale, souveraine et ancrée dans le territoire.
- **Fait avec ❤️ à Corte, Corse.**

---

### #PERTITELLU | CORTI CAPITALE
