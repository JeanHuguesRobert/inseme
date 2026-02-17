// ========================================
// SINGLETON USER - INSTANCE GLOBALE DIRECTE
// ========================================

import { User } from "../entities/User.js";
import { TheBar } from "./TheBar.js";

// Instance globale directe
export let TheUser = null;

// Fonction d'initialisation
export const initializeTheUser = (currentUser, _roomMetadata) => {
  if (TheUser) return TheUser;

  // If currentUser is already a rich User entity, use it directly
  if (currentUser instanceof User) {
    TheUser = currentUser;
  } else {
    // Fallback: Create from raw data (legacy support or safety net)
    console.warn("Initializing TheUser with raw object, expected User entity.");

    // Legacy keys and better fallback for anonymous ids
    const savedId =
      typeof window !== "undefined"
        ? localStorage.getItem("inseme_client_id") || localStorage.getItem("cyrnea_anon_id")
        : null;
    const savedPseudo =
      typeof window !== "undefined"
        ? localStorage.getItem("inseme_client_pseudo") || localStorage.getItem("cyrnea_anon_name")
        : null;
    const savedZone =
      typeof window !== "undefined" ? localStorage.getItem("inseme_client_zone") : null;
    const savedRole =
      typeof window !== "undefined" ? localStorage.getItem("inseme_client_role") : null;
    const savedOnDuty =
      typeof window !== "undefined" ? localStorage.getItem("inseme_on_duty") === "true" : false;

    const defaultZone = TheBar?.zones?.[0]?.id || "indoor";

    // If we don't have a stable id, create an anonymous user with a proper uuid
    if (!currentUser?.id && !savedId) {
      TheUser = User.createAnonymous();
    } else {
      TheUser = new User({
        id: currentUser?.id || savedId || "",
        pseudo: currentUser?.pseudo || savedPseudo || "Anonyme",
        zone: currentUser?.zone || savedZone || defaultZone,
        isOnDuty: currentUser?.isOnDuty || savedOnDuty,
        role: currentUser?.role || savedRole || "client",
        isAnonymous: currentUser?.isAnonymous ?? true,
      });
    }
  }

  // Rendre TheUser accessible globalement pour la vérification dans l'entité
  if (typeof window !== "undefined") {
    window.TheUser = TheUser;
  }

  return TheUser;
};

// Setters explicites pour respecter l'encapsulation

export const setUserZone = (zone) => {
  if (TheUser) {
    TheUser.zone = zone; // Utilise le setter de l'entité avec localStorage automatique
  }
};

export const setUserPseudo = (pseudo) => {
  if (TheUser) {
    TheUser.pseudo = pseudo; // Utilise le setter de l'entité avec localStorage automatique
  }
};

export const setUserOnDuty = (onDuty) => {
  if (TheUser) {
    TheUser.isOnDuty = onDuty; // Utilise le setter de l'entité avec localStorage automatique
  }
};

export const setUserGabrielMode = (isGabrielMode) => {
  if (TheUser) {
    TheUser.isGabrielMode = isGabrielMode; // Utilise le setter de l'entité avec localStorage automatique
  }
};
