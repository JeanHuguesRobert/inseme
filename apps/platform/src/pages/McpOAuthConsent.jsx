import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { ANONYMOUS_EMAIL } from "@inseme/cop-host";
import AuthModal from "../components/common/AuthModal";
import { useSupabase } from "../contexts/SupabaseContext";
import { isPersonalOAuthSession, readOAuthAuthorizationId,
  validateOAuthDetails, validateOAuthRedirect } from "./mcpOAuthConsent.js";

const scopeLabels = {
  openid: "Vous identifier",
  profile: "Lire votre profil",
  email: "Lire votre adresse électronique",
  phone: "Lire votre numéro de téléphone",
  offline_access: "Rester connecté après cette session",
};

export default function McpOAuthConsent() {
  const { search } = useLocation();
  const authorizationId = readOAuthAuthorizationId(search);
  const { supabase, session, loading } = useSupabase();
  const userId = isPersonalOAuthSession(session?.user, ANONYMOUS_EMAIL)
    ? session.user.id : null;
  const [details, setDetails] = useState(null);
  const [error, setError] = useState("");
  const [showAuth, setShowAuth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const actionPending = useRef(false);
  const current = useRef(null);
  current.current = { authorizationId, userId };

  useEffect(() => {
    let cancelled = false;
    setDetails(null);
    setError("");
    if (!authorizationId || !userId || !supabase || loading) return;
    async function load() {
      try {
        const { data, error: failure } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
        if (cancelled) return;
        if (failure) throw failure;
        if (data?.redirect_url) {
          // Already granted by the authenticated user, as attested by Supabase.
          window.location.assign(validateOAuthRedirect(data.redirect_url));
          return;
        }
        setDetails({ ...validateOAuthDetails(data, authorizationId, userId), userId });
      } catch {
        if (!cancelled) setError("Impossible de retrouver cette demande. Réessayez ou revenez à votre assistant.");
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [authorizationId, userId, supabase, loading, attempt]);

  const active = details?.id === authorizationId && details?.userId === userId ? details : null;
  async function decide(approve) {
    if (!active || actionPending.current || !supabase) return;
    actionPending.current = true;
    setBusy(true);
    setError("");
    try {
      const oauth = supabase.auth.oauth;
      const { data, error: failure } = approve
        ? await oauth.approveAuthorization(active.id, { skipBrowserRedirect: true })
        : await oauth.denyAuthorization(active.id, { skipBrowserRedirect: true });
      if (failure) throw failure;
      if (current.current.authorizationId !== active.id || current.current.userId !== active.userId)
        return;
      window.location.assign(validateOAuthRedirect(data?.redirect_url, active.redirect));
    } catch {
      setError("La connexion n’a pas été confirmée. Rechargez la demande avant de réessayer.");
      setDetails(null);
    } finally {
      actionPending.current = false;
      setBusy(false);
    }
  }

  return <main style={{ maxWidth: 520, margin: "2rem auto", padding: "1rem" }}>
    <h1>Connecter votre assistant</h1>
    {!authorizationId ? <p role="alert">Demande de connexion invalide.</p> : null}
    {authorizationId && loading ? <p role="status">Connexion en cours…</p> : null}
    {authorizationId && !loading && !userId ? <>
      <p>Connectez-vous à votre compte Cogentia.</p>
      <button className="btn btn-primary" onClick={() => setShowAuth(true)}>Se connecter</button>
    </> : null}
    {authorizationId && userId && !active && !error ? <p role="status">Recherche de la demande…</p> : null}
    {active ? <>
      <p><strong>{active.clientName}</strong> souhaite se connecter à votre compte Cogentia.</p>
      <ul>{active.scopes.map(scope => <li key={scope}>{scopeLabels[scope] || scope}</li>)}</ul>
      <p>Retour vers {new URL(active.redirect).hostname}. Cette connexion ne crée aucun mandat de travail.</p>
      <button className="btn btn-primary" disabled={busy} onClick={() => decide(true)}>Connecter</button>{" "}
      <button className="btn" disabled={busy} onClick={() => decide(false)}>Refuser</button>
    </> : null}
    {error ? <><p role="alert">{error}</p><button disabled={busy} onClick={() => setAttempt(n => n + 1)}>Recharger la demande</button></> : null}
    {showAuth ? <AuthModal onClose={() => setShowAuth(false)}
      showAnonymous={false} showProviders={false} /> : null}
  </main>;
}
