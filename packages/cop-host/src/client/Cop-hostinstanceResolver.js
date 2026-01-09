/**
 * @inseme/cop-host/client/instanceResolver
 * Résolution dynamique de l'instance Supabase selon l'URL (Côté Client)
 */

// Domaine de base pour la détection des sous-domaines
const BASE_DOMAINS = ["lepp.fr", "kudocracy.org"];

// Sous-domaines à ignorer (pas des instances)
const IGNORED_SUBDOMAINS = ["www", "app", "api", "admin", "staging", "preview"];

let currentInstance = null;
let resolvePromise = null;

/**
 * Extrait le sous-domaine de l'URL actuelle
 */
export function extractSubdomain() {
  if (typeof window === "undefined") return null;
  const hostname = window.location.hostname;

  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
  ) {
    return null;
  }

  for (const baseDomain of BASE_DOMAINS) {
    if (hostname.endsWith(`.${baseDomain}`)) {
      const subdomain = hostname.replace(`.${baseDomain}`, "");
      if (!IGNORED_SUBDOMAINS.includes(subdomain)) {
        return subdomain;
      }
    }
  }

  return null;
}

/**
 * Récupère le paramètre ?instance= de l'URL
 */
export function getInstanceParam() {
  if (typeof window === "undefined") return null;
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("instance");
}

/**
 * Résout l'instance Supabase à utiliser
 */
export async function resolveInstance() {
  if (resolvePromise) return resolvePromise;
  if (currentInstance) return currentInstance;

  resolvePromise = doResolveInstance();
  currentInstance = await resolvePromise;
  resolvePromise = null;

  return currentInstance;
}

async function doResolveInstance() {
  const instanceParam = getInstanceParam();
  if (instanceParam) {
    const instance = await lookupInstance(instanceParam);
    if (instance) return { ...instance, source: "url-param" };
  }

  const subdomain = extractSubdomain();
  if (subdomain) {
    const instance = await lookupInstance(subdomain);
    if (instance) return { ...instance, source: "subdomain" };
  }

  return getDefaultInstance();
}

async function lookupInstance(subdomain) {
  const remoteInstance = await lookupRemoteRegistry(subdomain);
  if (remoteInstance) return remoteInstance;
  console.warn(`⚠️ Instance non trouvée: ${subdomain}`);
  return null;
}

async function lookupRemoteRegistry(subdomain) {
  // @ts-ignore
  const registryUrl = import.meta.env?.VITE_REGISTRY_URL;
  if (!registryUrl) return null;

  try {
    const response = await fetch(`${registryUrl}/api/instance/${subdomain}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.debug("Registre central non disponible:", error.message);
    return null;
  }
}

function getDefaultInstance() {
  return {
    subdomain: "default",
    displayName: "local",
    supabaseUrl: null,
    supabaseAnonKey: null,
    isDefault: true,
    isConfigured: true,
    source: "local",
    metadata: {},
  };
}

export function getInstance() {
  return currentInstance;
}

export function isDefaultInstance() {
  return currentInstance?.isDefault === true;
}

export function getSubdomain() {
  return currentInstance?.subdomain || "default";
}

export function getInstanceUrl(subdomain, path = "/") {
  if (typeof window === "undefined") return path;
  if (window.location.hostname === "localhost") {
    const url = new URL(window.location.origin);
    url.pathname = path;
    url.searchParams.set("instance", subdomain);
    return url.toString();
  }

  const baseDomain = BASE_DOMAINS[0];
  return `https://${subdomain}.${baseDomain}${path}`;
}
