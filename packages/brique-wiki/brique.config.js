export default {
  id: "wiki",
  name: "Wiki Collaboratif",
  feature: "wiki",
  routes: [
    {
      path: "/wiki",
      component: "./src/pages/Wiki",
      protected: false,
    },
    {
      path: "/wiki/new",
      component: "./src/pages/WikiCreate",
      protected: true,
    },
    {
      path: "/wiki/dashboard",
      component: "./src/pages/WikiDashboard",
      protected: true,
    },
    {
      path: "/wiki/:slug",
      component: "./src/pages/WikiPage",
      protected: false,
    },
    {
      path: "/wiki/:slug/edit",
      component: "./src/pages/WikiEdit",
      protected: true,
    },
  ],
  menuItems: [
    {
      id: "main-wiki",
      label: "Wiki",
      path: "/wiki",
      icon: "Book",
      position: "header",
    },
  ],
  functions: {
    sync: {
      handler: "./src/functions/sync.js",
      schedule: "0 0 * * *", // Daily sync
    },
    resolve: {
      handler: "./src/functions/resolve.js",
    },
    propose: {
      handler: "./src/functions/propose.js",
    },
    "optimize-title": {
      handler: "./src/functions/optimize-title.js",
    },
    "propose-ai": {
      handler: "./src/functions/propose-ai.js",
    },
    search: {
      handler: "./src/functions/search.js",
    },
  },
  tools: [
    {
      type: "function",
      handler: "./src/edge/tool-search-wiki.js",
      function: {
        name: "search_wiki",
        description:
          "Rechercher des informations dans le Wiki global ou spécifique à la salle. Utilise cet outil pour trouver des précédents, des définitions ou des règles archivées.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Le terme ou la question à rechercher.",
            },
            scope: {
              type: "string",
              enum: ["global", "room"],
              description: "L'étendue de la recherche.",
            },
          },
          required: ["query"],
        },
      },
    },
    {
      type: "function",
      handler: "./src/edge/tool-propose-wiki.js",
      function: {
        name: "propose_wiki_page",
        description:
          "Proposer la création ou la mise à jour d'une page Wiki. Utilise cet outil pour synthétiser des décisions de réunion, créer un compte-rendu ou archiver une information importante.",
        parameters: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Le titre de la page Wiki.",
            },
            content: {
              type: "string",
              description: "Le contenu Markdown de la page.",
            },
            summary: {
              type: "string",
              description:
                "Un bref résumé (1-2 phrases) de l'objectif de la page.",
            },
            is_room_specific: {
              type: "boolean",
              description:
                "Si vrai, la page sera liée uniquement à cette salle.",
            },
          },
          required: ["title", "content"],
        },
      },
    },
  ],
  configSchema: {
    wiki_storage_bucket: {
      type: "string",
      default: "wiki-content",
    },
  },
};
