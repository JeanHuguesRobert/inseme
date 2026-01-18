export default {
  id: "ophelia",
  name: "Ophélia - Chat Vocal",
  feature: "vocal_chat",
  routes: [
    {
      path: "/chat",
      component: "./components/chat/OpheliaChat",
      protected: false,
    },
    {
      path: "/ophelia",
      component: "./InsemeRoom",
      protected: false,
    },
    {
      path: "/ophelia/:roomName",
      component: "./InsemeRoom",
      protected: false,
    },
  ],
  menuItems: [
    {
      id: "main-ophelia-chat",
      label: "Ophélia Chat",
      path: "/chat",
      icon: "ChatTeardropText",
      position: "header",
    },
    {
      id: "main-ophelia-vocal",
      label: "Ophélia Vocal",
      path: "/ophelia",
      icon: "Microphone",
      position: "header",
    },
  ],
  tools: [
    {
      type: "function",
      function: {
        name: "create_inseme_room",
        description: "Créer une nouvelle session Inseme avec Ophélia.",
        parameters: {
          type: "object",
          properties: {
            room_name: { type: "string", description: "Nom de la salle" },
            mode: { type: "string", enum: ["consensus", "debate", "workshop"] },
          },
        },
      },
    },
  ],
  configSchema: {
    default_room: { type: "string" },
    enable_vocal: { type: "boolean" },
    ophelia_voice: { type: "string" },
  },
  prompts: {
    identity: "./public/prompts/identity.md",
    "identity-origin": "./public/prompts/identity/origin.md",
    "identity-personality": "./public/prompts/identity/personality.md",
    "identity-conatus": "./public/prompts/identity/conatus.md",
    "identity-ethos": "./public/prompts/identity/ethos.md",
    final_instructions: "./public/prompts/final_instructions.md",
    "mode-mediator": "./public/prompts/modes/mediator.md",
    "mode-assistant": "./public/prompts/modes/assistant.md",
    "mode-oracle": "./public/prompts/modes/oracle.md",
    "capability-sql": "./public/prompts/capabilities/sql.md",
    "capability-search": "./public/prompts/capabilities/search.md",
    "capability-democracy": "./public/prompts/capabilities/democracy.md",
    "capability-logic": "./public/prompts/capabilities/logic.md",
    "role-mediator": "./public/prompts/roles/mediator.md",
    "role-analyst": "./public/prompts/roles/analyst.md",
    "role-scribe": "./public/prompts/roles/scribe.md",
    "role-guardian": "./public/prompts/roles/guardian.md",
    "role-cyrnea-indoor": "./public/prompts/roles/cyrnea-indoor.md",
    "role-cyrnea-outdoor": "./public/prompts/roles/cyrnea-outdoor.md",
    "task-translate": "./public/prompts/tasks/translate.md",
    "task-summarize": "./public/prompts/tasks/summarize.md",
    "task-report": "./public/prompts/tasks/report.md",
    "task-share": "./public/prompts/tasks/share.md",
    "task-gabriel": "./public/prompts/tasks/gabriel.md",
  },
  edgeFunctions: {
    chat: {
      handler: "./edge/gateway.js",
      path: "/api/ophelia",
    },
    "chat-stream": {
      handler: "./edge/gateway.js",
      path: "/api/chat-stream",
    },
    "openai-v1": {
      handler: "./edge/gateway.js",
      path: "/v1/chat/completions",
    },
    "vector-search": {
      handler: "./edge/vector-search.js",
      path: "/api/vector-search",
    },
    transcribe: {
      handler: "./edge/gateway.js",
      path: "/api/transcribe",
    },
    translate: {
      handler: "./edge/gateway.js",
      path: "/api/translate",
    },
    summarize: {
      handler: "./edge/gateway.js",
      path: "/api/summarize",
    },
    sessions: {
      handler: "./edge/sessions.js",
      path: "/api/sessions",
    },
    health: {
      handler: "./edge/health.js",
      path: "/api/health",
    },
    "prolog-executor": {
      handler: "./edge/prolog-executor.js",
      path: "/api/prolog-executor",
    },
  },
};
