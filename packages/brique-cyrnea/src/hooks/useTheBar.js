// ========================================
// HOOK - ACCÈS AU SINGLETON BAR (DÉJÀ INITIALISÉ)
// ========================================

import { TheBar } from "../singletons/index.js";

/**
 * Hook pour accéder au singleton Bar (déjà initialisé au niveau app)
 * Retourne directement l'instance Bar pour un accès simple
 */
export const useTheBar = () => {
  return TheBar; // Accès direct à l'instance Bar
};
