// ========================================
// USER STORAGE - LOCAL STORAGE SIMPLE
// Stockage de l'utilisateur courant (singleton)
// ========================================

const USER_KEY = "inseme_current_user";

/**
 * Storage simple pour l'utilisateur courant
 * Remplace le UserRepository complexe inutile
 */
export const UserStorage = {
  /**
   * Sauvegarder l'utilisateur courant
   * @param {Object} user - Données utilisateur
   */
  save(user) {
    if (!user) return;

    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (error) {
      console.error("Erreur lors de la sauvegarde de l'utilisateur:", error);
    }
  },

  /**
   * Récupérer l'utilisateur courant
   * @returns {Object|null} Données utilisateur ou null
   */
  load() {
    try {
      const data = localStorage.getItem(USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("Erreur lors du chargement de l'utilisateur:", error);
      return null;
    }
  },

  /**
   * Supprimer l'utilisateur courant (logout)
   */
  clear() {
    try {
      localStorage.removeItem(USER_KEY);
    } catch (error) {
      console.error("Erreur lors de la suppression de l'utilisateur:", error);
    }
  },

  /**
   * Vérifier si un utilisateur est stocké
   * @returns {boolean} True si utilisateur existe
   */
  exists() {
    return localStorage.getItem(USER_KEY) !== null;
  },

  /**
   * Mettre à jour une propriété spécifique
   * @param {string} property - Nom de la propriété
   * @param {*} value - Nouvelle valeur
   */
  updateProperty(property, value) {
    const user = this.load();
    if (user) {
      user[property] = value;
      this.save(user);
    }
  },
};
