// netlify/edge-functions/instance-resolver.js
// Edge function pour résoudre l'instance à partir du sous-domaine pour l'app Cyrnea.

import { handleInstanceResolution } from "../../../../packages/cop-host/src/runtime/edge.js";

export default async function (request, context) {
  console.log( "🚀 Edge Function instance-resolver invoked for url:", request.url);
  return await handleInstanceResolution(request, context);
}

export const config = {
  // S'exécute sur toutes les requêtes
  path: "/*",
  // Exclure les assets statiques et l'API
  excludedPath: ["/assets/*", "/images/*", "/fonts/*", "/api/*"],
};
