import { useCurrentUser } from "@inseme/cop-host";
import PostEditor from "../components/social/PostEditor";
import SiteFooter from "../components/layout/SiteFooter";

/**
 * Page création de post
 */
export default function PostCreate() {
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
        <p className="text-gray-300 mb-4">Vous devez être connecté pour créer une publication</p>
        <a href="/login" className="text-primary-600 hover:underline">
          Se connecter
        </a>
      </div>
    );
  }

  return (
    <>
      <PostEditor currentUser={currentUser} />
      <SiteFooter />
    </>
  );
}
