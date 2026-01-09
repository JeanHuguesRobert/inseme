import React, { useState, useEffect } from "react";
import { getSupabase } from "../../lib/supabase.js";
import { useSupabase } from "../../contexts/SupabaseContext";
import { getUserRole, ROLE_ADMIN } from "@inseme/cop-host";

const DATA_TYPES = ["Titre", "Description", "Date", "Lieu", "Personne", "Organisation", "Autre"];
const STATUSES = ["draft", "reviewed", "published", "archived"];

const TAG_COLOR_MAP = {
  Titre: "bg-blue-100 text-blue-800",
  Description: "bg-gray-100 text-gray-800",
  Date: "bg-green-100 text-green-800",
  Lieu: "bg-yellow-100 text-yellow-800",
  Personne: "bg-purple-100 text-purple-800",
  Organisation: "bg-pink-100 text-pink-800",
  Autre: "bg-indigo-100 text-indigo-800",
};

const STATUS_COLOR_MAP = {
  draft: "bg-gray-200 text-gray-800",
  reviewed: "bg-blue-200 text-blue-800",
  published: "bg-green-200 text-green-800",
  archived: "bg-red-200 text-red-800",
};

/**
 * DataReview - Admin page for reviewing and moderating collected data
 * Allows admins to change status, filter, and export data
 */
export function DataReview() {
  const { user } = useSupabase();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Filters
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterUser, setFilterUser] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Users list for filter
  const [users, setUsers] = useState([]);

  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const role = getUserRole(user);
        setIsAdmin(role === ROLE_ADMIN);
      } catch (error) {
        console.error("Erreur lors de la vérification admin:", error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdmin();
  }, [user]);

  // Load data
  useEffect(() => {
    if (!isAdmin) return;
    loadData();
  }, [isAdmin]);

  const loadData = async () => {
    try {
      setLoading(true);

      let query = getSupabase()
        .from("collected_data")
        .select(
          `
          *,
          users:user_id ( display_name, email )
        `
        )
        .order("created_at", { ascending: false });

      // Apply filters
      if (filterType !== "all") {
        query = query.eq("data_type", filterType);
      }
      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }
      if (filterUser !== "all") {
        query = query.eq("user_id", filterUser);
      }

      const { data: collectedData, error } = await query;
      if (error) throw error;

      // Apply search filter client-side
      let filtered = collectedData || [];
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (item) =>
            item.value.toLowerCase().includes(query) ||
            item.source_url.toLowerCase().includes(query)
        );
      }

      setData(filtered);

      // Extract unique users for filter
      const uniqueUsers = Array.from(
        new Map(collectedData.filter((d) => d.users).map((d) => [d.user_id, d.users])).values()
      );
      setUsers(uniqueUsers);
    } catch (error) {
      console.error("Erreur lors du chargement:", error);
      alert("❌ Erreur lors du chargement: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Change status
  const handleChangeStatus = async (id, newStatus) => {
    try {
      const { error } = await getSupabase()
        .from("collected_data")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;

      // Update local state
      setData((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
      );

      // Show success message
      const statusLabels = {
        draft: "brouillon",
        reviewed: "revu",
        published: "publié",
        archived: "archivé",
      };
      alert(`✅ Statut changé à : ${statusLabels[newStatus]}`);
    } catch (error) {
      console.error("Erreur lors du changement de statut:", error);
      alert("❌ Erreur: " + error.message);
    }
  };

  // Export to JSON
  const handleExport = () => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `collected-data-export-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen ">
        <div className="text-center max-w-md p-8 bg-white   shadow-lg">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">🔒 Accès restreint</h1>
          <p className="text-gray-600">Vous devez être connecté pour accéder à cette page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">Chargement...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-screen ">
        <div className="text-center max-w-md p-8 bg-white   shadow-lg">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">🚫 Accès refusé</h1>
          <p className="text-gray-600">Cette page est réservée aux administrateurs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen ">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-800">🔍 Revue des Données Collectées</h1>
          <p className="text-sm text-gray-500">Modération et gestion des données pour Ophélia</p>
        </div>
      </header>

      {/* Filters */}
      <div className="container mx-auto px-4 py-6">
        <div className="bg-white   shadow p-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Filtres</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Type filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type de donnée</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tous les types</option>
                {DATA_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Status filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tous les statuts</option>
                <option value="draft">Brouillon</option>
                <option value="reviewed">Revu</option>
                <option value="published">Publié</option>
                <option value="archived">Archivé</option>
              </select>
            </div>

            {/* User filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Utilisateur</label>
              <select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tous les utilisateurs</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.display_name || u.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Recherche</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher..."
                className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-between items-center mt-4">
            <button
              onClick={loadData}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              🔄 Rafraîchir
            </button>
            <button
              onClick={handleExport}
              disabled={data.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-300"
            >
              📤 Exporter JSON ({data.length})
            </button>
          </div>
        </div>

        {/* Data list */}
        <div className="space-y-4">
          {data.length === 0 ? (
            <div className="bg-white   shadow p-8 text-center text-gray-500">
              Aucune donnée correspondant aux filtres
            </div>
          ) : (
            data.map((item) => (
              <div key={item.id} className="bg-white   shadow p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex gap-2">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${TAG_COLOR_MAP[item.data_type]}`}
                    >
                      {item.data_type}
                    </span>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLOR_MAP[item.status]}`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(item.created_at).toLocaleDateString("fr-FR")}
                  </div>
                </div>

                <div className="mb-3">
                  <p className="text-sm text-gray-700">{item.value}</p>
                </div>

                <div className="text-xs text-gray-500 mb-3">
                  <strong>Source:</strong>{" "}
                  <a
                    href={item.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {item.source_url}
                  </a>
                </div>

                <div className="text-xs text-gray-500 mb-3">
                  <strong>Collecté par:</strong>{" "}
                  {item.users?.display_name || item.users?.email || "Utilisateur inconnu"}
                </div>

                {/* Status actions */}
                <div className="flex gap-2">
                  {STATUSES.filter((s) => s !== item.status).map((status) => (
                    <button
                      key={status}
                      onClick={() => handleChangeStatus(item.id, status)}
                      className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                    >
                      → {status}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default DataReview;
