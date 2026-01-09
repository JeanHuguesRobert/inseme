import { useState, useEffect, useCallback } from "react";
import { getSupabase } from "@inseme/cop-host";

/**
 * Hook pour gérer les notifications temps réel des abonnements
 * @param {string} userId - ID de l'utilisateur connecté
 * @returns {object} { unreadCount, notifications, markAsRead, refresh }
 */
export function useSubscriptionNotifications(userId) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState(null);

  // Charger le compteur initial
  const loadUnreadCount = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }

    try {
      const { data, error } = await supabase.rpc("get_user_unread_count", {
        p_user_id: userId,
      });

      if (error) {
        // Fallback: compter manuellement si la fonction RPC n'existe pas
        const { data: subs, error: subsError } = await supabase
          .from("content_subscriptions")
          .select("metadata")
          .eq("user_id", userId);

        if (!subsError && subs) {
          const total = subs.reduce((sum, sub) => {
            return sum + (parseInt(sub.metadata?.unread_count) || 0);
          }, 0);
          setUnreadCount(total);
        }
        return;
      }

      setUnreadCount(data || 0);
    } catch (err) {
      console.error("Error loading unread count:", err);
    }
  }, [userId]);

  // Charger les notifications récentes
  const loadNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("content_subscriptions")
        .select("*")
        .eq("user_id", userId)
        .order("last_activity_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      // Filtrer ceux avec activité non lue
      const withActivity = (data || []).filter((sub) => parseInt(sub.metadata?.unread_count) > 0);

      setNotifications(withActivity);
    } catch (err) {
      console.error("Error loading notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Marquer un abonnement comme lu
  const markAsRead = useCallback(
    async (contentType, contentId) => {
      if (!userId) return false;

      try {
        // Appel RPC si disponible
        const { error: rpcError } = await supabase.rpc("mark_subscription_read", {
          p_user_id: userId,
          p_content_type: contentType,
          p_content_id: contentId,
        });

        if (rpcError) {
          // Fallback: mise à jour directe
          await supabase
            .from("content_subscriptions")
            .update({
              metadata: {
                unread_count: 0,
                last_seen_at: new Date().toISOString(),
              },
            })
            .eq("user_id", userId)
            .eq("content_type", contentType)
            .eq("content_id", contentId);
        }

        // Refresh counts
        await loadUnreadCount();
        await loadNotifications();
        return true;
      } catch (err) {
        console.error("Error marking as read:", err);
        return false;
      }
    },
    [userId, loadUnreadCount, loadNotifications]
  );

  // Configurer le canal temps réel
  useEffect(() => {
    if (!userId) return;

    // Écouter les changements sur les commentaires pour mettre à jour les compteurs
    const subscriptionChannel = supabase
      .channel(`user-subscriptions:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "content_subscriptions",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          // Recharger les données quand les abonnements changent
          loadUnreadCount();
          loadNotifications();
        }
      )
      .subscribe();

    setChannel(subscriptionChannel);

    return () => {
      if (subscriptionChannel) {
        supabase.removeChannel(subscriptionChannel);
      }
    };
  }, [userId, loadUnreadCount, loadNotifications]);

  // Charger les données initiales
  useEffect(() => {
    loadUnreadCount();
    loadNotifications();
  }, [loadUnreadCount, loadNotifications]);

  const refresh = useCallback(() => {
    loadUnreadCount();
    loadNotifications();
  }, [loadUnreadCount, loadNotifications]);

  return {
    unreadCount,
    notifications,
    loading,
    markAsRead,
    refresh,
  };
}

export default useSubscriptionNotifications;
