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
const BASE_DOMAINS = [
  "lepp.fr",
  "kudocracy.org",
  "inseme.org",
  "baronsmariani.org",
  "acorsica.org",
];

// Sous-domaines à ignorer (pas des instances)
const IGNORED_SUBDOMAINS = ["www", "app", "api", "admin", "staging", "preview"];

/**
 * Built-in personal / known twins when the central registry is unavailable.
 * Credentials still come from env (Netlify site env for jhn.baronsmariani.org).
 * Keeps subdomain + twin metadata correct so vault/config and HomeRoute stay coherent.
 *
 * oleole.acorsica.org is a *façade* of the same Twin JHN (not a second Twin):
 * same credentials / agent John; UX is Presence/discovery (Olé Olé).
 */
const KNOWN_SUBDOMAIN_FALLBACKS = {
  jhn: {
    instanceId: "00000000-0000-0000-0000-000000000001",
    displayName: "JHN",
    deployment_kind: "personal",
    application_profile: "personal-twin",
    host_domain: "baronsmariani.org",
    canonical_url: "https://jhn.baronsmariani.org",
    subject_root_ref: "twin:jhn",
    subject_ref: "subject:jhn",
  },
  john: { aliasOf: "jhn" },
  jean: { aliasOf: "jhn" },
  "jean-hugues": { aliasOf: "jhn" },
  "jean-hugues-noel": { aliasOf: "jhn" },
  "jean-hugues-noël": { aliasOf: "jhn" },
  "jean-hugues-noel-robert": { aliasOf: "jhn" },
  "jean-hugues-noël-robert": { aliasOf: "jhn" },
  jhr: { aliasOf: "jhn" },
  "baron-mariani": { aliasOf: "jhn" },
  "barons-mariani": { aliasOf: "jhn" },
  mariani: { aliasOf: "jhn" },
  robert: { aliasOf: "jhn" },

  "frederic-lecourtois": {
    instanceId: "00000000-0000-0000-0000-000000000002",
    hostInstanceId: "00000000-0000-0000-0000-000000000001",
    displayName: "Frédéric Lecourtois",
    botName: "Aréopage",
    deployment_kind: "personal",
    application_profile: "personal-twin",
    host_domain: "baronsmariani.org",
    canonical_url: "https://frederic-lecourtois.jhn.baronsmariani.org",
    subject_root_ref: "twin:frederic-lecourtois",
    subject_ref: "subject:frederic-lecourtois",
  },
  areopage: { aliasOf: "frederic-lecourtois" },
  aréopage: { aliasOf: "frederic-lecourtois" },
  frederic: { aliasOf: "frederic-lecourtois" },
  frédéric: { aliasOf: "frederic-lecourtois" },
  lecourtois: { aliasOf: "frederic-lecourtois" },
  "f-lecourtois": { aliasOf: "frederic-lecourtois" },

  "marie-cornelie-lenglet": {
    instanceId: "00000000-0000-0000-0000-000000000003",
    hostInstanceId: "00000000-0000-0000-0000-000000000001",
    displayName: "Marie-Cornélie Lenglet",
    botName: "Ophélia",
    deployment_kind: "personal",
    application_profile: "personal-twin",
    host_domain: "baronsmariani.org",
    canonical_url: "https://marie-cornelie-lenglet.jhn.baronsmariani.org",
    subject_root_ref: "twin:marie-cornelie-lenglet",
    subject_ref: "subject:marie-cornelie-lenglet",
  },
  "marie-cornelie": { aliasOf: "marie-cornelie-lenglet" },
  "marie-cornélie": { aliasOf: "marie-cornelie-lenglet" },
  cornelie: { aliasOf: "marie-cornelie-lenglet" },
  cornélie: { aliasOf: "marie-cornelie-lenglet" },
  "mc-lenglet": { aliasOf: "marie-cornelie-lenglet" },
  lenglet: { aliasOf: "marie-cornelie-lenglet" },

  "marie-louise-robert": {
    instanceId: "00000000-0000-0000-0000-000000000004",
    hostInstanceId: "00000000-0000-0000-0000-000000000001",
    displayName: "Marie-Louise Robert",
    botName: "Marie-Louise",
    deployment_kind: "personal",
    subject_kind: "deceased_person",
    application_profile: "personal-twin",
    host_domain: "baronsmariani.org",
    canonical_url: "https://marie-louise.jhn.baronsmariani.org",
    subject_root_ref: "twin:marie-louise-robert",
    subject_ref: "subject:marie-louise-robert",
  },
  "marie-louise": { aliasOf: "marie-louise-robert" },
  marie: { aliasOf: "marie-louise-robert" },
  mary: { aliasOf: "marie-louise-robert" },
  mlr: { aliasOf: "marie-louise-robert" },
  "ml-robert": { aliasOf: "marie-louise-robert" },
  "marie-robert": { aliasOf: "marie-louise-robert" },

  oleole: {
    displayName: "Olé Olé",
    deployment_kind: "personal",
    application_profile: "personal-twin",
    service_facade: "oleole",
    host_domain: "acorsica.org",
    /** Legal public site; éditeur Association C.O.R.S.I.C.A. */
    canonical_url: "https://oleole.acorsica.org",
    /** Twin facet (same code) under jhn DNS tree */
    jhn_facet_url: "https://oleole.jhn.baronsmariani.org",
    subject_root_ref: "twin:jhn",
    subject_ref: "subject:jhn",
    agent_ref: "agent:jhn",
    publisher: "Association C.O.R.S.I.C.A.",
  },
};

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

  // 2. Built-in personal-twin / known hosts (no registry required)
  const known = getKnownSubdomainFallback(subdomain);
  if (known) {
    console.log(`🏠 Instance connue (fallback): ${subdomain}`);
    return known;
  }

  console.warn(`⚠️ Instance non trouvée: ${subdomain}`);
  return null;
}

