import React from "react";

/**
 * Statistiques d'un bar
 */
export const BarStats = ({ bar }) => {
  if (!bar) return null;

  const userCount = bar.totalUsersCount ?? bar.userCount ?? 0;
  const barmanCount = bar.barmansCount ?? bar.barmanCount ?? 0;
  // publicLinks is likely on the bar settings or computed
  const linksCount = bar.publicLinks?.length ?? bar.settings?.publicLinks?.length ?? 0;

  return (
    <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
      <div className="text-center">
        <div className="text-2xl font-bold text-mondrian-blue">{userCount}</div>
        <div className="text-xs text-gray-600">Utilisateurs</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-mondrian-yellow">{barmanCount}</div>
        <div className="text-xs text-gray-600">Barmans</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-mondrian-red">{linksCount}</div>
        <div className="text-xs text-gray-600">Liens</div>
      </div>
    </div>
  );
};
