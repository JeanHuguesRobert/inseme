import React, { useState, useMemo } from "react";
import { UserCard } from "./UserCard";

export const UserList = ({
  users,
  showStatus = true,
  showRole = true,
  compact = true,
  searchable = false,
  onUserClick = null,
  className = "",
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredUsers = useMemo(() => {
    if (!searchTerm) return users;
    return users.filter((user) => user.matches(searchTerm));
  }, [users, searchTerm]);

  return (
    <div className={`user-list ${className}`.trim()}>
      {/* Recherche */}
      {searchable && (
        <div className="mb-4">
          <input
            type="text"
            placeholder="Rechercher un utilisateur..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
      )}

      {/* Liste des utilisateurs */}
      <div className="space-y-2">
        {filteredUsers.length > 0 ? (
          filteredUsers.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              showStatus={showStatus}
              showRole={showRole}
              compact={compact}
              onClick={onUserClick}
              className="hover:bg-gray-50 p-2 rounded border border-transparent hover:border-gray-200 transition-colors"
            />
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">Aucun utilisateur trouvé</div>
        )}
      </div>

      {/* Statistiques */}
      <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-600">
        {filteredUsers.length} utilisateur{filteredUsers.length > 1 ? "s" : ""} affiché
        {filteredUsers.length > 1 ? "s" : ""}
      </div>
    </div>
  );
};
