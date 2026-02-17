import { isAnonymousUserId, isValidSupabaseUserId } from "../lib/userUtils.js";

/**
 * ENTITÉ USER - CENTRALIZED RICH DOMAIN MODEL
 *
 * Unified User entity for all Inseme applications (Platform, Cyrnea, Room).
 * Handles the 3 types of users:
 * 1. LOCAL VISITOR (Type 1): Purely local, no Supabase.
 * 2. GUEST USER (Type 2): Supabase Anonymous.
 * 3. AUTHENTICATED USER (Type 3): Supabase Authenticated (Email/Social).
 */
export class User {
  constructor(userData = {}) {
    this._id = userData.id || userData.user_id || "";
    this._pseudo = userData.pseudo || userData.display_name || userData.full_name || "Anonyme";

    // Metadata & Roles
    this._metadata = userData.metadata || userData.user_metadata || {};
    this._role = userData.role || this._metadata.role || "client"; // Effective role
    this._realRole = userData.realRole || userData.real_role || this._role; // Underlying role (e.g. for barman toggling)

    // Status
    this._isOnDuty = userData.isOnDuty || userData.is_on_duty || false;
    this._zone = userData.zone || this._metadata.place || "indoor";

    // Explicit Type override or auto-detection
    this._type = userData.type || this._detectType();

    this._email = userData.email || "";
  }

  /**
   * Detects the user type based on ID and properties
   */
  _detectType() {
    if (!this._id) return 1; // No ID -> Type 1 (Transient)

    // Check if explicitly marked as anonymous
    const isAnon =
      this._metadata.is_anonymous ||
      this._metadata.isAnonymous ||
      String(this._id).startsWith("anon_");

    if (isAnon) {
      // If it has a valid Supabase UUID but is anonymous -> Type 2
      // If it has a local random ID or "anon_" -> Type 1
      return isValidSupabaseUserId(this._id) ? 2 : 1;
    }

    // Default to Type 3 (Authenticated)
    return 3;
  }

  // ========================
  // GETTERS
  // ========================

  get id() {
    return this._id;
  }
  get email() {
    return this._email;
  }
  get pseudo() {
    return this._pseudo;
  }
  get displayName() {
    return this._pseudo;
  }
  get type() {
    return this._type;
  }

  get isType1() {
    return this._type === 1;
  }
  get isType2() {
    return this._type === 2;
  }
  get isType3() {
    return this._type === 3;
  }

  get isAnonymous() {
    return this._type === 1 || this._type === 2;
  }
  get isAuthenticated() {
    return this._type === 3;
  }

  get role() {
    return this._role;
  }
  get realRole() {
    return this._realRole;
  }
  get isOnDuty() {
    return this._isOnDuty;
  }
  get zone() {
    return this._zone;
  }
  get metadata() {
    return this._metadata;
  }
  get user_metadata() {
    return this._metadata;
  } // Alias for Supabase compatibility
  get app_metadata() {
    return {};
  } // Placeholder for Supabase compatibility

  // Compatibility aliases for useInseme / Legacy code
  get name() {
    return this._pseudo;
  }
  get avatar_url() {
    return this.avatarUrl;
  }
  get summary() {
    return this._metadata.summary || (this.isAnonymous ? "Visiteur" : "Membre");
  }
  get color() {
    return this._metadata.color || "#000000";
  }

  get avatarUrl() {
    return (
      this._metadata.avatarUrl ||
      this._metadata.avatar_url ||
      `https://api.dicebear.com/7.x/notionists/svg?seed=${this._id}&backgroundColor=transparent`
    );
  }

  get initials() {
    const name = this._pseudo || "?";
    return name.slice(0, 2).toUpperCase();
  }

  // ========================
  // FACTORIES
  // ========================

  /**
   * Creates a Type 1 Local Visitor
   */
  static createLocal(id, pseudo) {
    return new User({
      id: id || crypto.randomUUID(),
      pseudo: pseudo || "Anonyme",
      type: 1,
      metadata: { is_anonymous: true },
    });
  }

  /**
   * Creates from a Supabase User object (Type 2 or 3)
   */
  static fromSupabase(sbUser) {
    if (!sbUser) return null;
    return new User({
      id: sbUser.id,
      email: sbUser.email,
      pseudo: sbUser.user_metadata?.full_name || sbUser.email?.split("@")[0] || "Utilisateur",
      metadata: sbUser.user_metadata || {},
      role: sbUser.role === "anon" ? "client" : sbUser.app_metadata?.role || "client",
      type: sbUser.is_anonymous ? 2 : 3,
    });
  }
}
