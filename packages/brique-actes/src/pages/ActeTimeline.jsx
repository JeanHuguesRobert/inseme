// src/pages/actes/ActeTimeline.jsx
// ============================================================================
// Timeline/Chronologie des actes
// Visualisation chronologique interactive des événements
// ============================================================================

import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getSupabase } from "@inseme/cop-host";

// ============================================================================
// CONSTANTS
// ============================================================================

const EVENT_TYPES = {
  CREATION: { label: "Création", emoji: "✨", color: "blue" },
  MODIFICATION: { label: "Modification", emoji: "✏️", color: "amber" },
  TRANSMISSION: { label: "Transmission", emoji: "📤", color: "purple" },
  AFFICHAGE: { label: "Affichage", emoji: "📌", color: "green" },
  DEMANDE_CRPA: { label: "Demande CRPA", emoji: "📬", color: "cyan" },
  DEMANDE_CADA: { label: "Saisine CADA", emoji: "📨", color: "orange" },
  RECOURS: { label: "Recours", emoji: "⚖️", color: "red" },
  REPONSE: { label: "Réponse reçue", emoji: "📩", color: "emerald" },
  PREUVE: { label: "Preuve ajoutée", emoji: "📎", color: "slate" },
  EXPIRATION: { label: "Délai expiré", emoji: "⏰", color: "red" },
  PUBLICATION: { label: "Publication", emoji: "📢", color: "indigo" },
  ACTION: { label: "Action externe", emoji: "🎯", color: "pink" },
};

const ZOOM_LEVELS = {
  DAY: { label: "Jour", days: 1 },
  WEEK: { label: "Semaine", days: 7 },
  MONTH: { label: "Mois", days: 30 },
  QUARTER: { label: "Trimestre", days: 90 },
  YEAR: { label: "Année", days: 365 },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format date for display
 */
const formatDate = (dateStr, includeTime = false) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const options = {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(includeTime && { hour: "2-digit", minute: "2-digit" }),
  };
  return date.toLocaleDateString("fr-FR", options);
};

/**
 * Get days between dates
 */
