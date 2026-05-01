import React, { useState } from "react";

export default function BiodiversityFilters({ onFiltersChange, initialFilters = {} }) {
  const [filters, setFilters] = useState({
    taxon: initialFilters.taxon || "",
    date_from: initialFilters.date_from || "",
    date_to: initialFilters.date_to || "",
    validation_status: initialFilters.validation_status || "",
  });

  const handleChange = (field, value) => {
    const newFilters = { ...filters, [field]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleReset = () => {
    const emptyFilters = {
      taxon: "",
      date_from: "",
      date_to: "",
      validation_status: "",
    };
    setFilters(emptyFilters);
    onFiltersChange(emptyFilters);
  };

  return (
    <div className="biodiversity-filters bg-white p-3 rounded-lg shadow-md border border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-gray-800">Filtres Biodiversité</h3>
        <button
          onClick={handleReset}
          className="text-xs text-gray-500 hover:text-gray-700 underline"
        >
          Réinitialiser
        </button>
      </div>

      <div className="space-y-3">
        {/* Espèce filter */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Espèce (nom scientifique)
          </label>
          <input
            type="text"
            value={filters.taxon}
            onChange={(e) => handleChange("taxon", e.target.value)}
            placeholder="Ex: Erinaceus europaeus"
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Date début</label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => handleChange("date_from", e.target.value)}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Date fin</label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => handleChange("date_to", e.target.value)}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Validation status */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Statut de validation
          </label>
          <select
            value={filters.validation_status}
            onChange={(e) => handleChange("validation_status", e.target.value)}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Tous les statuts</option>
            <option value="unverified">Non vérifié</option>
            <option value="probable">Probable</option>
            <option value="confirmed">Confirmé</option>
            <option value="rejected">Rejeté</option>
          </select>
        </div>

        {/* Temporal filters */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Période rapide</label>
          <select
            value={filters.recent_days || ""}
            onChange={(e) => {
              const value = e.target.value;
              if (value) {
                handleChange("recent_days", value);
                handleChange("date_from", "");
                handleChange("date_to", "");
              } else {
                handleChange("recent_days", "");
              }
            }}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Période personnalisée</option>
            <option value="7">Derniers 7 jours</option>
            <option value="30">Derniers 30 jours</option>
            <option value="90">Derniers 90 jours</option>
            <option value="365">Dernière année</option>
          </select>
        </div>

        {/* Active filters summary */}
        <div className="pt-2 border-t border-gray-200">
          <div className="text-xs text-gray-600">
            Filtres actifs:{" "}
            <span className="font-medium">{Object.values(filters).filter(Boolean).length} / 5</span>
          </div>
        </div>
      </div>
    </div>
  );
}
