// ========================================
// ENTITÉ USER - RICH DOMAIN MODEL (Cyrnea Specific)
// Logic, Data, and Behavior centralized
// Extends centralized Base User from @inseme/cop-host
// ========================================

import { User as BaseUser } from "@inseme/cop-host";
import { StorageManager } from "../utils/storageUtils.js";

/**
 * Entité User représentant un utilisateur du système.
 * RICH DOMAIN MODEL: Contient à la fois les données et la logique métier.
 */
export class User extends BaseUser {
  constructor(userData = {}) {
    super(userData);

    // États & Préférences spécifiques à Cyrnea
    this._isGabrielMode = userData.isGabrielMode ?? false;
    this._isHandsFree = userData.isHandsFree ?? false;
    this._isSilent = userData.isSilent ?? false;
    this._screen = userData.screen || "games";

    // Social
    this._joinedAt = userData.joined_at || userData.createdAt || new Date();
    this._lastSeen = userData.last_seen || userData.lastSeen || new Date();
    this._publicLinks = Array.isArray(userData.public_links) ? userData.public_links : [];
  }

  // ========================
  // FACTORIES (Création)
  // ========================

  /**
   * Crée un utilisateur courrant basé sur le stockage local ou une session
   * Remplace la logique de CyrneaUserProvider
   */
  static createWithRole(identity, profile = {}, settings = {}) {
    // Calcul du rôle effectif (similaire à computeUserObject)
    const realRole = profile.role || identity.role || "client";
    const isOnDuty = settings.isOnDuty ?? false;

    return new User({
      ...identity,
      ...profile,
      realRole,
      isOnDuty,
      ...settings,
    });
  }

  /**
   * Crée ou récupère une identité anonyme depuis le localStorage
   */
  static createAnonymous() {
    if (typeof window === "undefined") return User.createGuest();

    let id = localStorage.getItem("cyrnea_anon_id");
    let name = localStorage.getItem("inseme_client_pseudo");
    let zone = localStorage.getItem("inseme_client_zone") || "indoor";

    // Check for local barman token (Source of Truth for Local Barman)
    const barmanToken = localStorage.getItem("inseme_barman_token");
    const isBarmanLegacy = localStorage.getItem("cyrnea_is_barman") === "true";
    const isBarman = !!barmanToken || isBarmanLegacy;

    // Use StorageManager for consistent JSON parsing
    const barmanPlace = StorageManager.getItem("inseme_barman_place", "Bar");
    const isOnDuty = localStorage.getItem("inseme_on_duty") === "true";

    // For Cyrnea Anonymous Users: We use a valid random UUID for local identification
    // (React keys, Presence keys) but sendMessage will send NULL to the database.
    if (!id || id.startsWith("anon_")) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : "00000000-0000-4000-a000-" + Math.random().toString(16).slice(2, 14);
      localStorage.setItem("cyrnea_anon_id", id);
      localStorage.setItem("inseme_client_id", id);
    }

