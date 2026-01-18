// netlify/edge-functions/app-entry.js
import { handleAppEntry } from "../../../../packages/cop-host/src/runtime/seo-middleware.js";

export default async (request, context) => {
  return await handleAppEntry(request, context);
};

export const config = {
  // On cible toutes les pages, mais on exclut les assets statiques
  path: ["/*"],
  excludedPath: [
    "/assets/*",
    "/images/*",
    "/cyrnea.svg",
    "/*.ico",
    "/*.png",
    "/manifest.webmanifest",
  ],
};
