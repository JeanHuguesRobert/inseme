// ========================================
// BAR ENTITY - Single Source of Truth
// Entity-Service Pattern : Centralized Bar Data Management
// - _slug: Primary identifier (room.slug)
// - _settings: All bar configuration (WiFi, services, zones, links)
// - _displayName: Bar name and description
// - _isOpen: Session state (open/closed)
// - _gamePacks, _barRituals: Entertainment configuration
// - _musicSettings: Audio system configuration
// - _availableServices: Ophelia, Gabriel, etc.
//
// 💬 MESSAGES (Supabase inseme_messages):
// - _messages: Recent messages since bar opened
// - _activeLegends: Currently active legend messages
// - Entity provides filtering methods for different message types

import { getConfig } from "@inseme/cop-host";
//
export class Bar {
  // ===== FACTORY METHODS =====
  /**
   * Créer une instance Bar depuis les métadonnées Supabase (room)
   * @param {Object} roomMetadata - Données brutes de la table rooms
   */
  static fromRoom(roomMetadata) {
    if (!roomMetadata) return null;

    const barData = {
      slug: roomMetadata.slug || roomMetadata.id || "cyrnea",
      displayName:
        roomMetadata.settings?.defaultBarName ||
        roomMetadata.settings?.displayName ||
        roomMetadata.name ||
        roomMetadata.slug ||
        "Cyrnea",
      settings: roomMetadata.settings || {},
      isOpen: roomMetadata.settings?.sessionStatus === "open", // Use sessionStatus if available
      createdAt: roomMetadata.created_at,
      updatedAt: roomMetadata.updated_at,
    };

    return new Bar(barData);
  }

  /**
   * Créer une instance vide/par défaut
   */
  static createDefault() {
    return new Bar({
      slug: "cyrnea",
      displayName: "Cyrnea Bar",
      settings: { zones: [] },
    });
  }

  constructor(data) {
    // 🎯 SOURCE DE VÉRITÉ : slug (Supabase inseme_rooms.slug)
    this._slug = data?.slug || data?.id || "";

    // 🗂️ CONFIGURATION PERSISTÉE (room.metadata)
    this._settings = data?.settings || {};
    this._createdAt = data?.createdAt || new Date();
    this._updatedAt = data?.updatedAt || new Date();

    // 🏷️ DISPLAY NAME (dans settings.metadata)
    this._displayName =
      data?.displayName || data?.settings?.displayName || data?.name || this._slug;

    // 🌙 GESTION DES BARS ÉPHÉMÈRES (Dynamique)
    this._isEphemeral = data?.isEphemeral || data?.isAfter || false; // ✅ UNIFIÉ : isAfter = isEphemeral
    this._parentSlug = data?.parentSlug || null; // Référence au bar principal
    this._proposedBy = data?.proposedBy || null; // Usager créateur
    // 🕐 ÉTAT D'OUVERTURE/FERMETURE (Déclaré par les barmans)
    this._isOpen = data?.isOpen ?? false; // true = ouvert, false = fermé

    // ⚡ ÉTAT DYNAMIQUE (Bus temps réel)
    this._connectedUsers = data?.connectedUsers || [];
    this._vibeScore = data?.vibeScore || 70; // base 70
    this._activeGames = data?.activeGames || [];
    this._activeRituals = data?.activeRituals || [];
    this._semanticWindow = data?.semanticWindow || null;

    // 💬 MESSAGES (Source de vérité : inseme_messages)
    // Tous les messages sont en broadcast via abonnements temps réel
    // On retient seulement les messages depuis l'ouverture du bar (session active)
    // Le reste sert pour les synthèses/blog du bar
    this._messages = data?.messages || []; // Messages depuis l'ouverture du bar
    this._activeLegends = data?.activeLegends || []; // Messages légendes en cours

    // 🎮 SERVICES (Configuration + Dynamique)
    this._gamePacks = data?.gamePacks || [];
    this._barRituals = data?.barRituals || [];
    this._musicSettings = data?.musicSettings || {};
    this._availableServices = data?.availableServices || ["ophelia", "gabriel"];
  }

  // ===== GETTERS DE BASE =====

  get id() {
    return this._slug; // ✅ Alias vers la source de vérité
  }

