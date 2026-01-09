// src/components/rgpd/RGPDSettings.jsx
// ============================================================================
// Composant de gestion des paramètres RGPD
// Permet à l'utilisateur de gérer ses consentements et exercer ses droits
// ============================================================================

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getSupabase } from "../../lib/supabase.js";
import { useCurrentUser } from "@inseme/cop-host";
import { getConfig } from "../../common/config/instanceConfig.client.js";

const CONSENT_TYPES = {
  rgpd_general: {
    label: "Consentement général RGPD",
    description: "J'accepte les conditions d'utilisation et la politique de confidentialité",
    required: true,
    default: false,
  },
  public_profile: {
    label: "Profil public",
    description: "Permettre l'affichage de votre nom et contributions publiquement",
    required: false,
    default: true,
  },
  ia_analysis: {
    label: "Analyse par IA",
    description: "Autoriser l'analyse de vos contributions pour améliorer les recommandations",
    required: false,
    default: true,
  },
  notification_email: {
    label: "Notifications par email",
    description: "Recevoir des notifications sur les réponses à vos contributions",
    required: false,
    default: false,
  },
  newsletter: {
    label: "Newsletter",
    description: "Recevoir les actualités de la plateforme",
    required: false,
    default: false,
  },
};

export default function RGPDSettings() {
  const { currentUser } = useCurrentUser();
  const [consents, setConsents] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Utiliser le vault pour l'email de contact
  const contactEmail = getConfig("contact_email", "jean_hugues_robert@yahoo.com");

  useEffect(() => {
    if (currentUser?.id) {
      loadConsents();
    }
  }, [currentUser?.id]);

  const loadConsents = async () => {
    try {
      const { data, error } = await getSupabase()
        .from("user_consents")
        .select("consent_type, granted")
        .eq("user_id", currentUser.id);

      if (error) throw error;

      const consentMap = {};
      data?.forEach((c) => {
        consentMap[c.consent_type] = c.granted;
      });

      // Appliquer les valeurs par défaut pour les consentements non définis
      Object.keys(CONSENT_TYPES).forEach((type) => {
        if (consentMap[type] === undefined) {
          consentMap[type] = CONSENT_TYPES[type].default;
        }
      });

      setConsents(consentMap);
    } catch (error) {
      console.error("Erreur chargement consentements:", error);
      setMessage({ type: "error", text: "Erreur lors du chargement des paramètres" });
    } finally {
      setLoading(false);
    }
  };

  const handleConsentChange = async (consentType, granted) => {
    setSaving(true);
    setMessage(null);

    try {
      const { error } = await getSupabase().from("user_consents").upsert(
        {
          user_id: currentUser.id,
          consent_type: consentType,
          granted,
          consent_version: "1.0",
          source: "web",
        },
        { onConflict: "user_id,consent_type" }
      );

      if (error) throw error;

      // Synchroniser avec l'ancien champ rgpd_consent_accepted pour rétrocompatibilité
      if (consentType === "rgpd_general") {
        await getSupabase()
          .from("users")
          .update({
            rgpd_consent_accepted: granted,
            rgpd_consent_date: granted ? new Date().toISOString() : null,
          })
          .eq("id", currentUser.id);
      }

      setConsents((prev) => ({ ...prev, [consentType]: granted }));
      setMessage({
        type: "success",
        text: `Préférence "${CONSENT_TYPES[consentType].label}" mise à jour`,
      });
    } catch (error) {
      console.error("Erreur mise à jour consentement:", error);
      setMessage({ type: "error", text: "Erreur lors de la mise à jour" });
    } finally {
      setSaving(false);
    }
  };

  const handleExportData = async () => {
    setExporting(true);
    setMessage(null);

    try {
      const { data: session } = await getSupabase().auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error("Session expirée");
      }

      const response = await fetch("/api/rgpd-export", {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Erreur lors de l'export");
      }

      const data = await response.json();

      // Télécharger le fichier JSON
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mes-donnees-rgpd-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setMessage({ type: "success", text: "Export téléchargé avec succès" });
    } catch (error) {
      console.error("Erreur export:", error);
      setMessage({ type: "error", text: "Erreur lors de l'export de vos données" });
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setMessage(null);

    try {
      const { data: session } = await getSupabase().auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error("Session expirée");
      }

      const response = await fetch("/api/rgpd-delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirmation: "SUPPRIMER_MON_COMPTE" }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erreur lors de la suppression");
      }

      // Déconnexion après suppression
      await getSupabase().auth.signOut();
      window.location.href = "/";
    } catch (error) {
      console.error("Erreur suppression:", error);
      setMessage({
        type: "error",
        text: error.message || "Erreur lors de la suppression du compte",
      });
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-gray-500">Chargement des paramètres...</div>;
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
        <h2 className="text-lg font-semibold text-blue-900 mb-2">🔒 Vos droits RGPD</h2>
        <p className="text-sm text-blue-800">
          Conformément au Règlement Général sur la Protection des Données (RGPD), vous pouvez gérer
          vos préférences de confidentialité, exporter vos données ou supprimer votre compte.
        </p>
      </div>

      {/* Message de feedback */}
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === "success"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Gestion des consentements */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-md font-semibold text-gray-900 mb-4">📋 Mes consentements</h3>
        <div className="space-y-4">
          {Object.entries(CONSENT_TYPES).map(([type, config]) => (
            <div
              key={type}
              className="flex items-start justify-between py-2 border-b border-gray-100 last:border-0"
            >
              <div className="flex-1">
                <label className="font-medium text-gray-900">{config.label}</label>
                <p className="text-sm text-gray-500">{config.description}</p>
              </div>
              <div className="ml-4">
                <button
                  onClick={() => handleConsentChange(type, !consents[type])}
                  disabled={saving || config.required}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    consents[type] ? "bg-green-500" : "bg-gray-300"
                  } ${config.required ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      consents[type] ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Export des données */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-md font-semibold text-gray-900 mb-2">📦 Exporter mes données</h3>
        <p className="text-sm text-gray-500 mb-4">
          Téléchargez une copie de toutes vos données personnelles au format JSON (Article 20 RGPD -
          Droit à la portabilité).
        </p>
        <button
          onClick={handleExportData}
          disabled={exporting}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {exporting ? "Export en cours..." : "📥 Télécharger mes données"}
        </button>
      </div>

      {/* Suppression du compte */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-md font-semibold text-red-900 mb-2">⚠️ Supprimer mon compte</h3>
        <p className="text-sm text-red-700 mb-4">
          Cette action est irréversible. Vos contributions publiques seront anonymisées mais
          conservées pour préserver l'intégrité des discussions. Vos données personnelles seront
          supprimées.
        </p>
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            🗑️ Supprimer mon compte
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-red-800">
              Êtes-vous sûr de vouloir supprimer définitivement votre compte ?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteAccount}
                className="px-4 py-2 bg-red-700 text-white rounded hover:bg-red-800"
              >
                Oui, supprimer définitivement
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Liens utiles */}
      <div className="text-sm text-gray-500">
        <p>
          Pour toute question concernant vos données personnelles, contactez l'éditeur du site :{" "}
          <a href={`mailto:${contactEmail}`} className="text-blue-600 hover:underline">
            {contactEmail}
          </a>
        </p>
        <p className="mt-2">
          <Link to="/legal/privacy" className="text-blue-600 hover:underline">
            Politique de confidentialité
          </Link>
          {" • "}
          <Link to="/legal/terms" className="text-blue-600 hover:underline">
            Conditions d'utilisation
          </Link>
        </p>
      </div>
    </div>
  );
}
