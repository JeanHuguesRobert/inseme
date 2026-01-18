// netlify/edge-functions/instance-resolver.js
// Edge function pour résoudre l'instance à partir du sous-domaine pour l'app Inseme.

import { handleAppEntry } from "../../../../packages/cop-host/src/runtime/seo-middleware.js";

export default async function (request, context) {
  return await handleAppEntry(request, context);
}

export const config = {
  // S'exécute sur toutes les requêtes pour garantir le contexte multi-tenant
  path: "/*",
  // Exclure les dossiers d'assets et les fichiers statiques courants à la racine
  excludedPath: [
    "/assets/*",
    "/images/*",
    "/fonts/*",
    "/briques/*",
    // Images & Media
    "/*.svg",
    "/*.ico",
    "/*.png",
    "/*.jpg",
    "/*.jpeg",
    "/*.gif",
    "/*.webp",
    // Web Standards
    // robots.txt est géré dynamiquement par edge-functions/robots.js
    // "/robots.txt",
    "/sitemap.xml",
    // Fonts (au cas où elles seraient à la racine)
    "/*.woff",
    "/*.woff2",
    "/*.ttf",
  ],
};
