import React, { useState } from "react";
import { useAiSummary } from "../../lib/useAiSummary.js";

const DATA_TYPES = ["Titre", "Description", "Date", "Lieu", "Personne", "Organisation", "Autre"];

/**
 * CollectorModal - Modal for adding/editing collected data
 * @param {boolean} isOpen - Whether modal is open
 * @param {Function} onClose - Close handler
 * @param {Function} onAdd - Add data handler
 * @param {Object} initialData - Initial data for editing (optional)
 */
export function CollectorModal({ isOpen, onClose, onAdd, initialData = null }) {
  const [value, setValue] = useState(initialData?.value || "");
  const [type, setType] = useState(initialData?.data_type || "Titre");
  const { summarize, loading: isSummarizing, error: aiError } = useAiSummary();

  const handleSummarize = async () => {
    if (!value || value.trim().length === 0) return;

    try {
      const summary = await summarize(value);
      setValue(summary);
    } catch (err) {
      console.error("Erreur de résumé:", err);
      // Error is already set by the hook
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (value.trim()) {
      onAdd({ data_type: type, value: value.trim() });
      setValue("");
      setType("Titre");
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white   shadow-xl w-full max-w-lg p-6 m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            {initialData ? "Modifier la donnée" : "Ajouter une nouvelle donnée"}
          </h2>

          <div className="mb-4">
            <label htmlFor="dataType" className="block text-sm font-medium text-gray-700 mb-1">
              Type de donnée
            </label>
            <select
              id="dataType"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {DATA_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label htmlFor="dataValue" className="block text-sm font-medium text-gray-700 mb-1">
              Contenu
            </label>
            <div className="relative">
              <textarea
                id="dataValue"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                rows={8}
                placeholder="Copiez-collez le texte ici..."
                className="w-full px-3 py-2 border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
              />
              <button
                type="button"
                onClick={handleSummarize}
                disabled={isSummarizing || !value}
                className="absolute bottom-2 right-2 flex items-center px-3 py-1.5 text-xs font-semibold text-white bg-purple-600 shadow-sm hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
              >
                {isSummarizing ? (
                  <span className="animate-pulse">✨ Analyse...</span>
                ) : (
                  <>✨ Résumer avec l'IA</>
                )}
              </button>
            </div>
            {aiError && <p className="text-red-500 text-sm mt-1">{aiError}</p>}
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={!value.trim()}
            >
              {initialData ? "Modifier" : "Ajouter"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CollectorModal;
