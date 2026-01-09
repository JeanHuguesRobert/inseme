// src/pages/actes/ActesList.jsx
// ============================================================================
// Liste complète des actes municipaux avec filtres et recherche
// ============================================================================

import React, { useEffect, useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getSupabase, useCurrentUser } from "@inseme/cop-host";
import { CITY_NAME, HASHTAG } from "@inseme/cop-host";

// ============================================================================
// CONSTANTS
// ============================================================================

const TYPES_ACTE = [
  { value: "", label: "Tous les types" },
  { value: "DELIBERATION", label: "Délibération" },
  { value: "ARRETE", label: "Arrêté" },
  { value: "DECISION", label: "Décision" },
  { value: "PV", label: "Procès-verbal" },
  { value: "AUTRE", label: "Autre" },
];

const STATUTS = [
  { value: "", label: "Tous les statuts" },
  { value: "EXECUTOIRE", label: "Exécutoire" },
  { value: "EN_ATTENTE_CONTROLE", label: "En attente de contrôle" },
  { value: "NON_TRANSMIS", label: "Non transmis" },
  { value: "SUSPENDU", label: "Suspendu" },
  { value: "ANNULE", label: "Annulé" },
];

const PAGE_SIZE = 20;

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const StatusBadge = ({ status }) => {
  const badges = {
    EXECUTOIRE: { class: "bg-green-100 text-green-800", label: "Exécutoire" },
    EN_ATTENTE_CONTROLE: {
      class: "bg-blue-100 text-blue-800",
      label: "En attente",
    },
    SUSPENDU: { class: "bg-orange-100 text-orange-800", label: "Suspendu" },
    ANNULE: { class: "bg-red-100 text-red-800", label: "Annulé" },
    NON_TRANSMIS: {
      class: "bg-slate-100 text-slate-800",
      label: "Non transmis",
    },
  };
  const badge = badges[status] || {
    class: "bg-slate-100 text-slate-600",
    label: status || "N/A",
  };
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded ${badge.class}`}>
      {badge.label}
    </span>
  );
};

const TransmissionIcon = ({ acte }) => {
  if (acte.transmission_confirmed) {
    return (
      <span
        className="text-green-600"
        title={`Confirmé le ${acte.transmission_confirmed}`}
      >
        ✅
      </span>
    );
  }
  if (acte.transmission_declared) {
    return (
      <span
        className="text-orange-500"
        title={`Déclaré le ${acte.transmission_declared}`}
      >
        ⏳
      </span>
    );
  }
  return (
    <span className="text-slate-400" title="Non transmis">
      —
    </span>
  );
};

const Pagination = ({ page, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const pages = [];
  const showEllipsis = totalPages > 7;

  if (showEllipsis) {
    // Always show first page
    pages.push(1);

    if (page > 3) pages.push("...");

    // Show pages around current
    for (
      let i = Math.max(2, page - 1);
      i <= Math.min(totalPages - 1, page + 1);
      i++
    ) {
      pages.push(i);
    }

    if (page < totalPages - 2) pages.push("...");

    // Always show last page
    if (totalPages > 1) pages.push(totalPages);
  } else {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
  }

  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className="px-3 py-1 rounded border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
      >
        ←
      </button>

      {pages.map((p, i) => (
        <button
          key={i}
          onClick={() => typeof p === "number" && onPageChange(p)}
          disabled={p === "..."}
          className={`px-3 py-1 rounded ${
            p === page
              ? "bg-blue-600 text-white"
              : p === "..."
                ? "cursor-default"
                : "border border-slate-200 hover:bg-slate-50"
          }`}
        >
          {p}
        </button>
      ))}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        className="px-3 py-1 rounded border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
      >
        →
      </button>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ActesList() {
  const { currentUser: user } = useCurrentUser();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actes, setActes] = useState([]);
  const [totalCount, setTotalCount] = useState(0);

  // Filters from URL
  const page = parseInt(searchParams.get("page") || "1", 10);
  const search = searchParams.get("q") || "";
  const typeActe = searchParams.get("type") || "";
  const statut = searchParams.get("statut") || "";
  const dateFrom = searchParams.get("from") || "";
  const dateTo = searchParams.get("to") || "";
  const sortBy = searchParams.get("sort") || "date_acte";
  const sortOrder = searchParams.get("order") || "desc";

  // Update URL params
  const updateFilters = (updates) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });
    // Reset to page 1 when filters change (unless page is being set)
    if (!("page" in updates)) {
      newParams.set("page", "1");
    }
    setSearchParams(newParams);
  };

  // Fetch data
  useEffect(() => {
    const fetchActes = async () => {
      if (!getSupabase()) {
        setError("Configuration Supabase manquante.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        let query = getSupabase()
          .from("v_actes_synthetiques")
          .select("*", { count: "exact" });

        // Apply filters
        if (search) {
          query = query.or(
            `objet_court.ilike.%${search}%,objet_complet.ilike.%${search}%,numero_interne.ilike.%${search}%`
          );
        }
        if (typeActe) {
          query = query.eq("type_acte", typeActe);
        }
        if (statut) {
          query = query.eq("statut_juridique", statut);
        }
        if (dateFrom) {
          query = query.gte("date_acte", dateFrom);
        }
        if (dateTo) {
          query = query.lte("date_acte", dateTo);
        }

        // Apply sorting
        query = query.order(sortBy, { ascending: sortOrder === "asc" });

        // Apply pagination
        const from = (page - 1) * PAGE_SIZE;
        query = query.range(from, from + PAGE_SIZE - 1);

        const { data, count, error: queryError } = await query;

        if (queryError) throw queryError;

        setActes(data || []);
        setTotalCount(count || 0);
      } catch (err) {
        console.error("[ActesList] Error:", err);
        setError(err.message || "Erreur lors du chargement");
      } finally {
        setLoading(false);
      }
    };

    fetchActes();
  }, [page, search, typeActe, statut, dateFrom, dateTo, sortBy, sortOrder]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

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
                <span className="text-slate-700">Liste des actes</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900">
                📋 Actes Municipaux
              </h1>
              <p className="text-slate-600 mt-1">
                {totalCount} acte{totalCount !== 1 ? "s" : ""} enregistré
                {totalCount !== 1 ? "s" : ""}
              </p>
            </div>
            {user && (
              <Link
                to="/actes/nouveau"
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                ➕ Nouvel acte
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow border border-slate-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Recherche
              </label>
              <input
                type="text"
                placeholder="Numéro, objet..."
                value={search}
                onChange={(e) => updateFilters({ q: e.target.value })}
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Type
              </label>
              <select
                value={typeActe}
                onChange={(e) => updateFilters({ type: e.target.value })}
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TYPES_ACTE.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Statut
              </label>
              <select
                value={statut}
                onChange={(e) => updateFilters({ statut: e.target.value })}
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date from */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Du
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => updateFilters({ from: e.target.value })}
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Date to */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Au
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => updateFilters({ to: e.target.value })}
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Active filters */}
          {(search || typeActe || statut || dateFrom || dateTo) && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500">Filtres actifs:</span>
              {search && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                  Recherche: {search}
                  <button
                    onClick={() => updateFilters({ q: "" })}
                    className="hover:text-blue-900"
                  >
                    ×
                  </button>
                </span>
              )}
              {typeActe && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                  Type: {typeActe}
                  <button
                    onClick={() => updateFilters({ type: "" })}
                    className="hover:text-blue-900"
                  >
                    ×
                  </button>
                </span>
              )}
              {statut && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                  Statut: {statut}
                  <button
                    onClick={() => updateFilters({ statut: "" })}
                    className="hover:text-blue-900"
                  >
                    ×
                  </button>
                </span>
              )}
              <button
                onClick={() => setSearchParams(new URLSearchParams())}
                className="text-xs text-red-600 hover:text-red-800 ml-2"
              >
                Effacer tout
              </button>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
            ⚠️ {error}
          </div>
        )}

        {/* Results table */}
        <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-slate-500">Chargement...</p>
            </div>
          ) : actes.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              Aucun acte trouvé avec ces critères.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">
                      N°
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">
                      <button
                        onClick={() =>
                          updateFilters({
                            sort: "date_acte",
                            order:
                              sortBy === "date_acte" && sortOrder === "desc"
                                ? "asc"
                                : "desc",
                          })
                        }
                        className="flex items-center gap-1 hover:text-blue-600"
                      >
                        Date
                        {sortBy === "date_acte" &&
                          (sortOrder === "desc" ? "↓" : "↑")}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">
                      Objet
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">
                      Statut
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-600">
                      Transmis
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-600">
                      Délais
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-600">
                      Demandes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {actes.map((acte) => (
                    <tr
                      key={acte.id}
                      className="hover:bg-slate-50 border-b border-slate-100"
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`/actes/${acte.id}`}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {acte.numero_interne || acte.numero_actes || "N/A"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {acte.date_acte || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium px-2 py-1 rounded bg-slate-100 text-slate-700">
                          {acte.type_acte || "ACTE"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 max-w-xs">
                        <span
                          className="block truncate"
                          title={acte.objet_complet || acte.objet_court}
                        >
                          {acte.objet_court || "Sans objet"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={acte.statut_juridique} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <TransmissionIcon acte={acte} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {acte.nb_deadlines_depassees > 0 ? (
                          <span className="text-red-600 font-bold">
                            {acte.nb_deadlines_depassees}
                          </span>
                        ) : (
                          <span className="text-green-600">✓</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {acte.nb_demandes > 0 ? (
                          <span className="font-medium text-slate-700">
                            {acte.nb_demandes}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
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

        {/* Export button */}
        <div className="mt-6 text-center">
          <button
            className="text-sm text-slate-500 hover:text-blue-600"
            onClick={() => {
              // TODO: Implement CSV export
              alert("Export CSV à venir...");
            }}
          >
            📥 Exporter en CSV
          </button>
        </div>
      </div>
    </div>
  );
}
