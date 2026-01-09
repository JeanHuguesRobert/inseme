// GENERATED AUTOMATICALLY BY COP-HOST COMPILER
// Do not modify manually

export const BRIQUES = [
  {
    "id": "actes",
    "name": "Actes Administratifs",
    "feature": "administrative_acts",
    "routes": [
      {
        "path": "/actes",
        "component": "./src/pages/ActesDashboard",
        "protected": true
      },
      {
        "path": "/actes/accueil",
        "component": "./src/pages/ActesHome",
        "protected": false
      },
      {
        "path": "/actes/liste",
        "component": "./src/pages/ActesList",
        "protected": false
      },
      {
        "path": "/actes/nouveau",
        "component": "./src/pages/ActeForm",
        "protected": true
      },
      {
        "path": "/actes/:id",
        "component": "./src/pages/ActeDetail",
        "protected": false
      },
      {
        "path": "/actes/:id/modifier",
        "component": "./src/pages/ActeForm",
        "protected": true
      },
      {
        "path": "/actes/:id/chronologie",
        "component": "./src/pages/ActeTimeline",
        "protected": false
      },
      {
        "path": "/actes/chronologie",
        "component": "./src/pages/ActeTimeline",
        "protected": false
      },
      {
        "path": "/actes/stats",
        "component": "./src/pages/StatsDashboard",
        "protected": true
      },
      {
        "path": "/demandes",
        "component": "./src/pages/DemandesList",
        "protected": false
      },
      {
        "path": "/demandes/nouvelle",
        "component": "./src/pages/DemandeForm",
        "protected": true
      },
      {
        "path": "/demandes/:id",
        "component": "./src/pages/DemandeDetail",
        "protected": false
      },
      {
        "path": "/demandes/:id/modifier",
        "component": "./src/pages/DemandeForm",
        "protected": true
      },
      {
        "path": "/preuves/ajouter",
        "component": "./src/pages/ProofUpload",
        "protected": true
      },
      {
        "path": "/moderation/actions",
        "component": "./src/pages/OutgoingActionsQueue",
        "protected": true
      },
      {
        "path": "/moderation/preuves",
        "component": "./src/pages/VerificationQueue",
        "protected": true
      },
      {
        "path": "/moderation/publications",
        "component": "./src/pages/PublicationModeration",
        "protected": true
      },
      {
        "path": "/moderation/responsabilites",
        "component": "./src/pages/ResponsibilityLog",
        "protected": true
      },
      {
        "path": "/exports/pdf",
        "component": "./src/pages/ExportPDF",
        "protected": true
      },
      {
        "path": "/exports/csv",
        "component": "./src/pages/ExportCSV",
        "protected": true
      }
    ],
    "menuItems": [
      {
        "id": "main-actes",
        "label": "Actes",
        "path": "/actes",
        "icon": "FileText",
        "position": "header"
      },
      {
        "id": "main-demandes",
        "label": "Demandes",
        "path": "/demandes",
        "icon": "Clipboard",
        "position": "header"
      }
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "search_actes",
          "description": "Rechercher des actes administratifs publiés.",
          "parameters": {
            "type": "object",
            "properties": {
              "query": {
                "type": "string"
              },
              "year": {
                "type": "number"
              },
              "type": {
                "type": "string"
              }
            }
          }
        },
        "handler": "./src/edge/tool-search-actes.js",
        "briqueId": "actes"
      },
      {
        "type": "function",
        "function": {
          "name": "get_demande_status",
          "description": "Obtenir le statut d'une demande administrative.",
          "parameters": {
            "type": "object",
            "properties": {
              "demande_id": {
                "type": "string"
              }
            },
            "required": [
              "demande_id"
            ]
          }
        },
        "handler": "./src/edge/tool-get-demande-status.js",
        "briqueId": "actes"
      }
    ],
    "configSchema": {
      "municipality_name": {
        "type": "string"
      },
      "publication_delay_days": {
        "type": "number"
      }
    },
    "hasPublic": true
  },
  {
    "id": "blog",
    "name": "Gestion des Blogs",
    "feature": "blog",
    "routes": [
      {
        "path": "/blog",
        "component": "./src/pages/BlogHome",
        "protected": false
      },
      {
        "path": "/blog/new",
        "component": "./src/pages/BlogEditor",
        "protected": true
      },
      {
        "path": "/blog/:slug",
        "component": "./src/pages/BlogPost",
        "protected": false
      },
      {
        "path": "/blog/:slug/edit",
        "component": "./src/pages/BlogEditor",
        "protected": true
      },
      {
        "path": "/gazette",
        "component": "./src/pages/GazettePage",
        "protected": false
      },
      {
        "path": "/gazette/:name",
        "component": "./src/pages/GazettePage",
        "protected": false
      }
    ],
    "menuItems": [
      {
        "id": "main-blog",
        "label": "Interventions",
        "path": "/blog",
        "icon": "Newspaper",
        "position": "header"
      }
    ],
    "tools": [
      {
        "type": "function",
        "handler": "./src/edge/tool-read-blog.js",
        "function": {
          "name": "read_blog_posts",
          "description": "Rechercher des articles de blog ou des tribunes.",
          "parameters": {
            "type": "object",
            "properties": {
              "query": {
                "type": "string",
                "description": "Termes de recherche (titre/contenu)."
              },
              "limit": {
                "type": "number",
                "description": "Nombre maximum de résultats (défaut: 5)."
              }
            }
          }
        },
        "briqueId": "blog"
      },
      {
        "type": "function",
        "handler": "./src/edge/tool-get-blog-post.js",
        "function": {
          "name": "get_blog_post",
          "description": "Lire le contenu complet d'un article de blog.",
          "parameters": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "description": "L'identifiant du post."
              }
            },
            "required": [
              "id"
            ]
          }
        },
        "briqueId": "blog"
      }
    ],
    "configSchema": {},
    "hasPublic": false
  },
  {
    "id": "communes",
    "name": "Communes & Consultations",
    "feature": "communes",
    "routes": [
      {
        "path": "/consultation/barometre",
        "component": "./src/pages/ConsultationDemocratieLocale",
        "protected": false
      }
    ],
    "hasPublic": false
  },
  {
    "id": "cyrnea",
    "name": "Cyrnea",
    "routes": [
      {
        "path": "/bar",
        "component": "./src/pages/BarmanDashboard",
        "protected": true
      },
      {
        "path": "/q",
        "component": "./src/pages/ClientMiniApp",
        "protected": false
      }
    ],
    "hasPublic": false
  },
  {
    "id": "fil",
    "name": "Le Fil",
    "feature": "fil",
    "routes": [
      {
        "path": "/fil",
        "component": "./src/pages/PageFilFeed",
        "protected": false
      },
      {
        "path": "/fil/new",
        "component": "./src/pages/PageFilSubmissionForm",
        "protected": true
      },
      {
        "path": "/fil/:id",
        "component": "./src/pages/FilItemDetail",
        "protected": false
      }
    ],
    "menuItems": [
      {
        "id": "main-fil",
        "label": "Le Fil",
        "path": "/fil",
        "icon": "Lightning",
        "position": "sidebar"
      }
    ],
    "tools": [
      {
        "type": "function",
        "handler": "./src/edge/tool-read-fil.js",
        "function": {
          "name": "read_fil",
          "description": "Obtenir les dernières actualités du Fil.",
          "parameters": {
            "type": "object",
            "properties": {
              "limit": {
                "type": "number",
                "description": "Nombre d'items (défaut: 5)."
              },
              "period": {
                "type": "string",
                "enum": [
                  "day",
                  "week",
                  "all"
                ],
                "description": "Période temporelle."
              }
            }
          }
        },
        "briqueId": "fil"
      },
      {
        "type": "function",
        "handler": "./src/edge/tool-post-to-fil.js",
        "function": {
          "name": "post_to_fil",
          "description": "Publier une nouvelle actualité sur le Fil.",
          "parameters": {
            "type": "object",
            "properties": {
              "url": {
                "type": "string",
                "description": "L'URL à partager."
              },
              "title": {
                "type": "string",
                "description": "Titre optionnel."
              },
              "content": {
                "type": "string",
                "description": "Description optionnelle."
              }
            },
            "required": [
              "url"
            ]
          }
        },
        "briqueId": "fil"
      }
    ],
    "hasPublic": true
  },
  {
    "id": "group",
    "name": "Gestion des Groupes",
    "feature": "group",
    "routes": [
      {
        "path": "/groups",
        "component": "./src/pages/PageGroupList",
        "protected": true
      },
      {
        "path": "/groups/:id",
        "component": "./src/pages/PageGroupDetail",
        "protected": false
      },
      {
        "path": "/groups/:id/admin",
        "component": "./src/pages/GroupAdmin",
        "protected": true
      }
    ],
    "menuItems": [
      {
        "id": "main-groups",
        "label": "Groupes",
        "path": "/groups",
        "icon": "Users",
        "position": "sidebar"
      }
    ],
    "configSchema": {},
    "hasPublic": false
  },
  {
    "id": "democracy",
    "name": "Gouvernance Citoyenne",
    "feature": "democracy",
    "routes": [
      {
        "path": "/democracy",
        "component": "./src/pages/DemocracyDashboard",
        "protected": false
      },
      {
        "path": "/propositions",
        "component": "./src/components/kudocracy/PropositionList",
        "protected": false
      },
      {
        "path": "/propositions/new",
        "component": "./src/pages/PropositionCreate",
        "protected": true
      },
      {
        "path": "/consultations",
        "component": "./src/pages/ConsultationList",
        "protected": false
      }
    ],
    "menuItems": [
      {
        "id": "main-democracy",
        "label": "Gouvernance",
        "path": "/democracy",
        "icon": "Scale",
        "position": "header"
      }
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "search_propositions",
          "description": "Rechercher des propositions citoyennes soumis au vote.",
          "parameters": {
            "type": "object",
            "properties": {
              "query": {
                "type": "string"
              },
              "status": {
                "type": "string",
                "enum": [
                  "active",
                  "closed",
                  "draft"
                ]
              }
            }
          }
        },
        "handler": "./src/edge/tool-search-propositions.js",
        "briqueId": "democracy"
      },
      {
        "type": "function",
        "function": {
          "name": "vote_proposition",
          "description": "Vote sur une proposition citoyenne.",
          "parameters": {
            "type": "object",
            "properties": {
              "proposition_id": {
                "type": "string"
              },
              "value": {
                "type": "integer",
                "enum": [
                  1,
                  -1,
                  0
                ],
                "description": "1 pour 'pour', -1 pour 'contre', 0 pour 'abstention'"
              }
            },
            "required": [
              "proposition_id",
              "value"
            ]
          }
        },
        "handler": "./src/edge/tool-vote-proposition.js",
        "briqueId": "democracy"
      },
      {
        "type": "function",
        "function": {
          "name": "manage_delegation",
          "description": "Gérer les délégations de vote.",
          "parameters": {
            "type": "object",
            "properties": {
              "action": {
                "type": "string",
                "enum": [
                  "delegate",
                  "revoke"
                ]
              },
              "delegator_id": {
                "type": "string"
              },
              "delegate_id": {
                "type": "string"
              },
              "tag": {
                "type": "string"
              }
            },
            "required": [
              "action",
              "delegator_id",
              "tag"
            ]
          }
        },
        "handler": "./src/edge/tool-manage-delegation.js",
        "briqueId": "democracy"
      },
      {
        "type": "function",
        "function": {
          "name": "emit_vote_recommendation",
          "description": "Émettre une recommandation de vote officielle d'Ophélia.",
          "parameters": {
            "type": "object",
            "properties": {
              "proposition_id": {
                "type": "string"
              },
              "recommendation": {
                "type": "string",
                "enum": [
                  "pour",
                  "contre",
                  "abstention"
                ]
              },
              "rationale": {
                "type": "string"
              },
              "tags": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "proposition_id",
              "recommendation",
              "rationale",
              "tags"
            ]
          }
        },
        "handler": "./src/edge/tool-emit-recommendation.js",
        "briqueId": "democracy"
      },
      {
        "type": "function",
        "function": {
          "name": "prolog_query",
          "description": "Interroger le moteur de raisonnement logique ProLog sur la gouvernance.",
          "parameters": {
            "type": "object",
            "properties": {
              "query": {
                "type": "string"
              }
            },
            "required": [
              "query"
            ]
          }
        },
        "handler": "./src/edge/tool-prolog-query.js",
        "briqueId": "democracy"
      }
    ],
    "configSchema": {},
    "hasPublic": true
  },
  {
    "id": "map",
    "name": "Carte Citoyenne",
    "feature": "map",
    "routes": [
      {
        "path": "/map",
        "component": "./src/pages/MapPage",
        "protected": false
      }
    ],
    "menuItems": [
      {
        "id": "main-map",
        "label": "Carte",
        "path": "/map",
        "icon": "Map",
        "position": "header"
      }
    ],
    "tools": [
      {
        "type": "function",
        "handler": "./src/edge/tool-search-map.js",
        "function": {
          "name": "search_map_places",
          "description": "Rechercher des lieux ou des points d'intérêt sur la carte.",
          "parameters": {
            "type": "object",
            "properties": {
              "query": {
                "type": "string",
                "description": "Nom du lieu ou type (ex: Mairie, École)."
              },
              "limit": {
                "type": "number",
                "description": "Nombre de résultats (défaut: 5)."
              }
            }
          }
        },
        "briqueId": "map"
      }
    ],
    "configSchema": {
      "map_default_lat": {
        "type": "string"
      },
      "map_default_lng": {
        "type": "string"
      },
      "map_default_zoom": {
        "type": "number"
      }
    },
    "hasPublic": false
  },
  {
    "id": "ophelia",
    "name": "Ophélia - Chat Vocal",
    "feature": "vocal_chat",
    "routes": [
      {
        "path": "/chat",
        "component": "./components/chat/OpheliaChat",
        "protected": false
      },
      {
        "path": "/ophelia",
        "component": "./InsemeRoom",
        "protected": false
      },
      {
        "path": "/ophelia/:roomName",
        "component": "./InsemeRoom",
        "protected": false
      }
    ],
    "menuItems": [
      {
        "id": "main-ophelia-chat",
        "label": "Ophélia Chat",
        "path": "/chat",
        "icon": "ChatTeardropText",
        "position": "header"
      },
      {
        "id": "main-ophelia-vocal",
        "label": "Ophélia Vocal",
        "path": "/ophelia",
        "icon": "Microphone",
        "position": "header"
      }
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "create_inseme_room",
          "description": "Créer une nouvelle session Inseme avec Ophélia.",
          "parameters": {
            "type": "object",
            "properties": {
              "room_name": {
                "type": "string",
                "description": "Nom de la salle"
              },
              "mode": {
                "type": "string",
                "enum": [
                  "consensus",
                  "debate",
                  "workshop"
                ]
              }
            }
          }
        },
        "briqueId": "ophelia"
      }
    ],
    "configSchema": {
      "default_room": {
        "type": "string"
      },
      "enable_vocal": {
        "type": "boolean"
      },
      "ophelia_voice": {
        "type": "string"
      }
    },
    "hasPublic": false
  },
  {
    "id": "tasks",
    "name": "Projets & Actions",
    "feature": "projects",
    "routes": [
      {
        "path": "/projects",
        "component": "./src/pages/ProjectList",
        "protected": false
      },
      {
        "path": "/projects/kanban/:id",
        "component": "./src/pages/KanbanBoardPage",
        "protected": true
      },
      {
        "path": "/projects/mission/:id",
        "component": "./src/pages/MissionDetail",
        "protected": false
      }
    ],
    "menuItems": [
      {
        "id": "main-projects",
        "label": "Projets",
        "path": "/projects",
        "icon": "CheckSquare",
        "position": "header"
      }
    ],
    "tools": [
      {
        "type": "function",
        "handler": "./src/edge/tool-list-projects.js",
        "function": {
          "name": "list_projects",
          "description": "Lister les projets et missions en cours.",
          "parameters": {
            "type": "object",
            "properties": {
              "status": {
                "type": "string",
                "enum": [
                  "active",
                  "completed",
                  "all"
                ]
              }
            }
          }
        },
        "briqueId": "tasks"
      },
      {
        "type": "function",
        "handler": "./src/edge/tool-get-my-tasks.js",
        "function": {
          "name": "get_my_tasks",
          "description": "Obtenir les tâches assignées à l'utilisateur courant.",
          "parameters": {
            "type": "object",
            "properties": {
              "limit": {
                "type": "number"
              }
            }
          }
        },
        "briqueId": "tasks"
      }
    ],
    "configSchema": {},
    "hasPublic": false
  },
  {
    "id": "wiki",
    "name": "Wiki Collaboratif",
    "feature": "wiki",
    "routes": [
      {
        "path": "/wiki",
        "component": "./src/pages/Wiki",
        "protected": false
      },
      {
        "path": "/wiki/new",
        "component": "./src/pages/WikiCreate",
        "protected": true
      },
      {
        "path": "/wiki/dashboard",
        "component": "./src/pages/WikiDashboard",
        "protected": true
      },
      {
        "path": "/wiki/:slug",
        "component": "./src/pages/WikiPage",
        "protected": false
      },
      {
        "path": "/wiki/:slug/edit",
        "component": "./src/pages/WikiEdit",
        "protected": true
      }
    ],
    "menuItems": [
      {
        "id": "main-wiki",
        "label": "Wiki",
        "path": "/wiki",
        "icon": "Book",
        "position": "header"
      }
    ],
    "tools": [
      {
        "type": "function",
        "handler": "./src/edge/tool-search-wiki.js",
        "function": {
          "name": "search_wiki",
          "description": "Rechercher des informations dans le Wiki global ou spécifique à la salle. Utilise cet outil pour trouver des précédents, des définitions ou des règles archivées.",
          "parameters": {
            "type": "object",
            "properties": {
              "query": {
                "type": "string",
                "description": "Le terme ou la question à rechercher."
              },
              "scope": {
                "type": "string",
                "enum": [
                  "global",
                  "room"
                ],
                "description": "L'étendue de la recherche."
              }
            },
            "required": [
              "query"
            ]
          }
        },
        "briqueId": "wiki"
      },
      {
        "type": "function",
        "handler": "./src/edge/tool-propose-wiki.js",
        "function": {
          "name": "propose_wiki_page",
          "description": "Proposer la création ou la mise à jour d'une page Wiki. Utilise cet outil pour synthétiser des décisions de réunion, créer un compte-rendu ou archiver une information importante.",
          "parameters": {
            "type": "object",
            "properties": {
              "title": {
                "type": "string",
                "description": "Le titre de la page Wiki."
              },
              "content": {
                "type": "string",
                "description": "Le contenu Markdown de la page."
              },
              "summary": {
                "type": "string",
                "description": "Un bref résumé (1-2 phrases) de l'objectif de la page."
              },
              "is_room_specific": {
                "type": "boolean",
                "description": "Si vrai, la page sera liée uniquement à cette salle."
              }
            },
            "required": [
              "title",
              "content"
            ]
          }
        },
        "briqueId": "wiki"
      }
    ],
    "configSchema": {
      "wiki_storage_bucket": {
        "type": "string",
        "default": "wiki-content"
      }
    },
    "hasPublic": false
  },
  {
    "id": "kudocracy",
    "name": "Kudocracy",
    "hasPublic": false
  }
];

