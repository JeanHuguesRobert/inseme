import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSupabase } from "../../lib/supabase.js";
import { useCurrentUser } from "@inseme/cop-host";
import { isAdmin } from "@inseme/cop-host";
import { getFederationConfig } from "../../common/config/instanceConfig.client.js";
import AuthModal from "../common/AuthModal";
import SiteFooter from "../layout/SiteFooter";

export default function FilSubmissionForm() {
  const { currentUser, userStatus } = useCurrentUser();
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
      alert("Erreur: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    // User is now logged in, they can click submit again
  };

  return (
    <>
      <div
        style={{
          maxWidth: 600,
          margin: "2rem auto",
          padding: "1.5rem",
          background: "var(--color-bg-app)",
          border: "2px solid var(--color-border-strong)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.5rem",
            fontWeight: 700,
            marginBottom: "1rem",
            color: "var(--color-content-primary)",
          }}
        >
          Ajouter au Fil
        </h2>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          {/* URL Field - Primary */}
          <div>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                marginBottom: 4,
                color: "var(--color-content-primary)",
              }}
            >
              Lien (URL)
            </label>
            <input
              type="url"
              style={{
                width: "100%",
                padding: "0.5rem",
                border: "1px solid var(--color-border-medium)",
                fontFamily: "var(--font-body)",
              }}
              value={formData.external_url}
              onChange={(e) => {
                setFormData({ ...formData, external_url: e.target.value });
                setDuplicateWarning(null);
              }}
              placeholder="https://..."
            />
          </div>

          {/* Title Field - Optional */}
          <div>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                marginBottom: 4,
                color: "var(--color-content-primary)",
              }}
            >
              Titre{" "}
              <span style={{ fontWeight: 400, color: "var(--color-content-secondary)" }}>
                (optionnel, l'URL sera utilisée si vide)
              </span>
            </label>
            <input
              type="text"
              style={{
                width: "100%",
                padding: "0.5rem",
                border: "1px solid var(--color-border-medium)",
                fontFamily: "var(--font-body)",
              }}
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Fermeture du pont..."
            />
          </div>

          {/* Content Field - Optional */}
          <div>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                marginBottom: 4,
                color: "var(--color-content-primary)",
              }}
            >
              Description{" "}
              <span style={{ fontWeight: 400, color: "var(--color-content-secondary)" }}>
                (optionnel)
              </span>
            </label>
            <textarea
              style={{
                width: "100%",
                padding: "0.5rem",
                border: "1px solid var(--color-border-medium)",
                fontFamily: "var(--font-body)",
                minHeight: 80,
                resize: "vertical",
              }}
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Détails supplémentaires..."
            />
          </div>

          {/* Federation Toggle - Ascending Subsidiarity (only show if there's a parent hub) */}
          {getFederationConfig().parentHubUrl && (
            <div
              style={{
                padding: "1rem",
                background: "var(--color-surface-secondary)",
                border: "1px solid var(--color-border-medium)",
                display: "flex",
                gap: "0.5rem",
                alignItems: "flex-start",
              }}
            >
              <input
                type="checkbox"
                id="federated_check"
                checked={formData.federated}
                onChange={(e) => setFormData({ ...formData, federated: e.target.checked })}
                style={{ marginTop: 4, transform: "scale(1.2)" }}
              />
              <label htmlFor="federated_check" style={{ cursor: "pointer" }}>
                <div
                  style={{
                    fontWeight: 700,
                    color: "var(--color-action-primary)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <span>🌍</span> Diffuser sur le réseau fédéré ?
                </div>
                <div
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--color-content-secondary)",
                    marginTop: 4,
                  }}
                >
                  Si coché, ce post pourra être relayé vers d'autres instances (Ascending
                  Subsidiarity). Sinon, il restera strictement local.
                </div>
              </label>
            </div>
          )}

          {/* Duplicate Warning */}
          {duplicateWarning && (
            <div
              style={{
                padding: "0.75rem",
                background: "#FFF3CD",
                border: "1px solid #FFECB5",
                color: "#856404",
              }}
            >
              ⚠️ Ce lien a déjà été publié récemment.{" "}
              {isAdmin(currentUser) ? (
                <span>Cliquez à nouveau pour publier quand même.</span>
              ) : (
                <span>Veuillez vérifier le Fil avant de republier.</span>
              )}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "0.75rem 1.5rem",
              background: "var(--color-action-primary)",
              color: "var(--color-bg-app)",
              fontWeight: 700,
              border: "2px solid var(--color-border-strong)",
              cursor: loading ? "wait" : "pointer",
              fontFamily: "var(--font-display)",
            }}
          >
            {loading ? "Publication..." : "Publier sur Le Fil"}
          </button>
        </form>
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} onSuccess={handleAuthSuccess} />
      )}

      <SiteFooter />
    </>
  );
}
