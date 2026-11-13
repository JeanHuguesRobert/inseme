import { useState } from "react";
import { getSupabase } from "../../lib/supabase.js";
import { ANONYMOUS_EMAIL } from "@inseme/cop-host";
import { useCurrentUser } from "@inseme/cop-host";
import { loadInstanceConfig } from "../../common/config/instanceConfig.client.js";
import { AuthModal as SharedAuthModal } from "@inseme/ui";

export default function AuthModal({ onClose, onSuccess }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState("");
  const { refreshUser } = useCurrentUser();

  const handleSignInWithPassword = async (email, password) => {
    setLoading(true);
    setError("");
    try {
      await loadInstanceConfig();
      const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
      if (error) throw error;

      if (refreshUser) {
        try {
          await refreshUser(data.user);
        } catch (refreshErr) {
          console.error("[DIAG] AuthModal: refreshUser failed", refreshErr);
        }
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (email) => {
    setError("");
    setRecoveryNotice("");
    const address = String(email || "").trim();
    if (!address || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(address)) {
      setError("Indiquez votre adresse email avant de demander un lien de récupération.");
      return;
    }
    setLoading(true);
    try {
      const { error: resetError } = await getSupabase().auth.resetPasswordForEmail(address, {
        // Keep the already configured/allowlisted redirect root. JHN's
        // bootstrap routes the 'recovery' callback to /auth/reset-password.
        redirectTo: window.location.origin,
      });
      if (resetError) throw resetError;
      setRecoveryNotice("Si ce compte existe, un courriel de récupération a été envoyé. Consultez votre boîte de réception.");
    } catch {
      setError("Impossible de demander la récupération actuellement. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignInAnonymously = async () => {
    setLoading(true);
    setError("");
    try {
      await loadInstanceConfig();
      const { error } = await getSupabase().auth.signInWithPassword({
        email: ANONYMOUS_EMAIL,
        password: "Anonymous",
      });
      if (error) throw error;

      if (refreshUser) {
        try {
          await refreshUser();
        } catch (e) {
          console.error(e);
        }
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || "Erreur de connexion anonyme");
    } finally {
      setLoading(false);
    }
  };

  const handleSignInWithProvider = async (provider) => {
    setLoading(true);
    setError("");
    try {
      await loadInstanceConfig();
      const { data, error } = await getSupabase().auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/profile`,
        },
      });
      if (error) throw error;
      console.log(`Starting ${provider} OAuth redirect`, data);
    } catch (err) {
      setError(err.message || `Erreur de connexion ${provider}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (email, password, displayName) => {
    setLoading(true);
    setError("");
    try {
      await loadInstanceConfig();
      if (!displayName) {
        setError("Veuillez entrer un nom d'affichage");
        setLoading(false);
        return;
      }

      const { data, error } = await getSupabase().auth.signUp({ email, password });
      if (error) throw error;

      if (data.user) {
        const { error: insertError } = await getSupabase().from("users").upsert({
          id: data.user.id,
          display_name: displayName,
        });

        if (insertError) {
          console.error("Erreur création user dans table users:", insertError);
          throw insertError;
        }
      }

      if (refreshUser) {
        try {
          await refreshUser();
        } catch (e) {
          console.error(e);
        }
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || "Erreur d'inscription");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SharedAuthModal
      onClose={onClose}
      onSignInAnonymously={handleSignInAnonymously}
      onSignInWithProvider={handleSignInWithProvider}
      onSignInWithPassword={handleSignInWithPassword}
      onSignUp={handleSignUp}
      onForgotPassword={handleForgotPassword}
      loading={loading}
      error={error}
      notice={recoveryNotice}
    />
  );
}
