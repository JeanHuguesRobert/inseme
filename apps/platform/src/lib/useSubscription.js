import { useState, useEffect } from "react";
import { getSupabase } from "@inseme/cop-host";

/**
 * Types de contenu supportés pour les abonnements
 */
export const SUBSCRIBABLE_TYPES = [
  "post",
  "proposition",
  "wiki_page",
  "user",
  "group",
  "mission",
  "task_project",
  "fil_item",
  "tag",
];

/**
 * Hook pour gérer les abonnements à n'importe quel type de contenu
 * @param {string} contentType - Type de contenu (voir SUBSCRIBABLE_TYPES)
 * @param {string} contentId - ID du contenu
 * @param {object} currentUser - Utilisateur connecté
 * @returns {object} { isSubscribed, loading, subscriberCount, subscribe, unsubscribe }
 */
export function useSubscription(contentType, contentId, currentUser) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscriberCount, setSubscriberCount] = useState(0);

  // Charger l'état initial
  useEffect(() => {
    if (!contentType || !contentId) {
      setLoading(false);
      return;
    }

    loadSubscriptionState();
  }, [contentType, contentId, currentUser]);

  // Écouter les changements en temps réel
  useEffect(() => {
    if (!contentType || !contentId) return;

    const channel = getSupabase()
      .channel(`subscriptions:${contentType}:${contentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "content_subscriptions",
          filter: `content_type=eq.${contentType},content_id=eq.${contentId}`,
        },
        () => {
          loadSubscriberCount();
        }
      )
      .subscribe();

    return () => {
      getSupabase().removeChannel(channel);
    };
  }, [contentType, contentId]);

  async function loadSubscriptionState() {
    try {
      setLoading(true);

      // Charger le statut d'abonnement de l'utilisateur
      if (currentUser?.id) {
        const { data, error } = await getSupabase()
          .from("content_subscriptions")
          .select("id")
          .eq("user_id", currentUser.id)
          .eq("content_type", contentType)
          .eq("content_id", contentId)
          .maybeSingle();

        if (error && error.code !== "PGRST116") throw error;
        setIsSubscribed(!!data);
      }

      // Charger le nombre d'abonnés
      await loadSubscriberCount();
    } catch (error) {
      console.error("Error loading subscription state:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadSubscriberCount() {
    try {
      const { count, error } = await getSupabase()
        .from("content_subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("content_type", contentType)
        .eq("content_id", contentId);

      if (error) throw error;
      setSubscriberCount(count || 0);
    } catch (error) {
      console.error("Error loading subscriber count:", error);
    }
  }

  async function subscribe() {
    if (!currentUser?.id) {
      console.warn("User must be logged in to subscribe");
      return { success: false, error: "Not authenticated" };
    }

    try {
      // Mise à jour optimiste
      setIsSubscribed(true);
      setSubscriberCount((prev) => prev + 1);

      const { error } = await getSupabase().from("content_subscriptions").insert({
        user_id: currentUser.id,
        content_type: contentType,
        content_id: contentId,
      });

      if (error) {
        // Rollback en cas d'erreur
        setIsSubscribed(false);
        setSubscriberCount((prev) => prev - 1);
        throw error;
      }

      return { success: true };
    } catch (error) {
      console.error("Error subscribing:", error);
      return { success: false, error: error.message };
    }
  }

  async function unsubscribe() {
    if (!currentUser?.id) {
      return { success: false, error: "Not authenticated" };
    }

    try {
      // Mise à jour optimiste
      setIsSubscribed(false);
      setSubscriberCount((prev) => Math.max(0, prev - 1));

      const { error } = await getSupabase()
        .from("content_subscriptions")
        .delete()
        .eq("user_id", currentUser.id)
        .eq("content_type", contentType)
        .eq("content_id", contentId);

      if (error) {
        // Rollback en cas d'erreur
        setIsSubscribed(true);
        setSubscriberCount((prev) => prev + 1);
        throw error;
      }

      return { success: true };
    } catch (error) {
      console.error("Error unsubscribing:", error);
      return { success: false, error: error.message };
    }
  }

  return {
    isSubscribed,
    loading,
    subscriberCount,
    subscribe,
    unsubscribe,
  };
}
