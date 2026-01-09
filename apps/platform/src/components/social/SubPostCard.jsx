import { Link } from "react-router-dom";
import { useState } from "react";
import { MarkdownViewer } from "@inseme/ui";
import { getPostTitle, getPostSubtitle, getThreadDepth } from "../../../../../packages/cop-host/src/lib/socialMetadata.js";
import { getDisplayName, getUserInitials } from "@inseme/cop-host";

/**
 * Card component for displaying sub-posts in a thread hierarchy
 */
export default function SubPostCard({ post, currentUser }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const title = getPostTitle(post);
  const subtitle = getPostSubtitle(post);
  const depth = getThreadDepth(post);
  const commentCount = post.comments?.[0]?.count || 0;

  // Color scheme based on depth
  const depthColors = {
    0: "border-blue-500 bg-blue-900/5",
    1: "border-purple-500 bg-purple-900/5",
    2: "border-pink-500 bg-pink-900/5",
    3: "border-orange-500 bg-orange-900/5",
  };

  const depthClass = depthColors[Math.min(depth, 3)] || "border-gray-500 bg-gray-900/5";
  const marginClass = depth > 0 ? `ml-${Math.min(depth * 8, 24)}` : "";

  // Truncate content for preview
  const contentPreview =
    post.content?.length > 200 ? post.content.substring(0, 200) + "..." : post.content;

  return (
    <article
      className={`border-l-4 ${depthClass} ${marginClass} p-4 rounded hover:bg-gray-800/30 transition-colors`}
    >
      {/* Header with collapse button */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Collapse/Expand Button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-gray-400 hover:text-gray-200 transition-colors shrink-0 text-lg"
            title={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? "▶" : "▼"}
          </button>

          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-sm shrink-0">
            {getUserInitials(post.users)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                to={`/users/${post.users?.id}`}
                className="font-medium text-gray-200 hover:underline text-sm"
              >
                {getDisplayName(post.users)}
              </Link>
              <span className="text-gray-500 text-xs">•</span>
              <span className="text-xs text-gray-400">
                {new Date(post.created_at).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              {depth > 0 && (
                <>
                  <span className="text-gray-500 text-xs">•</span>
                  <span className="text-xs text-gray-400">Niveau {depth}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Collapsed view - just title */}
      {isCollapsed ? (
        <Link to={`/posts/${post.id}`} className="block group">
          <h4 className="text-lg font-semibold text-gray-100 group-hover:text-primary-400 transition-colors">
            {title}
          </h4>
          {commentCount > 0 && (
            <span className="text-xs text-gray-400 mt-1 inline-block">
              💬 {commentCount} commentaire{commentCount > 1 ? "s" : ""}
            </span>
          )}
        </Link>
      ) : (
        <>
          {/* Expanded view - full content */}
          {/* Title */}
          <Link to={`/posts/${post.id}`} className="block group">
            <h4 className="text-lg font-semibold text-gray-100 group-hover:text-primary-400 transition-colors mb-1">
              {title}
            </h4>
            {subtitle && <p className="text-sm text-gray-400 italic mb-2">{subtitle}</p>}
          </Link>

          {/* Content Preview */}
          <div className="prose prose-sm max-w-none text-gray-300 mb-4">
            <MarkdownViewer content={contentPreview} />
          </div>

          {/* Footer with stats */}
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <Link
              to={`/posts/${post.id}`}
              className="hover:text-primary-400 transition-colors font-medium"
            >
              Voir le post complet →
            </Link>
            {commentCount > 0 && (
              <>
                <span>•</span>
                <span>
                  💬 {commentCount} commentaire{commentCount > 1 ? "s" : ""}
                </span>
              </>
            )}
          </div>
        </>
      )}
    </article>
  );
}
