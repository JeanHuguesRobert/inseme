#!/usr/bin/env node
// scripts/generate-meta-init.js
// Génère public/meta-init.js avec les variables d'environnement au moment du build
// Appelé automatiquement par le script build dans package.json

import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { loadConfig, getConfig } from "./lib/config.js";

console.log("generate-meta-init.js: début");

// Charger la configuration (et la mettre à jour si nécessaire)
await loadConfig();

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dirname, "../public/meta-init.js");

// Récupérer les valeurs (avec fallbacks)
// TODO: should use Community name
const CITY_NAME = getConfig("city_name", "Corte");
const PARTY_NAME = getConfig("party_name", "Petit Parti");
const SITE_URL = getConfig("app_url", "https://lepp.fr");
const FACEBOOK_APP_ID = getConfig("facebook_app_id", "");

const content = `// Dynamic metadata initialization
// ⚠️ FICHIER GÉNÉRÉ AUTOMATIQUEMENT - NE PAS MODIFIER
// Généré par scripts/generate-meta-init.js lors du build
// Dernière génération: ${new Date().toISOString()}

const CITY_NAME = ${JSON.stringify(CITY_NAME)};
const PARTY_NAME = ${JSON.stringify(PARTY_NAME)};
const SITE_URL = ${JSON.stringify(SITE_URL)};
const SITE_URL_CLEAN = SITE_URL.endsWith("/") ? SITE_URL.slice(0, -1) : SITE_URL;
const FACEBOOK_APP_ID = ${JSON.stringify(FACEBOOK_APP_ID)};

// Mise à jour dynamique des métadonnées
const pageTitle = document.getElementById("page-title");
if (pageTitle) pageTitle.textContent = \`Consultation Citoyenne - \${PARTY_NAME}\`;

const pageDesc = document.getElementById("page-description");
if (pageDesc) {
  pageDesc.setAttribute(
    "content",
    \`Plateforme de consultation citoyenne pour les élections municipales de \${CITY_NAME}, incluant un wiki collaboratif et un système de propositions citoyennes.\`
  );
}

const ogTitle = document.getElementById("og-title");
if (ogTitle) ogTitle.setAttribute("content", \`Consultation Citoyenne - \${PARTY_NAME}\`);

const ogDesc = document.getElementById("og-description");
if (ogDesc) {
  ogDesc.setAttribute(
    "content",
    \`Participez à la démocratie locale de \${CITY_NAME} avec notre plateforme de consultation citoyenne.\`
  );
}

// Ensure an explicit og:image is set (Facebook requires explicit image meta)
const ogImageUrl = \`\${SITE_URL_CLEAN}/images/og-image.png\`;
const ogEl = document.getElementById("og-image");
const twEl = document.getElementById("twitter-image");
if (ogEl) ogEl.setAttribute("content", ogImageUrl);
if (twEl) twEl.setAttribute("content", ogImageUrl);

// Set og:url explicitly for Facebook debugger
const ogUrlEl = document.getElementById("og-url");
if (ogUrlEl) ogUrlEl.setAttribute("content", SITE_URL_CLEAN);

// Set Facebook App ID
const fbAppIdEl = document.getElementById("fb-app-id");
if (fbAppIdEl) fbAppIdEl.setAttribute("content", FACEBOOK_APP_ID);
`;

writeFileSync(outputPath, content, "utf-8");
console.log(
  `✓ meta-init.js généré avec CITY_NAME="${CITY_NAME}", PARTY_NAME="${PARTY_NAME}", FB_ID="${FACEBOOK_APP_ID}"`
);
