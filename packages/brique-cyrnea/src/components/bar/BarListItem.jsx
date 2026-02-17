import React from "react";

/**
 * Élément de liste de bar pour l'administration
 */
export const BarListItem = ({ bar, onEdit, onDelete }) => {
  if (!bar) return null;

  return (
    <div className="flex items-center justify-between p-4 border-b border-gray-200">
      <div className="flex-1">
        <h4 className="font-semibold">{bar.displayName || bar.name}</h4>
        <p className="text-sm text-gray-600">{bar.slug}</p>
        <div className="flex gap-4 mt-2 text-xs">
          <span>Utilisateurs: {bar.totalUsersCount || 0}</span>
          <span>Barmans: {bar.barmansCount || 0}</span>
        </div>
      </div>

      <div className="flex gap-2">
        {onEdit && (
          <button
            onClick={() => onEdit(bar.id)}
            className="px-3 py-1 text-xs font-black uppercase bg-blue-500 text-white hover:bg-blue-600"
          >
            Modifier
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(bar.id)}
            className="px-3 py-1 text-xs font-black uppercase bg-red-500 text-white hover:bg-red-600"
          >
            Supprimer
          </button>
        )}
      </div>
    </div>
  );
};
