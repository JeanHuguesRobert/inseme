// src/pages/actes/ResponsibilityLog.jsx
// ============================================================================
// Journal des responsabilités
// Audit trail complet des actions avec engagement juridique
// ============================================================================

import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getSupabase, useCurrentUser } from "@inseme/cop-host";

// ============================================================================
// CONSTANTS
// ============================================================================

const RESPONSIBILITY_TYPES = {
  DECOUVERTE: {
    label: "Découverte",
    emoji: "🔍",
    color: "blue",
    description: "Premier constat d'un élément",
  },
  VERIFICATION: {
    label: "Vérification",
    emoji: "✅",
    color: "green",
    description: "Validation d'une information",
  },
  ANALYSE: {
    label: "Analyse",
    emoji: "📊",
    color: "purple",
    description: "Étude approfondie d'un sujet",
  },
  TRANSMISSION: {
    label: "Transmission",
    emoji: "📤",
    color: "orange",
    description: "Envoi à une autorité",
  },
  PUBLICATION: {
    label: "Publication",
    emoji: "📢",
    color: "cyan",
    description: "Mise en ligne publique",
  },
  VALIDATION: {
    label: "Validation",
    emoji: "✔️",
    color: "emerald",
    description: "Approbation d'une action",
  },
  CORRECTION: {
    label: "Correction",
    emoji: "✏️",
    color: "amber",
    description: "Modification d'une erreur",
  },
};

