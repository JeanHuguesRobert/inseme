// packages/cop-host/src/lib/instanceResolver.js
// Résolution dynamique de l'instance Supabase selon l'URL
//
// STRATÉGIE DE ROUTAGE :
// 1. Paramètre URL ?instance=xxx (dev/test, priorité max)
// 2. Sous-domaine : corte.transparence.corsica → instance "corte"
// 3. Fallback : variables d'environnement (instance par défaut)
//
// En développement local (localhost), utiliser ?instance=xxx
// En production, les sous-domaines sont résolus automatiquement
//

// ============================================================================
// CONFIGURATION
// ============================================================================

// Domaine de base pour la détection des sous-domaines
const BASE_DOMAINS = ["lepp.fr", "kudocracy.org"];

// Sous-domaines à ignorer (pas des instances)
const IGNORED_SUBDOMAINS = ["www", "app", "api", "admin", "staging", "preview"];

// ============================================================================
// ÉTAT GLOBAL
// ============================================================================

let currentInstance = null;
let resolvePromise = null;

// ============================================================================
// DÉTECTION DU SOUS-DOMAINE
// ============================================================================

/**
 * Extrait le sous-domaine de l'URL actuelle
 * @returns {string|null} - Le sous-domaine ou null
 */
export function extractSubdomain() {
  const hostname = window.location.hostname;

  // Localhost ou IP = pas de sous-domaine
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
  ) {
    return null;
  }

  // Vérifier chaque domaine de base
  for (const baseDomain of BASE_DOMAINS) {
    if (hostname.endsWith(`.${baseDomain}`)) {
      const subdomain = hostname.replace(`.${baseDomain}`, "");
      // Ignorer les sous-domaines système
      if (!IGNORED_SUBDOMAINS.includes(subdomain)) {
        return subdomain;
      }
    }
  }

  // Netlify preview URLs : deploy-preview-123--site-name.netlify.app
  if (hostname.includes(".netlify.app")) {
    // Extraire le paramètre instance si présent dans l'URL
    return null;
  }

  return null;
}

/**
 * Alias for extractSubdomain (used by some briques)
 */
export const getSubdomain = extractSubdomain;

/**
 * Récupère le paramètre ?instance= de l'URL
 * @returns {string|null}
 */
export function getInstanceParam() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("instance");
}

// ============================================================================
// RÉSOLUTION D'INSTANCE
// ============================================================================

/**
 * Résout l'instance Supabase à utiliser
 * Priorité : paramètre URL > sous-domaine > env vars
 *
 * @returns {Promise<InstanceConfig>}
 */
export async function resolveInstance() {
  // Éviter les résolutions multiples simultanées
  if (resolvePromise) {
    return resolvePromise;
  }

  // Si déjà résolu, retourner le cache
  if (currentInstance) {
    return currentInstance;
  }

  resolvePromise = doResolveInstance();
  currentInstance = await resolvePromise;
  resolvePromise = null;

  return currentInstance;
}

/**
 * Logique de résolution interne
 */
async function doResolveInstance() {
  // 1. Priorité max : paramètre URL (dev/test)
  const instanceParam = getInstanceParam();
  if (instanceParam) {
    console.log(`🔧 Instance depuis URL param: ${instanceParam}`);
    const instance = await lookupInstance(instanceParam);
    if (instance) {
      return { ...instance, source: "url-param" };
    }
  }

  // 2. Sous-domaine
  const subdomain = extractSubdomain();
  if (subdomain) {
    console.log(`🌐 Instance depuis sous-domaine: ${subdomain}`);
    const instance = await lookupInstance(subdomain);
    if (instance) {
      return { ...instance, source: "subdomain" };
    }
  }

  // 3. Fallback : variables d'environnement (instance par défaut)
  console.log("📋 Instance locale");
  return getDefaultInstance();
}

/**
 * Recherche une instance dans le registre
 * @param {string} subdomain
 * @returns {Promise<InstanceConfig|null>}
 */
async function lookupInstance(subdomain) {
  // 1. D'abord essayer le registre central (API)
  const remoteInstance = await lookupRemoteRegistry(subdomain);
  if (remoteInstance) {
    return remoteInstance;
  }
  console.warn(`⚠️ Instance non trouvée: ${subdomain}`);
  return null;
}

/**
 * Recherche dans le registre central (API)
 * @param {string} subdomain
 * @returns {Promise<InstanceConfig|null>}
 */
async function lookupRemoteRegistry(subdomain) {
  // TODO: should get this from vault
  const registryUrl = import.meta.env.VITE_REGISTRY_URL;

  if (!registryUrl) {
    return null;
  }

  try {
    const response = await fetch(`${registryUrl}/api/instance/${subdomain}`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    console.log(`🌐 Instance trouvée dans registre central: ${subdomain}`);
    return data;
  } catch (error) {
    console.debug("Registre central non disponible:", error.message);
    return null;
  }
}

/**
 * Retourne l'instance par défaut (depuis env vars)
 * @returns {InstanceConfig}
 */
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
