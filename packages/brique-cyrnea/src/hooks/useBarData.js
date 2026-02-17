// ========================================
// HOOK - BAR DATA
// Accès direct aux données du bar depuis roomMetadata
// ========================================

import { useInsemeContext } from "@inseme/room";

/**
 * Hook pour accéder aux données du bar courant
 * Remplace le BarRepository complexe inutile
 */
export const useBarData = () => {
  const { roomMetadata } = useInsemeContext();

  return {
    // Données principales
    barData: roomMetadata || {},
    name: roomMetadata?.name || "Bar",
    slug: roomMetadata?.slug || "bar",
    id: roomMetadata?.id || "bar",

    // Settings
    settings: roomMetadata?.settings || {},

    // Accès rapides aux settings courants
    wifi: {
      ssid: roomMetadata?.settings?.wifi_ssid,
      password: roomMetadata?.settings?.wifi_password,
    },
    social: {
      facebook: roomMetadata?.settings?.facebook_url,
      instagram: roomMetadata?.settings?.instagram_url,
      customLinks: roomMetadata?.settings?.custom_links || [],
    },
    zones: roomMetadata?.settings?.zones || [],
    barSesame: roomMetadata?.settings?.bar_sesame || "",

    // Métadonnées
    createdAt: roomMetadata?.created_at,
    updatedAt: roomMetadata?.updated_at,

    // Utilitaires
    hasSettings: !!roomMetadata?.settings,
    hasWifi: !!roomMetadata?.settings?.wifi_ssid,
    hasSocial: !!(roomMetadata?.settings?.facebook_url || roomMetadata?.settings?.instagram_url),
  };
};
