// src/pages/actes/DemandesList.jsx
// ============================================================================
// Liste des demandes administratives (CRPA/CADA/Recours)
// ============================================================================

import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getSupabase, useCurrentUser } from "@inseme/cop-host";

// ============================================================================
// CONSTANTS
// ============================================================================

const TYPES_DEMANDE = [
  { value: "", label: "Tous les types" },
  { value: "CRPA_COMMUNICATION", label: "Communication doc (CRPA)" },
  { value: "CRPA_RECLAMATION", label: "Réclamation (CRPA)" },
  { value: "CADA_SAISINE", label: "Saisine CADA" },
  { value: "RECOURS_GRACIEUX", label: "Recours gracieux" },
  { value: "RECOURS_HIERARCHIQUE", label: "Recours hiérarchique" },
  { value: "DROIT_ERREUR", label: "Droit à l'erreur" },
  { value: "AUTRE", label: "Autre" },
];

const STATUTS_DEMANDE = [
  { value: "", label: "Tous les statuts" },
  { value: "BROUILLON", label: "Brouillon" },
  { value: "EN_COURS", label: "En cours" },
  { value: "REPONDUE", label: "Répondue" },
  { value: "REJET_EXPLICITE", label: "Rejet explicite" },
  { value: "REJET_IMPLICITE", label: "Rejet implicite" },
  { value: "CLASSEE", label: "Classée" },
];

