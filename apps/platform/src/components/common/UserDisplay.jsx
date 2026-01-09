import { useUserProfileById } from "@inseme/cop-host";

/**
 * Affichage compact d'un nom d'utilisateur avec infos optionnelles
 */
export default function UserDisplay({ userId, showNeighborhood = false, className = "" }) {
  const { profile, loading } = useUserProfileById(userId);

  if (loading) {
    return <span className={`text-gray-400 ${className}`}>Chargement...</span>;
  }

  if (!profile) {
    return <span className={`text-gray-400 ${className}`}>Utilisateur inconnu</span>;
  }

  return (
    <span className={className}>
      <span className="font-medium">{profile.display_name || profile.id}</span>
      {showNeighborhood && profile.neighborhood && (
        <span className="text-gray-400 text-sm ml-2">📍 {profile.neighborhood}</span>
      )}
    </span>
  );
}
