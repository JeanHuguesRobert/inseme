import { Link } from "react-router-dom";
import { getMetadata } from "../../../../cop-host/src/lib/metadata.js";

/**
 * Carte d'affichage d'une mission
 */
export default function MissionCard({ mission }) {
  const location = getMetadata(mission, "location");
  const tags = getMetadata(mission, "tags", []);
  const missionDetails = getMetadata(mission, "mission_details", {});
  const memberCount = mission.group_members?.[0]?.count || 0;

  const startDate = missionDetails.start_date ? new Date(missionDetails.start_date) : null;

  return (
    <Link
      to={`/missions/${mission.id}`}
      className="theme-card p-6 block hover:translate-y-[-4px] transition-transform border-l-4 border-l-primary-500"
    >
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <div className="w-12 h-12 bg-primary-100 text-primary-700 flex items-center justify-center rounded-full text-2xl">
          🤝
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-gray-800 truncate font-bauhaus uppercase">
            {mission.name}
          </h3>
          <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
            <span className="bg-primary-50 text-primary-700 border border-primary-200 px-2 py-0.5 font-bold text-xs uppercase">
              Mission
            </span>
            {missionDetails.status && (
              <span
                className={`px-2 py-0.5 font-bold text-xs uppercase border ${
                  missionDetails.status === "open"
                    ? "bg-green-50 text-green-700 border-green-200"
                    : missionDetails.status === "completed"
                      ? "bg-gray-100 text-gray-600 border-gray-300"
                      : "bg-gray-50 text-gray-600 border-gray-200"
                }`}
              >
                {missionDetails.status === "open"
                  ? "Ouverte"
                  : missionDetails.status === "completed"
                    ? "Terminée"
                    : missionDetails.status}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {mission.description && (
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">{mission.description}</p>
      )}

      {/* Details */}
      <div className="space-y-2 mb-4 text-sm text-gray-600">
        {startDate && (
          <div className="flex items-center gap-2">
            <span>📅</span>
            <span className="font-medium">
              {startDate.toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        )}

        {location && (
          <div className="flex items-center gap-2">
            <span>📍</span>
            <span>{location}</span>
          </div>
        )}
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {tags.slice(0, 3).map((tag, idx) => (
            <span key={idx} className="filter-chip text-xs py-0 px-2 cursor-default">
              {tag}
            </span>
          ))}
          {tags.length > 3 && (
            <span className="text-xs text-gray-400 font-bold">+{tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Footer avec stats */}
      <div className="flex items-center justify-between text-sm text-gray-500 pt-3 border-t border-gray-200">
        <span className="font-bold">
          {memberCount} bénévole{memberCount !== 1 ? "s" : ""}
        </span>
        {missionDetails.max_volunteers && (
          <span className="text-xs">Max: {missionDetails.max_volunteers}</span>
        )}
      </div>
    </Link>
  );
}
