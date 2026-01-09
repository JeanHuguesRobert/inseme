import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSupabase, useCurrentUser, getFederationConfig, AuthModal } from "@inseme/cop-host";

export default function FilSubmissionForm() {
  const { currentUser } = useCurrentUser();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    external_url: "",
    federated: false,
  });

  // Auto-infer source_type from URL
  const inferSourceType = (url) => {
    if (!url) return "internal";
    try {
      const urlObj = new URL(url);
      const currentHost = window.location.hostname;
      return urlObj.hostname === currentHost ? "internal" : "external";
    } catch {
      return "external";
    }
  };

  // Check for duplicates (same URL in last 24h)
  const checkDuplicate = async (url) => {
    if (!url) return null;
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await getSupabase()
      .from("posts")
      .select("id, metadata, created_at")
      .ilike("metadata->>type", "fil_%")
      .eq("metadata->>external_url", url)
      .gte("created_at", yesterday)
      .limit(1);
    return data && data.length > 0 ? data[0] : null;
  };

  async function handleSubmit(e) {
    e.preventDefault();

    // Auth check - show modal instead of alert
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }

    // Validate: need either title or URL
    if (!formData.title.trim() && !formData.external_url.trim()) {
      alert("Veuillez fournir un titre ou une URL.");
      return;
    }

    setLoading(true);
    try {
      // Duplicate check
      const duplicate = await checkDuplicate(formData.external_url);
      if (duplicate && !duplicateWarning) {
        setDuplicateWarning(duplicate);
        setLoading(false);
        return; // Show warning, user can click again to override
      }

      const {
        data: { session },
      } = await getSupabase().auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Session expirée. Reconnectez-vous.");

      const source_type = inferSourceType(formData.external_url);

      const response = await fetch("/api/fil/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: formData.title.trim() || null, // Optional
          content: formData.content,
          type: "fil_link",
          source_type,
          external_url: formData.external_url || null,
          federated: formData.federated,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Échec de la soumission");
      }

      navigate("/fil");
    } catch (err) {
      console.error("Submission error:", err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  const fedConfig = getFederationConfig();

  return (
    <div className="max-w-xl mx-auto p-4">
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} onSuccess={() => setShowAuthModal(false)} />
      )}

      <h1 className="text-2xl font-bold mb-6">Ajouter au Fil</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">URL (optionnel)</label>
          <input
            type="url"
            className="w-full p-3 border rounded bg-gray-50 focus:bg-white transition-colors"
            placeholder="https://..."
            value={formData.external_url}
            onChange={(e) => {
              setFormData({ ...formData, external_url: e.target.value });
              setDuplicateWarning(null);
            }}
          />
          {duplicateWarning && (
            <div className="mt-2 p-3 bg-amber-50 text-amber-800 text-sm rounded border border-amber-200">
              ⚠️ Un lien identique a déjà été posté il y a moins de 24h. Cliquez à nouveau sur "Publier" pour confirmer.
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Titre</label>
          <input
            type="text"
            className="w-full p-3 border rounded bg-gray-50 focus:bg-white transition-colors"
            placeholder="Titre de l'information"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Commentaire (optionnel)</label>
          <textarea
            className="w-full p-3 border rounded bg-gray-50 focus:bg-white transition-colors"
            rows={4}
            placeholder="Pourquoi cette info est-elle importante ?"
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          />
        </div>

        {fedConfig?.enabled && (
          <div className="flex items-center gap-2 p-4 bg-blue-50 rounded-lg border border-blue-100">
            <input
              type="checkbox"
              id="federated"
              className="w-5 h-5"
              checked={formData.federated}
              onChange={(e) => setFormData({ ...formData, federated: e.target.checked })}
            />
            <label htmlFor="federated" className="text-sm text-blue-800 font-medium cursor-pointer">
              Diffuser cette information sur le réseau Inseme (Fédération)
            </label>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex-1 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className={`flex-1 py-3 rounded font-bold text-white transition-all ${
              loading ? "bg-gray-400 cursor-not-allowed" : "bg-bauhaus-black hover:scale-[1.02] active:scale-95 shadow-lg"
            }`}
          >
            {loading ? "Envoi..." : "Publier"}
          </button>
        </div>
      </form>
    </div>
  );
}
