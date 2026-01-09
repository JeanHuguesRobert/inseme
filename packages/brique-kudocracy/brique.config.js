export default {
  id: "democracy", // exposed as 'democracy' or 'kudocracy'? Let's use 'democracy' for the ID/routes to be clean.
  name: "Gouvernance Citoyenne",
  feature: "democracy",
  routes: [
    {
      path: "/democracy",
      component: "./src/pages/DemocracyDashboard",
      protected: false,
    },
    {
      path: "/propositions",
      component: "./src/components/kudocracy/PropositionList",
      protected: false,
    },
    {
      path: "/propositions/new",
      component: "./src/pages/PropositionCreate",
      protected: true,
    },
    {
      path: "/consultations",
      component: "./src/pages/ConsultationList",
      protected: false,
    },
  ],
  menuItems: [
    {
      id: "main-democracy",
      label: "Gouvernance",
      path: "/democracy",
      icon: "Scale", // Balance/Justice icon
      position: "header",
    },
  ],
  tools: [
    {
      type: "function",
      function: {
        name: "search_propositions",
        description: "Rechercher des propositions citoyennes soumis au vote.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
            status: { type: "string", enum: ["active", "closed", "draft"] },
          },
        },
      },
      handler: "./src/edge/tool-search-propositions.js",
    },
    {
      type: "function",
      function: {
        name: "vote_proposition",
        description: "Vote sur une proposition citoyenne.",
        parameters: {
          type: "object",
          properties: {
            proposition_id: { type: "string" },
            value: {
              type: "integer",
              enum: [1, -1, 0],
              description: "1 pour 'pour', -1 pour 'contre', 0 pour 'abstention'",
            },
          },
          required: ["proposition_id", "value"],
        },
      },
      handler: "./src/edge/tool-vote-proposition.js",
    },
    {
      type: "function",
      function: {
        name: "manage_delegation",
        description: "Gérer les délégations de vote.",
        parameters: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["delegate", "revoke"] },
            delegator_id: { type: "string" },
            delegate_id: { type: "string" },
            tag: { type: "string" },
          },
          required: ["action", "delegator_id", "tag"],
        },
      },
      handler: "./src/edge/tool-manage-delegation.js",
    },
    {
      type: "function",
      function: {
        name: "emit_vote_recommendation",
        description: "Émettre une recommandation de vote officielle d'Ophélia.",
        parameters: {
          type: "object",
          properties: {
            proposition_id: { type: "string" },
            recommendation: {
              type: "string",
              enum: ["pour", "contre", "abstention"],
            },
            rationale: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
          },
          required: ["proposition_id", "recommendation", "rationale", "tags"],
        },
      },
      handler: "./src/edge/tool-emit-recommendation.js",
    },
    {
      type: "function",
      function: {
        name: "prolog_query",
        description:
          "Interroger le moteur de raisonnement logique ProLog sur la gouvernance.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
          },
          required: ["query"],
        },
      },
      handler: "./src/edge/tool-prolog-query.js",
    },
  ],
  configSchema: {},
};
