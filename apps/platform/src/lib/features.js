// src/lib/features.js
import { getConfig } from "./supabase.js";

/**
 * Vérifie si une fonctionnalité est activée dans la configuration de l'instance.
 * Supporte les booléens, les chaînes "true"/"false" et les nombres 0/1.
 *
 * @param {string} featureName - Le nom de la feature (ex: 'wiki', 'chat')
 * @param {boolean} defaultValue - Valeur par défaut si la config est absente
 * @returns {boolean}
 */
export function isFeatureEnabled(featureName, defaultValue = false) {
  // On cherche 'feature_name' ou 'feature_name' selon la convention
  const key = featureName.startsWith("feature_") ? featureName : `feature_${featureName}`;
  const value = getConfig(key);

  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  // Normalisation en booléen
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const v = value.toLowerCase().trim();
    return v === "true" || v === "1" || v === "yes" || v === "on";
  }

  return !!value;
}

/**
 * Liste des features principales pour faciliter l'usage
 */
export const FEATURES = {
  WIKI: "wiki",
  CONSULTATIONS: "consultations",
  PETITIONS: "petitions",
  CHATBOT: "chatbot",
  TRANSPARENCY: "transparency",
  SOCIAL: "social",
  COMMENTS: "comments",
  CHAT: "chat", // Inseme
  MISSIONS: "missions",
  ACTES: "actes",
  FIL: "fil",
  GROUPS: "social",
  POSTS: "social",
};
