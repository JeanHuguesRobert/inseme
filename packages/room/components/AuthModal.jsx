import React from "react";
import { getSupabase } from "@inseme/cop-host";
import { AuthModal as SharedAuthModal } from "@inseme/ui";

export function AuthModal({
  onClose,
  roomName,
  isUpgrading = false,
  onSpectator,
  initialMode = null,
}) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const supabase = getSupabase();

  // 1. ANONYMOUS
  const handleSignInAnonymously = async (nickname) => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInAnonymously({
        options: {
          data: {
            full_name: nickname || "Invité",
            source: "inseme",
            initial_room: roomName,
          },
        },
      });

      if (error) {
        if (error.message.includes("Anonymous sign-ins are disabled")) {
          throw new Error(
            "L'accès invité est désactivé sur ce serveur Supabase. Veuillez activer 'Anonymous sign-ins' dans Authentication > Providers ou utilisez un compte email."
          );
        }
        throw error;
      }
      onClose();
    } catch (err) {
      console.error("Error signing in anonymously:", err.message);
      setError(err.message || "Erreur lors de la connexion anonyme");
    } finally {
      setLoading(false);
    }
  };

  // 2. EMAIL SIGN IN
  const handleSignInWithPassword = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      onClose();
    } catch (err) {
      console.error("Sign In Error:", err.message);
      setError(
        err.message === "Invalid login credentials" ? "Identifiants incorrects" : err.message
      );
    } finally {
      setLoading(false);
    }
  };

  // 3. SIGN UP
  const handleSignUp = async (email, password, nickname) => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: nickname,
            source: "inseme",
            initial_room: roomName,
          },
        },
      });
      if (error) throw error;

      if (isUpgrading) {
        alert(
          "Votre compte invité a été transformé en compte permanent ! Vous pouvez maintenant vous connecter avec votre email."
        );
      }
      onClose();
    } catch (err) {
      console.error("Sign Up Error:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 4. OAUTH PROVIDERS
  const handleSignInWithProvider = async (provider) => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err) {
      console.error(`Error signing in with ${provider}:`, err.message);
      setError(err.message || `Erreur lors de la connexion avec ${provider}`);
      setLoading(false);
    }
  };

  const sidebar = (
    <div className="w-full bg-mondrian-blue p-12 flex flex-col justify-between text-white relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

      <div className="relative z-10">
        <h3 className="text-3xl font-black tracking-tight mb-4">
          L'Assemblée
          <br />
          Augmentée.
        </h3>
        <p className="text-white/80 font-medium leading-relaxed">
          Rejoignez un espace de délibération nouvelle génération. Votez, débattez et construisez le
          consensus avec l'aide d'Ophélia.
        </p>
      </div>

      <div className="relative z-10 text-xs font-bold uppercase tracking-widest opacity-60">
        Kudocracy v3.0
      </div>
    </div>
  );

  return (
    <SharedAuthModal
      onClose={onClose}
      onSignInAnonymously={handleSignInAnonymously}
      onSignInWithProvider={handleSignInWithProvider}
      onSignInWithPassword={handleSignInWithPassword}
      onSignUp={handleSignUp}
      onSpectator={onSpectator}
      loading={loading}
      error={error}
      roomName={roomName}
      isUpgrading={isUpgrading}
      initialMode={initialMode}
      sidebar={sidebar}
      maxWidth="max-w-4xl"
    />
  );
}

export default AuthModal;