const daysBetween = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const TimelineEvent = ({ event, isLast }) => {
  const [expanded, setExpanded] = useState(false);
  const typeInfo = EVENT_TYPES[event.type] || {
    label: event.type,
    emoji: "📋",
    color: "slate",
  };

  const colorClasses = {
    blue: "bg-blue-500 border-blue-500",
    amber: "bg-amber-500 border-amber-500",
    purple: "bg-purple-500 border-purple-500",
    green: "bg-green-500 border-green-500",
    cyan: "bg-cyan-500 border-cyan-500",
    orange: "bg-orange-500 border-orange-500",
    red: "bg-red-500 border-red-500",
    emerald: "bg-emerald-500 border-emerald-500",
    slate: "bg-slate-500 border-slate-500",
    indigo: "bg-indigo-500 border-indigo-500",
    pink: "bg-pink-500 border-pink-500",
  };

  return (
    <div className="relative flex gap-4">
      {/* Line and dot */}
      <div className="flex flex-col items-center">
        <div
          className={`w-4 h-4 rounded-full ${colorClasses[typeInfo.color]} z-10`}
        ></div>
        {!isLast && (
          <div className="w-0.5 flex-1 bg-slate-200 min-h-[60px]"></div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-8">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div
            className="p-4 cursor-pointer hover:bg-slate-50"
            onClick={() => setExpanded(!expanded)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{typeInfo.emoji}</span>
                <span className="font-medium text-slate-800">
                  {typeInfo.label}
                </span>
              </div>
              <div className="text-sm text-slate-500">
                {formatDate(event.date, true)}
              </div>
            </div>

            <p className="text-slate-600 mt-2">{event.description}</p>

            {event.entity_link && (
              <Link
                to={event.entity_link}
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mt-2"
                onClick={(e) => e.stopPropagation()}
              >
                👁️ Voir le détail
              </Link>
            )}
          </div>

          {/* Expanded details */}
          {expanded && event.metadata && (
            <div className="px-4 pb-4 pt-0 border-t border-slate-100 mt-2">
              <h4 className="text-xs font-medium text-slate-500 mt-3 mb-2">
                Détails
              </h4>
              <pre className="text-xs bg-slate-50 p-3 rounded overflow-x-auto">
                {JSON.stringify(event.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const DateRange = ({ start, end, events }) => {
  const daysCount = daysBetween(start, end);

  return (
    <div className="mb-6 p-4 bg-slate-50 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-700">
          📅 {formatDate(start)} → {formatDate(end)}
        </span>
        <span className="text-sm text-slate-500">
          {daysCount} jours • {events} événements
        </span>
      </div>
      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full"
          style={{ width: `${Math.min((events / 10) * 100, 100)}%` }}
        ></div>
      </div>
    </div>
  );
};

const FilterButton = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded text-sm transition-colors ${
      active
        ? "bg-blue-600 text-white"
        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
    }`}
  >
    {children}
  </button>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ActeTimeline() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [events, setEvents] = useState([]);
  const [acte, setActe] = useState(null);

  // Filters
  const zoomLevel = searchParams.get("zoom") || "MONTH";
  const filterTypes =
    searchParams.get("types")?.split(",").filter(Boolean) || [];

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (!getSupabase()) return;

      setLoading(true);

      try {
        const allEvents = [];

        if (id) {
          // Single acte timeline
          const { data: acteData, error: acteError } = await getSupabase()
            .from("actes")
            .select(
              `
              *, 
              acte_version(*), 
              mandats(
                role, 
                user:users(display_name)
              )
            `
            )
            .eq("id", id)
            .single();

          if (acteError) throw acteError;
          setActe(acteData);

          // Creation event
          allEvents.push({
            type: "CREATION",
            date: acteData.created_at,
            description: `Acte créé: ${acteData.titre}`,
            entity_link: `/actes/${id}`,
          });

          // Versions
          acteData.acte_version?.forEach((v) => {
            if (v.version_number > 1) {
              allEvents.push({
                type: "MODIFICATION",
                date: v.created_at,
                description: `Version ${v.version_number}: ${v.change_notes || "Mise à jour"}`,
                entity_link: `/actes/${id}`,
                metadata: { version: v.version_number },
              });
            }
          });

          // Transmission
          if (acteData.date_transmission) {
            allEvents.push({
              type: "TRANSMISSION",
              date: acteData.date_transmission,
              description: "Transmission à la préfecture",
            });
          }

          // Affichage
          if (acteData.date_affichage) {
            allEvents.push({
              type: "AFFICHAGE",
              date: acteData.date_affichage,
              description: "Affichage public",
            });
          }

          // Demandes liées
          const { data: demandes } = await getSupabase()
            .from("demande_admin")
            .select("*")
            .eq("acte_id", id)
            .order("date_envoi", { ascending: true });

          demandes?.forEach((d) => {
            const typeMap = {
              CRPA: "DEMANDE_CRPA",
              CADA: "DEMANDE_CADA",
              RECOURS_GRACIEUX: "RECOURS",
              RECOURS_TA: "RECOURS",
            };
            allEvents.push({
              type: typeMap[d.type_demande] || "DEMANDE_CRPA",
              date: d.date_envoi || d.created_at,
              description: `${d.type_demande}: ${d.objet}`,
              entity_link: `/demandes/${d.id}`,
            });

            // Deadline expiration
            if (d.date_limite_reponse && d.statut === "SANS_REPONSE") {
              const now = new Date();
              if (new Date(d.date_limite_reponse) < now) {
                allEvents.push({
                  type: "EXPIRATION",
                  date: d.date_limite_reponse,
                  description: `Délai de réponse expiré (${d.type_demande})`,
                });
              }
            }
          });

          // Preuves liées
          const { data: proofs } = await getSupabase()
            .from("proof")
            .select("*")
            .eq("acte_id", id)
            .order("created_at", { ascending: true });

          proofs?.forEach((p) => {
            allEvents.push({
              type: "PREUVE",
              date: p.date_constat || p.created_at,
              description: `Preuve ajoutée: ${p.type_preuve || "Document"}`,
            });
          });
        } else {
          // Global timeline - recent events
          const since = new Date();
          since.setDate(since.getDate() - ZOOM_LEVELS[zoomLevel].days);

          // Recent actes
          const { data: actes } = await getSupabase()
            .from("actes")
            .select("id, titre, created_at, date_transmission, date_affichage")
            .gte("created_at", since.toISOString())
            .order("created_at", { ascending: false })
            .limit(50);

          actes?.forEach((a) => {
            allEvents.push({
              type: "CREATION",
              date: a.created_at,
              description: `Nouvel acte: ${a.titre}`,
              entity_link: `/actes/${a.id}`,
            });
          });

          // Recent demandes
          const { data: demandes } = await getSupabase()
            .from("demande_admin")
            .select("id, type_demande, objet, date_envoi, created_at")
            .gte("created_at", since.toISOString())
            .order("created_at", { ascending: false })
            .limit(50);

          demandes?.forEach((d) => {
            const typeMap = {
              CRPA: "DEMANDE_CRPA",
              CADA: "DEMANDE_CADA",
              RECOURS_GRACIEUX: "RECOURS",
              RECOURS_TA: "RECOURS",
            };
            allEvents.push({
              type: typeMap[d.type_demande] || "DEMANDE_CRPA",
              date: d.date_envoi || d.created_at,
              description: `${d.type_demande}: ${d.objet}`,
              entity_link: `/demandes/${d.id}`,
            });
          });
        }

        // Sort by date descending
        allEvents.sort((a, b) => new Date(b.date) - new Date(a.date));

        setEvents(allEvents);
      } catch (err) {
        console.error("[ActeTimeline] Error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, zoomLevel]);

  // Filter events
  const filteredEvents =
    filterTypes.length > 0
      ? events.filter((e) => filterTypes.includes(e.type))
      : events;

  // Update URL params
  const updateZoom = (newZoom) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("zoom", newZoom);
    setSearchParams(newParams);
  };

  const toggleTypeFilter = (type) => {
    const newTypes = filterTypes.includes(type)
      ? filterTypes.filter((t) => t !== type)
      : [...filterTypes, type];

    const newParams = new URLSearchParams(searchParams);
    if (newTypes.length > 0) {
      newParams.set("types", newTypes.join(","));
    } else {
      newParams.delete("types");
    }
    setSearchParams(newParams);
  };

  // Get date range
  const dateRange =
    filteredEvents.length > 0
      ? {
          start: filteredEvents[filteredEvents.length - 1].date,
          end: filteredEvents[0].date,
        }
      : null;

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
            {id && acte && (
              <>
                <Link to={`/actes/${id}`} className="hover:text-blue-600">
                  {acte.reference || acte.titre?.slice(0, 30)}
                </Link>
                <span>/</span>
              </>
            )}
            <span className="text-slate-700">Chronologie</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            📅 {id ? "Chronologie de l'acte" : "Chronologie générale"}
          </h1>
          <p className="text-slate-500 mt-1">
            {id
              ? `Timeline des événements liés à cet acte`
              : `Visualisation des événements sur la période sélectionnée`}
          </p>
          {id && acte?.mandats && (
            <div className="mt-4 inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium border border-blue-100">
              👤 Porté par : {acte.mandats.user?.display_name} (
              {acte.mandats.role})
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Zoom controls (global only) */}
        {!id && (
          <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
            <h3 className="text-sm font-medium text-slate-700 mb-3">
              📏 Période
            </h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(ZOOM_LEVELS).map(([key, info]) => (
                <FilterButton
                  key={key}
                  active={zoomLevel === key}
                  onClick={() => updateZoom(key)}
                >
                  {info.label}
                </FilterButton>
              ))}
            </div>
          </div>
        )}

        {/* Type filters */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
          <h3 className="text-sm font-medium text-slate-700 mb-3">
            🏷️ Types d'événements
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(EVENT_TYPES).map(([key, info]) => (
              <FilterButton
                key={key}
                active={filterTypes.includes(key)}
                onClick={() => toggleTypeFilter(key)}
              >
                {info.emoji} {info.label}
              </FilterButton>
            ))}
          </div>
          {filterTypes.length > 0 && (
            <button
              onClick={() => {
                const newParams = new URLSearchParams(searchParams);
                newParams.delete("types");
                setSearchParams(newParams);
              }}
              className="mt-2 text-xs text-blue-600 hover:text-blue-800"
            >
              ✕ Effacer les filtres
            </button>
          )}
        </div>

        {/* Stats */}
        {dateRange && (
          <DateRange
            start={dateRange.start}
            end={dateRange.end}
            events={filteredEvents.length}
          />
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
            ⚠️ {error}
          </div>
        )}

        {/* Timeline */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-500">Chargement...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
            <div className="text-4xl mb-4">📅</div>
            <p className="text-slate-500">Aucun événement trouvé</p>
          </div>
        ) : (
          <div className="pl-4">
            {filteredEvents.map((event, index) => (
              <TimelineEvent
                key={`${event.type}-${event.date}-${index}`}
                event={event}
                isLast={index === filteredEvents.length - 1}
              />
            ))}
          </div>
        )}

        {/* Export */}
        <div className="mt-8 text-center">
          <button
            onClick={() => {
              const csv = [
                "Date;Type;Description",
                ...filteredEvents.map(
                  (e) =>
                    `${formatDate(e.date)};${EVENT_TYPES[e.type]?.label || e.type};${e.description.replace(/;/g, ",")}`
                ),
              ].join("\n");

              const blob = new Blob(["\uFEFF" + csv], {
                type: "text/csv;charset=utf-8",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `timeline_${id || "global"}_${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-sm"
          >
            📥 Exporter la chronologie
          </button>
        </div>
      </div>
    </div>
  );
}