/**
 * Env-backed fallback for known subdomains (e.g. jhn without VITE_REGISTRY_URL).
 * @param {string} subdomain
 * @returns {InstanceConfig|null}
 */
function getKnownSubdomainFallback(subdomain) {
  let key = String(subdomain || "").toLowerCase();
  let meta = KNOWN_SUBDOMAIN_FALLBACKS[key];
  if (!meta) return null;

  if (meta.aliasOf) {
    const targetKey = meta.aliasOf;
    meta = KNOWN_SUBDOMAIN_FALLBACKS[targetKey];
    if (!meta) return null;
  }

  const env = import.meta.env || {};
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || null;
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || null;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      `⚠️ Fallback "${key}" sans VITE_SUPABASE_URL/ANON_KEY — impossible de monter l'instance`
    );
    return null;
  }

  return {
    subdomain: key,
    instanceId: meta.instanceId || null,
    hostInstanceId: meta.hostInstanceId || null,
    displayName: meta.displayName || key,
    botName: meta.botName || null,
    supabaseUrl,
    supabaseAnonKey,
    isDefault: false,
    isConfigured: true,
    source: "known-fallback",
    metadata: {
      instance_id: meta.instanceId || null,
      host_instance_id: meta.hostInstanceId || null,
      bot_name: meta.botName || null,
      deployment_kind: meta.deployment_kind,
      application_profile: meta.application_profile,
      host_domain: meta.host_domain,
      canonical_url: meta.canonical_url,
      subject_root_ref: meta.subject_root_ref,
      subject_ref: meta.subject_ref,
    },
  };
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
  const env = import.meta.env || {};
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || null;
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || null;

  return {
    subdomain: "default",
    displayName: "local",
    supabaseUrl,
    supabaseAnonKey,
    isDefault: true,
    isConfigured: !!supabaseUrl && !!supabaseAnonKey,
    source: "local",
    metadata: {},
  };
}
