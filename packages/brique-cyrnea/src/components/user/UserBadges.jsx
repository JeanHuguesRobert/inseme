import React from "react";
import { Icon } from "../Icon"; // Adjust import path if Icon is elsewhere

export const UserStatusBadge = ({ user, showText = true, size = "md", className = "" }) => {
  if (!user) return null;

  const statusInfo = user.statusBadge; // Uses the getter from User entity

  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-4 py-2 text-base",
  };

  const colorClasses = {
    green: "bg-green-100 text-green-800 border-green-200",
    blue: "bg-blue-100 text-blue-800 border-blue-200",
    gray: "bg-gray-100 text-gray-800 border-gray-200",
    yellow: "bg-yellow-100 text-yellow-800 border-yellow-200",
    red: "bg-red-100 text-red-800 border-red-200",
  };

  const indicatorColor =
    {
      green: "bg-green-500",
      blue: "bg-blue-500",
      gray: "bg-gray-400",
      yellow: "bg-yellow-500",
      red: "bg-red-500",
    }[statusInfo.color] || "bg-gray-400";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border ${sizeClasses[size]} ${colorClasses[statusInfo.color]} ${className}`.trim()}
    >
      <div className={`w-2 h-2 rounded-full ${indicatorColor}`} />
      {showText && <span className="font-medium">{statusInfo.text}</span>}
    </span>
  );
};

export const UserRoleBadge = ({ user, showIcon = true, size = "md", className = "" }) => {
  if (!user) return null;

  const roleInfo = user.roleBadge; // Uses the getter from User entity

  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-4 py-2 text-base",
  };

  const colorClasses =
    {
      red: "bg-red-100 text-red-800 border-red-200",
      yellow: "bg-yellow-100 text-yellow-800 border-yellow-200",
      blue: "bg-blue-100 text-blue-800 border-blue-200",
      purple: "bg-purple-100 text-purple-800 border-purple-200",
      green: "bg-green-100 text-green-800 border-green-200",
    }[roleInfo.color] || "bg-gray-100 text-gray-800 border-gray-200";

  const roleIcons = {
    admin: "shield",
    barman: "coffee",
    moderator: "gavel",
    client: "user",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border ${sizeClasses[size]} ${colorClasses} ${className}`.trim()}
    >
      {showIcon && <Icon name={roleIcons[user.role] || "user"} className="w-3 h-3" />}
      <span className="font-medium">{roleInfo.text}</span>
    </span>
  );
};
