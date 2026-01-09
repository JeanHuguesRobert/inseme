import React, { useEffect, useState, useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CurrentUserContext } from "../contexts/CurrentUserContext.proxy";
import { useSocialAvatar } from "../hooks/useSocialAvatar.js";

export default function OAuthCallback() {
  const navigate = useNavigate();
  const { provider } = useParams();
  const { currentUser } = useContext(CurrentUserContext);
  const { completeIfCallback } = useSocialAvatar(provider);
  const [state, setState] = useState({ loading: true, error: null });

  useEffect(() => {
    let isMounted = true;
    async function handle() {
      setState({ loading: true, error: null });
      // Callback URL logged during development - removed for production
      try {
        // attempt to complete the OAuth flow; completeIfCallback expects a userId only
        // when a user is logged in. If not logged-in, the hook will throw an error.
        await completeIfCallback(currentUser?.id);
        if (!isMounted) return;
        // Redirect to profile on success
        navigate("/profile", { replace: true });
      } catch (err) {
        console.error("OAuth callback error", err);
        if (!isMounted) return;
        // Provide a user-friendly message for common state mismatch
        const msg =
          err?.message && err.message.toLowerCase().includes("state")
            ? "L'autorisation a échoué — assurez-vous d'avoir démarré la connexion depuis votre profil et réessayez."
            : err?.message || "Failed to complete OAuth";
        setState({ loading: false, error: msg });
        // Give user a moment, then route back to profile
        setTimeout(() => navigate("/profile"), 2000);
      }
    }
    handle();
    return () => {
      isMounted = false;
    };
    // We intentionally only run on mount and provider change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, currentUser?.id]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        {state.loading && <div>Traitement de l'autorisation...</div>}
        {state.error && (
          <div className="text-red-600">
            Erreur lors de la connexion: {state.error}
            <div className="mt-2">Vous allez être redirigé...</div>
          </div>
        )}
      </div>
    </div>
  );
}
