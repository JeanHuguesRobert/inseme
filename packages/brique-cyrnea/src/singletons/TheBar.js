// ========================================
// SINGLETON BAR - INSTANCE GLOBALE DIRECTE
// ========================================

import { Bar } from "../entities/Bar.js";

// Instance globale directe
export let TheBar = null;

// Fonction d'initialisation
export const initializeTheBar = (roomMetadata, roomData, _messages) => {
  const newSlug = roomMetadata?.slug || roomMetadata?.id;

  // If TheBar exists and slug is the same, no need to re-initialize
  if (TheBar && TheBar.slug === newSlug) {
    return TheBar;
  }

  // Use the factory method from the Entity
  const newBar = Bar.fromRoom(roomMetadata);

  if (newBar) {
    TheBar = newBar;
  } else if (!TheBar) {
    // Fallback only if we don't have a bar at all
    TheBar = Bar.createDefault();
  }

  // Update with dynamic data if available
  if (TheBar && roomData?.connectedUsers) {
    TheBar.updateConnectedUsers(roomData.connectedUsers);
  }

  return TheBar;
};
