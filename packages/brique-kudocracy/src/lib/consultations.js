/**
 * Utilitaires pour le partage des consultations
 * Migré depuis apps/platform pour l'autonomie du package
 */

import { COMMUNITY_NAME, REGION_NAME, HASHTAG } from "../constants.js";

/**
 * Génère l'URL de partage d'une consultation
 * @param {Object} consultation - La consultation
 * @param {Object} options - Options (includeResults, utmSource, utmMedium)
 * @returns {string} URL complète
 */
export function getShareUrl(consultation, options = {}) {
  const { includeResults = false, utmSource = null, utmMedium = null } = options;

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  let url = `${baseUrl}/consultation/${consultation.slug}`;

  const params = new URLSearchParams();
  if (includeResults) {
    params.set("view", "results");
  }
  if (utmSource) {
    params.set("utm_source", utmSource);
    params.set("utm_medium", utmMedium || "social");
    params.set("utm_campaign", `consultation_${consultation.slug}`);
  }

  const queryString = params.toString();
  return queryString ? `${url}?${queryString}` : url;
}

/**
 * Génère le texte de partage pour une consultation
 * @param {Object} consultation - La consultation
 * @param {Object} options - Options (scope, stats, language)
 * @returns {Object} {title, text, hashtags}
 */
export function getShareText(consultation, options = {}) {
  const { scope = "local", stats = null } = options;

  const scopeEmoji =
    {
      local: "🏘️",
      regional: "🗺️",
      national: "🇫🇷",
    }[scope] || "📊";

  const scopeLabel =
    {
      local: COMMUNITY_NAME,
      regional: REGION_NAME,
      national: "France",
    }[scope] || COMMUNITY_NAME;

  let title = `${scopeEmoji} ${consultation.title}`;
  let text = consultation.description || "";

  if (stats?.totalResponses) {
    if (scope === "national" && stats.communeCount) {
      text += ` • ${stats.totalResponses} réponses de ${stats.communeCount} commune${stats.communeCount > 1 ? "s" : ""}`;
    } else {
      text += ` • ${stats.totalResponses} réponse${stats.totalResponses > 1 ? "s" : ""} à ${scopeLabel}`;
    }
  }

  text += " • Donnez votre avis !";

  const hashtags = [
    HASHTAG.replace("#", ""),
    `democratie${scope === "local" ? "locale" : scope === "regional" ? "regionale" : "participative"}`,
    consultation.slug.replace(/-/g, ""),
  ];

  return { title, text, hashtags };
}

/**
 * Génère les liens de partage pour différentes plateformes
 * @param {Object} consultation - La consultation
 * @param {Object} options - Options (scope, stats)
 * @returns {Object} {twitter, facebook, linkedin, whatsapp, email, copy}
 */
export function getShareLinks(consultation, options = {}) {
  const url = getShareUrl(consultation, { utmSource: "share" });
  const { title, text, hashtags } = getShareText(consultation, options);
  const fullText = `${title}\n\n${text}`;
  const hashtagsStr = hashtags.map((h) => `#${h}`).join(" ");

  return {
    twitter: {
      name: "Twitter/X",
      icon: "𝕏",
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(fullText)}&url=${encodeURIComponent(url)}&hashtags=${encodeURIComponent(hashtags.join(","))}`,
      color: "#000000",
    },
    facebook: {
      name: "Facebook",
      icon: "f",
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(fullText)}`,
      color: "#1877f2",
    },
    linkedin: {
      name: "LinkedIn",
      icon: "in",
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      color: "#0a66c2",
    },
    whatsapp: {
      name: "WhatsApp",
      icon: "📱",
      url: `https://wa.me/?text=${encodeURIComponent(`${fullText}\n\n${url}`)}`,
      color: "#25d366",
    },
    telegram: {
      name: "Telegram",
      icon: "✈️",
      url: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(fullText)}`,
      color: "#0088cc",
    },
    email: {
      name: "Email",
      icon: "✉️",
      url: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${fullText}\n\n${url}\n\n${hashtagsStr}`)}`,
      color: "#ea4335",
    },
    copy: {
      name: "Copier le lien",
      icon: "📋",
      url: url,
      color: "#666666",
      action: "copy",
    },
  };
}

/**
 * Copie le lien de partage dans le presse-papiers
 */
export async function copyShareLink(consultation, options = {}) {
  try {
    const url = getShareUrl(consultation, options);
    await navigator.clipboard.writeText(url);
    return true;
  } catch (err) {
    console.error("Erreur copie lien:", err);
    try {
      const textArea = document.createElement("textarea");
      textArea.value = getShareUrl(consultation, options);
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Utilise l'API Web Share si disponible
 */
export async function nativeShare(consultation, options = {}) {
  if (typeof navigator === "undefined" || !navigator.share) {
    return false;
  }

  try {
    const url = getShareUrl(consultation, { utmSource: "native_share" });
    const { title, text } = getShareText(consultation, options);

    await navigator.share({
      title,
      text,
      url,
    });
    return true;
  } catch (err) {
    if (err.name === "AbortError") {
      return false;
    }
    console.error("Erreur partage natif:", err);
    return false;
  }
}

/**
 * Suit un événement de partage (analytics)
 */
export function trackShare(consultationSlug, platform, scope = "local") {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "share", {
      method: platform,
      content_type: "consultation",
      content_id: consultationSlug,
      custom_dimension_scope: scope,
    });
  }
  console.log(`📤 Partage: ${consultationSlug} via ${platform} (${scope})`);
}