const ENTITY_TYPES = {
  acte: { label: "Acte", emoji: "📋", path: "/actes" },
  demande_admin: { label: "Demande", emoji: "📬", path: "/demandes" },
  proof: { label: "Preuve", emoji: "📎", path: null },
  publication_citoyenne: { label: "Publication", emoji: "📢", path: null },
  outgoing_action: { label: "Action externe", emoji: "📤", path: null },
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const TypeBadge = ({ type }) => {
  const info = RESPONSIBILITY_TYPES[type] || {
    label: type,
    emoji: "📋",
    color: "slate",
  };
  const colorClasses = {
    blue: "bg-blue-100 text-blue-700",
    green: "bg-green-100 text-green-700",
    purple: "bg-purple-100 text-purple-700",
    orange: "bg-orange-100 text-orange-700",
    cyan: "bg-cyan-100 text-cyan-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    slate: "bg-slate-100 text-slate-700",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${colorClasses[info.color]}`}
    >
      <span>{info.emoji}</span>
      <span>{info.label}</span>
    </span>
  );
};

const EntityLink = ({ entityType, entityId }) => {
  const info = ENTITY_TYPES[entityType] || {
    label: entityType,
    emoji: "📋",
    path: null,
  };

  if (info.path && entityId) {
    return (
      <Link
        to={`${info.path}/${entityId}`}
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
      >
        <span>{info.emoji}</span>
        <span>{info.label}</span>
        <span className="text-xs text-slate-400">#{entityId.slice(0, 8)}</span>
      </Link>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-sm text-slate-600">
      <span>{info.emoji}</span>
      <span>{info.label}</span>
      {entityId && (
        <span className="text-xs text-slate-400">#{entityId.slice(0, 8)}</span>
      )}
    </span>
  );
};

const LogEntry = ({ entry }) => {
  const [expanded, setExpanded] = useState(false);
  const typeInfo = RESPONSIBILITY_TYPES[entry.responsibility_type] || {};

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Timeline indicator */}
          <div className="flex flex-col items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-lg bg-${typeInfo.color || "slate"}-100`}
            >
              {typeInfo.emoji || "📋"}
            </div>
            <div className="w-0.5 h-full bg-slate-200 mt-2"></div>
          </div>

          {/* Content */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <TypeBadge type={entry.responsibility_type} />
              <span className="text-xs text-slate-400">
                {new Date(entry.created_at).toLocaleString("fr-FR")}
              </span>
            </div>

            {/* User */}
            <div className="text-sm text-slate-600 mb-2">
              👤{" "}
              <span className="font-medium">
                {entry.user_email || entry.user_id?.slice(0, 8)}
              </span>
            </div>

            {/* Summary */}
            <p className="text-slate-800 mb-2">{entry.summary}</p>

            {/* Entity link */}
            {entry.entity_type && (
              <div className="mb-2">
                <EntityLink
                  entityType={entry.entity_type}
                  entityId={entry.entity_id}
                />
              </div>
            )}

            {/* IP and signature info - Masqué pour conformité RGPD */}
            {/* Note: IP et User-Agent stockés pour audit mais non affichés publiquement */}
            <div className="flex items-center gap-4 text-xs text-slate-400">
              {entry.ip_address && (
                <span title="Adresse IP masquée pour la vie privée">
                  🌐 IP: ***.***.***
                </span>
              )}
              {entry.user_agent && (
                <span title="User-Agent masqué pour la vie privée">
                  💻 Navigateur enregistré
                </span>
              )}
            </div>

            {/* Expand button */}
            {entry.metadata && Object.keys(entry.metadata).length > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                {expanded ? "▲ Masquer les détails" : "▼ Voir les détails"}
              </button>
            )}

            {/* Expanded metadata */}
            {expanded && entry.metadata && (
              <div className="mt-3 bg-slate-50 rounded-lg p-3">
                <h4 className="text-xs font-medium text-slate-500 mb-2">
                  Métadonnées:
                </h4>
                <pre className="text-xs text-slate-600 overflow-x-auto">
                  {JSON.stringify(entry.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const Pagination = ({ page, totalPages, onPageChange }) => {
  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded disabled:opacity-50"
      >
        ← Précédent
      </button>
      <span className="text-sm text-slate-500">
        Page {page} / {totalPages}
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded disabled:opacity-50"
      >
        Suivant →
      </button>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ResponsibilityLog() {
  const { currentUser: user } = useCurrentUser();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [entries, setEntries] = useState([]);
  const [totalCount, setTotalCount] = useState(0);

  // Filters from URL
  const page = parseInt(searchParams.get("page")) || 1;
  const filterType = searchParams.get("type") || "";
  const filterUser = searchParams.get("user") || "";
  const filterEntity = searchParams.get("entity") || "";
  const filterDateFrom = searchParams.get("from") || "";
  const filterDateTo = searchParams.get("to") || "";

  const PAGE_SIZE = 20;

  // Update URL params
  const updateFilter = (key, value) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    if (key !== "page") {
      newParams.set("page", "1");
    }
    setSearchParams(newParams);
  };

  // Fetch entries
  useEffect(() => {
    const fetchEntries = async () => {
      if (!getSupabase()) return;

      setLoading(true);

      try {
        let query = getSupabase()
          .from("responsibility_log")
          .select("*", { count: "exact" });

        if (filterType) {
          query = query.eq("responsibility_type", filterType);
        }

        if (filterUser) {
          query = query.eq("user_id", filterUser);
        }

        if (filterEntity) {
          query = query.eq("entity_type", filterEntity);
        }

        if (filterDateFrom) {
          query = query.gte("created_at", filterDateFrom);
        }

        if (filterDateTo) {
          query = query.lte("created_at", filterDateTo + "T23:59:59");
        }

        query = query
          .order("created_at", { ascending: false })
          .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

        const { data, error: fetchError, count } = await query;

        if (fetchError) throw fetchError;

        setEntries(data || []);
        setTotalCount(count || 0);
      } catch (err) {
        console.error("[ResponsibilityLog] Error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchEntries();
  }, [
    page,
    filterType,
    filterUser,
    filterEntity,
    filterDateFrom,
    filterDateTo,
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Stats
  const stats = {
    total: totalCount,
    today: entries.filter(
      (e) => new Date(e.created_at).toDateString() === new Date().toDateString()
    ).length,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link to="/actes" className="hover:text-blue-600">
              Tableau de bord
            </Link>
            <span>/</span>
            <span className="text-slate-700">Journal des responsabilités</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            📜 Journal des responsabilités
          </h1>
          <p className="text-slate-500 mt-1">
            Audit trail complet des actions avec engagement juridique
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Legal notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚖️</span>
            <div>
              <h3 className="font-semibold text-amber-800">Valeur juridique</h3>
              <p className="text-sm text-amber-700 mt-1">
                Ce journal constitue une trace d'audit à valeur probatoire.
                Chaque entrée est horodatée, signée et liée à l'adresse IP de
                l'utilisateur. Il peut être produit en cas de contentieux devant
                le Tribunal Administratif ou la CADA.
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-lg border border-slate-200 bg-white">
            <div className="text-2xl font-bold text-slate-800">
              {stats.total.toLocaleString("fr-FR")}
            </div>
            <div className="text-sm text-slate-500">📊 Total des entrées</div>
          </div>

          <div className="p-4 rounded-lg border border-slate-200 bg-white">
            <div className="text-2xl font-bold text-blue-600">
              {stats.today}
            </div>
            <div className="text-sm text-slate-500">📅 Entrées aujourd'hui</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
          <h3 className="text-sm font-medium text-slate-700 mb-3">
            🔍 Filtres
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Type filter */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Type d'action
              </label>
              <select
                value={filterType}
                onChange={(e) => updateFilter("type", e.target.value)}
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
              >
                <option value="">Tous les types</option>
                {Object.entries(RESPONSIBILITY_TYPES).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.emoji} {info.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Entity filter */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Type d'entité
              </label>
              <select
                value={filterEntity}
                onChange={(e) => updateFilter("entity", e.target.value)}
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
              >
                <option value="">Toutes les entités</option>
                {Object.entries(ENTITY_TYPES).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.emoji} {info.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date from */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Date début
              </label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => updateFilter("from", e.target.value)}
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
              />
            </div>

            {/* Date to */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Date fin
              </label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => updateFilter("to", e.target.value)}
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Clear filters */}
          {(filterType ||
            filterUser ||
            filterEntity ||
            filterDateFrom ||
            filterDateTo) && (
            <button
              onClick={() => setSearchParams({ page: "1" })}
              className="mt-4 text-sm text-blue-600 hover:text-blue-800"
            >
              ✕ Effacer tous les filtres
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
            ⚠️ {error}
          </div>
        )}

        {/* Entries list */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-500">Chargement...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
            <div className="text-4xl mb-4">📜</div>
            <p className="text-slate-500">Aucune entrée trouvée</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {entries.map((entry) => (
                <LogEntry key={entry.id} entry={entry} />
              ))}
            </div>

            {totalPages > 1 && (
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={(newPage) =>
                  updateFilter("page", String(newPage))
                }
              />
            )}
          </>
        )}

        {/* Export button */}
        <div className="mt-8 text-center">
          <button
            onClick={() => {
              // Export as JSON
              const dataStr = JSON.stringify(entries, null, 2);
              const blob = new Blob([dataStr], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `responsabilites_${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-sm"
          >
            📥 Exporter en JSON
          </button>
        </div>
      </div>
    </div>
  );
}
