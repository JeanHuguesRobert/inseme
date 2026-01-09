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
                  mode: { type: "string", enum: ["consensus", "debate", "workshop"] }
                }
              }
            }
        }
    ],
    configSchema: {
      default_room: { type: "string" },
      enable_vocal: { type: "boolean" },
      ophelia_voice: { type: "string" }
    },
    edgeFunctions: {
      "chat": {
        handler: "./edge/gateway.js",
        path: "/api/ophelia"
      },
      "chat-stream": {
        handler: "./edge/gateway.js",
        path: "/api/chat-stream"
      },
      "openai-v1": {
        handler: "./edge/gateway.js",
        path: "/v1/chat/completions"
      },
      "vector-search": {
        handler: "./edge/vector-search.js",
        path: "/api/vector-search"
      },
      "transcribe": {
        handler: "./edge/gateway.js",
        path: "/api/transcribe"
      },
      "translate": {
        handler: "./edge/gateway.js",
        path: "/api/translate"
      },
      "sessions": {
        handler: "./edge/sessions.js",
        path: "/api/sessions"
      },
      "health": {
        handler: "./edge/health.js",
        path: "/api/health"
      }
    }
  };
  