  get slug() {
    return this._slug; // 🎯 Source de vérité (Supabase)
  }

  get displayName() {
    return (
      this._displayName ||
      this._slug?.replace(/[-_]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) ||
      ""
    );
  }

  // Alias pour compatibilité
  get name() {
    return this._displayName; // ✅ Compatibilité avec l'existant
  }

  get settings() {
    return this._settings;
  }

  // ===== GETTERS COMMUNE =====

  get commune() {
    // Single source of truth: instance configuration
    return getConfig("city_name") || getConfig("community_name") || "";
  }

  get createdAt() {
    return this._createdAt;
  }

  get updatedAt() {
    return this._updatedAt;
  }

  // ===== GETTERS CALCULÉS =====

  get zones() {
    return (
      this._settings?.zones || [
        { id: "indoor", label: "Intérieur" },
        { id: "outdoor", label: "Extérieur" },
        { id: "terrace", label: "Terrasse" },
      ]
    );
  }

  get wifiSSID() {
    return this._settings?.wifi_ssid || "";
  }

  get wifiPassword() {
    return this._settings?.wifi_password || "";
  }

  get facebookUrl() {
    return this._settings?.facebook_url || "";
  }

  get instagramUrl() {
    return this._settings?.instagram_url || "";
  }

  get customLinks() {
    return this._settings?.custom_links || [];
  }

  get barSesame() {
    return this._settings?.bar_sesame || "42";
  }

  // ===== GETTERS BARS ÉPHÉMÈRES =====

  get isEphemeral() {
    return this._isEphemeral; // ✅ UNIFIÉ : isAfter = isEphemeral
  }

  get isAfter() {
    return this._isEphemeral; // ✅ ALIAS pour compatibilité
  }

  get parentSlug() {
    return this._parentSlug; // Référence au bar principal
  }

  get proposedBy() {
    return this._proposedBy; // Usager créateur
  }

  // ===== GETTERS SESSION BAR =====

  get isOpen() {
    return this._isOpen;
  }

  get isClosed() {
    return !this._isOpen;
  }

  get gamePacks() {
    return this._gamePacks || [];
  }

  get barRituals() {
    return this._barRituals || [];
  }

  /**
   * Met à jour la liste des zones disponibles
   * @param {Array} zones - Liste des zones [{id, label}]
   * @returns {boolean} Success
   */
  updateZones(zones) {
    if (!Array.isArray(zones) || zones.length === 0) {
      console.error("At least one zone is required");
      return false;
    }

    // Validate zone structure
    const valid = zones.every((z) => z.id && z.label);
    if (!valid) {
      console.error("Each zone must have an id and label");
      return false;
    }

    this._settings = {
      ...this._settings,
      zones: zones,
    };

    return true;
  }

  get musicSettings() {
    return this._musicSettings || {};
  }

  get availableServices() {
    return this._availableServices || [];
  }

  // Getters calculés de services
  get hasOphelia() {
    return this._availableServices?.includes("ophelia") ?? true;
  }

  get hasGabriel() {
    return this._availableServices?.includes("gabriel") ?? true;
  }

  get availableGames() {
    return this._gamePacks.flatMap((pack) => pack.games || []);
  }

  get availableRituals() {
    return this._barRituals || [];
  }

  get musicEnabled() {
    return this._musicSettings?.enabled || false;
  }

  get musicVolume() {
    return this._musicSettings?.volume || 50;
  }

  get musicPlaylist() {
    return this._musicSettings?.playlist || [];
  }

  // ===== GETTERS MESSAGES =====

  get messages() {
    return this._messages || []; // Messages depuis l'ouverture du bar
  }

  get activeLegends() {
    return this._activeLegends || []; // Messages légendes en cours
  }

  // Getters calculés pour les messages (filtrés par type)
  get chatMessages() {
    return this._messages?.filter((m) => m.type === "chat") || [];
  }

  get legendMessages() {
    return this._messages?.filter((m) => m.type === "legend") || [];
  }

  get tipMessages() {
    return this._messages?.filter((m) => m.type === "tip") || [];
  }

  get broadcastMessages() {
    return this._messages?.filter((m) => m.type === "broadcast") || [];
  }

