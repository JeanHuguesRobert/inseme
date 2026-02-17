import React from "react";

/**
 * Sélecteur de bar
 */
export const BarSelector = ({ bars, selectedBarId, onSelect }) => {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-black uppercase mb-2">Sélectionner un bar</label>
      <select
        value={selectedBarId || ""}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full border-2 border-black p-2 font-black"
      >
        <option value="">Choisir un bar...</option>
        {bars && bars.length > 0 ? (
          bars.map((bar) => (
            <option key={bar.id || bar.slug} value={bar.id || bar.slug}>
              {bar.displayName || bar.name} ({bar.slug})
            </option>
          ))
        ) : (
          <option disabled>Aucun bar disponible</option>
        )}
      </select>
    </div>
  );
};
