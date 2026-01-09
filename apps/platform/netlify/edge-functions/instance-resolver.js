// netlify/edge-functions/instance-resolver.js
// Edge function pour résoudre l'instance à partir du sous-domaine.

import { handleInstanceResolution } from "../../../../packages/cop-host/src/runtime/edge.js";

export default async function (request, context) {
  return await handleInstanceResolution(request, context);
}

export const config = {
  // S'exécute sur toutes les requêtes
  path: "/*",
  // Exclure les assets statiques
  excludedPath: ["/assets/*", "/_next/*", "/images/*", "/fonts/*"],
};
