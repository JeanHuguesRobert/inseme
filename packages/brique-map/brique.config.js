export default {
    id: "map",
    name: "Carte Citoyenne",
    feature: "map",
    routes: [
      {
        path: "/map",
        component: "./src/pages/MapPage",
        protected: false,
      },
    ],
    menuItems: [
      {
        id: "main-map",
        label: "Carte",
        path: "/map",
        icon: "Map",
        position: "header",
      },
    ],
    tools: [
        {
      type: "function",
      handler: "./src/edge/tool-search-map.js",
      function: {
        name: "search_map_places",
              description: "Rechercher des lieux ou des points d'intérêt sur la carte.",
              parameters: {
                type: "object",
                properties: {
                  query: { type: "string", description: "Nom du lieu ou type (ex: Mairie, École)." },
                  limit: { type: "number", description: "Nombre de résultats (défaut: 5)." }
                }
              }
            }
        }
    ],
    configSchema: {
        map_default_lat: { type: "string" },
        map_default_lng: { type: "string" },
        map_default_zoom: { type: "number" },
    },
    edgeFunctions: {
        "municipal-data": {
            handler: "./src/edge/municipal-data.js",
            path: "/api/municipal/*"
        }
    }
  };
  
