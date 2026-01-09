import { Link } from "react-router-dom";
import { getMetadata } from "../../../../../packages/cop-host/src/lib/metadata.js";
import { getGroupType } from "../../../../../packages/cop-host/src/lib/socialMetadata.js";

/**
 * Carte d'affichage d'un groupe
 */
export default function GroupCard({ group, currentUserId }) {
  const groupType = getGroupType(group);
  const avatarUrl = getMetadata(group, "avatarUrl");
  const location = getMetadata(group, "location");
  const tags = getMetadata(group, "tags", []);
  const memberCount = group.group_members?.[0]?.count || 0;

  // Icônes par type (SVG)
  const typeIcons = {
    neighborhood: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    interest: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
    ),
    community: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    other: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  };

  // Labels par type
  const typeLabels = {
    neighborhood: "Quartier",
    association: "Association",
    community: "Communauté",
    forum: "Forum",
  };

  return (
    <Link
      to={`/groups/${group.id}`}
      className="theme-card p-6 block hover:translate-y-[-4px] transition-transform"
    >
      {/* Header avec avatar */}
      <div className="flex items-start gap-4 mb-4">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={group.name}
            className="w-16 h-16 rounded-none border-2 border-bauhaus-black object-cover"
          />
        ) : (
          <div className="w-16 h-16 bg-gray-100 border-2 border-bauhaus-black flex items-center justify-center text-3xl">
            {typeIcons[groupType] || typeIcons.community}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-gray-800 truncate font-bauhaus uppercase">
            {group.name}
          </h3>
          <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
            <span className="bg-gray-100 border border-gray-300 px-2 py-0.5 font-bold text-xs uppercase">
              {typeLabels[groupType] || "Groupe"}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      {group.description && (
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">{group.description}</p>
      )}

      {/* Location si présente */}
      {location && (
        <div className="text-sm text-gray-500 mb-3 flex items-center gap-1 font-medium">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>{" "}
          {location}
        </div>
      )}

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
          {memberCount} membre{memberCount !== 1 ? "s" : ""}
        </span>
        <span className="text-xs">{new Date(group.created_at).toLocaleDateString("fr-FR")}</span>
      </div>
    </Link>
  );
}
