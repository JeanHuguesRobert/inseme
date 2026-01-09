// src/pages/actes/StatsDashboard.jsx
// ============================================================================
// Tableau de bord statistique
// Indicateurs clés et visualisations pour le suivi citoyen
// ============================================================================

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSupabase } from "@inseme/cop-host";

// ============================================================================
// CONSTANTS
// ============================================================================

const STAT_PERIODS = {
  WEEK: { label: "7 jours", days: 7 },
  MONTH: { label: "30 jours", days: 30 },
  QUARTER: { label: "90 jours", days: 90 },
  YEAR: { label: "1 an", days: 365 },
  ALL: { label: "Tout", days: null },
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const StatCard = ({ title, value, subtitle, emoji, trend, trendLabel, color = "blue" }) => {
  const colorClasses = {
    blue: "from-blue-500 to-blue-600",
    green: "from-green-500 to-green-600",
    amber: "from-amber-500 to-amber-600",
    red: "from-red-500 to-red-600",
    purple: "from-purple-500 to-purple-600",
    cyan: "from-cyan-500 to-cyan-600",
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className={`h-1 bg-gradient-to-r ${colorClasses[color]}`}></div>
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-2xl">{emoji}</span>
          {trend !== undefined && (
            <span
              className={`text-sm font-medium ${trend >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}%
              {trendLabel && <span className="text-slate-400 text-xs ml-1">{trendLabel}</span>}
            </span>
          )}
        </div>
        <div className="text-3xl font-bold text-slate-800 mb-1">
          {typeof value === "number" ? value.toLocaleString("fr-FR") : value}
        </div>
        <div className="text-sm text-slate-500">{title}</div>
        {subtitle && <div className="text-xs text-slate-400 mt-1">{subtitle}</div>}
      </div>
    </div>
  );
};

const ProgressBar = ({ label, value, max, color = "blue" }) => {
  const percentage = max > 0 ? Math.round((value / max) * 100) : 0;
  const colorClasses = {
    blue: "bg-blue-500",
    green: "bg-green-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
  };

  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-700">{label}</span>
        <span className="text-slate-500">
          {value} / {max} ({percentage}%)
        </span>
      </div>
      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClasses[color]} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

const DeadlineAlert = ({ count, type, daysUntil }) => (
  <div
    className={`p-4 rounded-lg border ${
      daysUntil <= 3
        ? "bg-red-50 border-red-200"
        : daysUntil <= 7
          ? "bg-amber-50 border-amber-200"
          : "bg-blue-50 border-blue-200"
    }`}
  >
    <div className="flex items-center justify-between">
      <div>
        <span
          className={`font-medium ${
            daysUntil <= 3 ? "text-red-700" : daysUntil <= 7 ? "text-amber-700" : "text-blue-700"
          }`}
        >
          ⏰ {count} {type}
          {count > 1 ? "s" : ""}
        </span>
        <span className="text-sm text-slate-500 ml-2">
          échéance dans {daysUntil} jour{daysUntil > 1 ? "s" : ""}
        </span>
      </div>
      <Link to="/demandes?deadline=soon" className="text-sm text-blue-600 hover:text-blue-800">
        Voir →
      </Link>
    </div>
  </div>
);

const MiniChart = ({ data, label, height = 100 }) => {
  const max = Math.max(...data.map((d) => d.value), 1);
  const barWidth = 100 / data.length;

  return (
    <div>
      <div className="flex items-end justify-between gap-1" style={{ height }}>
        {data.map((d, i) => (
          <div
            key={i}
            className="flex-1 bg-blue-500 rounded-t hover:bg-blue-600 transition-colors cursor-pointer group relative"
            style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 4 : 0 }}
            title={`${d.label}: ${d.value}`}
          >
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-10">
              {d.label}: {d.value}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-xs text-slate-400">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
      {label && <div className="text-center text-sm text-slate-500 mt-2">{label}</div>}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function StatsDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState("MONTH");

  // Stats
  const [stats, setStats] = useState({
    actes: { total: 0, recent: 0, byType: {}, byStatus: {} },
    demandes: { total: 0, pending: 0, byType: {}, byStatus: {} },
    proofs: { total: 0, verified: 0, pending: 0 },
    deadlines: { soon: [], overdue: [] },
    activity: [],
  });

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      if (!getSupabase()) return;

      setLoading(true);

      try {
        const periodDays = STAT_PERIODS[period].days;
        const since = periodDays
          ? new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString()
          : null;

        // Actes stats
        const { data: actes, count: actesTotal } = await getSupabase()
          .from("actes")
          .select("id, type_acte, statut, created_at", { count: "exact" });

        const actesRecent = since
          ? actes?.filter((a) => a.created_at >= since).length || 0
          : actesTotal || 0;

        const actesByType =
          actes?.reduce((acc, a) => {
            acc[a.type_acte] = (acc[a.type_acte] || 0) + 1;
            return acc;
          }, {}) || {};

        const actesByStatus =
          actes?.reduce((acc, a) => {
            acc[a.statut] = (acc[a.statut] || 0) + 1;
            return acc;
          }, {}) || {};

        // Demandes stats
        const { data: demandes, count: demandesTotal } = await getSupabase()
          .from("demande_admin")
          .select("id, type_demande, statut, date_limite_reponse, created_at", { count: "exact" });

        const demandesPending =
          demandes?.filter((d) => ["EN_ATTENTE", "ENVOYEE"].includes(d.statut)).length || 0;

        const demandesByType =
          demandes?.reduce((acc, d) => {
            acc[d.type_demande] = (acc[d.type_demande] || 0) + 1;
            return acc;
          }, {}) || {};

        const demandesByStatus =
          demandes?.reduce((acc, d) => {
            acc[d.statut] = (acc[d.statut] || 0) + 1;
            return acc;
          }, {}) || {};

        // Deadlines
        const now = new Date();
        const soon = [];
        const overdue = [];

        demandes?.forEach((d) => {
          if (d.date_limite_reponse && ["EN_ATTENTE", "ENVOYEE"].includes(d.statut)) {
            const deadline = new Date(d.date_limite_reponse);
            const daysUntil = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));

            if (daysUntil < 0) {
              overdue.push({ ...d, daysOverdue: Math.abs(daysUntil) });
            } else if (daysUntil <= 7) {
              soon.push({ ...d, daysUntil });
            }
          }
        });

        // Proofs stats
        const { data: proofs, count: proofsTotal } = await getSupabase()
          .from("proof")
          .select("id, verified_at", { count: "exact" });

        const proofsVerified = proofs?.filter((p) => p.verified_at).length || 0;

        // Activity chart (last 7 days)
        const activity = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().slice(0, 10);

          const dayActes = actes?.filter((a) => a.created_at?.slice(0, 10) === dateStr).length || 0;

          const dayDemandes =
            demandes?.filter((d) => d.created_at?.slice(0, 10) === dateStr).length || 0;

          activity.push({
            label: date.toLocaleDateString("fr-FR", { weekday: "short" }),
            value: dayActes + dayDemandes,
          });
        }

        setStats({
          actes: {
            total: actesTotal || 0,
            recent: actesRecent,
            byType: actesByType,
            byStatus: actesByStatus,
          },
          demandes: {
            total: demandesTotal || 0,
            pending: demandesPending,
            byType: demandesByType,
            byStatus: demandesByStatus,
          },
          proofs: {
            total: proofsTotal || 0,
            verified: proofsVerified,
            pending: (proofsTotal || 0) - proofsVerified,
          },
          deadlines: { soon, overdue },
          activity,
        });
      } catch (err) {
        console.error("[StatsDashboard] Error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [period]);

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
            <span className="text-slate-700">Statistiques</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">📊 Indicateurs de suivi</h1>
              <p className="text-slate-500 mt-1">
                Vue d'ensemble de l'activité et des performances
              </p>
            </div>

            {/* Period selector */}
            <div className="flex gap-2">
              {Object.entries(STAT_PERIODS).map(([key, info]) => (
                <button
                  key={key}
                  onClick={() => setPeriod(key)}
                  className={`px-3 py-1.5 rounded text-sm ${
                    period === key
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {info.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-500">Chargement des statistiques...</p>
          </div>
        ) : (
          <>
            {/* Key stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard
                title="Actes suivis"
                value={stats.actes.total}
                subtitle={`${stats.actes.recent} sur la période`}
                emoji="📋"
                color="blue"
              />
              <StatCard
                title="Demandes en cours"
                value={stats.demandes.pending}
                subtitle={`${stats.demandes.total} total`}
                emoji="📬"
                color="purple"
              />
              <StatCard
                title="Preuves vérifiées"
                value={stats.proofs.verified}
                subtitle={`${stats.proofs.pending} en attente`}
                emoji="📎"
                color="green"
              />
              <StatCard
                title="Délais dépassés"
                value={stats.deadlines.overdue.length}
                subtitle={`${stats.deadlines.soon.length} échéances proches`}
                emoji="⏰"
                color={stats.deadlines.overdue.length > 0 ? "red" : "green"}
              />
            </div>

            {/* Deadline alerts */}
            {(stats.deadlines.overdue.length > 0 || stats.deadlines.soon.length > 0) && (
              <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
                <h3 className="font-semibold text-slate-800 mb-4">⚠️ Alertes délais</h3>
                <div className="space-y-3">
                  {stats.deadlines.overdue.length > 0 && (
                    <div className="p-4 rounded-lg border bg-red-50 border-red-200">
                      <span className="font-medium text-red-700">
                        🚨 {stats.deadlines.overdue.length} délai
                        {stats.deadlines.overdue.length > 1 ? "s" : ""} dépassé
                        {stats.deadlines.overdue.length > 1 ? "s" : ""}
                      </span>
                      <Link
                        to="/demandes?status=SANS_REPONSE"
                        className="text-sm text-blue-600 hover:text-blue-800 ml-4"
                      >
                        Voir →
                      </Link>
                    </div>
                  )}
                  {stats.deadlines.soon.length > 0 && (
                    <DeadlineAlert
                      count={stats.deadlines.soon.length}
                      type="demande"
                      daysUntil={Math.min(...stats.deadlines.soon.map((d) => d.daysUntil))}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Activity chart */}
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-800 mb-4">
                  📈 Activité (7 derniers jours)
                </h3>
                <MiniChart data={stats.activity} height={120} />
              </div>

              {/* Demandes by type */}
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-800 mb-4">📊 Demandes par type</h3>
                {Object.entries(stats.demandes.byType).map(([type, count]) => (
                  <ProgressBar
                    key={type}
                    label={type}
                    value={count}
                    max={stats.demandes.total}
                    color={type === "CRPA" ? "blue" : type === "CADA" ? "amber" : "purple"}
                  />
                ))}
                {Object.keys(stats.demandes.byType).length === 0 && (
                  <p className="text-slate-500 text-center py-4">Aucune donnée</p>
                )}
              </div>
            </div>

            {/* Status breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Actes by status */}
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-800 mb-4">📋 Actes par statut</h3>
                {Object.entries(stats.actes.byStatus).map(([status, count]) => (
                  <ProgressBar
                    key={status}
                    label={status}
                    value={count}
                    max={stats.actes.total}
                    color="blue"
                  />
                ))}
                {Object.keys(stats.actes.byStatus).length === 0 && (
                  <p className="text-slate-500 text-center py-4">Aucune donnée</p>
                )}
              </div>

              {/* Demandes by status */}
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-800 mb-4">📬 Demandes par statut</h3>
                {Object.entries(stats.demandes.byStatus).map(([status, count]) => {
                  const colors = {
                    EN_ATTENTE: "amber",
                    ENVOYEE: "blue",
                    REPONSE_RECUE: "green",
                    SANS_REPONSE: "red",
                    CLOTUREE: "slate",
                  };
                  return (
                    <ProgressBar
                      key={status}
                      label={status}
                      value={count}
                      max={stats.demandes.total}
                      color={colors[status] || "blue"}
                    />
                  );
                })}
                {Object.keys(stats.demandes.byStatus).length === 0 && (
                  <p className="text-slate-500 text-center py-4">Aucune donnée</p>
                )}
              </div>
            </div>

            {/* Quick links */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-800 mb-4">🔗 Actions rapides</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Link
                  to="/actes/nouveau"
                  className="p-4 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50 text-center transition-colors"
                >
                  <span className="text-2xl block mb-2">➕</span>
                  <span className="text-sm text-slate-600">Nouvel acte</span>
                </Link>
                <Link
                  to="/demandes/nouvelle"
                  className="p-4 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50 text-center transition-colors"
                >
                  <span className="text-2xl block mb-2">📬</span>
                  <span className="text-sm text-slate-600">Nouvelle demande</span>
                </Link>
                <Link
                  to="/preuves/ajouter"
                  className="p-4 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50 text-center transition-colors"
                >
                  <span className="text-2xl block mb-2">📎</span>
                  <span className="text-sm text-slate-600">Ajouter preuve</span>
                </Link>
                <Link
                  to="/exports/csv"
                  className="p-4 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50 text-center transition-colors"
                >
                  <span className="text-2xl block mb-2">📊</span>
                  <span className="text-sm text-slate-600">Exporter données</span>
                </Link>
              </div>
            </div>
          </>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}
