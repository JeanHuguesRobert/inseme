import { useState, useEffect } from "react";
import { getSupabase } from "@inseme/cop-host";
import { getDisplayName } from "@inseme/cop-host";

export default function TopCuratorsLeaderboard({ limit = 10 }) {
  const [curators, setCurators] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCurators() {
      try {
        // Simple query using cached shareCount in user metadata
        const { data: users, error } = await getSupabase()
          .from("users")
          .select("id, display_name, metadata")
          .not("metadata->>shareCount", "is", null)
          .order("metadata->>shareCount", { ascending: false })
          .limit(limit);

        if (error) throw error;

        // Filter and format
        const leaderboard = (users || [])
          .map((user) => ({
            user,
            shareCount: parseInt(user.metadata?.shareCount || 0, 10),
          }))
          .filter((c) => c.shareCount > 0);

        setCurators(leaderboard);
        setLoading(false);
      } catch (err) {
        console.error("Error loading curators:", err);
        setLoading(false);
      }
    }

    loadCurators();
  }, [limit]);

  if (loading) return <div className="text-gray-400 text-sm">Chargement...</div>;
  if (curators.length === 0) return null;

  return (
    <div className="theme-card p-4 mb-6">
      <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
        <span>🏆</span>
        <span>Top Curateurs</span>
      </h3>
      <div className="space-y-2">
        {curators.map((curator, index) => (
          <div
            key={curator.user.id}
            className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0"
          >
            <div className="flex items-center gap-3">
              <div className="text-xl font-bold text-gray-500 w-6">{index + 1}</div>
              <div>
                <div className="font-medium">{getDisplayName(curator.user)}</div>
              </div>
            </div>
            <div className="text-primary-400 font-bold">
              {curator.shareCount} partage{curator.shareCount > 1 ? "s" : ""}
            </div>
          </div>
        ))}
      </div>
      <div className="text-xs text-gray-500 mt-3 text-center">
        Plus vous partagez, plus vous êtes visible
      </div>
    </div>
  );
}
