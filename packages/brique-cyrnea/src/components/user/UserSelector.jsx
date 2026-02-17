import React, { useState, useMemo } from "react";
import { Icon } from "../Icon";
import { UserAvatar } from "./UserAvatar";
import { UserRoleBadge, UserStatusBadge } from "./UserBadges";

export const UserSelector = ({
  users,
  selectedUserId = null,
  onSelect = null,
  placeholder = "Sélectionner un utilisateur...",
  showStatus = true,
  showRole = true,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredUsers = useMemo(() => {
    if (!searchTerm) return users;
    return users.filter((user) => user.matches(searchTerm));
  }, [users, searchTerm]);

  const selectedUser = users.find((u) => u.id === selectedUserId);

  return (
    <div className={`user-selector relative ${className}`.trim()}>
      {/* Bouton de sélection */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-left flex items-center justify-between"
      >
        {selectedUser ? (
          <div className="flex items-center gap-2">
            <UserAvatar user={selectedUser} size="sm" />
            <span>{selectedUser.pseudo}</span>
            {showRole && <UserRoleBadge user={selectedUser} size="sm" />}
            {showStatus && <UserStatusBadge user={selectedUser} size="sm" />}
          </div>
        ) : (
          <span className="text-gray-500">{placeholder}</span>
        )}

        <Icon name="chevronDown" className="w-4 h-4" />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-hidden flex flex-col">
          {/* Champ de recherche */}
          <div className="p-2 border-b border-gray-200">
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              autoFocus
            />
          </div>

          {/* Liste des utilisateurs */}
          <div className="flex-1 overflow-y-auto max-h-48">
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => {
                    if (onSelect) onSelect(user.id);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center gap-2 ${
                    selectedUserId === user.id ? "bg-blue-50" : ""
                  }`}
                >
                  <UserAvatar user={user} size="sm" />
                  <span>{user.pseudo}</span>
                  {showRole && <UserRoleBadge user={user} size="sm" />}
                  {showStatus && <UserStatusBadge user={user} size="sm" />}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-gray-500 text-sm text-center">
                Aucun utilisateur trouvé
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
