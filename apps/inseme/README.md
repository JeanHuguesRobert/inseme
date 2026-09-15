---
title: 🧬 Inseme - L'Agora Participative v3.0
author: unknown
date: '2026-01-01'
document_role: source
document_kind: documentation
visibility: public
lifecycle_state: working
update_policy: UP-DEFAULT-REVIEWED
provenance:
  origin_type: repository
  origin_repository: JeanHuguesRobert/inseme
  origin_ref: f99e4bf
  origin_date: '2026-01-01'
  derived_from: []
review:
  status: unreviewed
  reviewed_by: []
license: CC BY-SA 4.0
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
language: fr
status: working-paper
---


# 🧬 Inseme - L'Agora Participative v3.0

**Inseme** est l'outil de démocratie directe et liquide du monorepo Inseme. Il facilite la
participation à distance à des assemblées physiques, inspiré par les principes de la démocratie
directe et liquide. Cette version modernisée intègre l'intelligence artificielle (Ophélia) et des
technologies temps réel pour une délibération fluide et proactive.

> Pour une vue d'ensemble de l'écosystème (Plateforme, Wiki, Gazette), consultez le
> [README global du dépôt](../../README.md).

---

## 🏛️ Démocratie Directe & Liquide

Inseme permet aux participants de s'engager sans barrières bureaucratiques :

- **Accès Liquide** : Participez instantanément en tant qu'**Invité** (anonyme) avec un pseudonyme,
  ou devenez **Membre** pour conserver votre historique.
- **Médiation IA (Ophélia)** : Une agente intelligente qui anime, résume et structure les débats.
  Elle intervient de manière proactive pour faciliter le consensus.
- **Délégation Dynamique** : Système de procuration et de délégation de vote en temps réel.
- **Gestuelle Digitale** : Vote instantané via une interface optimisée (Accord, Désaccord, Besoin
  d'air, Demande de parole).
- **Visioconférence Native** : Intégration Jitsi Meet pour une latence minimale.

---

## 🚀 Technologie (Modern Stack)

- **Frontend** : [React](https://reactjs.org/) + [Vite](https://vitejs.dev/) +
  [Tailwind CSS](https://tailwindcss.com/)
- **Backend Realtime** : [Supabase](https://supabase.com/) (PostgreSQL, Realtime, Auth)
- **AI Agent** : OpenAI GPT-4o orchestré via **Netlify Edge Functions** (Deno).
- **Media** : [Jitsi Meet SDK](https://jitsi.org/) pour la vidéo temps réel.
- **Stockage Hybride** : Cloudflare R2 & Supabase Storage pour les archives vocales et rapports.

---

## 🤖 Ophélia : L'Agente Médiatrice

Ophélia est une participante active au service de l'assemblée :

- **Synthèse** : Elle résume les échanges complexes pour aider à la décision.
- **Neutralité** : Elle ne prend pas parti, elle facilite le processus démocratique.
- **Mémoire** : Elle accède aux archives et au contexte des sessions précédentes.
- **Interface Chat** : Pilotez l'assemblée avec des commandes comme `inseme ?` pour proposer un
  vote.

---

## 🛠️ Installation et Développement

### Setup Rapide

1.  Installez les dépendances : `npm install`
2.  Configurez votre `.env` (voir `.env.example`).
3.  Lancez le serveur de développement :
    ```bash
    # Recommandé (avec Edge Functions)
    netlify dev
    ```
    _L'application sera accessible sur `http://localhost:8888`._

---

## 📖 Commandes Inseme (Chat)

- `inseme ? [Texte]` : Définit la proposition de vote active.
- `inseme !` : Réinitialise les votes de la session.
- `inseme live [url]` : Active le flux vidéo.
- `inseme report` : Génère un rapport de session via Ophélia.

---

## ⚖️ Neutralité & Engagement

Comme tous les outils du projet Inseme, cette application est une infrastructure **neutre**. Elle ne
soutient aucun candidat ou liste électorale.

---

## 📜 Licence & Auteur

Ce projet est sous licence **MIT**.

**Auteur : Jean Hugues Noël Robert**

- Projet porté par l'association **C.O.R.S.I.C.A.** (Président Fondateur : Jean Hugues Noël Robert).
- Communauté [LePP.fr](https://lepp.fr).
- Fait avec ❤️ à Corte, Corse.

---

### #PERTITELLU | CORTI CAPITALE
