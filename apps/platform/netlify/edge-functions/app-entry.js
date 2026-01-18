// netlify/edge-functions/app-entry.js
import { handleAppEntry } from "../../../../packages/cop-host/src/runtime/seo-middleware.js";

export default async (request, context) => {
  return await handleAppEntry(request, context);
};

export const config = {
  path: ["/", "/index.html", "/consultations/*", "/propositions/*", "/wiki/*"],
  excludedPath: ["/assets/*", "/images/*", "/api/*"],
};
