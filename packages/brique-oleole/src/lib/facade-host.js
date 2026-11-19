/**
 * Olé Olé = façade de service d’Agent JHN (même Twin, même code).
 *
 * Hosts that mount this façade (same Netlify site / same artefact):
 *   - oleole.acorsica.org              → CANONICAL public site
 *     (éditeur / publisher au sens légal : association C.O.R.S.I.C.A.)
 *   - oleole.baronsmariani.org         → Twin facet (same service, under JHN)
 *   - oleole-acorsica.netlify.app, etc. → preview / transitional
 *   - ?facade=oleole on any host       → dev / smoke
 *
 * Never invent a second agent; John remains the conversational agent.
 * Service memory stays scoped service:oleole (not silent mix with personal Twin memory).
 */

/** Legal public site — C.O.R.S.I.C.A. as éditeur. */
export const OLEOLE_CANONICAL_HOST = "oleole.acorsica.org";

/** Same façade under the JHN / Twin DNS tree. */
export const OLEOLE_JHN_FACET_HOST = "oleole.baronsmariani.org";

export const OLEOLE_PUBLISHER = {
  legal_name: "Association C.O.R.S.I.C.A.",
  short_name: "C.O.R.S.I.C.A.",
  role: "editeur",
  canonical_host: OLEOLE_CANONICAL_HOST,
  service_agent: "john",
  subject_root_ref: "twin:jhn",
};

/**
 * @typedef {"canonical" | "jhn_facet" | "preview" | "query" | null} OleoleHostRole
 */

/**
 * @param {string} [hostname]
 * @param {string} [search]
 * @returns {{ isOleole: boolean, role: OleoleHostRole, host: string }}
 */
export function classifyOleoleHost(hostname, search) {
  const host = String(hostname || "")
    .toLowerCase()
    .replace(/\.$/, "");
  const q = String(search || "");

  let fromQuery = false;
  try {
    const params = new URLSearchParams(q.startsWith("?") ? q.slice(1) : q);
    const facade = (params.get("facade") || params.get("service") || "").toLowerCase();
    if (facade === "oleole" || facade === "olé" || facade === "ole") fromQuery = true;
  } catch {
    /* ignore */
  }

  if (host === OLEOLE_CANONICAL_HOST || host === `www.${OLEOLE_CANONICAL_HOST}`) {
    return { isOleole: true, role: "canonical", host };
  }

  if (host === OLEOLE_JHN_FACET_HOST || host === `www.${OLEOLE_JHN_FACET_HOST}`) {
    return { isOleole: true, role: "jhn_facet", host };
  }

  // Nested under jhn.* e.g. oleole.jhn.baronsmariani.org already covered;
  // also accept any oleole.*.baronsmariani.org / oleole.* pattern for future aliases.
  if (host.startsWith("oleole.jhn.") || /^oleole\.jhn\./.test(host)) {
    return { isOleole: true, role: "jhn_facet", host };
  }

  if (host.startsWith("oleole.") || host.includes("oleole-acorsica")) {
    return { isOleole: true, role: "preview", host };
  }

  if (fromQuery) {
    return { isOleole: true, role: "query", host };
  }

  return { isOleole: false, role: null, host };
}

/**
 * @param {string} [hostname]
 * @param {string} [search]
 */
export function isOleoleFacadeHost(hostname, search) {
  return classifyOleoleHost(hostname, search).isOleole;
}

export function isOleoleFacade() {
  if (typeof window === "undefined") return false;
  return isOleoleFacadeHost(window.location.hostname, window.location.search);
}

/** True only for the legal public hostname (or www). */
export function isOleoleCanonicalHost(hostname) {
  const host = String(hostname || "")
    .toLowerCase()
    .replace(/\.$/, "");
  return host === OLEOLE_CANONICAL_HOST || host === `www.${OLEOLE_CANONICAL_HOST}`;
}

/**
 * Service context for John / APIs / analytics.
 * Always same twin; publisher metadata points at C.O.R.S.I.C.A. for the service.
 */
export function getActiveServiceContext() {
  if (typeof window !== "undefined" && isOleoleFacade()) {
    const { role, host } = classifyOleoleHost(window.location.hostname, window.location.search);
    return {
      service: "oleole",
      agent: "john",
      subject_root_ref: OLEOLE_PUBLISHER.subject_root_ref,
      facade_of: "agent-jhn",
      memory_scope: "service:oleole",
      host_role: role,
      host,
      publisher: OLEOLE_PUBLISHER,
      canonical_url: `https://${OLEOLE_CANONICAL_HOST}`,
      is_canonical_public_site: role === "canonical",
    };
  }
  return {
    service: "jhn",
    agent: "john",
    subject_root_ref: "twin:jhn",
    facade_of: null,
    memory_scope: "twin:jhn",
    host_role: null,
    publisher: null,
    canonical_url: "https://jhn.baronsmariani.org",
    is_canonical_public_site: false,
  };
}
