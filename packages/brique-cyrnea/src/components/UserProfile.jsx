import React, { useState } from "react";
import { Icon } from "./Icon";
import UserDisplay from "./UserDisplay";
import { usePresenceData } from "../hooks/usePresenceData.js";

/**
 * Modal ou panneau pour afficher le profil complet d'un utilisateur
 * avec ses informations publiques (zone, liens, etc.)
 */
const UserProfile = ({ user, isOpen, onClose, isEditable = false, onEdit = null }) => {
  const { getUserPresence } = usePresenceData();
  const [isEditing, setIsEditing] = useState(false);

  if (!isOpen || !user) return null;

  // Récupérer les données enrichies de l'utilisateur (Compatible Entity & Plain Object)
  const userZone = user.zone || getUserPresence(user.id || user.user_id)?.zone;
  const userLinks =
    user.public_links ||
    user.publicLinks ||
    getUserPresence(user.id || user.user_id)?.public_links ||
    [];

  const enrichedUser = {
    // Base properties (handle both Entity instance vs Plain object)
    id: user.id || user.user_id,
    pseudo: user.pseudo || user.display_name || user.name || "Anonyme",
    role: user.role || "client",

    // Computed/Enriched
    zone: userZone,
    public_links: userLinks,
  };

  // Try to get status from presence/bar if available
  let status = null;
  try {
    // Prefer TheBar authoritative user entry
    // Use dynamic import to avoid circular deps during SSR
    const { TheBar } = require("@inseme/brique-cyrnea");
    const barUser = TheBar?.getUser?.(enrichedUser.id);
    status = barUser?.status || null;
  } catch (_e) {
    // fallback: presence data
    const presence = getUserPresence(enrichedUser.id);
    status = presence?.status || null;
  }

  const displayName = enrichedUser.pseudo || enrichedUser.name || "Anonyme";
  const hasZone = enrichedUser.zone;
  const hasLinks = enrichedUser.public_links && enrichedUser.public_links.length > 0;

  const handleEdit = () => {
    if (onEdit) {
      onEdit(enrichedUser);
    } else {
      setIsEditing(!isEditing);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
      <div className="bg-white border-8 border-black shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] max-w-md w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-mondrian-blue text-white p-6 border-b-4 border-black">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon name="user" className="w-8 h-8" />
              <h2 className="text-2xl font-black uppercase tracking-tighter">
                Profil de {displayName}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="bg-white/20 hover:bg-white/30 p-2 border-2 border-white transition-colors"
            >
              <Icon name="x" className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contenu */}
        <div className="p-6 space-y-6">
          {/* Informations de base */}
          <div className="bg-gray-50 border-4 border-black p-4">
            <h3 className="text-sm font-black uppercase mb-3">Informations</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Icon name="user" className="w-4 h-4" />
                <span className="font-bold">{displayName}</span>
              </div>

              {/* Status (user-defined) */}
              {status && <div className="text-sm text-gray-700 italic">“{status.text}”</div>}

              {enrichedUser.role && (
                <div className="text-sm text-gray-600">Rôle: {enrichedUser.role}</div>
              )}
            </div>
          </div>

          {/* Zone */}
          {hasZone && (
            <div className="bg-green-50 border-4 border-green-400 p-4">
              <h3 className="text-sm font-black uppercase mb-3 flex items-center gap-2">
                <Icon name="map" className="w-4 h-4" />
                Zone
              </h3>
              <div className="font-bold text-green-800">
                {enrichedUser.zone === "indoor" ? "Intérieur" : "Extérieur"}
              </div>
            </div>
          )}

          {/* Liens publics */}
          {hasLinks && (
            <div className="bg-blue-50 border-4 border-blue-400 p-4">
              <h3 className="text-sm font-black uppercase mb-3 flex items-center gap-2">
                <Icon name="externalLink" className="w-4 h-4" />
                Liens publics
              </h3>
              <div className="space-y-2">
                {enrichedUser.public_links.map((link, index) => (
                  <a
                    key={index}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-white border-2 border-black p-3 hover:bg-mondrian-yellow transition-colors"
                  >
                    <div className="font-black text-sm">{link.label}</div>
                    <div className="text-xs text-gray-600 truncate">{link.url}</div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {isEditable && (
            <div className="flex gap-3">
              <button
                onClick={handleEdit}
                className="flex-1 bg-mondrian-red text-white border-4 border-black font-black uppercase py-3 hover:bg-black transition-colors flex items-center justify-center gap-2"
              >
                <Icon name="edit2" className="w-4 h-4" />
                Modifier
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