  get afterProposalMessages() {
    return this._messages?.filter((m) => m.type === "after_proposal") || [];
  }

  // Getters calculés pour les messages
  get messagesCount() {
    return this._messages?.length || 0;
  }

  get recentMessages() {
    return this._messages?.slice(-50) || []; // 50 derniers messages depuis l'ouverture
  }

  get messageTypes() {
    const types = new Set(this._messages?.map((m) => m.type) || []);
    return Array.from(types);
  }

  get lastMessage() {
    return this._messages?.[this._messages.length - 1] || null;
  }

  get messageFrequency() {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    return this._messages.filter((m) => new Date(m.created_at) > oneHourAgo).length;
  }

  // ===== GETTERS PRÉSENCE =====

  get connectedUsers() {
    return this._connectedUsers || [];
  }

  get vibeScore() {
    return this._vibeScore;
  }

  get activeGames() {
    return this._activeGames;
  }

  get activeRituals() {
    return this._activeRituals;
  }

  get semanticWindow() {
    return this._semanticWindow;
  }

  // Getters calculés de présence
  get barmansCount() {
    return this.connectedUsers.filter((u) => u.role === "barman").length;
  }

  get clientsCount() {
    return this.connectedUsers.filter((u) => u.role === "client").length;
  }

  get totalUsersCount() {
    return this.connectedUsers.length;
  }

  get isPopular() {
    return this.connectedUsers.length > 5;
  }

  get isQuiet() {
    return this.connectedUsers.length < 3;
  }

  get vibeLevel() {
    if (this._vibeScore > 80) return "hot";
    if (this._vibeScore > 60) return "lively";
    if (this._vibeScore > 40) return "moderate";
    return "calm";
  }

  get activeGamesCount() {
    return this._activeGames.length;
  }

  get activeRitualsCount() {
    return this._activeRituals.length;
  }

  get groupMood() {
    return this._semanticWindow?.group_mood || "Neutre";
  }

  get themes() {
    return this._semanticWindow?.themes || [];
  }

  get intensity() {
    return this._semanticWindow?.intensity || 0;
  }

  // ===== SETTERS DISPLAY NAME =====

  setDisplayName(displayName) {
    this._displayName = displayName || this._slug;
    this._updatedAt = new Date();
    return this;
  }

  // Alias pour compatibilité
  setName(name) {
    return this.setDisplayName(name);
  }

  // Setter pour le slug (compatibilité avec l'existant)
  setSlug(slug) {
    if (slug) this._slug = slug;
    this._updatedAt = new Date();
    return this;
  }

  setSettings(settings) {
    this._settings = settings;
    this._updatedAt = new Date();
    return this;
  }

  // ===== SETTERS SERVICES =====

  setIsEphemeral(isEphemeral) {
    this._isEphemeral = Boolean(isEphemeral); // ✅ UNIFIÉ : isAfter = isEphémère
    this._updatedAt = new Date();
    return this;
  }

  setIsAfter(isAfter) {
    this._isEphemeral = Boolean(isAfter); // ✅ ALIAS pour compatibilité
    this._updatedAt = new Date();
    return this;
  }

  setParentSlug(parentSlug) {
    this._parentSlug = parentSlug;
    this._updatedAt = new Date();
    return this;
  }

  setProposedBy(proposedBy) {
    this._proposedBy = proposedBy;
    this._updatedAt = new Date();
    return this;
  }

  // ===== SETTERS SESSION BAR =====

  setOpen(isOpen) {
    this._isOpen = Boolean(isOpen);
    this._updatedAt = new Date();
    return this;
  }

  // Méthodes utilitaires pour la gestion de session
  open() {
    this._isOpen = true;
    this._updatedAt = new Date();
    return this;
  }

  close() {
    this._isOpen = false;
    this._updatedAt = new Date();
    return this;
  }

  setGamePacks(gamePacks) {
    this._gamePacks = Array.isArray(gamePacks) ? gamePacks : [];
    this._updatedAt = new Date();
    return this;
  }

  setBarRituals(barRituals) {
    this._barRituals = Array.isArray(barRituals) ? barRituals : [];
    this._updatedAt = new Date();
    return this;
  }

