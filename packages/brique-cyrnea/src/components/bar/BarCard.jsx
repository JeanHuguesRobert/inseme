import React from "react";
import { Icon } from "../Icon"; // Adjust path if needed
import { MondrianBlock } from "../../utils/uiUtils"; // Adjust path if needed

/**
 * Carte de bar pour l'affichage grille
 */
export const BarCard = ({ bar, onClick, className = "" }) => {
  if (!bar) return null;

  return (
    <MondrianBlock
      key={bar.id}
      onClick={() => onClick && onClick(bar.id)}
      className={`cursor-pointer hover:shadow-lg transition-shadow ${className}`.trim()}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-black">{bar.displayName || bar.name}</h3>
          <div className="flex gap-2">
            <span className="bg-green-500 text-white px-2 py-1 text-xs font-black uppercase">
              Actif
            </span>
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-2">
          {bar.zones?.length ? `${bar.zones.length} zones` : "3 zones"}
        </p>

        <div className="flex justify-between items-center">
          <div className="flex gap-4 text-xs">
            <span className="flex items-center gap-1">
              <Icon name="users" className="w-3 h-3" />
              {bar.totalUsersCount || bar.userCount || 0}
            </span>
            <span className="flex items-center gap-1">
              <Icon name="user" className="w-3 h-3" />
              {bar.barmansCount || bar.barmanCount || 0}
            </span>
          </div>

          {(bar.facebookUrl || bar.instagramUrl || bar.hasSocialLinks) && (
            <div className="flex gap-2">
              <Icon name="facebook" className="w-4 h-4 text-blue-600" />
              <Icon name="instagram" className="w-4 h-4 text-pink-600" />
            </div>
          )}
        </div>
      </div>
    </MondrianBlock>
  );
};
