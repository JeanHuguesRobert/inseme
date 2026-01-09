import { isAnonymous } from "@inseme/cop-host";
import { useSubscription } from "../../lib/useSubscription.js";

/**
 * Bouton d'abonnement universel pour tout type de contenu
 */
export default function SubscribeButton({ contentType, contentId, currentUser, className = "" }) {
  const { isSubscribed, loading, subscriberCount, subscribe, unsubscribe } = useSubscription(
    contentType,
    contentId,
    currentUser
  );

  const handleClick = async () => {
    if (!currentUser || isAnonymous(currentUser)) {
      alert("Vous devez être connecté pour vous abonner");
      return;
    }

    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  if (loading) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-sm text-gray-400">Chargement...</span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <button
        onClick={handleClick}
        disabled={!currentUser}
        className={`inline-flex items-center gap-2 px-4 py-2 font-medium transition-colors ${
          isSubscribed
            ? "bg-blue-600 text-bauhaus-white hover:bg-blue-700"
            : " text-blue-600 border-2 border-blue-600 hover:bg-blue-50"
        } ${!currentUser ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        title={!currentUser ? "Connectez-vous pour vous abonner" : ""}
      >
        <span className="text-lg">{isSubscribed ? "✓" : "🔔"}</span>
        <span>{isSubscribed ? "Abonné" : "S'abonner"}</span>
      </button>

      {subscriberCount > 0 && (
        <span className="text-sm text-gray-300">
          {subscriberCount} abonné{subscriberCount > 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}
