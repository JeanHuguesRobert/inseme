// src/pages/actes/ActesDashboard.jsx
// ============================================================================
// Dashboard des Actes Municipaux — Système Citoyen de Contrôle
// Vue principale avec statistiques, échéances, et accès rapide aux actes
// ============================================================================

import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { getSupabase, useCurrentUser } from "@inseme/cop-host";
import { CITY_NAME, HASHTAG } from "@inseme/cop-host";

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const StatCard = ({ title, value, subtitle, icon, color = "slate", trend }) => {
  const colorClasses = {
    green: "bg-green-50 border-green-200 text-green-700",
    red: "bg-red-50 border-red-200 text-red-700",
    orange: "bg-orange-50 border-orange-200 text-orange-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    slate: "bg-slate-50 border-slate-200 text-slate-700",
    purple: "bg-purple-50 border-purple-200 text-purple-700",
  };

  return (
    <div className={`rounded-lg border p-5 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        {trend && (
          <span
            className={`text-xs font-medium ${trend > 0 ? "text-green-600" : trend < 0 ? "text-red-600" : "text-slate-500"}`}
          >
            {trend > 0 ? "↑" : trend < 0 ? "↓" : "→"} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="mt-3 text-3xl font-bold">{value}</p>
      <p className="text-sm font-medium mt-1">{title}</p>
      {subtitle && <p className="text-xs opacity-75 mt-1">{subtitle}</p>}
    </div>
  );
};

const DeadlineCard = ({ deadline }) => {
  const daysRemaining = deadline.days_remaining;
  const isOverdue = deadline.status === "DEPASSEE" || daysRemaining < 0;
  const isUrgent = daysRemaining <= 3 && daysRemaining >= 0;

  const statusColors = {
    overdue: "bg-red-100 border-red-300 text-red-800",
    urgent: "bg-orange-100 border-orange-300 text-orange-800",
    normal: "bg-blue-100 border-blue-300 text-blue-800",
  };

  const statusClass = isOverdue
    ? statusColors.overdue
    : isUrgent
      ? statusColors.urgent
      : statusColors.normal;

  return (
    <div className={`rounded-lg border p-4 ${statusClass}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="font-medium text-sm">
            {deadline.template?.label_fr ||
              deadline.template?.code ||
              "Échéance"}
          </p>
          <p className="text-xs opacity-75 mt-1">
            {deadline.entity_type} — {deadline.due_date}
          </p>
        </div>
        <div className="text-right">
          <span
            className={`text-lg font-bold ${isOverdue ? "text-red-600" : isUrgent ? "text-orange-600" : "text-blue-600"}`}
          >
            {isOverdue ? `J+${Math.abs(daysRemaining)}` : `J-${daysRemaining}`}
          </span>
        </div>
      </div>
      {deadline.consequence_if_missed && (
        <p className="text-xs mt-2 font-medium">
          ⚠️ {deadline.consequence_if_missed}
        </p>
      )}
    </div>
  );
};

const ActeRow = ({ acte }) => {
  const statusBadge = (status) => {
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
    return (
      badges[status] || {
        class: "bg-slate-100 text-slate-600",
        label: status || "N/A",
      }
    );
  };

  const badge = statusBadge(acte.statut_juridique);

  return (
    <tr className="hover:bg-slate-50 border-b border-slate-100">
      <td className="px-4 py-3">
        <Link
          to={`/actes/${acte.id}`}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          {acte.numero_interne || acte.numero_actes || "N/A"}
        </Link>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">
        {acte.date_acte || "—"}
      </td>
      <td className="px-4 py-3">
        <span className="text-xs font-medium px-2 py-1 rounded bg-slate-100 text-slate-700">
          {acte.type_acte || "ACTE"}
        </span>
      </td>
      <td
        className="px-4 py-3 text-sm text-slate-700 max-w-xs truncate"
        title={acte.objet_court}
      >
        {acte.objet_court || "Sans objet"}
      </td>
      <td className="px-4 py-3">
        <span
          className={`text-xs font-medium px-2 py-1 rounded ${badge.class}`}
        >
          {badge.label}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        {acte.transmission_confirmed ? (
          <span
            className="text-green-600"
            title={`Transmis le ${acte.transmission_confirmed}`}
          >
            ✅
          </span>
        ) : acte.transmission_declared ? (
          <span
            className="text-orange-500"
            title={`Déclaré le ${acte.transmission_declared}`}
          >
            ⏳
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        {acte.nb_deadlines_depassees > 0 ? (
          <span
            className="text-red-600 font-bold"
            title={`${acte.nb_deadlines_depassees} délai(s) dépassé(s)`}
          >
            {acte.nb_deadlines_depassees}
          </span>
        ) : (
          <span className="text-green-600">✓</span>
        )}
      </td>
    </tr>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ActesDashboard() {
  const { currentUser: user } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data states
  const [transparencyScore, setTransparencyScore] = useState(null);
  const [stats, setStats] = useState(null);
  const [recentActes, setRecentActes] = useState([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState([]);
  const [overdueDeadlines, setOverdueDeadlines] = useState([]);
  const [pendingDemandes, setPendingDemandes] = useState([]);

  // Filters
  const [collectiviteFilter, setCollectiviteFilter] = useState("");
  const [collectivites, setCollectivites] = useState([]);

  // Fetch data
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!getSupabase()) {
        setError("Configuration Supabase manquante.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // 1. Fetch collectivities for filter
        const { data: collData } = await getSupabase()
          .from("collectivite")
          .select("id, nom_officiel, code_insee")
          .order("nom_officiel");

        if (collData) {
          setCollectivites(collData);
          // Default to first or Corte
          const corte = collData.find((c) =>
            c.nom_officiel?.toLowerCase().includes("corte")
          );
          if (corte) setCollectiviteFilter(corte.id);
          else if (collData.length > 0) setCollectiviteFilter(collData[0].id);
        }

        // 2. Fetch transparency score
        const { data: scoreData } = await getSupabase()
          .from("v_transparence_score")
          .select("*")
          .limit(1)
          .single();

        if (scoreData) setTransparencyScore(scoreData);

        // 3. Fetch transmission stats
        const { data: statsData } = await getSupabase()
          .from("v_stats_transmission")
          .select("*")
          .limit(1)
          .single();

        if (statsData) setStats(statsData);

        // 4. Fetch recent actes
        const { data: actesData } = await getSupabase()
          .from("v_actes_synthetiques")
          .select("*")
          .order("date_acte", { ascending: false })
          .limit(10);

        if (actesData) setRecentActes(actesData);

        // 5. Fetch upcoming deadlines
        const { data: upcomingData } = await getSupabase()
          .from("v_deadlines_upcoming")
          .select("*")
          .order("due_date")
          .limit(5);

        if (upcomingData) setUpcomingDeadlines(upcomingData);

        // 6. Fetch overdue deadlines
        const { data: overdueData } = await getSupabase()
          .from("v_deadlines_overdue")
          .select("*")
          .order("due_date")
          .limit(5);

        if (overdueData) setOverdueDeadlines(overdueData);

        // 7. Fetch pending demandes
        const { data: demandesData } = await getSupabase()
          .from("demande_admin")
          .select(
            "id, type_demande, reference_interne, objet, date_envoi, status"
          )
          .eq("status", "EN_ATTENTE")
          .order("date_envoi")
          .limit(5);

        if (demandesData) setPendingDemandes(demandesData);
      } catch (err) {
        console.error("[ActesDashboard] Error:", err);
        setError(err.message || "Erreur lors du chargement des données.");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Calculate derived stats
  const scoreGlobal = transparencyScore?.score_global || 0;
  const scoreColor =
    scoreGlobal >= 70 ? "green" : scoreGlobal >= 40 ? "orange" : "red";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">
            Chargement du tableau de bord...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-sm tracking-widest text-slate-500 font-semibold mb-2">
                {HASHTAG} — CONTRÔLE CITOYEN
              </p>
              <h1 className="text-3xl font-bold text-slate-900">
                Tableau de Bord des Actes Municipaux
              </h1>
              <p className="text-slate-600 mt-2">
                Suivi de la transparence et des délais légaux —{" "}
                {CITY_NAME || "Collectivité"}
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                to="/demandes"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                📩 Demandes CRPA
              </Link>
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
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            ⚠️ {error}
          </div>
        )}

        {/* Score de transparence */}
        <section>
          <h2 className="text-xl font-semibold text-slate-800 mb-4">
            🏛️ Score de Transparence
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard
              title="Score Global"
              value={`${scoreGlobal}/100`}
              subtitle="Indicateur composite"
              icon="📊"
              color={scoreColor}
            />
            <StatCard
              title="Transmission"
              value={`${transparencyScore?.score_transmission || 0}%`}
              subtitle={`${stats?.transmis_confirmes || 0}/${stats?.total_actes || 0} actes`}
              icon="📡"
              color={
                transparencyScore?.score_transmission >= 80 ? "green" : "orange"
              }
            />
            <StatCard
              title="Réponse CRPA"
              value={`${transparencyScore?.score_reponse_crpa || 0}%`}
              subtitle={`${transparencyScore?.total_demandes || 0} demandes`}
              icon="📩"
              color={
                transparencyScore?.score_reponse_crpa >= 80 ? "green" : "orange"
              }
            />
            <StatCard
              title="Non-Silence"
              value={`${transparencyScore?.score_non_silence || 0}%`}
              subtitle="Pénalité refus implicites"
              icon="🤫"
              color={
                transparencyScore?.score_non_silence >= 80 ? "green" : "red"
              }
            />
            <StatCard
              title="Recours"
              value={transparencyScore?.total_recours || 0}
              subtitle="En cours ou terminés"
              icon="⚖️"
              color="purple"
            />
          </div>
        </section>

        {/* Alertes échéances */}
        {(overdueDeadlines.length > 0 || upcomingDeadlines.length > 0) && (
          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">
              ⏰ Échéances Juridiques
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Overdue */}
              {overdueDeadlines.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
                    🔴 Délais dépassés ({overdueDeadlines.length})
                  </h3>
                  <div className="space-y-3">
                    {overdueDeadlines.map((d) => (
                      <DeadlineCard key={d.id} deadline={d} />
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming */}
              {upcomingDeadlines.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-blue-700 mb-3 flex items-center gap-2">
                    🔵 Échéances à venir ({upcomingDeadlines.length})
                  </h3>
                  <div className="space-y-3">
                    {upcomingDeadlines.map((d) => (
                      <DeadlineCard key={d.id} deadline={d} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Demandes en attente */}
        {pendingDemandes.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-800">
                📩 Demandes en Attente
              </h2>
              <Link
                to="/demandes"
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Voir toutes →
              </Link>
            </div>
            <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">
                      Référence
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">
                      Objet
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">
                      Envoi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pendingDemandes.map((d) => (
                    <tr
                      key={d.id}
                      className="hover:bg-slate-50 border-b border-slate-100"
                    >
                      <td className="px-4 py-3 font-medium text-blue-600">
                        <Link to={`/demandes/${d.id}`}>
                          {d.reference_interne || d.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                          {d.type_demande}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 max-w-xs truncate">
                        {d.objet || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {d.date_envoi || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Actes récents */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-slate-800">
              📋 Actes Récents
            </h2>
            <Link
              to="/actes/liste"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Voir tous les actes →
            </Link>
          </div>
          <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">
                      N°
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">
                      Date
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
                  </tr>
                </thead>
                <tbody>
                  {recentActes.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-slate-500"
                      >
                        Aucun acte enregistré. Commencez par ajouter un acte
                        municipal.
                      </td>
                    </tr>
                  ) : (
                    recentActes.map((acte) => (
                      <ActeRow key={acte.id} acte={acte} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Actions rapides */}
        <section>
          <h2 className="text-xl font-semibold text-slate-800 mb-4">
            🚀 Actions Rapides
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              to="/demandes/nouvelle"
              className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md transition-shadow flex items-center gap-4"
            >
              <span className="text-3xl">📝</span>
              <div>
                <p className="font-semibold text-slate-800">
                  Nouvelle demande CRPA
                </p>
                <p className="text-sm text-slate-500">Demander un document</p>
              </div>
            </Link>
            <Link
              to="/bob"
              className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md transition-shadow flex items-center gap-4"
            >
              <span className="text-3xl">🤖</span>
              <div>
                <p className="font-semibold text-slate-800">
                  Consulter Ophélia
                </p>
                <p className="text-sm text-slate-500">Assistant juridique IA</p>
              </div>
            </Link>
            <Link
              to="/demandes"
              className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md transition-shadow flex items-center gap-4"
            >
              <span className="text-3xl">⚖️</span>
              <div>
                <p className="font-semibold text-slate-800">
                  Suivre mes recours
                </p>
                <p className="text-sm text-slate-500">CADA, TA, gracieux</p>
              </div>
            </Link>
            <Link
              to="/transparence"
              className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md transition-shadow flex items-center gap-4"
            >
              <span className="text-3xl">📊</span>
              <div>
                <p className="font-semibold text-slate-800">Observatoire</p>
                <p className="text-sm text-slate-500">Comparaison nationale</p>
              </div>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
