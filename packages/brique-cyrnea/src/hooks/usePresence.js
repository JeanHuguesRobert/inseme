// packages/brique-cyrnea/hooks/usePresence.js

import { useEffect, useMemo } from "react";
import { TheUser, TheBar } from "../singletons/index.js";

import { useHybridPresence } from "./useHybridPresence.js";
import { normalizePublicLink } from "../utils/uiUtils";
import { useAppContext } from "../contexts/AppContext";

export function usePresence(currentUser, roomMetadata) {
  const { state, actions } = useAppContext();

  // Accès direct au singleton User
  const pseudo = TheUser.pseudo || currentUser?.pseudo || "";
  // Stable id selection: try global TheUser, currentUser, or anonymous storage fallback
  const anonFallback =
    typeof window !== "undefined"
      ? localStorage.getItem("cyrnea_anon_id") || localStorage.getItem("inseme_client_id")
      : null;
  const userId = TheUser?.id || currentUser?.user_id || currentUser?.id || anonFallback;

  // Hook hybride pour gérer les données de présence
  const { persistPresence: persistHybridPresence, presenceHistory: connectedUsers } =
    useHybridPresence(roomMetadata?.id, userId || currentUser?.user_id);

  // Client URL pour invitations
  const clientUrl = useMemo(() => {
    const roomSettings = roomMetadata?.settings;

    // Priorité 1: Tunnel URL (ngrok/cloudflare) - Requis par l'utilisateur
    if (roomSettings?.tunnel_url) return roomSettings.tunnel_url;

    // Priorité 2: IP locale injectée par le script tunnel (Fallback WiFi)
    if (roomSettings?.local_ip && roomSettings.local_ip !== "localhost") {
      return `http://${roomSettings.local_ip}:${window.location.port || 8888}`;
    }

    // Priorité 3: L'origine actuelle
    const origin = window.location.origin;
    if (origin.includes("localhost") && roomSettings?.local_ip) {
      return origin.replace("localhost", roomSettings.local_ip);
    }

    return origin;
  }, [roomMetadata?.settings]);

  // Normalisation des liens publics
  const normalizedPublicLinks = useMemo(() => {
    return (state.publicLinks || []).map(normalizePublicLink);
  }, [state.publicLinks]);

  // Synchronisation de la présence avec le hook hybride
  useEffect(() => {
    const userId = TheUser.id || currentUser?.user_id;
    const pseudo = TheUser.pseudo || currentUser?.pseudo;
    if (userId) {
      persistHybridPresence("update", {
        pseudo: pseudo,
        role: currentUser?.role,
        zone: state.zone,
        public_links: normalizedPublicLinks,
        metadata: currentUser.metadata,
      });
    }
  }, [currentUser, state.zone, state.publicLinks, persistHybridPresence, normalizedPublicLinks]);

  // SYNC: Mise à jour du singleton TheBar avec les utilisateurs connectés
  useEffect(() => {
    if (connectedUsers) {
      TheBar.updateConnectedUsers(connectedUsers);
    }
  }, [connectedUsers]);

  // Actions de présence
  const handleZoneChange = (newZone) => {
    actions.setZone(newZone);
  };

  const handlePublicLinksChange = (newLinks) => {
    actions.setPublicLinks(newLinks);
  };

  // Gestion des événements broadcast (temporisation)
  useEffect(() => {
    if (state.broadcastEvent) {
      const timer = setTimeout(() => {
        actions.setBroadcastEvent(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [state.broadcastEvent, actions]);

  // Gestion du succès des pourboires (temporisation)
  useEffect(() => {
    if (state.showTipSuccess) {
      const timer = setTimeout(() => {
        actions.setTipSuccess(false);
        actions.setTipSuccessData(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [state.showTipSuccess, actions]);

  return {
    // État présence
    connectedUsers,
    clientUrl,
    normalizedPublicLinks,

    // État app (inclure publicLinks)
    zone: state.zone,
    publicLinks: state.publicLinks || [],
    invitedBy: state.invitedBy,
    broadcastEvent: state.broadcastEvent,
    showTipSuccess: state.showTipSuccess,
    tipSuccessData: state.tipSuccessData,

    // Actions
    setZone: actions.setZone,
    setPublicLinks: actions.setPublicLinks,
    setInvitedBy: actions.setInvitedBy,
    setBroadcastEvent: actions.setBroadcastEvent,
    setTipSuccess: actions.setTipSuccess,
    setTipSuccessData: actions.setTipSuccessData,

    // Persistence action
    persistPresence: persistHybridPresence,

    // Handlers
    handleZoneChange,
    handlePublicLinksChange,
  };
}
