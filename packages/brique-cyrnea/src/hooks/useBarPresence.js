// ========================================
// HOOK - BAR PRESENCE
// Hook unifié pour toutes les données du bar incluant la présence
// ========================================

import { useMemo, useEffect, useCallback } from "react";
import { Bar } from "../entities/Bar.js";

export const useBarPresence = (roomMetadata, roomData, messages, semanticWindow) => {
  // Créer l'entité Bar une seule fois
  const bar = useMemo(() => new Bar(), []);

  // Synchronisation avec les données de base du bar
  useEffect(() => {
    if (roomMetadata) {
      bar.setName(roomMetadata.name || "");
      bar.setSlug(roomMetadata.slug || "");
      bar.setSettings(roomMetadata.settings || {});

      // Ensure the virtual AI user (Ophélia) exists in the bar if the service is enabled
      try {
        if (bar.hasOphelia && !bar.hasUser("ophélia")) {
          bar.addUser({
            id: "ophélia",
            user_id: "ophélia",
            name: "Ophélia",
            pseudo: "Ophélia",
            role: "ai",
            zone: "indoor",
            status: "online",
            metadata: { is_ai: true },
            messages: [],
          });
        }
      } catch (_e) {
        // ignore if bar is not ready
      }
    }
  }, [roomMetadata, bar]);

  // Synchronisation avec les données de présence
  useEffect(() => {
    if (roomData?.connectedUsers) {
      bar.updateConnectedUsers(roomData.connectedUsers);
    }
  }, [roomData?.connectedUsers, bar]);

  // Calcul du score de vibe
  useEffect(() => {
    if (roomData?.results) {
      const votes = roomData.results;
      const positive = votes["vibe:up"] || 0;
      const negative = votes["vibe:down"] || 0;
      const score = 70 + positive * 5 - negative * 5;
      bar.updateVibeScore(Math.max(0, Math.min(100, score)));
    }
  }, [roomData?.results, bar]);

  // Synchronisation avec les messages (jeux, rituels, et messages par utilisateur)
  useEffect(() => {
    if (!messages) return;

    // Games actifs
    const activeGames = messages?.filter(
      (msg) => msg.type === "game_start" && msg.metadata?.status === "active"
    );
    bar.setActiveGames(activeGames);

    // Rituels actifs (derniers 5 minutes)
    const activeRituals = messages?.filter(
      (msg) => msg.type === "ritual_trigger" && new Date() - new Date(msg.created_at) < 60000 * 5 // 5 minutes
    );
    bar.setActiveRituals(activeRituals);

    // Ajouter les messages récents à l'entité Bar et associer au(x) utilisateur(s)
    for (const msg of messages) {
      const existing = bar.getMessage(msg.id);
      if (!existing) {
        bar.addMessage(msg);
        // Attach to user if possible
        bar.attachMessageToUser(msg);
      }
    }
  }, [messages, bar]);

  // Synchronisation avec les données sémantiques
  useEffect(() => {
    if (semanticWindow) {
      bar.updateSemanticWindow(semanticWindow);
    }
  }, [semanticWindow, bar]);

  // Actions de présence
  const addUser = useCallback(
    (user) => {
      bar.addUser(user);
      return bar;
    },
    [bar]
  );

  const removeUser = useCallback(
    (userId) => {
      bar.removeUser(userId);
      return bar;
    },
    [bar]
  );

  const updateUser = useCallback(
    (userId, updates) => {
      bar.updateUser(userId, updates);
      return bar;
    },
    [bar]
  );

  const addActiveGame = useCallback(
    (game) => {
      bar.addActiveGame(game);
      return bar;
    },
    [bar]
  );

  const removeActiveGame = useCallback(
    (gameId) => {
      bar.removeActiveGame(gameId);
      return bar;
    },
    [bar]
  );

  const addActiveRitual = useCallback(
    (ritual) => {
      bar.addActiveRitual(ritual);
      return bar;
    },
    [bar]
  );

  const removeActiveRitual = useCallback(
    (ritualId) => {
      bar.removeActiveRitual(ritualId);
      return bar;
    },
    [bar]
  );

  const updateVibeScore = useCallback(
    (score) => {
      bar.updateVibeScore(score);
      return bar;
    },
    [bar]
  );

  const updateSemanticWindow = useCallback(
    (semanticWindow) => {
      bar.updateSemanticWindow(semanticWindow);
      return bar;
    },
    [bar]
  );

  return {
    // Getters de l'entité Bar de base
    id: bar.id,
    slug: bar.slug,
    name: bar.name,
    settings: bar.settings,
    zones: bar.zones, // 🏠 Zones du bar
    wifiSSID: bar.wifiSSID,
    wifiPassword: bar.wifiPassword,
    facebookUrl: bar.facebookUrl,
    instagramUrl: bar.instagramUrl,
    customLinks: bar.customLinks,
    barSesame: bar.barSesame,

    // Getters de présence
    connectedUsers: bar.connectedUsers,
    vibeScore: bar.vibeScore,
    activeGames: bar.activeGames,
    activeRituals: bar.activeRituals,
    semanticWindow: bar.semanticWindow,

    // Getters calculés de présence
    barmansCount: bar.barmansCount,
    clientsCount: bar.clientsCount,
    totalUsersCount: bar.totalUsersCount,
    isPopular: bar.isPopular,
    isQuiet: bar.isQuiet,
    vibeLevel: bar.vibeLevel,
    activeGamesCount: bar.activeGamesCount,
    activeRitualsCount: bar.activeRitualsCount,
    groupMood: bar.groupMood,
    themes: bar.themes,
    intensity: bar.intensity,

    // Méthodes de recherche
    hasUser: bar.hasUser.bind(bar),
    getUser: bar.getUser.bind(bar),
    getUsersByRole: bar.getUsersByRole.bind(bar),
    getBarmans: bar.getBarmans.bind(bar),
    getClients: bar.getClients.bind(bar),
    hasActiveGame: bar.hasActiveGame.bind(bar),
    getActiveGame: bar.getActiveGame.bind(bar),
    hasActiveRitual: bar.hasActiveRitual.bind(bar),
    getActiveRitual: bar.getActiveRitual.bind(bar),

    // Actions de présence
    addUser,
    removeUser,
    updateUser,
    addActiveGame,
    removeActiveGame,
    addActiveRitual,
    removeActiveRitual,
    updateVibeScore,
    updateSemanticWindow,

    // Actions de gestion
    clearUsers: useCallback(() => bar.clearUsers(), [bar]),
    clearActiveGames: useCallback(() => bar.clearActiveGames(), [bar]),
    clearActiveRituals: useCallback(() => bar.clearActiveRituals(), [bar]),
    activate: useCallback(() => bar.activate(), [bar]),
    deactivate: useCallback(() => bar.deactivate(), [bar]),

    // Validation
    validate: useCallback(() => bar.validate(), [bar]),

    // Utilitaires
    toJSON: useCallback(() => bar.toJSON(), [bar]),
    clone: useCallback(() => bar.clone(), [bar]),
    toString: useCallback(() => bar.toString(), [bar]),
  };
};
