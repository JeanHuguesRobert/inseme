import { useState, useEffect } from "react";
import { getSupabase } from "../../lib/supabase.js";
import { isDeleted } from "../../../../../packages/cop-host/src/lib/metadata.js";
import GroupCard from "./GroupCard";

/**
 * Liste tous les groupes (forums, quartiers, associations)
 */
export default function GroupList({ filterType = null, currentUserId = null, gazette = null }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadGroups();
  }, [filterType]);

  async function loadGroups() {
    try {
      setLoading(true);
      setError(null);

      let query = getSupabase().from("groups").select("*, group_members(count)");

      // Filtre par type si spécifié
      if (filterType) {
        query = query.eq("metadata->>groupType", filterType);
      }

      // Order alphabetically by group name for consistent UI
      query = query.order("name", { ascending: true });

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Filtre les groupes supprimés (soft delete)
      const activeGroups = (data || []).filter((g) => !isDeleted(g));

      setGroups(activeGroups);
    } catch (err) {
      console.error("Error loading groups:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="theme-card p-6 text-center border-red-500">
        <p className="text-red-500 font-bold">Erreur lors du chargement des groupes</p>
        <p className="text-gray-600 text-sm mt-2">{error}</p>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="theme-card p-12 text-center text-gray-500">
        <p className="text-lg mb-2 font-bold">Aucun groupe pour l'instant</p>
        <p className="text-sm">Créez le premier groupe !</p>
      </div>
    );
  }

  const gridClass =
    gazette === "global"
      ? "grid grid-cols-1 gap-6"
      : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6";

  return (
    <div className={gridClass}>
      {groups.map((group) => (
        <GroupCard key={group.id} group={group} currentUserId={currentUserId} />
      ))}
    </div>
  );
}
