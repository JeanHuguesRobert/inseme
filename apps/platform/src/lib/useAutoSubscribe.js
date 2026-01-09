import { getSupabase } from "./supabase.js";

/**
 * Types de contenu pour lesquels on peut s'abonner
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
 * Auto-abonne un utilisateur à un contenu (appel après création)
 * @param {string} contentType - Type de contenu
 * @param {string} contentId - ID du contenu
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function autoSubscribe(contentType, contentId, userId) {
  if (!userId || !contentId || !contentType) {
    return { success: false, error: "Missing parameters" };
  }

  if (!SUBSCRIBABLE_TYPES.includes(contentType)) {
    console.warn(`autoSubscribe: Invalid content type "${contentType}"`);
    return { success: false, error: "Invalid content type" };
  }

  try {
    // Upsert pour éviter les doublons
    const { error } = await getSupabase()
      .from("content_subscriptions")
      .upsert(
        {
          user_id: userId,
          content_type: contentType,
          content_id: contentId,
          metadata: {
            auto_subscribed: true,
            subscribed_at: new Date().toISOString(),
            unread_count: 0,
          },
        },
        {
          onConflict: "user_id,content_type,content_id",
          ignoreDuplicates: true,
        }
      );

    if (error) {
      console.error("autoSubscribe error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("autoSubscribe exception:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Hook wrapper pour auto-abonnement dans les composants React
 * Usage: const { autoSubscribeToContent } = useAutoSubscribe();
 */
export function useAutoSubscribe() {
  const autoSubscribeToContent = async (contentType, contentId, userId) => {
    return autoSubscribe(contentType, contentId, userId);
  };

  return { autoSubscribeToContent, SUBSCRIBABLE_TYPES };
}

export default useAutoSubscribe;
