import React from "react";

/**
 * Liste des utilisateurs connectés à un bar
 */
export const BarConnectedUsers = ({ bar }) => {
  if (!bar) return null;

  const connectedUsers = bar.connectedUsers || [];
  const userCount = connectedUsers.length;

  return (
    <div className="space-y-2">
      <h4 className="font-black uppercase">Utilisateurs connectés ({userCount})</h4>
      {userCount === 0 ? (
        <p className="text-gray-500">Aucun utilisateur connecté</p>
      ) : (
        <div className="space-y-1">
          {connectedUsers.map((user, index) => (
            <div key={user.id || index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
              <div className="w-8 h-8 bg-mondrian-blue text-white rounded-full flex items-center justify-center text-xs font-black">
                {user.pseudo?.charAt(0)?.toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm">{user.pseudo}</div>
                <div className="text-xs text-gray-600">{user.role}</div>
              </div>
              {user.role === "barman" && (
                <span className="bg-mondrian-yellow text-black px-2 py-1 text-xs font-black uppercase">
                  Barman
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
