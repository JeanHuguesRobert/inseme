// src/pages/actes/DemandeForm.jsx
// ============================================================================
// Formulaire de création/modification d'une demande administrative
// Supporte tous les types: CRPA, CADA, recours gracieux, etc.
// ============================================================================

import React, { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { getSupabase, useCurrentUser } from "@inseme/cop-host";

// ============================================================================
// CONSTANTS
// ============================================================================

const TYPES_DEMANDE = [
  {
    value: "CRPA_COMMUNICATION",
    label: "Communication de documents",
    emoji: "📬",
    description:
      "Demande d'accès aux documents administratifs (art. L311-1 CRPA)",
    delai: "1 mois",
  },
  {
    value: "CRPA_RECLAMATION",
    label: "Réclamation administrative",
    emoji: "📋",
    description: "Plainte ou réclamation formelle (art. L112-3 CRPA)",
    delai: "Pas de délai légal impératif",
  },
  {
    value: "CADA_SAISINE",
    label: "Saisine de la CADA",
    emoji: "⚖️",
    description: "Suite à un refus de communication (art. L342-1 CRPA)",
    delai: "Avis CADA sous 1 mois",
  },
  {
    value: "RECOURS_GRACIEUX",
    label: "Recours gracieux",
    emoji: "🤝",
    description:
      "Demande de retrait ou modification d'un acte (art. L411-2 CRPA)",
    delai: "2 mois pour réponse",
  },
  {
    value: "RECOURS_HIERARCHIQUE",
    label: "Recours hiérarchique",
    emoji: "📊",
    description: "Recours auprès de l'autorité supérieure (Préfet)",
    delai: "2 mois pour transmission",
  },
  {
    value: "DROIT_ERREUR",
    label: "Droit à l'erreur",
    emoji: "🔄",
    description: "Demande de régularisation (art. L123-1 et L123-2 CRPA)",
    delai: "Variable",
  },
  {
    value: "AUTRE",
    label: "Autre demande",
    emoji: "📄",
    description: "Autre type de courrier administratif",
    delai: "Variable",
  },
];

const METHODES_ENVOI = [
  { value: "LRAR", label: "📬 Lettre recommandée AR" },
  { value: "EMAIL", label: "📧 Email" },
  { value: "DEPOSEE", label: "🏛️ Déposée en mairie" },
  { value: "TELESERVICE", label: "💻 Téléservice" },
  { value: "FAX", label: "📠 Fax" },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Calculate default deadline based on type
const getDefaultDeadline = (type, dateEnvoi) => {
  if (!dateEnvoi) return "";

  const date = new Date(dateEnvoi);
  const delays = {
    CRPA_COMMUNICATION: 30, // 1 mois
    CRPA_RECLAMATION: 60, // 2 mois par défaut
    CADA_SAISINE: 30, // 1 mois pour avis
    RECOURS_GRACIEUX: 60, // 2 mois
    RECOURS_HIERARCHIQUE: 60, // 2 mois
    DROIT_ERREUR: 60, // Variable, 2 mois par défaut
    AUTRE: 60,
  };

  date.setDate(date.getDate() + (delays[type] || 60));
  return date.toISOString().split("T")[0];
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const FormField = ({ label, required, help, error, children }) => (
  <div className="space-y-1">
    <label className="block text-sm font-medium text-slate-700">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {help && <p className="text-xs text-slate-500">{help}</p>}
    {error && <p className="text-xs text-red-600">{error}</p>}
  </div>
);

const TypeCard = ({ type, selected, onSelect }) => (
  <button
    type="button"
    onClick={() => onSelect(type.value)}
    className={`w-full text-left p-4 rounded-lg border transition-all ${
      selected
        ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
    }`}
  >
    <div className="flex items-start gap-3">
      <span className="text-2xl">{type.emoji}</span>
      <div className="flex-1">
        <div className="font-medium text-slate-800">{type.label}</div>
        <div className="text-xs text-slate-500 mt-0.5">{type.description}</div>
        <div className="text-xs text-indigo-600 mt-1">
          ⏱️ Délai: {type.delai}
        </div>
      </div>
    </div>
  </button>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DemandeForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser: user } = useCurrentUser();
  const isEditing = Boolean(id);
  const linkedActeId = searchParams.get("actes") || searchParams.get("acte");

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEditing);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const [collectivites, setCollectivites] = useState([]);
  const [actes, setActes] = useState([]);
  const [searchActe, setSearchActe] = useState("");

  // Form data
  const [formData, setFormData] = useState({
    collectivite_id: "",
    acte_id: linkedActeId || "",
    type: "CRPA_COMMUNICATION",
    objet: "",
    motifs: "",
    method_envoi: "LRAR",
    date_envoi: "",
    reference_envoi: "",
    date_limite_reponse: "",
    status: "BROUILLON",
  });

  const [errors, setErrors] = useState({});

  // Fetch collectivites on mount
  useEffect(() => {
    const fetchCollectivites = async () => {
      if (!getSupabase()) return;

      const { data } = await getSupabase()
        .from("collectivite")
        .select("id, nom, code_insee")
        .order("nom");

      setCollectivites(data || []);

      if (data?.length === 1 && !isEditing) {
        setFormData((prev) => ({ ...prev, collectivite_id: data[0].id }));
      }
    };

    fetchCollectivites();
  }, [isEditing]);

  // Fetch actes for linking
  useEffect(() => {
    const fetchActes = async () => {
      if (!getSupabase() || !formData.collectivite_id) return;

      let query = getSupabase()
        .from("v_actes_current")
        .select("id, numero_interne, objet_court, date_acte, type_acte")
        .eq("collectivite_id", formData.collectivite_id)
        .order("date_acte", { ascending: false })
        .limit(50);

      if (searchActe) {
        query = query.or(
          `numero_interne.ilike.%${searchActe}%,objet_court.ilike.%${searchActe}%`
        );
      }

      const { data } = await query;
      setActes(data || []);
    };

    fetchActes();
  }, [formData.collectivite_id, searchActe]);

  // Fetch linked acte info if provided
  useEffect(() => {
    const fetchLinkedActe = async () => {
      if (!linkedActeId || !getSupabase()) return;

      const { data } = await getSupabase()
        .from("v_actes_current")
        .select("id, collectivite_id, numero_interne, objet_court")
        .eq("id", linkedActeId)
        .single();

      if (data) {
        setFormData((prev) => ({
          ...prev,
          acte_id: data.id,
          collectivite_id: data.collectivite_id,
        }));
      }
    };

    fetchLinkedActe();
  }, [linkedActeId]);

  // Fetch existing demande if editing
  useEffect(() => {
    const fetchDemande = async () => {
      if (!isEditing || !getSupabase() || !id) return;

      setLoadingData(true);

      try {
        const { data, error: fetchError } = await getSupabase()
          .from("demande_admin")
          .select("*")
          .eq("id", id)
          .single();

        if (fetchError) throw fetchError;
        if (!data) throw new Error("Demande non trouvée");

        setFormData({
          collectivite_id: data.collectivite_id || "",
          acte_id: data.acte_id || "",
          type: data.type || "CRPA_COMMUNICATION",
          objet: data.objet || "",
          motifs: data.motifs || "",
          method_envoi: data.method_envoi || "LRAR",
          date_envoi: data.date_envoi || "",
          reference_envoi: data.reference_envoi || "",
          date_limite_reponse: data.date_limite_reponse || "",
          status: data.status || "BROUILLON",
        });
      } catch (err) {
        console.error("[DemandeForm] Error fetching:", err);
        setError(err.message || "Erreur lors du chargement");
      } finally {
        setLoadingData(false);
      }
    };

    fetchDemande();
  }, [id, isEditing]);

  // Auto-calculate deadline when type or date changes
  useEffect(() => {
    if (formData.date_envoi && !formData.date_limite_reponse) {
      const deadline = getDefaultDeadline(formData.type, formData.date_envoi);
      setFormData((prev) => ({ ...prev, date_limite_reponse: deadline }));
    }
  }, [formData.type, formData.date_envoi]);

  // Handle field change
  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  // Validate form
  const validate = () => {
    const newErrors = {};

    if (!formData.collectivite_id) {
      newErrors.collectivite_id = "Veuillez sélectionner une collectivité";
    }
    if (!formData.type) {
      newErrors.type = "Veuillez sélectionner un type de demande";
    }
    if (!formData.objet || formData.objet.length < 10) {
      newErrors.objet = "L'objet doit faire au moins 10 caractères";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;
    if (!user?.id) {
      setError("Vous devez être connecté");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        collectivite_id: formData.collectivite_id,
        acte_id: formData.acte_id || null,
        type: formData.type,
        objet: formData.objet,
        motifs: formData.motifs || null,
        method_envoi: formData.method_envoi || null,
        date_envoi: formData.date_envoi || null,
        reference_envoi: formData.reference_envoi || null,
        date_limite_reponse: formData.date_limite_reponse || null,
        status: formData.status,
      };

      if (isEditing) {
        const { error: updateError } = await getSupabase()
          .from("demande_admin")
          .update(payload)
          .eq("id", id);

        if (updateError) throw updateError;

        setSuccess(true);
        setTimeout(() => navigate(`/demandes/${id}`), 1500);
      } else {
        payload.created_by = user.id;

        const { data, error: insertError } = await getSupabase()
          .from("demande_admin")
          .insert(payload)
          .select("id")
          .single();

        if (insertError) throw insertError;

        setSuccess(true);
        setTimeout(() => navigate(`/demandes/${data.id}`), 1500);
      }
    } catch (err) {
      console.error("[DemandeForm] Submit error:", err);
      setError(err.message || "Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  // Get selected type info
  const selectedType = TYPES_DEMANDE.find((t) => t.value === formData.type);

  if (loadingData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-500">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link to="/actes" className="hover:text-blue-600">
              Tableau de bord
            </Link>
            <span>/</span>
            <Link to="/demandes" className="hover:text-blue-600">
              Demandes
            </Link>
            <span>/</span>
            <span className="text-slate-700">
              {isEditing ? "Modifier" : "Nouvelle"}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isEditing
              ? "✏️ Modifier la demande"
              : "➕ Nouvelle demande administrative"}
          </h1>
          <p className="text-slate-500 mt-1">
            Communication, réclamation, recours ou saisine CADA
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Success message */}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700 flex items-center gap-2">
              ✅ Demande {isEditing ? "modifiée" : "créée"} avec succès !
              Redirection...
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              ⚠️ {error}
            </div>
          )}

          {/* Type selection */}
          <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              📂 Type de demande
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {TYPES_DEMANDE.map((type) => (
                <TypeCard
                  key={type.value}
                  type={type}
                  selected={formData.type === type.value}
                  onSelect={(v) => handleChange("type", v)}
                />
              ))}
            </div>
            {errors.type && (
              <p className="text-xs text-red-600 mt-2">{errors.type}</p>
            )}
          </div>

          {/* Basic info */}
          <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              📋 Informations générales
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                label="Collectivité"
                required
                error={errors.collectivite_id}
              >
                <select
                  value={formData.collectivite_id}
                  onChange={(e) =>
                    handleChange("collectivite_id", e.target.value)
                  }
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Sélectionner...</option>
                  {collectivites.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom} ({c.code_insee})
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField
                label="Acte concerné"
                help="Lier à un acte municipal (optionnel)"
              >
                <select
                  value={formData.acte_id}
                  onChange={(e) => handleChange("acte_id", e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Aucun acte lié</option>
                  {actes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.numero_interne || a.date_acte} -{" "}
                      {a.objet_court?.substring(0, 50)}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Rechercher un acte..."
                  value={searchActe}
                  onChange={(e) => setSearchActe(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </FormField>
            </div>

            <div className="mt-6">
              <FormField
                label="Objet de la demande"
                required
                error={errors.objet}
              >
                <input
                  type="text"
                  value={formData.objet}
                  onChange={(e) => handleChange("objet", e.target.value)}
                  placeholder="Ex: Demande de communication du compte administratif 2023"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </FormField>
            </div>

            <div className="mt-4">
              <FormField
                label="Motifs et fondements juridiques"
                help="Références légales, arguments..."
              >
                <textarea
                  value={formData.motifs}
                  onChange={(e) => handleChange("motifs", e.target.value)}
                  rows={4}
                  placeholder="Fondé sur l'article L311-1 du CRPA, je sollicite la communication de..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </FormField>
            </div>
          </div>

          {/* Envoi */}
          <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              📤 Envoi et délais
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField label="Méthode d'envoi">
                <select
                  value={formData.method_envoi}
                  onChange={(e) => handleChange("method_envoi", e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {METHODES_ENVOI.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Date d'envoi">
                <input
                  type="date"
                  value={formData.date_envoi}
                  onChange={(e) => handleChange("date_envoi", e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </FormField>

              <FormField
                label="Référence d'envoi"
                help="N° recommandé, n° de ticket..."
              >
                <input
                  type="text"
                  value={formData.reference_envoi}
                  onChange={(e) =>
                    handleChange("reference_envoi", e.target.value)
                  }
                  placeholder="1A 123 456 789 0"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </FormField>

              <FormField
                label="Date limite de réponse"
                help={selectedType ? `Délai légal: ${selectedType.delai}` : ""}
              >
                <input
                  type="date"
                  value={formData.date_limite_reponse}
                  onChange={(e) =>
                    handleChange("date_limite_reponse", e.target.value)
                  }
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </FormField>
            </div>
          </div>

          {/* Status */}
          <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              📊 Statut
            </h2>

            <div className="flex flex-wrap gap-3">
              {[
                { value: "BROUILLON", label: "Brouillon", emoji: "📝" },
                { value: "EN_COURS", label: "En cours", emoji: "⏳" },
                { value: "REPONDUE", label: "Répondue", emoji: "✅" },
                {
                  value: "REJET_EXPLICITE",
                  label: "Rejet explicite",
                  emoji: "❌",
                },
                {
                  value: "REJET_IMPLICITE",
                  label: "Rejet implicite",
                  emoji: "⚠️",
                },
                { value: "CLASSEE", label: "Classée", emoji: "📁" },
              ].map((s) => (
                <label
                  key={s.value}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                    formData.status === s.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="status"
                    value={s.value}
                    checked={formData.status === s.value}
                    onChange={(e) => handleChange("status", e.target.value)}
                    className="sr-only"
                  />
                  <span>{s.emoji}</span>
                  <span className="text-sm font-medium">{s.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Legal info box */}
          {selectedType && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-indigo-800 mb-2">
                ⚖️ {selectedType.emoji} {selectedType.label}
              </h3>
              <p className="text-sm text-indigo-700 mb-2">
                {selectedType.description}
              </p>
              <p className="text-sm text-indigo-600">
                <strong>Délai légal:</strong> {selectedType.delai}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-4 pt-4">
            <Link
              to={isEditing ? `/demandes/${id}` : "/demandes"}
              className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700"
            >
              ← Annuler
            </Link>

            <div className="flex gap-3">
              {!isEditing && (
                <button
                  type="button"
                  onClick={() => {
                    handleChange("status", "BROUILLON");
                    handleSubmit(new Event("submit"));
                  }}
                  disabled={loading}
                  className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700"
                >
                  💾 Enregistrer brouillon
                </button>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  loading
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">⏳</span> Enregistrement...
                  </span>
                ) : isEditing ? (
                  "💾 Sauvegarder"
                ) : (
                  "✅ Créer la demande"
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

    </div>
  );
}
