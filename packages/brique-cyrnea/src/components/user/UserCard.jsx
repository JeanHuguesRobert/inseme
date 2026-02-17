import React from "react";
import { UserAvatar } from "./UserAvatar";
import { UserRoleBadge, UserStatusBadge } from "./UserBadges";

/**
 * Carte utilisateur standard
 */
export const UserCard = ({
  user,
  showStatus = true,
  showRole = true,
  showZone = false,
  showLinks = false,
  compact = false,
  onClick = null,
  className = "",
}) => {
  if (!user) return null;

  const displayInfo = user.getDisplayInfo();

  return (
    <div
      className={`user-card ${compact ? "compact" : ""} ${className} ${onClick ? "cursor-pointer" : ""}`.trim()}
      onClick={onClick ? () => onClick(user) : undefined}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <UserAvatar user={user} size={compact ? "sm" : "md"} showStatus={false} />

        {/* Informations */}
        <div className="flex-1">
          <h3 className={`font-bold ${compact ? "text-sm" : "text-lg"}`}>{displayInfo.pseudo}</h3>

          {showRole && (
            <div className="text-sm text-gray-600">
              <UserRoleBadge user={user} size="sm" showIcon={!compact} />
            </div>
          )}

          {showZone && <div className="text-xs text-gray-500">Zone: {user.zone}</div>}
        </div>

        {/* Status (Right side) */}
        {showStatus && (
          <div className="flex flex-col items-end gap-1">
            <UserStatusBadge user={user} size="sm" showText={!compact} />
            {!compact && <span className="text-xs text-gray-500">{displayInfo.lastSeen}</span>}
          </div>
        )}
      </div>

      {/* Liens publics */}
      {showLinks && user.hasPublicLinks && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="text-sm font-semibold mb-2">Liens publics</div>
          <div className="flex flex-wrap gap-2">
            {user.publicLinks.slice(0, 3).map((link, index) => (
              <a
                key={index}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded hover:bg-blue-200"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
