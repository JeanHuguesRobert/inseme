/**
 * Robustly identify the Room ID (slug) from the current URL.
 * Supports path patterns (/bar/:roomId, /app/:roomId), query parameters (?bar=slug),
 * and fallback to default or subdomain-based identification.
 */
export const getRoomIdFromURL = (pathname = window.location.pathname) => {
  // 1. Check Query Parameters first
  const urlParams = new URLSearchParams(window.location.search);
  const barParam = urlParams.get("bar") || urlParams.get("room");
  if (barParam) return barParam;

  // 2. Identify by well-known path prefixes
  // Patterns like /bar/cyrnea, /app/cyrnea, /vocal/cyrnea
  const parts = pathname.split("/").filter(Boolean);
  const prefixes = ["bar", "app", "vocal", "radio", "room"];
  const genericPrefixes = ["gazette", "blog", "legal"];

  if (parts.length >= 2 && prefixes.includes(parts[0])) {
    return parts[1];
  }

  // 3. Fallback for generic patterns
  // If the first part is a generic prefix (gazette, blog),
  // we do NOT treat the second part as a room ID here.
  if (parts.length > 0 && genericPrefixes.includes(parts[0])) {
    // Generic pages should probably stay on the default room
    // unless a query param or subdomain says otherwise.
    // We continue to subdomain check.
  } else if (parts.length > 0) {
    // Last segment fallback (only if not a generic prefix)
    const lastPart = parts[parts.length - 1];
    const excluded = [...genericPrefixes, ...prefixes, "terms", "privacy"];
    if (!excluded.includes(lastPart)) {
      return lastPart;
    }
  }

  // 4. Subdomain fallback
  const hostnameParts = window.location.hostname.split(".");
  if (hostnameParts.length >= 3) {
    const subdomain = hostnameParts[0];
    const ignoredSubdomains = ["www", "app", "localhost", "127", "dashboard"];
    if (!ignoredSubdomains.includes(subdomain)) {
      return subdomain;
    }
  }

  // 5. Ultimate default
  return "cyrnea";
};
