---
canonical_url: https://github.com/JeanHuguesRobert/inseme/blob/main/packages/cop-host/BRIQUE_SPEC.md
author: Jean Hugues Noël Robert, baron Mariani
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
license: CC BY-SA 4.0
last_stamped_at: 2026-06-01T00:00:00.000Z
language: fr
date: '2026-09-15'
update_policy: UP-DEFAULT-REVIEWED
status: working-paper
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


# Spécification du Manifeste de Brique (brique.config.js)

Le manifeste `brique.config.js` est le point d'entrée unique pour définir comment un module (une
"brique") s'intègre dans l'écosystème Cop-Host.

## Structure du Manifeste

```javascript
/**
 * @type {import('@inseme/cop-host').BriqueConfig}
 */
export default {
  // Identifiant unique de la brique (kebab-case)
  id: "wiki",

  // Nom d'affichage (pour l'administration)
  name: "Wiki Collaboratif",

  // Clé de feature flag dans instance_config (ex: feature_wiki)
  feature: "wiki",

  // --- FRONTEND ---

  // Définition des routes React
  routes: [
    {
      path: "/wiki",
      // Chemin relatif vers le composant de page
      component: "./src/pages/WikiHome.jsx",
      // Si vrai, la route est protégée par authentification
      protected: false,
    },
    {
      path: "/wiki/:slug",
      component: "./src/pages/WikiPage.jsx",
    },
  ],

  // Entrées dans les menus de navigation
  menuItems: [
    {
      id: "main-wiki",
      label: "Wiki",
      path: "/wiki",
      icon: "Book", // Nom de l'icône Phosphor
      position: "header", // 'header', 'footer', 'sidebar'
    },
  ],

  // --- BACKEND (NETLIFY) ---

  // Functions Node.js classiques
  functions: {
    // La clé devient le nom de la fonction : /api/wiki-sync
    sync: {
      handler: "./src/functions/sync.js",
      schedule: "0 0 * * *", // Optionnel : pour les fonctions cron
    },
  },

  // Edge Functions (Deno)
  edgeFunctions: {
    resolver: {
      path: "/wiki/*",
      handler: "./src/edge/resolver.js",
    },
  },

  // --- CONFIGURATION ---

  // Définition des paramètres requis dans instance_config
  configSchema: {
    wiki_storage_bucket: {
      type: "string",
      default: "wiki-content",
      description: "Nom du bucket Supabase pour le stockage",
    },
  },
};
```

## Fonctionnement du Compiler

Le **Brique Compiler** (dans `cop-host`) utilisera ces manifestes pour :

1.  **Génération des Entry-points Netlify** : Création de fichiers "wrapper" dans
    `apps/platform/src/netlify/[functions|edge-functions]/[brique-id]-[func-name].js` qui importent
    le handler de la brique et injectent le runtime Cop-Host.

2.  **Génération du Registre Frontend** : Création d'un fichier `brique-registry.gen.js` importé par
    `App.jsx` pour enregistrer dynamiquement les routes et les menus si la feature est activée.

3.  **Validation de la Config** : Vérification au démarrage que l'instance possède les paramètres
requis par les briques activées.
<!-- BEGIN_AUTO: backlinks -->
### Backlinks

*These documents link to this file:*
- [Cogentia Commons — MVP Specification](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/cogentia_commons_mvp_spec.md)
- For citizens
- [brique-auxilia](../brique-auxilia/README.md)
- [Concept Index — inseme](../../research/concepts.md)
- [Inseme](../../README.md)
- [Research Index — Inseme](../../research/index.md)
<!-- END_AUTO: backlinks -->