  setMusicSettings(musicSettings) {
    this._musicSettings = musicSettings || {};
    this._updatedAt = new Date();
    return this;
  }

  setAvailableServices(services) {
    this._availableServices = Array.isArray(services) ? services : [];
    this._updatedAt = new Date();
    return this;
  }

  // ===== MÉTHODES BARS ÉPHÉMÈRES =====

  // Créer un bar éphémère (after)
  createAfter(proposedBy, parentSlug = null) {
    this._isEphemeral = true; // ✅ UNIFIÉ : isAfter = isEphémère
    this._parentSlug = parentSlug || this._slug; // Lui-même si pas de parent
    this._proposedBy = proposedBy;
    this._isOpen = true;
    this._updatedAt = new Date();
    return this;
  }

  // Vérifier si c'est un bar éphémère valide
  isValidEphemeral() {
    return this._isEphemeral && this._isAfter && this._proposedBy && this._parentSlug;
  }

  // Obtenir l'URL d'invitation pour un after
  getInvitationUrl() {
    if (!this.isValidEphemeral()) return null;
    const baseUrl = window.location.origin;
    return `${baseUrl}/app?room=${this._slug}`;
  }

  // ===== MÉTHODES DE SERVICES =====

  // Session Management
  startSession() {
    this._isOpen = true;
    this._updatedAt = new Date();
    return this;
  }

  endSession() {
    this._isOpen = false;
    this._updatedAt = new Date();
    return this;
  }

  toggleService(serviceName) {
    if (this._availableServices.includes(serviceName)) {
      this._availableServices = this._availableServices.filter((s) => s !== serviceName);
    } else {
      this._availableServices.push(serviceName);
    }
    this._updatedAt = new Date();
    return this;
  }

  // IA Services
  askOphélia(message) {
    if (!this.hasOphelia) {
      throw new Error("Ophélia service is not available");
    }
    // Logique d'appel à Ophélia
    return this._callIAService("ophelia", message);
  }

  askGabriel(message) {
    if (!this.hasGabriel) {
      throw new Error("Gabriel service is not available");
    }
    // Logique d'appel à Gabriel
    return this._callIAService("gabriel", message);
  }

  _callIAService(service, message) {
    // Implémentation simulée pour l'instant
    return {
      service,
      message,
      response: `Response from ${service} for: ${message}`,
      timestamp: new Date(),
    };
  }

  // Music Management
  enableMusic() {
    this._musicSettings.enabled = true;
    this._updatedAt = new Date();
    return this;
  }

  disableMusic() {
    this._musicSettings.enabled = false;
    this._updatedAt = new Date();
    return this;
  }

  setMusicVolume(volume) {
    this._musicSettings.volume = Math.max(0, Math.min(100, volume));
    this._updatedAt = new Date();
    return this;
  }

  addToPlaylist(track) {
    if (!this._musicSettings.playlist) {
      this._musicSettings.playlist = [];
    }
    this._musicSettings.playlist.push(track);
    this._updatedAt = new Date();
    return this;
  }

  // Game Management
  addGamePack(gamePack) {
    if (!this._gamePacks) this._gamePacks = [];
    this._gamePacks.push(gamePack);
    this._updatedAt = new Date();
    return this;
  }

  removeGamePack(packId) {
    if (!this._gamePacks) return this;
    this._gamePacks = this._gamePacks.filter((pack) => pack.id !== packId);
    this._updatedAt = new Date();
    return this;
  }

  // Ritual Management
  addRitual(ritual) {
    if (!this._barRituals) this._barRituals = [];
    this._barRituals.push(ritual);
    this._updatedAt = new Date();
    return this;
  }

  removeRitual(ritualId) {
    if (!this._barRituals) return this;
    this._barRituals = this._barRituals.filter((ritual) => ritual.id !== ritualId);
    this._updatedAt = new Date();
    return this;
  }

  // ===== SETTERS MESSAGES =====

  updateMessages(messages) {
    this._messages = Array.isArray(messages) ? messages : [];
    this._updatedAt = new Date();
    return this;
  }

  addMessage(message) {
    if (!this._messages) this._messages = [];
    // Avoid duplicates
    if (!this._messages.find((m) => m.id === message.id)) {
      this._messages.push(message);
      this._updatedAt = new Date();
    }
    return this;
  }