    return new User({
      id,
      pseudo: name || "Anonyme",
      type: 1, // Explicitly Type 1
      realRole: isBarman ? "barman" : "client",
      isOnDuty: isOnDuty,
      zone: zone,
      metadata: {
        is_anonymous: true,
        place: barmanPlace,
        avatarUrl: `https://api.dicebear.com/7.x/notionists/svg?seed=${id}&backgroundColor=transparent`,
      },
    });
  }

  static createGuest(id) {
    return new User({
      id: id || `guest-${Date.now()}`,
      pseudo: `Invité-${Math.random().toString(36).slice(2, 8)}`,
      role: "client",
      type: 1,
    });
  }

  static fromRoomUser(roomUser) {
    if (!roomUser) return null;
    return new User({
      id: roomUser.user_id || roomUser.id,
      pseudo: roomUser.pseudo || roomUser.display_name,
      role: roomUser.role, // Sera traité comme realRole
      isOnDuty: roomUser.isOnDuty ?? false,
      joinedAt: roomUser.joined_at,
      zone: roomUser.zone,
      metadata: roomUser.metadata || {},
    });
  }

  // ========================
  // GETTERS (Lecture)
  // ========================

  // Note: id, pseudo, realRole, isOnDuty, zone, metadata are inherited from BaseUser

  get screen() {
    return this._screen;
  }
  get publicLinks() {
    return [...this._publicLinks];
  }
  get isGabrielMode() {
    return this._isGabrielMode;
  }
  get lastSeen() {
    return this._lastSeen;
  }
  get joinedAt() {
    return this._joinedAt;
  }

  // Getters Calculés - OVERRIDES

  get role() {
    // Logique métier: Si on peut prendre le service (barman) et qu'on est en service -> Rôle effectif
    if (this.canTakeService && this._isOnDuty) {
      return this._realRole;
    }
    return "client";
  }

  // Inherited from BaseUser but preserved for explicit logic or checked for diff
  // isAnonymous -> BaseUser logic (type 1 or 2) is compatible.

  get isBarman() {
    return this.role === "barman";
  }

  get place() {
    return this._metadata?.place || this._zone || "";
  }

  // displayName -> Inherited from BaseUser (returns _pseudo)

  get canTakeService() {
    return ["barman", "admin", "super_admin"].includes(this._realRole);
  }

  get isAdmin() {
    return this.role === "admin" || this.role === "super_admin";
  }

  get isStaff() {
    return ["barman", "admin", "moderator", "super_admin"].includes(this.role);
  }

  // avatarUrl -> Inherited from BaseUser
  // initials -> Inherited from BaseUser

  // Badge Logic (Moved from JsxService/UserEntity)
  get statusBadge() {
    if (this._isOnDuty) return { text: "EN SERVICE", color: "green" };
    return { text: "ACTIF", color: "blue" };
  }

  get roleBadge() {
    const badges = {
      super_admin: { text: "SUPER ADMIN", color: "red" },
      admin: { text: "ADMIN", color: "red" },
      barman: { text: "BARMAN", color: "yellow" },
      moderator: { text: "MODÉRATEUR", color: "purple" },
      client: { text: "CLIENT", color: "blue" },
    };
    return badges[this.role] || badges.client;
  }

  // Permissions (previously in computeUserObject)
  get permissions() {
    const effectiveRole = this.role;
    const isStaff = ["barman", "admin", "super_admin"].includes(effectiveRole);
    return {
      moderate: isStaff,
      configure: isStaff,
      broadcast: isStaff,
      canTakeService: this.canTakeService,
    };
  }

  // ========================
  // ACTIONS (Modification & Métier)
  // ========================

  /**
   * Change le pseudo et met à jour le stockage local si nécessaire
   */
  setPseudo(newPseudo) {
    const cleanPseudo = String(newPseudo || "").trim();
    if (cleanPseudo.length < 2) throw new Error("Le pseudo doit contenir au moins 2 caractères");

    this._pseudo = cleanPseudo;

    // Sync localStorage if this is the current user
    if (this._isCurrentUser()) {
      localStorage.setItem("cyrnea_anon_name", this._pseudo);
      localStorage.setItem("inseme_client_pseudo", this._pseudo);

      // Event pour synchroniser les autres composants
      this._emitUpdate("inseme-anonymous-profile-updated", { pseudo: this._pseudo });
    }
    return this;
  }

  /**
   * Change la zone (indoor/outdoor)
   */
  setZone(newZone) {
    this._zone = newZone;
    if (this._isCurrentUser()) {
      localStorage.setItem("inseme_client_zone", newZone);
    }
    return this;
  }

  /**
   * Change l'écran actuel
   */
  setScreen(newScreen) {
    this._screen = newScreen;
    if (this._isCurrentUser()) {
      localStorage.setItem("inseme_client_screen", newScreen);
    }
    return this;
  }

  /**
   * Définit le mode service
   */
  setOnDuty(onDuty) {
    this._isOnDuty = Boolean(onDuty);
    if (this._isCurrentUser()) {
      localStorage.setItem("inseme_on_duty", JSON.stringify(this._isOnDuty));
    }
    return this;
  }

  /**
   * Bascule le mode service (Barman)
   */
  toggleService() {
    if (!this.canTakeService) {
      throw new Error("Vous n'avez pas les droits pour prendre le service.");
    }

    this._isOnDuty = !this._isOnDuty;

    if (this._isCurrentUser()) {
      localStorage.setItem("inseme_on_duty", JSON.stringify(this._isOnDuty));
    }
    return this;
  }

  /**
   * Met à jour le profil avec un objet partiel de manière sécurisée
   */
  updateProfile(updates) {
    if (!updates) return this;

    // Handle names
    if (updates.display_name || updates.pseudo) {
      this.setPseudo(updates.display_name || updates.pseudo);
    }

    // Handle core state with setters (handles persistence)
    if (updates.zone) this.setZone(updates.zone);
    if (updates.screen) this.setScreen(updates.screen);
    if (updates.isOnDuty !== undefined) this.setOnDuty(updates.isOnDuty);
    if (updates.onDuty !== undefined) this.setOnDuty(updates.onDuty);
    if (updates.isGabrielMode !== undefined) this.setGabrielMode(updates.isGabrielMode);

    // Handle internal states
    if (updates.isHandsFree !== undefined) this._isHandsFree = !!updates.isHandsFree;
    if (updates.isSilent !== undefined) this._isSilent = !!updates.isSilent;

    // Handle roles
    if (updates.role || updates.realRole || updates.real_role) {
      this.promoteTo(updates.role || updates.realRole || updates.real_role);
    }

    // Handle metadata merge
    if (updates.metadata) {
      this._metadata = { ...this._metadata, ...updates.metadata };
    }

    // Support for specific metadata fields if passed at root
    const rootMetaFields = ["summary", "color", "avatar_url", "avatarUrl", "place"];
    rootMetaFields.forEach((field) => {
      if (updates[field] !== undefined) {
        this._metadata[field] = updates[field];
      }
    });

    return this;
  }

  setGabrielMode(enabled) {
    this._isGabrielMode = Boolean(enabled);
    if (this._isCurrentUser()) {
      localStorage.setItem("inseme_gabriel_mode", String(this._isGabrielMode));
    }
    return this;
  }

  // ========================
  // VALIDATION
  // ========================

  validate() {
    const errors = [];
    if (!this._id) errors.push("ID utilisateur requis");
    if (!this._pseudo || this._pseudo.length < 2) errors.push("Pseudo requis (min 2 chars)");

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateUserData(userData) {
    // Méthode utilitaire statique pour valider des données brutes
    if (!userData) return { isValid: false, errors: ["Données requises"] };
    // Reuse instance validation
    return new User(userData).validate();
  }

  // ========================
  // UTILITAIRES INTERNES
  // ========================

  /**
   * Vérifie si cette instance correspond à l'utilisateur courant du navigateur
   * (Simplification: On assume que si on manipule localStorage, c'est pour "soi-même")
   * Idéalement, on passerait un flag 'isSelf' au constructeur.
   */
  _isCurrentUser() {
    // Pour l'instant, on suppose TRUE pour les méthodes qui impactent localStorage
    // Dans une future phase, on pourrait être plus stricts.
    return true;
  }

  _emitUpdate(eventName, detail) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(eventName, { detail }));
    }
  }

  // ========================
  // SERIALIZATION
  // ========================

  toJSON() {
    return {
      id: this._id,
      pseudo: this._pseudo,
      role: this.role,
      realRole: this._realRole,
      isOnDuty: this._isOnDuty,
      isGabrielMode: this._isGabrielMode,
      zone: this._zone,
      metadata: this._metadata,
      joinedAt: this._joinedAt,
    };
  }

  clone() {
    // Créer une nouvelle instance avec les mêmes données (pour l'immutabilité React)
    const clone = new User(this.toJSON());
    // Copier les champs privés qui ne sont pas dans toJSON si nécessaire
    clone._publicLinks = [...this._publicLinks];
    return clone;
  }

  // Compatibilité avec l'ancien code "matches"
  matches(searchTerm) {
    if (!searchTerm) return true;
    const term = String(searchTerm).toLowerCase();
    return this._pseudo.toLowerCase().includes(term) || this.role.toLowerCase().includes(term);
  }
  // ========================
  // MÉTHODES DE RÔLES & PERMISSIONS
  // ========================

  hasRole(role) {
    return this.role === role;
  }

  hasAnyRole(roles) {
    return Array.isArray(roles) ? roles.includes(this.role) : this.role === roles;
  }

  hasPermission(permission) {
    const permissions = {
      admin: [
        "configure",
        "manage_users",
        "manage_settings",
        "view_analytics",
        "moderate",
        "broadcast",
      ],
      super_admin: [
        "configure",
        "manage_users",
        "manage_settings",
        "view_analytics",
        "moderate",
        "broadcast",
      ],
      barman: ["take_service", "manage_music", "view_stats", "moderate", "configure", "broadcast"],
      moderator: ["moderate_content", "manage_users", "moderate"],
      client: ["basic_access"],
    };
    return permissions[this.role]?.includes(permission) || false;
  }

  promoteTo(newRole) {
    const validRoles = ["client", "barman", "admin", "moderator"];
    if (validRoles.includes(newRole)) {
      this._realRole = newRole;
      return true;
    }
    return false;
  }

  demoteTo(newRole) {
    return this.promoteTo(newRole);
  }
}
