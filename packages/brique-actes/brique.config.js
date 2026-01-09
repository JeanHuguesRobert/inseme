export default {
    id: "actes",
    name: "Actes Administratifs",
    feature: "administrative_acts",
    routes: [
      {
        path: "/actes",
        component: "./src/pages/ActesDashboard",
        protected: true,
      },
      {
        path: "/actes/accueil",
        component: "./src/pages/ActesHome",
        protected: false,
      },
      {
        path: "/actes/liste",
        component: "./src/pages/ActesList",
        protected: false,
      },
      {
        path: "/actes/nouveau",
        component: "./src/pages/ActeForm",
        protected: true,
      },
      {
        path: "/actes/:id",
        component: "./src/pages/ActeDetail",
        protected: false,
      },
      {
        path: "/actes/:id/modifier",
        component: "./src/pages/ActeForm",
        protected: true,
      },
      {
        path: "/actes/:id/chronologie",
        component: "./src/pages/ActeTimeline",
        protected: false,
      },
      {
        path: "/actes/chronologie",
        component: "./src/pages/ActeTimeline",
        protected: false,
      },
      {
        path: "/actes/stats",
        component: "./src/pages/StatsDashboard",
        protected: true,
      },
      {
        path: "/demandes",
        component: "./src/pages/DemandesList",
        protected: false,
      },
      {
        path: "/demandes/nouvelle",
        component: "./src/pages/DemandeForm",
        protected: true,
      },
      {
        path: "/demandes/:id",
        component: "./src/pages/DemandeDetail",
        protected: false,
      },
      {
        path: "/demandes/:id/modifier",
        component: "./src/pages/DemandeForm",
        protected: true,
      },
      {
        path: "/preuves/ajouter",
        component: "./src/pages/ProofUpload",
        protected: true,
      },
      {
        path: "/moderation/actions",
        component: "./src/pages/OutgoingActionsQueue",
        protected: true,
      },
      {
        path: "/moderation/preuves",
        component: "./src/pages/VerificationQueue",
        protected: true,
      },
      {
        path: "/moderation/publications",
        component: "./src/pages/PublicationModeration",
        protected: true,
      },
      {
        path: "/moderation/responsabilites",
        component: "./src/pages/ResponsibilityLog",
        protected: true,
      },
      {
        path: "/exports/pdf",
        component: "./src/pages/ExportPDF",
        protected: true,
      },
      {
        path: "/exports/csv",
        component: "./src/pages/ExportCSV",
        protected: true,
      },
    ],
    menuItems: [
      {
        id: "main-actes",
        label: "Actes",
        path: "/actes",
        icon: "FileText",
        position: "header",
      },
      {
        id: "main-demandes",
        label: "Demandes",
        path: "/demandes",
        icon: "Clipboard",
        position: "header",
      },
    ],
    tools: [
        {
            type: "function",
            function: {
              name: "search_actes",
              description: "Rechercher des actes administratifs publiés.",
              parameters: {
                type: "object",
                properties: {
                  query: { type: "string" },
                  year: { type: "number" },
                  type: { type: "string" }
                }
              }
            },
            handler: "./src/edge/tool-search-actes.js"
        },
        {
            type: "function",
            function: {
              name: "get_demande_status",
              description: "Obtenir le statut d'une demande administrative.",
              parameters: {
                type: "object",
                properties: {
                  demande_id: { type: "string" }
                },
                required: ["demande_id"]
              }
            },
            handler: "./src/edge/tool-get-demande-status.js"
        }
    ],
    configSchema: {
      municipality_name: { type: "string" },
      publication_delay_days: { type: "number" }
    }
  };
  