  /**
   * Attach a message to the corresponding connected user (if present).
   * If the user is not present, optionally add a lightweight entry so the message
   * can still be associated with an identity in the bar.
   */
  attachMessageToUser(message) {
    if (!message) return this;

    const userId =
      message.user_id ||
      message.metadata?.user_id ||
      message.metadata?.userId ||
      message.metadata?.userIdRaw ||
      null;

    // First try matching on user id
    let user = userId ? this.getUser(userId) : null;

    // Fallback: try matching by name
    if (!user && message.name) {
      user =
        this._connectedUsers?.find((u) => u.name === message.name || u.pseudo === message.name) ||
        null;
    }

    if (!user) {
      // Create a lightweight user entry so messages can be associated
      const newUser = {
        id: userId || `anon:${message.name || "unknown"}`,
        user_id: userId || null,
        name: message.name || message.metadata?.user_name || "Anonyme",
        pseudo: message.metadata?.user_name || message.name || "Anonyme",
        role: "client",
        zone: "indoor",
        status: "online",
        metadata: {},
        messages: [],
        lastSeen: message.created_at || new Date().toISOString(),
      };
      this.addUser(newUser);
      user = newUser;
    }

    // Ensure messages array exists and avoid duplicates
    if (!user.messages) user.messages = [];
    if (!user.messages.find((m) => m.id === message.id)) {
      user.messages.push(message);
    }

    // Update last seen / last message pointers
    user.lastSeen = message.created_at || new Date().toISOString();

    // If this is a status message, set the user's status instead of overriding lastMessage
    if (message.type === "user_status") {
      user.status = {
        text: message.message || (message.metadata && message.metadata.status_text) || "",
        message,
        updatedAt: message.created_at || new Date().toISOString(),
      };
      user.statusText = user.status.text;
    } else {
      user.lastMessage = message;
    }

    this._updatedAt = new Date();
    return this;
  }

  removeMessage(messageId) {
    if (!this._messages) return this;
    this._messages = this._messages.filter((m) => m.id !== messageId);
    this._updatedAt = new Date();
    return this;
  }

  // Gestion des légendes actives
  addLegend(legend) {
    if (!this._activeLegends) this._activeLegends = [];
    this._activeLegends.push(legend);
    this._updatedAt = new Date();
    return this;
  }

  removeLegend(legendId) {
    if (!this._activeLegends) return this;
    this._activeLegends = this._activeLegends.filter((l) => l.id !== legendId);
    this._updatedAt = new Date();
    return this;
  }

  // ===== SETTERS PRÉSENCE =====

  updateConnectedUsers(users) {
    // Normaliser la forme des utilisateurs pour garantir une compatibilité
    if (!Array.isArray(users)) {
      this._connectedUsers = [];
      this._updatedAt = new Date();
      return this;
    }

    this._connectedUsers = users.map((u) => {
      // Accept multiple shapes: {user_id}, {id}, {userId}
      const id = u.user_id || u.id || u.userId || u.uid || null;
      const name = u.name || u.pseudo || u.display_name || "";
      const role = u.role || "client";
      const zone = u.zone || u.zone_id || "indoor";

      // Preserve any existing messages array if present
      const existing = this.getUser(id);
      return {
        id,
        user_id: id,
        name,
        pseudo: name,
        role,
        zone,
        status: u.status || (u.online ? "online" : "offline"),
        public_links: u.public_links || u.publicLinks || [],
        metadata: u.metadata || {},
        messages: existing?.messages || [],
        lastSeen: u.lastSeen || u.last_seen || u.lastSeenAt || null,
        is_ai: !!u.is_ai || !!u.isAI,
      };
    });

    this._updatedAt = new Date();
    return this;
  }

  updateVibeScore(score) {
    this._vibeScore = Math.max(0, Math.min(100, score));
    this._updatedAt = new Date();
    return this;
  }

  setActiveGames(games) {
    this._activeGames = Array.isArray(games) ? games : [];
    this._updatedAt = new Date();
    return this;
  }

  setActiveRituals(rituals) {
    this._activeRituals = Array.isArray(rituals) ? rituals : [];
    this._updatedAt = new Date();
    return this;
  }

