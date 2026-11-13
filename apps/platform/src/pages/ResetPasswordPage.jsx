import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSupabase } from "../contexts/SupabaseContext";
import { eraseRecoveryUrl, recoveryLanding } from "../lib/recoveryLanding.js";

// This route uses the already initialized instance client, never a second Auth client.
// Determine recovery intent on mount, AFTER bootstrap has rerouted the legacy
// root callback, and BEFORE Supabase strips tokens from the URL.
export default function ResetPasswordPage() {
  const [landing] = useState(() => typeof window !== "undefined"
    ? (window.__JHN_RECOVERY_LANDING__ || recoveryLanding(window.location))
    : { expected: false, error: false });
  const { supabase, session, loading } = useSupabase();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    // Supabase detectSessionInUrl handles implicit recovery and PKCE callbacks.
    // Clear all credential-bearing query/fragment data once client initialization finishes.
    eraseRecoveryUrl(window.location, window.history);
    if (landing.error || !landing.expected || !session?.access_token) {
      setError("Lien de récupération invalide ou expiré. Demandez un nouveau courriel.");
      return;
    }
    setReady(true);
  }, [loading, session?.access_token]);

  async function submit(event) {
    event.preventDefault();
    if (!ready || busy || complete || !supabase || !session?.access_token) return;
    if (password.length < 12 || password !== confirm) {
      setError("Le mot de passe doit contenir au moins 12 caractères et les deux saisies doivent correspondre.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setComplete(true);
      setPassword(""); setConfirm("");
    } catch {
      setError("La modification a échoué. Vérifiez la validité du lien ou recommencez la récupération.");
    } finally { setBusy(false); }
  }

  return <main style={{ maxWidth: 520, margin: "3rem auto", padding: "1rem" }}>
    <h1>Réinitialiser le mot de passe</h1>
    {loading ? <p>Vérification de la session…</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    {complete ? <p role="status">Le mot de passe a été modifié. Vous pouvez vous connecter.</p> : null}
    {ready && !complete ? <form onSubmit={submit}>
      <label htmlFor="new-password">Nouveau mot de passe</label>
      <input id="new-password" type="password" autoComplete="new-password" minLength={12}
        value={password} onChange={e => setPassword(e.target.value)} required />
      <label htmlFor="confirm-password">Confirmer le mot de passe</label>
      <input id="confirm-password" type="password" autoComplete="new-password" minLength={12}
        value={confirm} onChange={e => setConfirm(e.target.value)} required />
      <button type="submit" disabled={busy}>{busy ? "Modification…" : "Changer le mot de passe"}</button>
    </form> : null}
    <p><Link to="/">Retour à l’accueil</Link></p>
  </main>;
}
