import { useState, useEffect } from "react";
import { getSupabase, useCurrentUser } from "@inseme/cop-host";
import { Link } from "react-router-dom";
import FilItemCard from "../components/FilItemCard";

export default function FilFeed() {
  const { currentUser } = useCurrentUser();
  const [items, setItems] = useState([]);
  const [period, setPeriod] = useState("day"); // 'day', 'week', 'all'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchItems();
  }, [period, currentUser]);

  async function fetchItems() {
    setLoading(true);
    let query = getSupabase()
      .from("posts")
      .select(
        `
        *,
        users:author_id(id, display_name, metadata),
        reactions(user_id, emoji)
      `
      )
      .ilike("metadata->>type", "fil_%");

    // Time filter
    const now = new Date();
    if (period === "day") {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      query = query.gt("created_at", yesterday.toISOString());
    } else if (period === "week") {
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      query = query.gt("created_at", lastWeek.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching fil items:", error);
    } else {
      // Enrich with user_vote and sort
      const enriched = data.map((item) => {
        const userReaction = item.reactions?.find(
          (r) => r.user_id === currentUser?.id && (r.emoji === "+1" || r.emoji === "-1")
        );
        const userVote = userReaction ? (userReaction.emoji === "+1" ? 1 : -1) : 0;
        return { ...item, user_vote: userVote };
      });

      // Sort by score DESC
      enriched.sort((a, b) => {
        const scoreA = a.metadata?.fil_score || 0;
        const scoreB = b.metadata?.fil_score || 0;
        return scoreB - scoreA;
      });

      setItems(enriched);
    }
    setLoading(false);
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold font-bauhaus text-bauhaus-black">LE FIL</h1>
        <div className="flex gap-2">
          {["day", "week", "all"].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded font-bold ${period === p ? "bg-bauhaus-black text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              {p === "day" ? "24h" : p === "week" ? "Semaine" : "Historique"}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <Link
          to="/fil/new"
          className="block w-full text-center py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600 font-bold"
        >
          + Ajouter une information au Fil
        </Link>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-10">Chargement...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            Aucun item pour cette période. Soyez le premier !
          </div>
        ) : (
          items.map((item, idx) => (
            <FilItemCard
              key={item.id}
              post={item}
              rank={idx + 1}
              currentUserId={currentUser?.id}
              onVote={() => fetchItems()}
            />
          ))
        )}
      </div>
    </div>
  );
}
