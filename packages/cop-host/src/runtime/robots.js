/**
 * packages/cop-host/src/runtime/robots.js
 * Logic for dynamic robots.txt generation in multi-tenant environments.
 */

export const handleRobotsTxt = async (request) => {
  const url = new URL(request.url);
  const host = url.host; // e.g., bastiat.inseme.app

  // TODO: Retrieve instance config to check if production or staging
  // For now, allow all by default

  const robotsTxt = `User-agent: *
Allow: /

# Sitemap specific to this instance
Sitemap: https://${host}/sitemap.xml
`;

  return new Response(robotsTxt, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=3600", // Cache 1h
    },
  });
};
