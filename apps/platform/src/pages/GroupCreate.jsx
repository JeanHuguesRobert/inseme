import { useCurrentUser } from "@inseme/cop-host";
import GroupForm from "../components/social/GroupForm";

/**
 * Page création de groupe
 */
export default function GroupCreate() {
  const { currentUser, userStatus } = useCurrentUser();

  if (userStatus === "signing_in") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-300 mb-4">Chargement de votre profil utilisateur...</p>
      </div>
    );
  }
  if (userStatus === "signed_out" || !currentUser) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-300 mb-4">Vous devez être connecté pour créer un groupe</p>
        <a href="/login" className="text-primary-600 hover:underline">
          Se connecter
        </a>
      </div>
    );
  }

  return <GroupForm currentUser={currentUser} />;
}