  updateSemanticWindow(semanticWindow) {
    this._semanticWindow = semanticWindow;
    this._updatedAt = new Date();
    return this;
  }

  // ===== SETTERS DE COLLECTION =====

  addUser(user) {
    if (!this._connectedUsers) this._connectedUsers = [];

    // Vérifier si l'utilisateur n'est pas déjà présent
    const existingIndex = this._connectedUsers.findIndex((u) => u.id === user.id);
    if (existingIndex === -1) {
      this._connectedUsers.push(user);
    } else {
      this._connectedUsers[existingIndex] = user;
    }

    this._updatedAt = new Date();
    return this;
  }

  removeUser(userId) {
    if (!this._connectedUsers) return this;

    this._connectedUsers = this._connectedUsers.filter((u) => u.id !== userId);
    this._updatedAt = new Date();
    return this;
  }

  updateUser(userId, updates) {
    if (!this._connectedUsers) return this;

    const userIndex = this._connectedUsers.findIndex((u) => u.id === userId);
    if (userIndex !== -1) {
      this._connectedUsers[userIndex] = { ...this._connectedUsers[userIndex], ...updates };
      this._updatedAt = new Date();
    }

    return this;
  }

  addActiveGame(game) {
    if (!this._activeGames) this._activeGames = [];

    // Vérifier si le jeu n'est pas déjà actif
    const existingIndex = this._activeGames.findIndex((g) => g.id === game.id);
    if (existingIndex === -1) {
      this._activeGames.push(game);
    } else {
      this._activeGames[existingIndex] = game;
    }

    this._updatedAt = new Date();
    return this;
  }

  removeActiveGame(gameId) {
    if (!this._activeGames) return this;

    this._activeGames = this._activeGames.filter((g) => g.id !== gameId);
    this._updatedAt = new Date();
    return this;
  }

  addActiveRitual(ritual) {
    if (!this._activeRituals) this._activeRituals = [];

    // Ajouter le rituel avec timestamp
    const ritualWithTimestamp = {
      ...ritual,
      timestamp: new Date(),
    };

    this._activeRituals.push(ritualWithTimestamp);
    this._updatedAt = new Date();
    return this;
  }

  removeActiveRitual(ritualId) {
    if (!this._activeRituals) return this;

    this._activeRituals = this._activeRituals.filter((r) => r.id !== ritualId);
    this._updatedAt = new Date();
    return this;
  }

  updateSettings(newSettings) {
    this._settings = { ...this._settings, ...newSettings };
    this._updatedAt = new Date();
    return this;
  }

  // ===== UTILITAIRES =====

  toJSON() {
    return {
      id: this._slug, // ✅ Alias vers la source de vérité
      slug: this._slug,
      displayName: this._displayName, // 🏷️ Display name (settings.metadata)
      settings: this._settings,
      zones: this.zones, // 🏠 Zones du bar
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,

      // Bars éphémères
      isEphemeral: this._isEphemeral, // ✅ UNIFIÉ : isAfter = isEphémère
      isAfter: this._isEphemeral, // ✅ ALIAS pour compatibilité
      parentSlug: this._parentSlug,
      proposedBy: this._proposedBy,
      isOpen: this._isOpen,
      isClosed: this.isClosed,
      activeGames: this._activeGames,
      activeRituals: this._activeRituals,
      semanticWindow: this._semanticWindow,
      messages: this._messages, // Messages depuis l'ouverture du bar
      activeLegends: this._activeLegends, // Messages légendes en cours
      gamePacks: this._gamePacks,
      barRituals: this._barRituals,
      musicSettings: this._musicSettings,
      availableServices: this._availableServices,
    };
  }

  clone() {
    return new Bar(this.toJSON());
  }

  // ===== VALIDATION SIMPLE =====

