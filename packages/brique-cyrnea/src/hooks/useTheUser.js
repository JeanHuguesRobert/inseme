// ========================================
// HOOK - ACCÈS AU SINGLETON USER (DÉJÀ INITIALISÉ)
// ========================================

import { TheUser } from "../singletons/index.js";

/**
 * Hook pour accéder au singleton User (déjà initialisé au niveau app)
 * Retourne directement l'instance User pour un accès simple
 */
export const useTheUser = () => {
  return TheUser; // Accès direct à l'instance User
};
