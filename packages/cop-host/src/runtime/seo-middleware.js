// packages/cop-host/src/runtime/seo-middleware.js
// Middleware Edge Function universel pour la gestion SEO et la résolution d'instance
// Compatible avec Netlify Edge Functions (Deno)

import { handleInstanceResolution, CORS_HEADERS } from "./edge.js";
import { getConfig } from "../config/instanceConfig.edge.js";

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
  let response;
  try {
    response = await context.next();
  } catch (e) {
    // Si next() échoue (404), on charge index.html manuellement
    // Note: Sur Netlify Edge, context.next() gère souvent le rewrite SPA si configuré,
    // mais on assure le coup.
    response = await context.rewrite("/index.html");
  }

  // Si ce n'est pas du HTML (ex: image, js), on retourne tel quel
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    return response;
  }

  // 3. Injection SEO (HTMLRewriter)
  // On récupère les infos de l'instance résolue
  const instanceName = getConfig("instance_name") || getConfig("city_name") || "Inseme";
  const appTitle = getConfig("app_title", `${instanceName} - Inseme`);
  const appDescription = getConfig(
    "app_description",
    `Plateforme participative pour ${instanceName}`
  );
  const appUrl = getConfig("app_url", url.origin);
  const appImage = getConfig("app_image", `${url.origin}/og-image.png`);

  // Utilisation de HTMLRewriter (API standard Edge/Deno) pour injecter les valeurs
  return (
    new HTMLRewriter()
      .on("title", {
        element(element) {
          element.setInnerContent(appTitle);
        },
      })
      .on('meta[name="description"]', {
        element(element) {
          element.setAttribute("content", appDescription);
        },
      })
      .on('meta[property="og:title"]', {
        element(element) {
          element.setAttribute("content", appTitle);
        },
      })
      .on('meta[property="og:description"]', {
        element(element) {
          element.setAttribute("content", appDescription);
        },
      })
      .on('meta[property="og:url"]', {
        element(element) {
          element.setAttribute("content", appUrl);
        },
      })
      .on('meta[property="og:image"]', {
        element(element) {
          element.setAttribute("content", appImage);
        },
      })
      .on('meta[name="twitter:title"]', {
        element(element) {
          element.setAttribute("content", appTitle);
        },
      })
      .on('meta[name="twitter:description"]', {
        element(element) {
          element.setAttribute("content", appDescription);
        },
      })
      .on('meta[name="twitter:image"]', {
        element(element) {
          element.setAttribute("content", appImage);
        },
      })
      // Injection d'un script de config global pour éviter le flash côté client
      .on("head", {
        element(element) {
          const script = `
          <script>
            window.__INSEME_CONFIG__ = {
              instanceName: "${instanceName}",
              apiUrl: "${appUrl}"
            };
          </script>
        `;
          element.append(script, { html: true });
        },
      })
      .transform(response)
  );
}
