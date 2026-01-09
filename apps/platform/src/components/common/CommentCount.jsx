import { useState, useEffect } from "react";
import { getSupabase } from "../../lib/supabase.js";

/**
 * Badge affichant le nombre de commentaires pour un contenu donné
 * Utilise le système de discussion threads
 *
 * @param {Object} props
 * @param {string} props.linkedType - Type de contenu (wiki_page, proposition, etc.)
 * @param {string} props.linkedId - ID du contenu
 * @param {boolean} props.showZero - Afficher même si 0 commentaires (défaut: false)
 */
export default function CommentCount({ linkedType, linkedId, showZero = false }) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!linkedType || !linkedId) {
      setLoading(false);
      return;
    }

    fetchCommentCount();
  }, [linkedType, linkedId]);

  async function fetchCommentCount() {
    try {
      setLoading(true);

      // Trouve le post de discussion lié
      const { data: posts, error: postError } = await getSupabase()
        .from("posts")
        .select("id")
        .eq("metadata->>linkedType", linkedType)
        .eq("metadata->>linkedId", linkedId)
        .eq("metadata->>isDiscussionThread", "true")
        .limit(1);

      if (postError) throw postError;

      if (!posts || posts.length === 0) {
        setCount(0);
        return;
      }

      // Compte les commentaires non supprimés
      const { count: commentCount, error: countError } = await getSupabase()
        .from("comments")
        .select("*", { count: "exact", head: true })
        .eq("post_id", posts[0].id)
        .or("metadata->>isDeleted.is.null,metadata->>isDeleted.eq.false");

      if (countError) throw countError;

      setCount(commentCount || 0);
    } catch (err) {
      console.error("Error fetching comment count:", err);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }

  // Ne rien afficher si loading ou si count = 0 et showZero = false
  if (loading || (count === 0 && !showZero)) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-1 text-sm text-gray-300">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
      <span>{count}</span>
    </span>
  );
}
