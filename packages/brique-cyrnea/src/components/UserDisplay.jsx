import React from "react";
import { Icon } from "./Icon";

/**
 * Composant unifié pour afficher le nom d'un utilisateur avec accès à son profil
 * quand il a publié des informations (zone, liens URL)
 */
const UserDisplay = ({
  user,
  showProfileLink = true,
  showZone = true,
  showLinks = true,
  className = "",
  onProfileClick = null,
}) => {
  if (!user) return null;

  const hasProfileInfo = showZone && (user.zone || user.metadata?.zone);
  const hasLinks = showLinks && user.public_links && user.public_links.length > 0;
  const shouldShowProfileLink = showProfileLink && (hasProfileInfo || hasLinks);

  const handleClick = () => {
    if (onProfileClick) {
      onProfileClick(user);
    } else if (shouldShowProfileLink) {
      // Navigation par défaut vers le profil
      window.location.href = `/app/${user.room_slug || "cyrnea"}?user=${user.user_id}`;
    }
  };

  const displayName = user.pseudo || user.name || "Anonyme";

  if (!shouldShowProfileLink) {
    // Affichage simple sans lien
    return <span className={`font-bold ${className}`}>{displayName}</span>;
  }

  // Affichage avec lien vers profil
  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-1 font-bold text-mondrian-blue hover:text-mondrian-red transition-colors underline decoration-2 underline-offset-2 hover:decoration-mondrian-red ${className}`}
      title={`Voir le profil de ${displayName}`}
    >
      <Icon name="user" className="w-3 h-3" />
      {displayName}

      {/* Indicateurs visuels pour les informations disponibles */}
      {hasProfileInfo && (
        <Icon name="map" className="w-3 h-3 text-green-600" title="Zone renseignée" />
      )}
      {hasLinks && (
        <Icon name="externalLink" className="w-3 h-3 text-blue-600" title="Liens disponibles" />
      )}
    </button>
  );
};

export default UserDisplay;
