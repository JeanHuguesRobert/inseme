export default {
  id: "blog",
  name: "Gestion des Blogs",
  feature: "blog",
  routes: [
    {
      path: "/blog",
      component: "./src/pages/BlogHome",
      protected: false,
    },
    {
      path: "/blog/new",
      component: "./src/pages/BlogEditor",
      protected: true,
    },
    {
      path: "/blog/:slug",
      component: "./src/pages/BlogPost",
      protected: false,
    },
    {
      path: "/blog/:slug/edit",
      component: "./src/pages/BlogEditor",
      protected: true,
    },
    {
      path: "/gazette",
      component: "./src/pages/GazettePage",
      protected: false,
    },
    {
      path: "/gazette/:name",
      component: "./src/pages/GazettePage",
      protected: false,
    },
  ],
  menuItems: [
    {
      id: "main-blog",
      label: "Interventions",
      path: "/blog",
      icon: "Newspaper", // Lucide/Phosphor icon name
      position: "header",
    },
  ],
  functions: {
    // Backend functions (optional, e.g. for RSS feed)
  },
  tools: [
    {
      type: "function",
      handler: "./src/edge/tool-read-blog.js",
      function: {
        name: "read_blog_posts",
        description: "Rechercher des articles de blog ou des tribunes.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Termes de recherche (titre/contenu).",
            },
            limit: {
              type: "number",
              description: "Nombre maximum de résultats (défaut: 5).",
            },
          },
        },
      },
    },
    {
      type: "function",
      handler: "./src/edge/tool-get-blog-post.js",
      function: {
        name: "get_blog_post",
        description: "Lire le contenu complet d'un article de blog.",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string", description: "L'identifiant du post." },
          },
          required: ["id"],
        },
      },
    },
  ],

  configSchema: {
    // Config if needed
  },
};