  validate() {
    const errors = [];

    if (!this._slug) errors.push("Slug is required"); // ✅ Source de vérité
    if (!this._displayName) errors.push("Display name is required"); // 🏷️ Display name

    if (!Array.isArray(this._connectedUsers)) {
      errors.push("connectedUsers doit être un tableau");
    }

    if (typeof this._vibeScore !== "number" || this._vibeScore < 0 || this._vibeScore > 100) {
      errors.push("vibeScore doit être entre 0 et 100");
    }

    // Validation des messages
    if (!Array.isArray(this._messages)) {
      errors.push("messages doit être un tableau");
    }

    // Validation des messages (source de vérité : inseme_messages)
    this._messages?.forEach((msg, index) => {
      if (!msg.id) errors.push(`Message ${index}: id requis`);
      if (!msg.type) errors.push(`Message ${index}: type requis`);
      if (!msg.created_at) errors.push(`Message ${index}: created_at requis`);
      if (!msg.room_id) errors.push(`Message ${index}: room_id requis`);
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // ===== MÉTHODES D'AFFICHAGE =====

  toString() {
    return `Bar(${this._name} - ${this.commune})`;
  }

  // ===== MÉTHODES DE RECHERCHE MESSAGES =====

  getMessage(messageId) {
    return this._messages?.find((m) => m.id === messageId) || null;
  }

  getMessagesByType(type) {
    return this._messages?.filter((m) => m.type === type) || [];
  }

  getMessagesByUser(userId) {
    return this._messages?.filter((m) => m.user_id === userId) || [];
  }

  getMessagesInPeriod(start, end) {
    return (
      this._messages?.filter((m) => {
        const msgDate = new Date(m.created_at);
        return msgDate >= start && msgDate <= end;
      }) || []
    );
  }

  getActiveGames() {
    return this.getMessagesByType("game_start").filter((m) => m.metadata?.status === "active");
  }

  getActiveRituals() {
    const now = Date.now();
    return this.getMessagesByType("ritual_trigger").filter(
      (m) => now - new Date(m.created_at) < 60000 * 5 // 5 minutes
    );
  }

  getLegendMessages() {
    return this.getMessagesByType("legend_add");
  }

  getAfterProposals() {
    return this.getMessagesByType("after_proposal");
  }

  getTipDeclarations() {
    return this.getMessagesByType("tip_declaration");
  }

  getVisualSignals() {
    return this.getMessagesByType("visual_signal");
  }

  // ===== MÉTHODES DE GESTION MESSAGES =====

  clearMessages() {
    this._messages = [];
    this._updatedAt = new Date();
    return this;
  }

  // Archiver les messages de la session (pour blog/synthèses)
  // Les messages archivés restent dans inseme_messages mais plus dans le bar actif
  archiveSessionMessages() {
    // Plus besoin de _messageHistory : tout reste dans inseme_messages
    // On vide juste les messages actifs du bar
    this._messages = [];
    this._updatedAt = new Date();
    return this;
  }

  // ===== MÉTHODES DE RECHERCHE PRÉSENCE =====

  hasUser(userId) {
    return this._connectedUsers?.some((u) => u.id === userId) || false;
  }

  getUser(userId) {
    return this._connectedUsers?.find((u) => u.id === userId) || null;
  }

  getUsersByRole(role) {
    return this._connectedUsers?.filter((u) => u.role === role) || [];
  }

  getBarmans() {
    return this.getUsersByRole("barman");
  }

  getClients() {
    return this.getUsersByRole("client");
  }

  hasActiveGame(gameId) {
    return this._activeGames?.some((g) => g.id === gameId) || false;
  }

  getActiveGame(gameId) {
    return this._activeGames?.find((g) => g.id === gameId) || null;
  }

  hasActiveRitual(ritualId) {
    return this._activeRituals?.some((r) => r.id === ritualId) || false;
  }

  getActiveRitual(ritualId) {
    return this._activeRituals?.find((r) => r.id === ritualId) || null;
  }

  // ===== MÉTHODES DE GESTION =====

  clearUsers() {
    this._connectedUsers = [];
    this._updatedAt = new Date();
    return this;
  }

  clearActiveGames() {
    this._activeGames = [];
    this._updatedAt = new Date();
    return this;
  }

  clearActiveRituals() {
    this._activeRituals = [];
    this._updatedAt = new Date();
    return this;
  }

  activate() {
    this._status = "active";
    this._updatedAt = new Date();
    return this;
  }

  deactivate() {
    this._status = "inactive";
    this._updatedAt = new Date();
    return this;
  }
}
