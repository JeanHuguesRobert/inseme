import { useState, useEffect, useCallback } from "react";
import { useSupabase } from "./useSupabase.js";

/**
 * Hook hybride qui combine le système Realtime existant
 * avec la persistance via inseme_messages
 */
export const useHybridPresence = (roomId, userId, _currentPresenceMetadata = {}) => {
  const supabase = useSupabase();
  const [presenceHistory, setPresenceHistory] = useState(new Map());
  const [lastSync, setLastSync] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // 1. "Persister" (qui devient un broadcast volatile uniquement)
  const persistPresence = useCallback(
    async (type, data) => {
      if (!roomId) return false;

      console.debug("[Presence Debug] Persisting presence:", { type, data, roomId, userId });

      try {
        // Insert a lightweight presence message into inseme_messages so history can be rebuilt
        const payload = {
          room_id: roomId,
          user_id: userId || null,
          name: data?.pseudo || data?.name || "Visiteur",
          message: data?.heartbeat ? "heartbeat" : `presence:${type}`,
          type: "presence",
          metadata: {
            presence: true,
            presence_type: type,
            presence_data: data || {},
          },
        };

        const { data: insertData, error } = await supabase
          .from("inseme_messages")
          .insert(payload)
          .select()
          .limit(1);
        if (error) {
          console.warn("[Presence] Failed to insert presence message:", error.message || error);
        }

        // Update local presence history map immediately for responsiveness
        setPresenceHistory((prev) => {
          const next = new Map(prev);
          if (type === "leave") {
            next.delete(userId);
          } else {
            // Update with provided data and timestamp
            const entry = {
              ...data,
              lastSeen:
                (insertData && insertData[0] && insertData[0].created_at) ||
                new Date().toISOString(),
              messageId: insertData && insertData[0] && insertData[0].id,
              userId: userId || data?.userId || null,
            };
            next.set(userId, entry);
          }
          return next;
        });

        return true;
      } catch (err) {
        console.error("Error persisting presence:", err);
        return false;
      }
    },
    [supabase, roomId, userId]
  );

  // 2. Charger l'historique des présences
  const loadPresenceHistory = useCallback(async () => {
    if (!roomId) return;

    try {
      const { data, error } = await supabase
        .from("inseme_messages")
        .select("*")
        .eq("room_id", roomId)
        .eq("metadata->>presence", "true")
        .order("created_at", { ascending: false })
        .limit(500); // Limite raisonnable

      if (error) throw error;

      // Traiter pour obtenir la dernière présence par utilisateur
      const latestPresences = new Map();

      for (const message of data) {
        const metadata = message.metadata || {};
        if (!metadata.presence) continue;

        const userId = message.user_id;
        const presenceType = metadata.presence_type;
        const presenceData = metadata.presence_data || {};

        if (presenceType === "leave") {
          latestPresences.delete(userId);
        } else {
          const existing = latestPresences.get(userId);
          if (!existing || message.created_at > existing.lastSeen) {
            latestPresences.set(userId, {
              ...presenceData,
              lastSeen: message.created_at,
              messageId: message.id,
              userId: userId,
            });
          }
        }
      }

      setPresenceHistory(latestPresences);
      setLastSync(new Date());
      return latestPresences;
    } catch (error) {
      console.error("Error loading presence history:", error);
      return new Map();
    }
  }, [supabase, roomId]);

  // 3. Synchroniser avec le système Realtime existant
  const syncWithRealtime = useCallback(
    (realtimeData) => {
      if (!realtimeData) return;

      // Enrichir les données Realtime avec l'historique
      const enrichedData = {
        ...realtimeData,
        historicalData: presenceHistory.get(realtimeData.user_id),
      };

      // Persister les changements significatifs
      if (shouldPersist(realtimeData, presenceHistory.get(realtimeData.user_id))) {
        persistPresence("update", {
          ...realtimeData,
          source: "realtime_sync",
        });
      }

      return enrichedData;
    },
    [presenceHistory, persistPresence, shouldPersist]
  );

  // 4. Déterminer si une présence doit être persistée
  const shouldPersist = useCallback((current, historical) => {
    if (!historical) return true; // Nouvelle présence

    const currentData = JSON.stringify({
      role: current.role,
      zone: current.zone,
      public_links: current.public_links,
    });

    const historicalData = JSON.stringify({
      role: historical.role,
      zone: historical.zone,
      public_links: historical.public_links,
    });

    return currentData !== historicalData;
  }, []);

  // 5. Heartbeat automatique
  const sendHeartbeat = useCallback(async () => {
    if (!isOnline) return;

    const success = await persistPresence("update", {
      heartbeat: true,
      timestamp: Date.now(),
      online: true,
    });

    return success;
  }, [persistPresence, isOnline]);

  // 6. Nettoyage des présences expirées
  const cleanupExpiredPresences = useCallback(() => {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes

    const cleanedPresences = new Map();
    let hasChanges = false;

    for (const [userId, presence] of presenceHistory) {
      const lastSeen = new Date(presence.lastSeen).getTime();
      if (now - lastSeen > timeout) {
        hasChanges = true;
        // Annoncer le départ
        persistPresence("leave", {
          reason: "timeout",
          lastSeen: presence.lastSeen,
        });
      } else {
        cleanedPresences.set(userId, presence);
      }
    }

    if (hasChanges) {
      setPresenceHistory(cleanedPresences);
    }

    return hasChanges;
  }, [presenceHistory, persistPresence]);

  // 7. Initialisation
  useEffect(() => {
    console.debug("[HybridPresence Debug] Initialization:", { roomId, userId });
    if (roomId && userId) {
      loadPresenceHistory();

      // Annoncer l'arrivée
      console.debug("[HybridPresence Debug] Sending join message");
      persistPresence("join", {
        initial: true,
        timestamp: Date.now(),
      });
    } else {
      console.debug("[HybridPresence Debug] Missing roomId or userId:", { roomId, userId });
    }
  }, [roomId, userId, loadPresenceHistory, persistPresence]);

  // 8. Heartbeat interval
  useEffect(() => {
    const heartbeatInterval = setInterval(() => {
      sendHeartbeat();
    }, 30000); // 30 secondes

    return () => clearInterval(heartbeatInterval);
  }, [sendHeartbeat]);

  // 9. Cleanup interval
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      cleanupExpiredPresences();
    }, 60000); // 1 minute

    return () => clearInterval(cleanupInterval);
  }, [cleanupExpiredPresences]);

  // 10. Gestion de la connectivité
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Resynchroniser à la reconnexion
      loadPresenceHistory();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [loadPresenceHistory]);

  // 11. Nettoyage au démontage
  useEffect(() => {
    return () => {
      // Annoncer le départ
      persistPresence("leave", {
        reason: "component_unmount",
        timestamp: Date.now(),
      });
    };
  }, [persistPresence]);

  return {
    // Données
    presenceHistory: Array.from(presenceHistory.values()),
    presenceMap: presenceHistory,
    lastSync,
    isOnline,

    // Actions
    persistPresence,
    loadPresenceHistory,
    syncWithRealtime,
    sendHeartbeat,
    cleanupExpiredPresences,

    // Utilitaires
    enrichUser: (user) => {
      const historical = presenceHistory.get(user.user_id);
      return historical ? { ...user, ...historical } : user;
    },
    enrichUsers: (users) => {
      return users.map((user) => {
        const historical = presenceHistory.get(user.user_id);
        return historical ? { ...user, ...historical } : user;
      });
    },
  };
};
