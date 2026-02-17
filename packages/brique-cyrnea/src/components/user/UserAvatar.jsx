import React from "react";

/**
 * Avatar utilisateur standardisé
 * @param {Object} props
 * @param {import('../../entities/User').User} props.user - L'entité User riche
 * @param {string} props.size - 'sm', 'md', 'lg', 'xl'
 * @param {boolean} props.showStatus - Afficher la pastille de statut
 * @param {string} props.className - Classes CSS additionnelles
 */
export const UserAvatar = ({ user, size = "md", showStatus = true, className = "" }) => {
  if (!user) return null;

  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-12 h-12 text-sm",
    lg: "w-16 h-16 text-lg",
    xl: "w-20 h-20 text-xl",
  };

  const statusColor = user.isOnline ? "bg-green-500" : "bg-gray-400";

  return (
    <div className={`relative inline-block ${className}`.trim()}>
      <div
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center text-white font-bold border-2 border-black overflow-hidden ${statusColor}`}
      >
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.pseudo}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          user.initials
        )}
      </div>

      {showStatus && (
        <div
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${statusColor}`}
        />
      )}
    </div>
  );
};
