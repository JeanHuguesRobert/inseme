export default {
  id: "host",
  name: "Host Runtime",
  feature: "host",
  routes: [],
  menuItems: [],
  tools: [],
  functions: {},
  edgeFunctions: {
    upload: {
      handler: "./src/edge/upload.js",
      path: "/api/upload",
    },
    robots: {
      handler: "./src/edge/robots.js",
      path: "/robots.txt",
    },
  },
  configSchema: {},
};
