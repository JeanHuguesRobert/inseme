// src/pages/UserProfile.jsx
// Page de gestion du profil utilisateur (création et modification)

import { useState, useEffect, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import { CurrentUserContext } from "../contexts/CurrentUserContext.proxy";
import { canWrite, getUserRole, ROLE_ADMIN } from "@inseme/cop-host";
import SiteFooter from "../components/layout/SiteFooter";
import SocialAvatarButton from "../components/SocialAvatarButton";
import RGPDSettings from "../components/rgpd/RGPDSettings";
import CivicPortfolio from "../components/user/CivicPortfolio";

export default function UserProfile() {
  const { currentUser, loading: authLoading, updateProfile } = useContext(CurrentUserContext);
  const navigate = useNavigate();

  // Debug: vérifier les infos de rôle
  console.log("[UserProfile] currentUser:", currentUser);
  console.log("[UserProfile] email:", currentUser?.email);
  console.log("[UserProfile] role:", currentUser?.role);
  console.log(
    "[UserProfile] getUserRole result:",
    currentUser ? getUserRole(currentUser) : "no user"
  );

  const [formData, setFormData] = useState({
    display_name: "",
    neighborhood: "",
    interests: "",
    avatarUrl: "",
    public_profile: true,
    gabriel_enabled: false,
    gabriel_url: "",
    gabriel_key: "",
    gabriel_model: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [enabledProviders, setEnabledProviders] = useState([]);

  // Fetch enabled providers
  useEffect(() => {
    fetch("/api/oauth-providers")
      .then((res) => res.json())
      .then((data) => setEnabledProviders(data.providers || []))
      .catch((err) => console.error("Failed to fetch providers", err));
  }, []);

  // Synchronise le formulaire avec le profil utilisateur
  useEffect(() => {
    if (currentUser) {
      const gabriel = currentUser.metadata?.gabriel || {};
      setFormData({
        display_name: currentUser.display_name || "",
        neighborhood: currentUser.neighborhood || "",
        interests: currentUser.interests || "",
        avatarUrl: currentUser?.metadata?.avatarUrl || "",
        public_profile: currentUser.public_profile !== false, // Default to true
        gabriel_enabled: gabriel.enabled || false,
        gabriel_url: gabriel.url || "",
        gabriel_key: gabriel.key || "",
        gabriel_model: gabriel.model || "",
      });
    } else {
      console.log("[UserProfile] No current user, redirecting to home");
      navigate("/");
    }
  }, [currentUser, navigate]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: "", text: "" });
    try {
      // Ajoute avatarUrl et version dans metadata si présent
      let updates = { ...formData };

      // Gestion de la configuration Gabriel
      const gabrielConfig = {
        enabled: formData.gabriel_enabled,
        url: formData.gabriel_url,
        key: formData.gabriel_key,
        model: formData.gabriel_model,
      };

      // Nettoyage des champs temporaires de formData
      delete updates.gabriel_enabled;
      delete updates.gabriel_url;
      delete updates.gabriel_key;
      delete updates.gabriel_model;

      updates.metadata = {
        ...currentUser?.metadata,
        gabriel: gabrielConfig,
      };

      if (formData.avatarUrl && formData.avatarUrl.match(/^https?:\/\//)) {
        updates.metadata = {
          ...updates.metadata,
          avatarUrl: formData.avatarUrl,
          avatarVersion:
            (currentUser?.metadata?.avatarVersion || currentUser?.metadata?.schemaVersion || 1) + 1,
        };
      }
      const result = await updateProfile(updates);
      if (result.success) {
        setMessage({ type: "success", text: "Profil mis à jour avec succès !" });
      } else {
        setMessage({ type: "error", text: result.error || "Erreur lors de la mise à jour" });
      }
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Erreur lors de la mise à jour" });
    }
    setSaving(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen  flex items-center justify-center">
        <div className="text-gray-300">Chargement du profil...</div>
      </div>
    );
  }

  if (!currentUser) {
    // Affiche le formulaire de création de profil si non connecté
    return (
      <div className="min-h-screen bg-bauhaus-black flex items-center justify-center">
        <div className="max-w-md w-full bg-bauhaus-black border-2 border-bauhaus-yellow p-8 shadow-md">
          <h1 className="text-2xl font-bold text-bauhaus-yellow mb-4">Créer votre profil</h1>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-bauhaus-yellow mb-2">
                Nom d'affichage *
              </label>
              <input
                type="text"
                name="display_name"
                value={formData.display_name}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-bauhaus-yellow focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="Comment souhaitez-vous être appelé ?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-bauhaus-yellow mb-2">
                Quartier / Localisation
              </label>
              <input
                type="text"
                name="neighborhood"
                value={formData.neighborhood}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-bauhaus-yellow focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="Ex: Centre-ville, Porette, etc."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-bauhaus-yellow mb-2">
                Centres d'intérêt / Expertises
              </label>
              <textarea
                name="interests"
                value={formData.interests}
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-2 border border-bauhaus-yellow focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="Ex: urbanisme, culture, environnement, éducation..."
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-orange-600 text-bauhaus-white py-3 px-6 font-semibold hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {saving ? "Enregistrement..." : "Créer le profil"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen  py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="   shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-50">Votre profil</h1>
            <div className="flex items-center gap-3">
              <Link
                to="/user-dashboard"
                className="bg-blue-600 text-bauhaus-white px-4 py-2 hover:bg-blue-700 font-semibold flex items-center gap-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                </svg>
                Votre tableau de bord
              </Link>
              {currentUser && getUserRole(currentUser) === ROLE_ADMIN && (
                <Link
                  to="/admin"
                  className="px-3 py-1 border text-sm bg-primary-600 text-bauhaus-white"
                >
                  Admin
                </Link>
              )}
            </div>
          </div>
          {/* Avatar utilisateur */}
          <div className="flex items-center gap-4 mb-6">
            <div className="avatar-container">
              {(() => {
                // Lecture avatarUrl et version dans metadata
                const metadata = currentUser?.metadata || {};
                const avatarUrl = metadata.avatarUrl || null;
                const avatarVersion = metadata.avatarVersion || metadata.schemaVersion || 1;
                let src = "";
                if (avatarUrl) {
                  if (avatarUrl.startsWith("supabase://")) {
                    // TODO: générer l’URL publique Supabase à partir du chemin
                    src =
                      "https://PLACEHOLDER_SUPABASE_URL/" + avatarUrl.replace("supabase://", "");
                  } else if (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://")) {
                    src = avatarUrl;
                  }
                }
                return src ? (
                  <img
                    src={src}
                    alt="Avatar utilisateur"
                    width={128}
                    height={128}
                    className="avatar-image"
                  />
                ) : (
                  <div className="avatar-placeholder">
                    <span>👤</span>
                  </div>
                );
              })()}
            </div>
            <div className="flex flex-col gap-2">
              {canWrite(currentUser) && enabledProviders.find((p) => p.id === "facebook") && (
                <Link
                  to="/oauth/consent?provider=facebook"
                  className="px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 text-sm"
                >
                  {currentUser?.metadata?.facebookId
                    ? "Re-importer depuis Facebook"
                    : "Importer depuis Facebook"}
                </Link>
              )}
              {currentUser?.metadata?.facebook_consent?.requestedAt && (
                <div className="text-xs text-gray-400">
                  Dernier consentement demandé:{" "}
                  {new Date(currentUser.metadata.facebook_consent.requestedAt).toLocaleString(
                    "fr-FR"
                  )}
                </div>
              )}
              {currentUser?.metadata?.facebook_consent?.grantedAt && (
                <div className="text-xs text-gray-400">
                  Dernier consentement validé:{" "}
                  {new Date(currentUser.metadata.facebook_consent.grantedAt).toLocaleString(
                    "fr-FR"
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-gray-300 text-xs">Avatar</span>
              <span className="text-gray-400 text-xs">
                Version:{" "}
                {currentUser?.metadata?.avatarVersion || currentUser?.metadata?.schemaVersion || 1}
              </span>
            </div>
          </div>
        </div>

        {!canWrite(currentUser) && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 p-4 text-yellow-800">
            ⚠️ Vous êtes connecté en tant qu'utilisateur anonyme partagé. Vous ne pouvez pas
            modifier ce profil.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email (non modifiable) */}
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">Email</label>
            <input
              type="email"
              value={currentUser.email}
              disabled
              className="w-full px-4 py-2 border border-gray-700 bg-gray-800 text-gray-50 cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-gray-400">L'email ne peut pas être modifié</p>
          </div>

          {/* Avatar externe (URL) */}
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">
              Avatar (URL externe)
            </label>
            <input
              type="url"
              name="avatarUrl"
              value={formData.avatarUrl}
              onChange={(e) => setFormData((prev) => ({ ...prev, avatarUrl: e.target.value }))}
              disabled={!canWrite(currentUser)}
              className="w-full px-4 py-2 border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="https://exemple.com/avatar.jpg"
              pattern="https?://.+"
            />
            <p className="mt-1 text-xs text-gray-400">
              Collez une URL d’image publique (JPEG, PNG, WebP, 128x128px recommandé).
            </p>
          </div>

          {/* Social Avatars */}
          {canWrite(currentUser) && enabledProviders.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-200">
                Ou importer depuis :
              </label>
              <div className="flex gap-4 flex-wrap">
                {enabledProviders.map((p) => (
                  <SocialAvatarButton
                    key={p.id}
                    provider={p.id}
                    label={p.name}
                    userId={currentUser.id}
                    onAvatarSuccess={(url) => setFormData((prev) => ({ ...prev, avatarUrl: url }))}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Nom d'affichage */}
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">
              Nom d'affichage *
            </label>
            <input
              type="text"
              name="display_name"
              value={formData.display_name}
              onChange={handleChange}
              required
              disabled={!canWrite(currentUser)}
              className="w-full px-4 py-2 border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="Comment souhaitez-vous être appelé ?"
            />
          </div>

          {/* Quartier */}
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">
              Quartier / Localisation
            </label>
            <input
              type="text"
              name="neighborhood"
              value={formData.neighborhood}
              onChange={handleChange}
              disabled={!canWrite(currentUser)}
              className="w-full px-4 py-2 border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="Ex: Centre-ville, Porette, etc."
            />
          </div>

          {/* Centres d'intérêt */}
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">
              Centres d'intérêt / Expertises
            </label>
            <textarea
              name="interests"
              value={formData.interests}
              onChange={handleChange}
              rows={4}
              disabled={!canWrite(currentUser)}
              className="w-full px-4 py-2 border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="Ex: urbanisme, culture, environnement, éducation..."
            />
            <p className="mt-1 text-xs text-gray-400">
              Cela aide à vous connecter avec des personnes partageant les mêmes intérêts
            </p>
          </div>

          {/* Public Profile Toggle */}
          <div className="bg-gray-800 p-4 rounded border border-gray-700">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="public_profile"
                checked={formData.public_profile}
                onChange={handleChange}
                disabled={!canWrite(currentUser)}
                className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
              />
              <div>
                <div className="font-medium text-gray-200">Profil Public</div>
                <div className="text-xs text-gray-400">
                  Si désactivé, vous ne pourrez pas publier de contenu. Votre activité passée reste
                  visible.
                </div>
              </div>
            </label>
          </div>

          {/* Configuration Gabriel */}
          <div className="bg-gray-800 p-4 rounded border border-gray-700 space-y-4">
            <div className="border-b border-gray-700 pb-2 mb-2">
              <h3 className="text-lg font-bold text-gray-200">Gabriel (Assistant Personnel)</h3>
              <p className="text-xs text-gray-400">
                Configurez votre propre fournisseur d'IA pour Gabriel.
              </p>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="gabriel_enabled"
                checked={formData.gabriel_enabled}
                onChange={handleChange}
                disabled={!canWrite(currentUser)}
                className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
              />
              <span className="font-medium text-gray-200">Activer le fournisseur personnalisé</span>
            </label>

            {formData.gabriel_enabled && (
              <div className="space-y-3 pl-4 border-l-2 border-gray-700 mt-2">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    URL de l'API (Compatible OpenAI)
                  </label>
                  <input
                    type="url"
                    name="gabriel_url"
                    value={formData.gabriel_url}
                    onChange={handleChange}
                    disabled={!canWrite(currentUser)}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-gray-200 focus:border-orange-500"
                    placeholder="https://api.openai.com/v1/chat/completions"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Clé API</label>
                  <input
                    type="password"
                    name="gabriel_key"
                    value={formData.gabriel_key}
                    onChange={handleChange}
                    disabled={!canWrite(currentUser)}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-gray-200 focus:border-orange-500"
                    placeholder="sk-..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Modèle (Optionnel)
                  </label>
                  <input
                    type="text"
                    name="gabriel_model"
                    value={formData.gabriel_model}
                    onChange={handleChange}
                    disabled={!canWrite(currentUser)}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-gray-200 focus:border-orange-500"
                    placeholder="gpt-4-turbo"
                  />
                </div>
              </div>
            )}
          </div>

          {/* RGPD Info */}
          <div className="bg-blue-50 border border-blue-200 p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">🔒 Confidentialité</h3>
            <p className="text-xs text-blue-800">
              Vos informations personnelles ne seront jamais vendues. Votre nom d'affichage est
              visible publiquement dans vos contributions.
            </p>
            {currentUser?.rgpd_consent_date && (
              <p className="text-xs text-blue-700 mt-2">
                Consentement RGPD accepté le{" "}
                {new Date(currentUser.rgpd_consent_date).toLocaleDateString("fr-FR")}
              </p>
            )}
          </div>

          {/* Message de confirmation/erreur */}
          {message.text && (
            <div
              className={`p-4 ${
                message.type === "success"
                  ? "bg-green-50 border border-green-200 text-green-800"
                  : "bg-red-50 border border-red-200 text-red-800"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Boutons */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving || !canWrite(currentUser)}
              className="flex-1 bg-orange-600 text-bauhaus-white py-3 px-6 font-semibold hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {saving ? "Enregistrement..." : "Enregistrer les modifications"}
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-3 border border-gray-300 text-gray-200 hover:bg-gray-50"
            >
              Annuler
            </button>
          </div>
        </form>

        {/* Statistiques du compte */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h2 className="text-lg font-semibold text-gray-50 mb-4">Informations du compte</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-300">Membre depuis:</span>
              <div className="font-medium text-gray-50">
                {currentUser?.created_at
                  ? new Date(currentUser.created_at).toLocaleDateString("fr-FR")
                  : "N/A"}
              </div>
            </div>
            <div>
              <span className="text-gray-300">Dernière modification:</span>
              <div className="font-medium text-gray-50">
                {currentUser?.updated_at
                  ? new Date(currentUser.updated_at).toLocaleDateString("fr-FR")
                  : "N/A"}
              </div>
            </div>
          </div>
        </div>

        {/* Section RGPD - Gestion des données personnelles */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h2 className="text-lg font-semibold text-gray-50 mb-4">🔒 Confidentialité et données</h2>
          <RGPDSettings />
        </div>

        {/* Civic Portfolio */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <CivicPortfolio userId={currentUser.id} />
        </div>
      </div>

      <div className="mt-8">
        <SiteFooter />
      </div>
    </div>
  );
}
