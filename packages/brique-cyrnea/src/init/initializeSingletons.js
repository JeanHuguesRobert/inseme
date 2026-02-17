// ========================================
// INITIALISATION DES SINGLETONS - NIVEAU APPLICATION
// ========================================

import { initializeTheBar, initializeTheUser } from "../singletons/index.js";

/**
 * Initialise tous les singletons une seule fois au démarrage de l'application
 * Doit être appelé dans le composant racine ou AppProvider
 * Lance des erreurs si l'initialisation échoue
 *
 * NOTE: getConfig() est disponible immédiatement via le cache global
 */
export const initializeSingletons = (roomMetadata, roomData, messages, currentUser) => {
  console.debug("[Singletons] Initializing application singletons...");

  // Initialiser TheBar - obligatoire
  if (!roomMetadata) {
    throw new Error("[Singletons] roomMetadata is required for TheBar initialization");
  }

  try {
    console.debug("[Singletons] Initializing TheBar...");
    const bar = initializeTheBar(roomMetadata, roomData, messages);
    if (!bar) {
      throw new Error("[Singletons] Failed to initialize TheBar - instance is null");
    }

    console.debug("[Singletons] TheBar initialized:", bar);
  } catch (error) {
    console.error("[Singletons] TheBar initialization failed:", error);
    throw new Error(`[Singletons] Failed to initialize TheBar: ${error.message}`);
  }

  // Initialiser TheUser - obligatoire
  if (!currentUser) {
    throw new Error("[Singletons] currentUser is required for TheUser initialization");
  }

  try {
    console.debug("[Singletons] Initializing TheUser...");
    const user = initializeTheUser(currentUser, roomMetadata);
    if (!user) {
      throw new Error("[Singletons] Failed to initialize TheUser - instance is null");
    }
    console.debug("[Singletons] TheUser initialized:", user);
  } catch (error) {
    console.error("[Singletons] TheUser initialization failed:", error);
    throw new Error(`[Singletons] Failed to initialize TheUser: ${error.message}`);
  }

  console.debug("[Singletons] All singletons initialized successfully");
};
