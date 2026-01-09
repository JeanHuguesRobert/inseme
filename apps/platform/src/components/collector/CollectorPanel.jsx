import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSupabase } from "../../lib/supabase.js";

const TAG_COLOR_MAP = {
  Titre: "bg-blue-100 text-blue-800",
  Description: "bg-gray-100 text-gray-800",
  Date: "bg-green-100 text-green-800",
  Lieu: "bg-yellow-100 text-yellow-800",
  Personne: "bg-purple-100 text-purple-800",
  Organisation: "bg-pink-100 text-pink-800",
  Autre: "bg-indigo-100 text-indigo-800",
};

/**
 * CollectorPanel - Side panel displaying and managing collected data
 * @param {boolean} isOpen - Whether panel is open
 * @param {Array} data - Array of collected data items
 * @param {Function} onUpdate - Update data handler
 * @param {Function} onRemove - Remove data handler
 * @param {Function} onClear - Clear all data handler
 * @param {Function} onRefresh - Refresh data handler
 */
export function CollectorPanel({ isOpen, data, onUpdate, onRemove, onClear, onRefresh }) {
  const [isViewJsonModalOpen, setIsViewJsonModalOpen] = useState(false);
  const [isCreatingWiki, setIsCreatingWiki] = useState(false);
  const navigate = useNavigate();

  const handleExport = () => {
    setIsViewJsonModalOpen(true);
  };

  const handleSave = async () => {
    if (!data || data.length === 0) {
      alert("Aucune donnée à sauvegarder");
      return;
    }

    try {
      // Check authentication
      const {
        data: { user },
      } = await getSupabase().auth.getUser();
      if (!user) {
        alert("Vous devez être connecté pour sauvegarder les données");
        return;
      }

      // Data is already saved via onUpdate/onAdd in parent component
      alert("✅ Données sauvegardées pour Ophélia !");
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      alert("❌ Erreur lors de la sauvegarde: " + error.message);
    }
  };

  const handleCreateWiki = async () => {
    if (!data || data.length === 0) {
      alert("Aucune donnée à convertir en page wiki");
      return;
    }

    setIsCreatingWiki(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        alert("Vous devez être connecté pour créer une page wiki");
        setIsCreatingWiki(false);
        return;
      }

      // Group data by type
      const groupedData = data.reduce((acc, item) => {
        if (!acc[item.data_type]) {
          acc[item.data_type] = [];
        }
        acc[item.data_type].push(item.value);
        return {};
      }, {});

      // Build wiki content
      let wikiContent = "";

      // Title (use first "Titre" if available)
      const titles = data.filter((d) => d.data_type === "Titre");
      const wikiTitle =
        titles.length > 0
          ? titles[0].value
          : "Page collectée le " + new Date().toLocaleDateString("fr-FR");

      // Description
      const descriptions = data.filter((d) => d.data_type === "Description");
      if (descriptions.length > 0) {
        wikiContent += descriptions.map((d) => d.value).join("\n\n") + "\n\n";
      }

      // Other data organized by type
      const otherTypes = ["Date", "Lieu", "Personne", "Organisation", "Autre"];
      otherTypes.forEach((type) => {
        const items = data.filter((d) => d.data_type === type);
        if (items.length > 0) {
          wikiContent += `## ${type}${items.length > 1 ? "s" : ""}\n\n`;
          items.forEach((item) => {
            wikiContent += `- ${item.value}\n`;
          });
          wikiContent += "\n";
        }
      });

      // Add metadata
      wikiContent += `\n---\n\n*Page créée depuis le collecteur de données Ophélia le ${new Date().toLocaleString("fr-FR")}*\n`;

      // Navigate to wiki create page with pre-filled content
      const params = new URLSearchParams({
        title: wikiTitle,
        content: wikiContent,
        fromCollector: "true",
      });
      navigate(`/wiki/create?${params.toString()}`);

      setIsCreatingWiki(false);
    } catch (error) {
      console.error("Erreur lors de la création de la page wiki:", error);
      alert("❌ Erreur lors de la création de la page wiki: " + error.message);
      setIsCreatingWiki(false);
    }
  };

  return (
    <>
      <aside
        className={`transition-all duration-300 ease-in-out bg-white border-r border-gray-200 shadow-lg flex flex-col ${isOpen ? "w-full max-w-md" : "w-0"} overflow-hidden`}
      >
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Données Collectées</h2>
          <p className="text-sm text-gray-500">Gérez les informations extraites du site.</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {data.length === 0 ? (
            <div className="text-center text-gray-500 pt-10">
              <p>Aucune donnée collectée.</p>
              <p className="text-sm">Cliquez sur "Ajouter une Donnée" pour commencer.</p>
            </div>
          ) : (
            data.map((item) => (
              <div key={item.id} className="  p-3 border border-gray-200 group">
                <div className="flex justify-between items-start mb-2">
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${TAG_COLOR_MAP[item.data_type]}`}
                  >
                    {item.data_type}
                  </span>
                  <button
                    onClick={() => onRemove(item.id)}
                    className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Supprimer"
                  >
                    🗑️
                  </button>
                </div>
                <textarea
                  value={item.value}
                  onChange={(e) => onUpdate(item.id, e.target.value)}
                  className="w-full text-sm text-gray-700 bg-transparent border-0 focus:ring-0 p-0 resize-none"
                  rows={Math.min(item.value.split("\n").length, 6)}
                  aria-label={`Contenu pour ${item.data_type}`}
                />
              </div>
            ))
          )}
        </div>

        {data.length > 0 && (
          <div className="p-4 border-t border-gray-200 space-y-2">
            <button
              onClick={handleCreateWiki}
              disabled={isCreatingWiki}
              className="w-full px-4 py-2 text-sm font-semibold text-white bg-green-600 shadow-sm hover:bg-green-700 disabled:bg-green-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              {isCreatingWiki ? "📝 Création..." : "📝 Créer une page Wiki"}
            </button>

            <button
              onClick={handleSave}
              className="w-full px-4 py-2 text-sm font-semibold text-white bg-blue-600 shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              💾 Sauvegarder pour Ophélia
            </button>

            <div className="flex space-x-2">
              <button
                onClick={handleExport}
                className="w-full px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
              >
                📤 Exporter JSON
              </button>
              <button
                onClick={onClear}
                className="w-full px-4 py-2 text-sm font-semibold text-red-600 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-400"
              >
                🗑️ Tout effacer
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* JSON Export Modal */}
      {isViewJsonModalOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setIsViewJsonModalOpen(false)}
        >
          <div
            className="bg-white   shadow-xl w-full max-w-2xl p-6 m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Données au format JSON</h2>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(data, null, 2));
                  alert("✅ JSON copié dans le presse-papiers !");
                }}
                className="text-sm px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700"
              >
                📋 Copier
              </button>
            </div>
            <pre className="p-4   overflow-auto max-h-96 text-sm">
              {JSON.stringify(data, null, 2)}
            </pre>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setIsViewJsonModalOpen(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default CollectorPanel;
