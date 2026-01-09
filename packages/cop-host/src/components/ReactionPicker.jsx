import { useState, useEffect } from "react";
import { getSupabase } from "../client/supabase.js";
import { REACTION_EMOJIS } from "../lib/socialMetadata.js";
import { isAnonymous } from "../lib/permissions.js";

/**
 * Sélecteur de réactions emoji avec compteur
 */
export default function ReactionPicker({ targetType, targetId, currentUser }) {
  const [reactions, setReactions] = useState([]);
  const [userReactions, setUserReactions] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (targetId) {
      loadReactions();

      // Subscribe to realtime changes
      const channel = getSupabase()
        .channel(`reactions:${targetType}:${targetId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "reactions",
            filter: `target_type=eq.${targetType}`,
          },
          () => loadReactions()
        )
        .subscribe();

      return () => {
        getSupabase().removeChannel(channel);
      };
    }
  }, [targetId, targetType]);

  async function loadReactions() {
    try {
      setLoading(true);

      const { data, error } = await getSupabase()
        .from("reactions")
        .select("*")
        .eq("target_type", targetType)
        .eq("target_id", targetId);

      if (error) throw error;

      setReactions(data || []);

      // Trouver les réactions de l'utilisateur actuel
      if (currentUser) {
        const userReacts = (data || []).filter((r) => r.user_id === currentUser.id);
        setUserReactions(userReacts.map((r) => r.emoji));
      }
    } catch (err) {
      console.error("Error loading reactions:", err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleReaction(emoji) {
    if (!currentUser || isAnonymous(currentUser)) {
      alert("Vous devez être connecté pour réagir");
      return;
    }

    console.log("toggleReaction called", {
      emoji,
      currentUser: currentUser.id,
      targetType,
      targetId,
    });

    try {
      // Check if user already reacted with this emoji
      const existing = reactions.find((r) => r.user_id === currentUser.id && r.emoji === emoji);

      console.log("Existing reaction:", existing);

      if (existing) {
        // Remove reaction
        console.log("Removing reaction", existing.id);
        const { error } = await getSupabase().from("reactions").delete().eq("id", existing.id);

        if (error) {
          console.error("Delete error:", error);
          throw error;
        }
        console.log("Reaction removed successfully");
      } else {
        // Add reaction
        console.log("Adding new reaction");
        const newReaction = {
          user_id: currentUser.id,
          target_type: targetType,
          target_id: targetId,
          emoji,
          metadata: { schemaVersion: 1 },
        };
        console.log("Insert data:", newReaction);

        const { error, data } = await getSupabase().from("reactions").insert(newReaction).select();

        console.log("Insert completed, error:", error, "data:", data);

        if (error) {
          console.error("Insert error:", error);
          throw error;
        }
        console.log("Reaction added successfully:", data);
      }

      await loadReactions();
      setShowPicker(false);
    } catch (err) {
      console.error("Error toggling reaction:", err);
      alert("Erreur : " + err.message + "\n\nVoir la console pour plus de détails.");
    }
  }

  // Compter les réactions par emoji
  const reactionCounts = {};
  reactions.forEach((r) => {
    reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1;
  });

  if (loading) {
    return <div className="text-xs text-gray-400">Chargement...</div>;
  }

  return (
    <div className="relative inline-flex items-center gap-2">
      {/* Display existing reactions */}
      {Object.entries(reactionCounts).map(([emoji, count]) => {
        const hasReacted = userReactions.includes(emoji);
        return (
          <button
            key={emoji}
            onClick={() => toggleReaction(emoji)}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
              hasReacted
                ? "bg-primary-100 text-primary-700 border border-primary-300"
                : "bg-gray-100 text-gray-300 hover:bg-gray-200"
            }`}
          >
            <span>{emoji}</span>
            <span className="font-medium">{count}</span>
          </button>
        );
      })}

      {/* Add reaction button */}
      {currentUser && (
        <div>
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-sm transition-colors"
            title="Ajouter une réaction"
          >
            {showPicker ? "✕" : "😀"}
          </button>

          {/* Emoji picker popup */}
          {showPicker && (
            <div className="absolute bottom-full left-0 mb-2  border border-gray-200   shadow-lg p-2 flex gap-1 z-10">
              {Object.values(REACTION_EMOJIS).map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => toggleReaction(emoji)}
                  className={`w-8 h-8 hover:bg-gray-100 flex items-center justify-center text-lg transition-colors ${
                    userReactions.includes(emoji) ? "bg-primary-50" : ""
                  }`}
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
