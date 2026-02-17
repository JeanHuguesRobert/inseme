// packages/brique-cyrnea/utils/storageUtils.js

/**
 * Gestion sécurisée du localStorage avec gestion d'erreurs
 */

export class StorageManager {
  /**
   * Récupère une valeur depuis localStorage avec gestion d'erreurs
   * @param {string} key - Clé de stockage
   * @param {any} defaultValue - Valeur par défaut si erreur ou vide
   * @param {Function} onError - Callback optionnel pour les erreurs
   * @returns {any} Valeur récupérée ou defaultValue
   */
  static getItem(key, defaultValue = null, onError = null) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null || raw === undefined || raw === "") return defaultValue;

      // Tentative de parsing JSON
      try {
        return JSON.parse(raw);
      } catch (parseError) {
        // If parse fails, check if it's a simple string value
        // This handles migration from old plain-string storage
        console.info(`Key "${key}" contains non-JSON value, returning as-is`);
        return raw;
      }
    } catch (error) {
      console.error(`Storage error getting key "${key}":`, error);
      if (onError) onError(error);
      return defaultValue;
    }
  }

  /**
   * Stocke une valeur dans localStorage avec gestion d'erreurs
   * @param {string} key - Clé de stockage
   * @param {any} value - Valeur à stocker
   * @param {Function} onError - Callback optionnel pour les erreurs
   * @returns {boolean} Succès de l'opération
   */
  static setItem(key, value, onError = null) {
    try {
      const serialized = typeof value === "string" ? value : JSON.stringify(value);
      localStorage.setItem(key, serialized);
      return true;
    } catch (error) {
      console.error(`Storage error setting key "${key}":`, error);
      if (onError) onError(error);
      return false;
    }
  }

  /**
   * Supprime une valeur du localStorage
   * @param {string} key - Clé à supprimer
   * @param {Function} onError - Callback optionnel pour les erreurs
   * @returns {boolean} Succès de l'opération
   */
  static removeItem(key, onError = null) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Storage error removing key "${key}":`, error);
      if (onError) onError(error);
      return false;
    }
  }

  /**
   * Nettoie les valeurs expirées basées sur un champ timestamp
   * @param {string} keyPattern - Pattern des clés à vérifier (ex: "inseme_token_")
   * @param {number} maxAge - Âge maximum en millisecondes
   */
  static cleanupExpired(keyPattern, maxAge) {
    try {
      const now = Date.now();
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(keyPattern)) {
          const value = this.getItem(key);
          if (value && value.timestamp && now - value.timestamp > maxAge) {
            this.removeItem(key);
            console.debug(`Cleaned up expired key: ${key}`);
          }
        }
      }
    } catch (error) {
      console.error("Error during cleanup:", error);
    }
  }

  /**
   * Vérifie l'espace de stockage disponible
   * @returns {number} Espace utilisé en bytes (approximatif)
   */
  static getStorageUsage() {
    try {
      let total = 0;
      for (let key in localStorage) {
        if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
          total += localStorage[key].length + key.length;
        }
      }
      return total;
    } catch (error) {
      console.error("Error calculating storage usage:", error);
      return 0;
    }
  }
}
