// packages/cop-host/src/runtime/seo-middleware.js
// Middleware Edge Function universel pour la gestion SEO et la résolution d'instance
// Compatible avec Netlify Edge Functions (Deno)

import { handleInstanceResolution } from "./edge.js";
import { getConfig } from "../config/instanceConfig.edge.js";
import { substituteVariables, getCommonVariables } from "../lib/template.js";

/**
 * Middleware principal pour les points d'entrée d'application (app-entry.js).
 * Gère :
 * 1. La résolution d'instance (quel client/ville ?)
 * 2. L'injection des métadonnées SEO dans le HTML (OpenGraph, Twitter)
 * 3. Le fallback SPA pour les routes non trouvées
 *
 * @param {Request} request - La requête entrante
 * @param {Object} context - Le contexte Netlify (next, etc.)
 * @returns {Promise<Response>}
 */
export async function handleAppEntry(request, context) {
  const url = new URL(request.url);

  // 1. Résolution d'instance (charge la bonne config DB)
  await handleInstanceResolution(request, context);

  // 2. Récupérer la réponse (soit le fichier statique, soit le index.html)
  // Si c'est une route client (ex: /bar/xxx), Netlify ne trouvera pas de fichier
  // et on doit servir index.html (SPA Fallback)
  const response = await context.next();

  // Si ce n'est pas du HTML (ex: image, js), on retourne tel quel
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    return response;
  }

  // 3. Injection SEO via templating Mustache-like
  const originalHtml = await response.text();

  const instanceName = getConfig("instance_name") || getConfig("city_name") || "Inseme";
  const appTitle = getConfig("app_title", `${instanceName} - Inseme`);
  const appDescription = getConfig(
    "app_description",
    `Plateforme participative pour ${instanceName}`
  );
  const appUrl = getConfig("app_url", url.origin);
  const appImage = getConfig("app_image", `${url.origin}/og-image.png`);

  const commonVars = getCommonVariables((key, defaultValue) => getConfig(key, defaultValue));

  const allVars = {
    ...commonVars,
    APP_TITLE: appTitle,
    APP_DESCRIPTION: appDescription,
    APP_IMAGE: appImage,
  };

  const configScript = `
<script>
  window.__INSEME_CONFIG__ = {
    instanceName: "${instanceName}",
    apiUrl: "${appUrl}"
  };
</script>
`;

  const withConfigScript = originalHtml.replace("</head>", `${configScript}</head>`);
  const finalHtml = substituteVariables(withConfigScript, allVars);

  const headers = new Headers(response.headers);
  headers.delete("content-length");

  return new Response(finalHtml, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
