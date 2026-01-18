// src/lib/meta.js
// Mise à jour dynamique des métadonnées (SEO, OpenGraph) à partir de la config de l'instance
// Adapté pour Cyrnea (App Bar)

import { getConfig } from "@inseme/cop-host/config/instanceConfig.client.js";

/**
 * Met à jour les balises meta et le titre de la page à partir de la configuration actuelle
 */
export function updatePageMeta() {
  const barName = getConfig("bar_name", "Inseme");
  const cityName = getConfig("city_name", "Corse");
  const appUrl = getConfig("app_url", window.location.origin);

  console.log(`🏷️ Mise à jour des métas pour "${barName}" (${cityName})`);

  // Titre
  const title = `${barName} - L'IA au Comptoir`;
  document.title = title;

  // Description
  const description = `Application interactive pour ${barName} à ${cityName}. Discutez avec Ophélia, votez pour la musique et participez à la vie du bar.`;

  // Update standard meta
  updateMeta("description", description);

  // Update OpenGraph
  updateMeta("og-title", title, "property", "og:title");
  updateMeta("og-description", description, "property", "og:description");
  updateMeta("og-url", appUrl.replace(/\/$/, ""), "property", "og:url");

  // Update Twitter
  updateMeta("twitter-title", title, "name", "twitter:title");
  updateMeta("twitter-description", description, "name", "twitter:description");
  updateMeta("twitter-url", appUrl.replace(/\/$/, ""), "property", "twitter:url");
}

/**
 * Utilitaire pour mettre à jour une balise meta par son ID
 * Fallback sur la création si elle n'existe pas
 */
function updateMeta(id, content, attrName = "name", attrValue = "") {
  if (!content) return;

  let el = document.getElementById(id);

  if (el) {
    el.setAttribute("content", content);
  } else {
    // Créer si n'existe pas
    const newMeta = document.createElement("meta");
    newMeta.id = id;
    newMeta.setAttribute(attrName, attrValue || id);
    newMeta.setAttribute("content", content);
    document.head.appendChild(newMeta);
  }
}
