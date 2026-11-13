import React, { useState, useEffect } from "react";
import {
  Github,
  Facebook,
  Mail,
  User,
  ArrowRight,
  Loader2,
} from "lucide-react";

export default function Login({
  onSignInAnonymously,
  onSignInWithProvider,
  onSignInWithPassword,
  onSignUp,
  onForgotPassword,
  onSpectator,
  loading,
  error,
  notice,
  roomName,
  isUpgrading = false,
  initialMode = null,
  showAnonymous = true,
  showProviders = true,
  showEmail = true,
  labels = {
    title: "Bienvenue",
    subtitle: "Connectez-vous pour continuer",
    anonymousTitle: "Accès Invité",
    anonymousSubtitle: "Participez instantanément",
    signupTitle: "Créer un compte",
    signupSubtitle: "Rejoignez la communauté",
  },
}) {
  const [mode, setMode] = useState(
    initialMode || (isUpgrading ? "signup" : "signin")
  ); // 'signin', 'signup', 'anonymous'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
    }
  }, [initialMode]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (mode === "signin") {
      onSignInWithPassword?.(email, password);
    } else if (mode === "signup") {
      onSignUp?.(email, password, nickname);
    } else if (mode === "anonymous") {
      onSignInAnonymously?.(nickname, isPublic);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full max-w-sm mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      {roomName && (
        <div className="mb-4 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full">
          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">
            {roomName}
          </p>
        </div>
      )}
      <div className="text-center space-y-2 mb-8">
        <h2 className="text-3xl font-black text-gray-900 tracking-tight">
          {mode === "signup"
            ? labels.signupTitle
            : mode === "anonymous"
              ? labels.anonymousTitle
              : labels.title}
        </h2>
        <p className="text-gray-500 text-sm font-medium">
          {mode === "signup"
            ? labels.signupSubtitle
            : mode === "anonymous"
              ? labels.anonymousSubtitle
              : labels.subtitle}
        </p>
      </div>

      {error && (
        <div className="w-full p-3 mb-6 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-100 text-center uppercase tracking-wide">
          {error}
        </div>
      )}

      {notice ? <p role="status" className="w-full p-3 mb-4 rounded-xl bg-emerald-50 text-emerald-900 text-sm">{notice}</p> : null}

      <form onSubmit={handleSubmit} className="w-full space-y-4">
        {(mode === "signup" || mode === "anonymous") && (
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-gray-400 tracking-widest px-1">
              Pseudonyme
            </label>
            <input
              type="text"
              required
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Comment doit-on vous appeler ?"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium text-gray-900"
            />
          </div>
        )}

        {mode === "anonymous" && (
          <div className="flex items-center gap-2 px-1">
            <input
              type="checkbox"
              id="public-browser"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label
              htmlFor="public-browser"
              className="text-xs text-gray-500 font-medium cursor-pointer select-none"
            >
              Ceci est un ordinateur public
            </label>
          </div>
        )}

        {(mode === "signin" || mode === "signup") && (
          <>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-gray-400 tracking-widest px-1">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium text-gray-900"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-gray-400 tracking-widest px-1">
                Mot de passe
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium text-gray-900"
              />
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-gray-900 hover:bg-black text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-gray-200 flex items-center justify-center gap-2 disabled:opacity-50 group"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              {mode === "signup"
                ? "Créer mon compte"
                : mode === "anonymous"
                  ? "Entrer dans la salle"
                  : "Se connecter"}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </form>

      {mode === "signin" && onForgotPassword ? (
        <button
          type="button"
          onClick={() => onForgotPassword(email)}
          disabled={loading}
          className="mt-4 text-sm font-semibold text-indigo-600 hover:underline disabled:opacity-50"
        >
          Mot de passe oublié ?
        </button>
      ) : null}

      <div className="w-full mt-8 space-y-6">
        {showProviders && (mode === "signin" || mode === "signup") && (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-black tracking-[0.2em] text-gray-400">
                <span className="bg-white px-4">Ou continuer avec</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => onSignInWithProvider?.("facebook")}
                className="flex items-center justify-center gap-2 py-3 px-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors font-bold text-xs text-gray-600"
              >
                <Facebook className="w-4 h-4 text-[#1877F2]" />
                Facebook
              </button>
              <button
                onClick={() => onSignInWithProvider?.("github")}
                className="flex items-center justify-center gap-2 py-3 px-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors font-bold text-xs text-gray-600"
              >
                <Github className="w-4 h-4" />
                GitHub
              </button>
            </div>
          </>
        )}

        <div className="flex flex-col items-center gap-4 pt-2">
          {mode === "signin" && (
            <>
              <button
                onClick={() => setMode("signup")}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
              >
                Pas encore de compte ? S'inscrire
              </button>
              {showAnonymous && (
                <button
                  onClick={() => setMode("anonymous")}
                  className="text-xs font-bold text-gray-400 hover:text-gray-600 flex items-center gap-2"
                >
                  <User className="w-3 h-3" />
                  Continuer en tant qu'invité
                </button>
              )}
            </>
          )}
          {mode === "signup" && (
            <button
              onClick={() => setMode("signin")}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
            >
              Déjà un compte ? Se connecter
            </button>
          )}
          {mode === "anonymous" && (
            <button
              onClick={() => setMode("signin")}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
            >
              Utiliser un compte existant
            </button>
          )}

          {onSpectator && mode === "anonymous" && (
            <button
              onClick={onSpectator}
              className="text-xs font-bold text-gray-400 hover:text-gray-600"
            >
              Entrer en mode spectateur uniquement
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
