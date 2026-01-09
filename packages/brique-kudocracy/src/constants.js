// src/constants.js
// Constantes pour la brique Kudocracy

/**
 * Niveaux de portée des consultations
 */
export const CONSULTATION_SCOPES = {
  local: {
    id: "local",
    label: "Locale",
    description: "Consultation à l'échelle de la commune",
    icon: "🏘️",
    color: "#4caf50",
  },
  regional: {
    id: "regional",
    label: "Régionale",
    description: "Consultation à l'échelle de la région",
    icon: "🗺️",
    color: "#ff9800",
  },
  national: {
    id: "national",
    label: "Nationale",
    description: "Consultation à l'échelle du pays",
    icon: "🇫🇷",
    color: "#2196f3",
  },
};

// Fallbacks pour le partage
export const COMMUNITY_NAME =
  import.meta.env?.VITE_COMMUNITY_NAME || "Ma Commune";
export const REGION_NAME = import.meta.env?.VITE_REGION_NAME || "Ma Région";
export const HASHTAG = import.meta.env?.VITE_HASHTAG || "#Inseme";
