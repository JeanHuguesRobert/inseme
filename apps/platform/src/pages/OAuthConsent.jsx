import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCurrentUser } from "@inseme/cop-host";
import { useSocialAvatar } from "../hooks/useSocialAvatar.js";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export default function OAuthConsent() {
  const q = useQuery();
  const provider = q.get("provider") || "facebook";
  const navigate = useNavigate();
  const { currentUser, loading } = useCurrentUser();
  const { start } = useSocialAvatar(provider);

  const handleAuthorize = async () => {
    try {
      await start();
    } catch (err) {
      console.error("Consent authorize error", err);
    }
  };

  return (
    <div className="page oauth-consent">
      <h1 className="page-title">Autorisation {provider}</h1>
      <p>
        Vous êtes sur le point d'autoriser l'importation de votre avatar depuis {provider}. Nous
        n'accéderons qu'à votre photo de profil publique et nous ne partagerons pas vos
        informations.
      </p>
      <div style={{ marginTop: 12 }}>
        {loading ? (
          <div>Chargement...</div>
        ) : currentUser ? (
          <div>
            <button onClick={handleAuthorize} className="btn btn-primary">
              Autoriser avec {provider}
            </button>
            <button onClick={() => navigate(-1)} className="btn btn-link">
              Annuler
            </button>
          </div>
        ) : (
          <div>
            <p>Vous devez être connecté pour continuer.</p>
            <button onClick={() => navigate("/signin")} className="btn btn-primary">
              Se connecter
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