export const BRIQUE_COMPONENTS = {
  "actes:/actes": () => import("../../brique-actes/src/pages/ActesDashboard"),
  "actes:/actes/accueil": () => import("../../brique-actes/src/pages/ActesHome"),
  "actes:/actes/liste": () => import("../../brique-actes/src/pages/ActesList"),
  "actes:/actes/nouveau": () => import("../../brique-actes/src/pages/ActeForm"),
  "actes:/actes/:id": () => import("../../brique-actes/src/pages/ActeDetail"),
  "actes:/actes/:id/modifier": () => import("../../brique-actes/src/pages/ActeForm"),
  "actes:/actes/:id/chronologie": () => import("../../brique-actes/src/pages/ActeTimeline"),
  "actes:/actes/chronologie": () => import("../../brique-actes/src/pages/ActeTimeline"),
  "actes:/actes/stats": () => import("../../brique-actes/src/pages/StatsDashboard"),
  "actes:/demandes": () => import("../../brique-actes/src/pages/DemandesList"),
  "actes:/demandes/nouvelle": () => import("../../brique-actes/src/pages/DemandeForm"),
  "actes:/demandes/:id": () => import("../../brique-actes/src/pages/DemandeDetail"),
  "actes:/demandes/:id/modifier": () => import("../../brique-actes/src/pages/DemandeForm"),
  "actes:/preuves/ajouter": () => import("../../brique-actes/src/pages/ProofUpload"),
  "actes:/moderation/actions": () => import("../../brique-actes/src/pages/OutgoingActionsQueue"),
  "actes:/moderation/preuves": () => import("../../brique-actes/src/pages/VerificationQueue"),
  "actes:/moderation/publications": () => import("../../brique-actes/src/pages/PublicationModeration"),
  "actes:/moderation/responsabilites": () => import("../../brique-actes/src/pages/ResponsibilityLog"),
  "actes:/exports/pdf": () => import("../../brique-actes/src/pages/ExportPDF"),
  "actes:/exports/csv": () => import("../../brique-actes/src/pages/ExportCSV"),
  "blog:/blog": () => import("../../brique-blog/src/pages/BlogHome"),
  "blog:/blog/new": () => import("../../brique-blog/src/pages/BlogEditor"),
  "blog:/blog/:slug": () => import("../../brique-blog/src/pages/BlogPost"),
  "blog:/blog/:slug/edit": () => import("../../brique-blog/src/pages/BlogEditor"),
  "blog:/gazette": () => import("../../brique-blog/src/pages/GazettePage"),
  "blog:/gazette/:name": () => import("../../brique-blog/src/pages/GazettePage"),
  "communes:/consultation/barometre": () => import("../../brique-communes/src/pages/ConsultationDemocratieLocale"),
  "cyrnea:/bar": () => import("../../brique-cyrnea/src/pages/BarmanDashboard"),
  "cyrnea:/q": () => import("../../brique-cyrnea/src/pages/ClientMiniApp"),
  "fil:/fil": () => import("../../brique-fil/src/pages/PageFilFeed"),
  "fil:/fil/new": () => import("../../brique-fil/src/pages/PageFilSubmissionForm"),
  "fil:/fil/:id": () => import("../../brique-fil/src/pages/FilItemDetail"),
  "group:/groups": () => import("../../brique-group/src/pages/PageGroupList"),
  "group:/groups/:id": () => import("../../brique-group/src/pages/PageGroupDetail"),
  "group:/groups/:id/admin": () => import("../../brique-group/src/pages/GroupAdmin"),
  "democracy:/democracy": () => import("../../brique-kudocracy/src/pages/DemocracyDashboard"),
  "democracy:/propositions": () => import("../../brique-kudocracy/src/components/kudocracy/PropositionList"),
  "democracy:/propositions/new": () => import("../../brique-kudocracy/src/pages/PropositionCreate"),
  "democracy:/consultations": () => import("../../brique-kudocracy/src/pages/ConsultationList"),
  "map:/map": () => import("../../brique-map/src/pages/MapPage"),
  "ophelia:/chat": () => import("../../brique-ophelia/components/chat/OpheliaChat"),
  "ophelia:/ophelia": () => import("../../brique-ophelia/InsemeRoom"),
  "ophelia:/ophelia/:roomName": () => import("../../brique-ophelia/InsemeRoom"),
  "tasks:/projects": () => import("../../brique-tasks/src/pages/ProjectList"),
  "tasks:/projects/kanban/:id": () => import("../../brique-tasks/src/pages/KanbanBoardPage"),
  "tasks:/projects/mission/:id": () => import("../../brique-tasks/src/pages/MissionDetail"),
  "wiki:/wiki": () => import("../../brique-wiki/src/pages/Wiki"),
  "wiki:/wiki/new": () => import("../../brique-wiki/src/pages/WikiCreate"),
  "wiki:/wiki/dashboard": () => import("../../brique-wiki/src/pages/WikiDashboard"),
  "wiki:/wiki/:slug": () => import("../../brique-wiki/src/pages/WikiPage"),
  "wiki:/wiki/:slug/edit": () => import("../../brique-wiki/src/pages/WikiEdit"),
};
