import React, { useState, useEffect, useCallback } from "react";
import { getSupabase } from "../lib/supabase.js";
import { useSupabase } from "../contexts/SupabaseContext";
import IframeViewer from "../components/collector/IframeViewer";
import CollectorPanel from "../components/collector/CollectorPanel";
import CollectorModal from "../components/collector/CollectorModal";

const DEFAULT_URL = "https://cortideri.fr/";

/**
 * DataCollector - Main page for collecting structured data from websites
 * Users can view a website in iframe and extract information for Ophélia
 */
export function DataCollector() {
  const { user, authState } = useSupabase();
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [collectedData, setCollectedData] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [targetUrl, setTargetUrl] = useState(DEFAULT_URL);
  const [urlInput, setUrlInput] = useState(DEFAULT_URL);
  const [loading, setLoading] = useState(true);

  // Load collected data from Supabase
  const loadData = useCallback(async () => {
    if (!user) {
      setCollectedData([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await getSupabase()
        .from("collected_data")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "draft") // Only show draft items in collector
        .order("created_at", { ascending: false });

      if (error) throw error;

      setCollectedData(data || []);
    } catch (error) {
      console.error("Erreur lors du chargement des données:", error);
      alert("❌ Erreur lors du chargement des données: " + error.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load data on mount and when user changes
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Add new data
  const handleAddData = useCallback(
    async (newData) => {
      if (!user || isAnonymous(user)) {
        alert("Vous devez être connecté pour collecter des données");
        return;
      }

      try {
        const { data, error } = await getSupabase()
          .from("collected_data")
          .insert([
            {
              user_id: user.id,
              source_url: targetUrl,
              data_type: newData.data_type,
              value: newData.value,
              status: "draft",
              metadata: {
                schemaVersion: 1,
                collectedAt: new Date().toISOString(),
              },
            },
          ])
          .select()
          .single();

        if (error) throw error;

        setCollectedData((prev) => [data, ...prev]);
      } catch (error) {
        console.error("Erreur lors de l'ajout:", error);
        alert("❌ Erreur lors de l'ajout: " + error.message);
      }
    },
    [user, targetUrl]
  );

  // Update data
  const handleUpdateData = useCallback(async (id, newValue) => {
    try {
      const { error } = await getSupabase()
        .from("collected_data")
        .update({
          value: newValue,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      setCollectedData((prev) =>
        prev.map((item) => (item.id === id ? { ...item, value: newValue } : item))
      );
    } catch (error) {
      console.error("Erreur lors de la mise à jour:", error);
      alert("❌ Erreur lors de la mise à jour: " + error.message);
    }
  }, []);

  // Remove data
  const handleRemoveData = useCallback(async (id) => {
    try {
      const { error } = await getSupabase().from("collected_data").delete().eq("id", id);

      if (error) throw error;

      setCollectedData((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      alert("❌ Erreur lors de la suppression: " + error.message);
    }
  }, []);

  // Clear all data
  const handleClearData = useCallback(async () => {
    if (!confirm("Êtes-vous sûr de vouloir tout effacer ?")) return;

    try {
      const { error } = await getSupabase()
        .from("collected_data")
        .delete()
        .eq("user_id", user.id)
        .eq("status", "draft");

      if (error) throw error;

      setCollectedData([]);
    } catch (error) {
      console.error("Erreur lors de l'effacement:", error);
      alert("❌ Erreur lors de l'effacement: " + error.message);
    }
  }, [user]);

  // Update target URL
  const handleUpdateUrl = (e) => {
    e.preventDefault();
    setTargetUrl(urlInput);
  };

  if (authState === "signing_in") {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">Chargement...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="text-center max-w-md p-8 bg-white   shadow-lg">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            📋 Collecteur de Données Ophélia
          </h1>
          <p className="text-gray-600 mb-6">
            Connectez-vous pour commencer à collecter des données structurées depuis des sites web.
          </p>
          <p className="text-sm text-gray-500">
            Ces données enrichiront la base de connaissances d'Ophélia après modération.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-bold text-gray-800">📋 Collecteur de Données</h1>
            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
              {collectedData.length} {collectedData.length > 1 ? "éléments" : "élément"}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsPanelOpen(!isPanelOpen)}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
              title={isPanelOpen ? "Masquer le panneau" : "Afficher le panneau"}
            >
              {isPanelOpen ? "👁️ Masquer" : "👁️ Afficher"}
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-1.5 text-sm font-semibold text-white bg-blue-600 shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              ➕ Ajouter une Donnée
            </button>
          </div>
        </div>

        {/* URL Input */}
        <div className="px-4 py-2 border-t border-gray-200">
          <form onSubmit={handleUpdateUrl} className="flex space-x-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com"
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="submit"
              className="px-4 py-1.5 text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              🔄 Charger
            </button>
          </form>
        </div>
      </header>

      {/* Main content */}
      <main className="flex flex-1 overflow-hidden">
        <CollectorPanel
          isOpen={isPanelOpen}
          data={collectedData}
          onUpdate={handleUpdateData}
          onRemove={handleRemoveData}
          onClear={handleClearData}
          onRefresh={loadData}
        />
        <IframeViewer url={targetUrl} />
      </main>

      {/* Add Data Modal */}
      <CollectorModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddData}
      />
    </div>
  );
}

export default DataCollector;
