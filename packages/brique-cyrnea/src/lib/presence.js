// packages/brique-cyrnea/lib/presence.js

/**
 * Utilitaires pour la gestion de la présence des utilisateurs
 * Fichier créé pour résoudre l'import manquant dans usePresence.js
 */

/**
 * Persiste les données de présence (stub pour compatibilité)
 * @param {string} type - Type d'action ('update', 'join', 'leave')
 * @param {Object} data - Données à persister
 * @returns {Promise<boolean>} Succès de l'opération
 */
export async function persistPresence(type, data) {
  // TODO: Implémenter la persistance réelle (base de données, etc.)
  console.debug(`[Presence] ${type}:`, data);

  // Simuler une persistance asynchrone
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, 10);
  });
}

/**
 * Nettoie les présences expirées
 * @param {Array} presences - Liste des présences
 * @param {number} timeout - Timeout en millisecondes
 * @returns {Array} Présences filtrées
 */
export function cleanupExpiredPresences(presences, timeout = 300000) {
  // 5 minutes par défaut
  const now = Date.now();
  return presences.filter((presence) => {
    const lastSeen = presence.lastSeen || presence.timestamp || 0;
    return now - lastSeen < timeout;
  });
}

/**
 * Enrichit les données de présence avec des informations calculées
 * @param {Object} presence - Données de présence brutes
 * @returns {Object} Présence enrichie
 */
export function enrichPresence(presence) {
  return {
    ...presence,
    isOnline: presence.online !== false,
    lastSeen: presence.lastSeen || presence.timestamp || Date.now(),
    status: presence.status || "active",
  };
}
