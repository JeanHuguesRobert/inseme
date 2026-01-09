// GENERATED AUTOMATICALLY BY COP-HOST COMPILER
// Do not modify manually

export const ALL_BRIQUE_TOOLS = [
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
  },
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
  },
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
  },
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
  },
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
  },
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
  },
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
  },
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
];