const PAGE_SIZE = 20;

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const StatusBadge = ({ status }) => {
  const badges = {
    BROUILLON: {
      class: "bg-slate-100 text-slate-600",
      label: "Brouillon",
      emoji: "📝",
    },
    EN_COURS: {
      class: "bg-blue-100 text-blue-800",
      label: "En cours",
      emoji: "⏳",
    },
    REPONDUE: {
      class: "bg-green-100 text-green-800",
      label: "Répondue",
      emoji: "✅",
    },
    REJET_EXPLICITE: {
      class: "bg-red-100 text-red-800",
      label: "Rejet explicite",
      emoji: "❌",
    },
    REJET_IMPLICITE: {
      class: "bg-orange-100 text-orange-800",
      label: "Rejet implicite",
      emoji: "⚠️",
    },
    CLASSEE: {
      class: "bg-slate-100 text-slate-600",
      label: "Classée",
      emoji: "📁",
    },
  };
  const badge = badges[status] || {
    class: "bg-slate-100 text-slate-600",
    label: status || "N/A",
    emoji: "❓",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded ${badge.class}`}
    >
      {badge.emoji} {badge.label}
    </span>
  );
};

const TypeBadge = ({ type }) => {
  const labels = {
    CRPA_COMMUNICATION: "📬 Communication",
    CRPA_RECLAMATION: "📋 Réclamation",
    CADA_SAISINE: "⚖️ Saisine CADA",
    RECOURS_GRACIEUX: "🤝 Gracieux",
    RECOURS_HIERARCHIQUE: "📊 Hiérarchique",
    DROIT_ERREUR: "🔄 Droit erreur",
    AUTRE: "📄 Autre",
  };
  return (
    <span className="text-xs font-medium px-2 py-1 rounded bg-indigo-50 text-indigo-700">
      {labels[type] || type}
    </span>
  );
};

const DeadlineIndicator = ({ demande }) => {
  if (demande.status === "REPONDUE" || demande.status === "CLASSEE") {
    return <span className="text-green-500">✓</span>;
  }

  if (!demande.date_limite_reponse) {
    return <span className="text-slate-400">—</span>;
  }

  const deadline = new Date(demande.date_limite_reponse);
  const now = new Date();
  const daysLeft = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    return (
      <span className="text-red-600 font-bold" title="Délai dépassé">
        ⛔ +{Math.abs(daysLeft)}j
      </span>
    );
  }
  if (daysLeft <= 7) {
    return (
      <span className="text-orange-500 font-medium" title="Délai proche">
        ⚠️ {daysLeft}j
      </span>
    );
  }
  return (
    <span className="text-green-600" title={`${daysLeft} jours restants`}>
      {daysLeft}j
    </span>
  );
};

const Pagination = ({ page, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className="px-3 py-1 rounded border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
      >
        ← Précédent
      </button>
      <span className="text-sm text-slate-500 px-4">
        Page {page} sur {totalPages}
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        className="px-3 py-1 rounded border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
      >
        Suivant →
      </button>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DemandesList() {
  const { currentUser: user } = useCurrentUser();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [demandes, setDemandes] = useState([]);
  const [totalCount, setTotalCount] = useState(0);

  // Filters from URL
  const page = parseInt(searchParams.get("page") || "1", 10);
  const search = searchParams.get("q") || "";
  const typeDemande = searchParams.get("type") || "";
  const statut = searchParams.get("statut") || "";
  const showMine = searchParams.get("mine") === "true";
  const sortBy = searchParams.get("sort") || "created_at";
  const sortOrder = searchParams.get("order") || "desc";

  // Update URL params
  const updateFilters = (updates) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        newParams.set(key, String(value));
      } else {
        newParams.delete(key);
      }
    });
    if (!("page" in updates)) {
      newParams.set("page", "1");
    }
    setSearchParams(newParams);
  };

  // Fetch data
  useEffect(() => {
    const fetchDemandes = async () => {
      if (!getSupabase()) {
        setError("Configuration Supabase manquante.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Use the pending demandes view or fetch directly
        let query = getSupabase()
          .from("demande_admin")
          .select(
            `
            *,
            acte:acte_id (id, numero_interne, objet_court, type_acte),
            collectivite:collectivite_id (nom),
            reponses:reponse_admin (id)
          `,
            { count: "exact" }
          );

        // Apply filters
        if (search) {
          query = query.or(
            `objet.ilike.%${search}%,motifs.ilike.%${search}%,reference_envoi.ilike.%${search}%`
          );
        }
        if (typeDemande) {
          query = query.eq("type", typeDemande);
        }
        if (statut) {
          query = query.eq("status", statut);
        }
        if (showMine && user?.id) {
          query = query.eq("created_by", user.id);
        }

        // Apply sorting
        query = query.order(sortBy, { ascending: sortOrder === "asc" });

        // Apply pagination
        const from = (page - 1) * PAGE_SIZE;
        query = query.range(from, from + PAGE_SIZE - 1);

        const { data, count, error: queryError } = await query;

        if (queryError) throw queryError;

        setDemandes(data || []);
        setTotalCount(count || 0);
      } catch (err) {
        console.error("[DemandesList] Error:", err);
        setError(err.message || "Erreur lors du chargement");
      } finally {
        setLoading(false);
      }
    };

    fetchDemandes();
  }, [page, search, typeDemande, statut, showMine, sortBy, sortOrder, user?.id]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Stats
  const stats = {
    total: totalCount,
    enCours: demandes.filter((d) => d.status === "EN_COURS").length,
    enRetard: demandes.filter((d) => {
      if (!d.date_limite_reponse || d.status === "REPONDUE" || d.status === "CLASSEE") return false;
      return new Date(d.date_limite_reponse) < new Date();
    }).length,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                <Link to="/actes" className="hover:text-blue-600">
                  Tableau de bord
                </Link>
                <span>/</span>
                <span className="text-slate-700">Demandes administratives</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900">📬 Demandes Administratives</h1>
              <p className="text-slate-600 mt-1">
                Suivi des requêtes CRPA, saisines CADA et recours
              </p>
            </div>
            {user && (
              <Link
                to="/demandes/nouvelle"
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
              >
                ➕ Nouvelle demande
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Quick stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow border border-slate-200 p-4">
            <div className="text-2xl font-bold text-slate-800">{totalCount}</div>
            <div className="text-sm text-slate-500">Total des demandes</div>
          </div>
          <div className="bg-white rounded-lg shadow border border-slate-200 p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.enCours}</div>
            <div className="text-sm text-slate-500">En cours de traitement</div>
          </div>
          <div className="bg-white rounded-lg shadow border border-slate-200 p-4">
            <div
              className={`text-2xl font-bold ${stats.enRetard > 0 ? "text-red-600" : "text-green-600"}`}
            >
              {stats.enRetard}
            </div>
            <div className="text-sm text-slate-500">
              {stats.enRetard > 0 ? "⚠️ Délais dépassés" : "✅ Aucun retard"}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow border border-slate-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Recherche</label>
              <input
                type="text"
                placeholder="Objet, motifs..."
                value={search}
                onChange={(e) => updateFilters({ q: e.target.value })}
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
              <select
                value={typeDemande}
                onChange={(e) => updateFilters({ type: e.target.value })}
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TYPES_DEMANDE.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Statut</label>
              <select
                value={statut}
                onChange={(e) => updateFilters({ statut: e.target.value })}
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUTS_DEMANDE.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* My demands only */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Filtre</label>
              <label className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  checked={showMine}
                  onChange={(e) => updateFilters({ mine: e.target.checked ? "true" : "" })}
                  className="rounded border-slate-300"
                />
                <span className="text-sm text-slate-600">Vos demandes uniquement</span>
              </label>
            </div>

            {/* Clear */}
            <div className="flex items-end">
              <button
                onClick={() => setSearchParams(new URLSearchParams())}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Effacer les filtres
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
            ⚠️ {error}
          </div>
        )}

        {/* Results */}
        <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-slate-500">Chargement...</p>
            </div>
          ) : demandes.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              Aucune demande trouvée avec ces critères.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Type</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Objet</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Acte lié</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Statut</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-600">Délai</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-600">Réponses</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {demandes.map((demande) => (
                    <tr key={demande.id} className="hover:bg-slate-50 border-b border-slate-100">
                      <td className="px-4 py-3 text-slate-600">
                        {demande.date_envoi
                          ? new Date(demande.date_envoi).toLocaleDateString("fr-FR")
                          : new Date(demande.created_at).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="px-4 py-3">
                        <TypeBadge type={demande.type} />
                      </td>
                      <td className="px-4 py-3 text-slate-700 max-w-xs">
                        <Link to={`/demandes/${demande.id}`} className="hover:text-blue-600">
                          <span className="block truncate" title={demande.objet}>
                            {demande.objet || "Sans objet"}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {demande.acte ? (
                          <Link
                            to={`/actes/${demande.acte.id}`}
                            className="text-blue-600 hover:text-blue-800 text-xs"
                          >
                            {demande.acte.numero_interne || "Voir l'acte"}
                          </Link>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={demande.status} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <DeadlineIndicator demande={demande} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {demande.reponses?.length > 0 ? (
                          <span className="font-medium text-green-600">
                            {demande.reponses.length}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          to={`/demandes/${demande.id}`}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Voir →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={(p) => updateFilters({ page: p.toString() })}
        />

        {/* Help box */}
        <div className="mt-8 bg-indigo-50 border border-indigo-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-indigo-800 mb-2">💡 Types de demandes</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-indigo-700">
            <div>
              <strong>CRPA Communication:</strong> Demande de document (art. L311-1)
            </div>
            <div>
              <strong>CRPA Réclamation:</strong> Plainte ou réclamation formelle
            </div>
            <div>
              <strong>Saisine CADA:</strong> Recours auprès de la CADA
            </div>
            <div>
              <strong>Recours gracieux:</strong> Demande de retrait/modification
            </div>
            <div>
              <strong>Recours hiérarchique:</strong> Recours auprès du Préfet
            </div>
            <div>
              <strong>Droit à l'erreur:</strong> Régularisation (art. L123-1 CRPA)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
