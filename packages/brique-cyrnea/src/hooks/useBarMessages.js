// ========================================
// HOOK - BAR MESSAGES
// Hook unifié pour toutes les données du bar incluant les messages
// ========================================

import { useMemo, useEffect, useCallback } from "react";
import { Bar } from "../entities/Bar.js";

export const useBarMessages = (roomMetadata, messages, semanticWindow) => {
  // Créer l'entité Bar une seule fois
  const bar = useMemo(() => new Bar(), []);

  // Synchronisation avec les données de base du bar
  useEffect(() => {
    if (roomMetadata) {
      bar.setName(roomMetadata.name || "");
      bar.setSlug(roomMetadata.slug || "");
      bar.setLocation(roomMetadata.location || {});
      bar.setSettings(roomMetadata.settings || "");
    }
  }, [roomMetadata, bar]);

  // Synchronisation avec les messages
  useEffect(() => {
    if (messages) {
      bar.updateMessages(messages);

      // Extraire les légendes des messages
      const legends = messages
        .filter((msg) => msg.type === "legend_add")
        .map((msg) => ({ ...msg.metadata, barName: bar.name }));
      bar._activeLegends = legends;
    }
  }, [messages, bar]);

  // Synchronisation avec les données sémantiques
  useEffect(() => {
    if (semanticWindow) {
      bar.updateSemanticWindow(semanticWindow);
    }
  }, [semanticWindow, bar]);

  // Actions de messages
  const addMessage = useCallback(
    (message) => {
      bar.addMessage(message);
      return bar;
    },
    [bar]
  );

  const removeMessage = useCallback(
    (messageId) => {
      bar.removeMessage(messageId);
      return bar;
    },
    [bar]
  );

  const addLegend = useCallback(
    (legend) => {
      bar.addLegend(legend);
      return bar;
    },
    [bar]
  );

  const addBroadcastEvent = useCallback(
    (event) => {
      bar.addBroadcastEvent(event);
      return bar;
    },
    [bar]
  );

  return {
    // Getters de base du bar
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

    // Getters de messages
    messages: bar.messages,
    activeLegends: bar.activeLegends,
    // Getters typés (remplacement de broadcastEvents)
    chatMessages: bar.chatMessages,
    tipMessages: bar.tipMessages,
    broadcastMessages: bar.broadcastMessages,
    afterProposalMessages: bar.afterProposalMessages,

    // Getters calculés de messages
    messagesCount: bar.messagesCount,
    recentMessages: bar.recentMessages,
    messageTypes: bar.messageTypes,
    hasActiveLegends: bar.hasActiveLegends,
    lastMessage: bar.lastMessage,
    messageFrequency: bar.messageFrequency,

    // Getters calculés (compatibilité avec l'existant)
    activeGamesFromMessages: bar.getActiveGames(),
    activeRitualsFromMessages: bar.getActiveRituals(),
    legendMessages: bar.getLegendMessages(),
    afterProposals: bar.getAfterProposals(),
    tipDeclarations: bar.getTipDeclarations(),
    visualSignals: bar.getVisualSignals(),

    // Getters de présence (compatibilité)
    connectedUsers: bar.connectedUsers,
    vibeScore: bar.vibeScore,
    activeGames: bar.activeGames,
    activeRituals: bar.activeRituals,
    semanticWindow: bar.semanticWindow,
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
    getMessage: bar.getMessage.bind(bar),
    getMessagesByType: bar.getMessagesByType.bind(bar),
    getMessagesByUser: bar.getMessagesByUser.bind(bar),
    getMessagesInPeriod: bar.getMessagesInPeriod.bind(bar),

    // Méthodes de recherche de présence
    hasUser: bar.hasUser.bind(bar),
    getUser: bar.getUser.bind(bar),
    getUsersByRole: bar.getUsersByRole.bind(bar),
    getBarmans: bar.getBarmans.bind(bar),
    getClients: bar.getClients.bind(bar),
    hasActiveGame: bar.hasActiveGame.bind(bar),
    getActiveGame: bar.getActiveGame.bind(bar),
    hasActiveRitual: bar.hasActiveRitual.bind(bar),
    getActiveRitual: bar.getActiveRitual.bind(bar),

    // Actions de messages
    addMessage,
    removeMessage,
    addLegend,
    addBroadcastEvent,

    // Actions de présence
    addUser: useCallback(
      (user) => {
        bar.addUser(user);
        return bar;
      },
      [bar]
    ),
    removeUser: useCallback(
      (userId) => {
        bar.removeUser(userId);
        return bar;
      },
      [bar]
    ),
    updateUser: useCallback(
      (userId, updates) => {
        bar.updateUser(userId, updates);
        return bar;
      },
      [bar]
    ),
    addActiveGame: useCallback(
      (game) => {
        bar.addActiveGame(game);
        return bar;
      },
      [bar]
    ),
    removeActiveGame: useCallback(
      (gameId) => {
        bar.removeActiveGame(gameId);
        return bar;
      },
      [bar]
    ),
    addActiveRitual: useCallback(
      (ritual) => {
        bar.addActiveRitual(ritual);
        return bar;
      },
      [bar]
    ),
    removeActiveRitual: useCallback(
      (ritualId) => {
        bar.removeActiveRitual(ritualId);
        return bar;
      },
      [bar]
    ),
    updateVibeScore: useCallback(
      (score) => {
        bar.updateVibeScore(score);
        return bar;
      },
      [bar]
    ),
    updateSemanticWindow: useCallback(
      (semanticWindow) => {
        bar.updateSemanticWindow(semanticWindow);
        return bar;
      },
      [bar]
    ),

    // Actions de gestion
    clearUsers: useCallback(() => bar.clearUsers(), [bar]),
    clearActiveGames: useCallback(() => bar.clearActiveGames(), [bar]),
    clearActiveRituals: useCallback(() => bar.clearActiveRituals(), [bar]),
    clearMessages: useCallback(() => bar.clearMessages(), [bar]),
    archiveMessages: useCallback(() => bar.archiveMessages(), [bar]),
    activate: useCallback(() => bar.activate(), [bar]),
    deactivate: useCallback(() => bar.deactivate(), [bar]),

    // Validation
    validate: useCallback(() => bar.validate(), [bar]),
    validateMessages: useCallback(() => bar.validateMessages(), [bar]),

    // Utilitaires
    toJSON: useCallback(() => bar.toJSON(), [bar]),
    clone: useCallback(() => bar.clone(), [bar]),
    toString: useCallback(() => bar.toString(), [bar]),
  };
};
