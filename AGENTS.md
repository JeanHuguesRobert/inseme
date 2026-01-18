# Agents & MCP Tools

Ce fichier recense les outils et règles spécifiques pour les agents de codage (comme toi)
travaillant sur ce dépôt.

## Nouveaux Outils MCP

### Context7

**But** : Explorer efficacement la documentation des packages et bibliothèques utilisés dans le
projet. **Usage** : Utilise cet outil lorsque tu as besoin de comprendre comment utiliser une
fonction, une classe ou un module d'un package tiers ou interne, au lieu de deviner ou de chercher
uniquement dans le code source. Il fournit un contexte enrichi issu des documentations officielles.
**Exemples d'utilisation** :

- **Netlify** : Vérifier la syntaxe de configuration `netlify.toml` ou les API des Edge Functions.
- **Vite** : Comprendre la configuration avancée (`vite.config.js`), les plugins (comme
  `vite-plugin-pwa`), ou les variables d'environnement.
- **React / Bibliothèques UI** :
  - `@dnd-kit/core` : Gestion avancée du drag & drop.
  - `@tanstack/react-query` : Gestion du cache et de l'état serveur.
  - `framer-motion` : Animations complexes.
  - `playwright` : Tests end-to-end.
  - `tailwindcss` (v4) : Nouvelles directives et configuration.

## Règles et Contextes pour les Agents

Plusieurs fichiers à la racine du dépôt définissent les règles de codage, l'architecture et le
contexte nécessaire pour travailler efficacement :

- **[.rules.md](./.rules.md)** : Règles générales de développement, conventions de nommage, et
  bonnes pratiques.
- **[.ai-rules.md](./.ai-rules.md)** : Règles spécifiques pour les assistants IA (comportement,
  style de réponse, etc.).
- **[.gemini.md](./.gemini.md)** : Instructions ou contextes spécifiques au modèle Gemini.
- **[.api-docs.md](./.api-docs.md)** : Documentation ou références d'API importantes pour le projet.

## Architecture

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** : Vue d'ensemble de l'architecture du système
  Inseme/Cyrnea.
- **[ROADMAP-TECH.md](./ROADMAP-TECH.md)** : Feuille de route technique.

Merci de te référer à ces fichiers pour aligner tes contributions avec les standards du projet.
