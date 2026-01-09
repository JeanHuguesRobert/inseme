export default {
  id: "tasks",
  name: "Projets & Actions",
  feature: "projects",
  routes: [
    {
      path: "/projects",
      component: "./src/pages/ProjectList",
      protected: false,
    },
    {
      path: "/projects/kanban/:id",
      component: "./src/pages/KanbanBoardPage",
      protected: true,
    },
    {
      path: "/projects/mission/:id",
      component: "./src/pages/MissionDetail",
      protected: false,
    },
  ],
  menuItems: [
    {
      id: "main-projects",
      label: "Projets",
      path: "/projects",
      icon: "CheckSquare",
      position: "header",
    },
  ],
  tools: [
    {
      type: "function",
      handler: "./src/edge/tool-list-projects.js",
      function: {
        name: "list_projects",
        description: "Lister les projets et missions en cours.",
        parameters: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["active", "completed", "all"] },
          },
        },
      },
    },
    {
      type: "function",
      handler: "./src/edge/tool-get-my-tasks.js",
      function: {
        name: "get_my_tasks",
        description: "Obtenir les tâches assignées à l'utilisateur courant.",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "number" },
          },
        },
      },
    },
  ],
  configSchema: {},
};
