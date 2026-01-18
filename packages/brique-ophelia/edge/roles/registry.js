/**
 * packages/brique-ophelia/edge/roles/registry.js
 * Registre des missions (Rôles) d'Ophélia.
 * Permet de filtrer les outils et d'adapter le prompt système selon la tâche.
 */

import { ALL_BRIQUE_PROMPTS } from "../lib/gen-all-prompts.js";

const p = ALL_BRIQUE_PROMPTS.ophelia || {};

export const ROLES = {
  mediator: {
    id: "mediator",
    name: "Médiatrice",
    description: "Faciliter les débats, gérer la parole et favoriser le consensus.",
    allowedTools: [
      "manage_speech_queue",
      "get_user_context",
      "list_capabilities",
      "assume_role",
      "persist_knowledge",
      "forget_knowledge",
      "speak",
      "vector_search",
      "web_search",
    ],
    missionPrompt: (p["role-mediator"] || "").trim(),
  },
  analyst: {
    id: "analyst",
    name: "Analyste",
    description: "Extraire des données, croiser des informations et effectuer des recherches.",
    allowedTools: [
      "sql_query",
      "vector_search",
      "web_search",
      "get_user_context",
      "list_capabilities",
      "assume_role",
      "speak",
    ],
    missionPrompt: (p["role-analyst"] || "").trim(),
  },
  scribe: {
    id: "scribe",
    name: "Secrétaire",
    description: "Documenter les échanges, mettre à jour l'agenda et mémoriser les faits.",
    allowedTools: [
      "persist_knowledge",
      "forget_knowledge",
      "get_user_context",
      "list_capabilities",
      "assume_role",
      "speak",
    ],
    missionPrompt: (p["role-scribe"] || "").trim(),
  },
  guardian: {
    id: "guardian",
    name: "Gardienne",
    description: "Modérer les échanges, vérifier les consentements et garantir la civilité.",
    allowedTools: [
      "report_to_moderation",
      "check_providers_status",
      "get_user_context",
      "list_capabilities",
      "assume_role",
      "speak",
    ],
    missionPrompt: (p["role-guardian"] || "").trim(),
  },
  "cyrnea-indoor": {
    id: "cyrnea-indoor",
    name: "Ophélia (Intérieur - Macagna)",
    description: "Assistante pour l'ambiance intérieure, experte en macagna et anecdotes.",
    allowedTools: [
      "list_capabilities",
      "assume_role",
      "get_user_context",
      "web_search",
      "vector_search",
      "speak",
    ],
    missionPrompt: (p["role-cyrnea-indoor"] || "").trim(),
  },
  "cyrnea-outdoor": {
    id: "cyrnea-outdoor",
    name: "Ophélia (Terrasse - Macagna)",
    description: "Assistante pour la terrasse, experte en macagna et défis dynamiques.",
    allowedTools: [
      "list_capabilities",
      "assume_role",
      "get_user_context",
      "web_search",
      "vector_search",
      "speak",
    ],
    missionPrompt: (p["role-cyrnea-outdoor"] || "").trim(),
  },
};

export function getRole(roleId) {
  return ROLES[roleId] || ROLES.mediator; // Mediator par défaut
}

export function listRoles() {
  return Object.values(ROLES).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
  }));
}
