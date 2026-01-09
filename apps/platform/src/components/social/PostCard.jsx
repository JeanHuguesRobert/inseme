import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { MarkdownViewer } from "@inseme/ui";
import { getMetadata, getPostTitle, getPostType, POST_TYPES } from "@inseme/cop-host";
import {
  isPinnedPost,
  isLockedPost,
  getPostEvent,
  isGazettePost,
  isShare,
  getPostShareInfo,
  getPostShareCount,
} from "../../lib/postPredicates.js";
import { getDisplayName, getUserInitials } from "@inseme/cop-host";
import { sharePost, resolveToOriginal } from "../../lib/sharePost.js";
import ShareDialog from "../social/ShareDialog";

/**
 * Carte d'affichage d'un article
 */
export default function PostCard({ post, currentUserId, gazette = null, showMarkdown = false }) {
  const [expanded, setExpanded] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [originalPost, setOriginalPost] = useState(null);
  const navigate = useNavigate();
  const title = getPostTitle(post);
  const postType = getPostType(post);
  const pinned = isPinnedPost(post);
  const locked = isLockedPost(post);
  const tags = getMetadata(post, "tags", []);
  const viewCount = getMetadata(post, "viewCount", 0);
  const subtitle = getMetadata(post, "subtitle", "");
  const event = getPostEvent(post);
  const thisIsAShare = isShare(post);
  const shareCount = getPostShareCount(post);

  // Load original post if this is a share
  useEffect(() => {
    if (thisIsAShare) {
      resolveToOriginal(post.id).then(setOriginalPost);
    }
  }, [thisIsAShare, post.id]);

  async function handleShare(gazetteName) {
    try {
      await sharePost(post.id, { gazette: gazetteName }, { id: currentUserId });
      alert("Partagé!");
      setShowShareDialog(false);
      // Optionally reload or update state
    } catch (err) {
      alert("Erreur: " + err.message);
    }
  }

  // Icônes par type
  const typeIcons = {
    [POST_TYPES.BLOG]: "📝",
    [POST_TYPES.FORUM]: "💬",
    [POST_TYPES.ANNOUNCEMENT]: "📢",
    [POST_TYPES.SHARE]: "📤",
  };

  const typeLabels = {
    [POST_TYPES.BLOG]: "Article",
    [POST_TYPES.FORUM]: "Discussion",
    [POST_TYPES.ANNOUNCEMENT]: "Annonce",
    [POST_TYPES.SHARE]: "Partage",
  };

  return (
    <Link
      to={`/posts/${post.id}`}
      className="theme-card p-6 block hover:translate-y-[-4px] transition-transform"
    >
      {/* Header */}
      <div className="flex items-start gap-4 mb-3">
        <div className="w-10 h-10 rounded-none border border-bauhaus-black bg-gray-100 flex items-center justify-center flex-shrink-0 font-bold text-bauhaus-black">
          {getUserInitials(post.users)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/users/${post.users?.id}`);
              }}
              className="text-sm font-bold text-gray-800 hover:underline"
            >
              {getDisplayName(post.users)}
            </button>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs text-gray-500">
              {new Date(post.created_at).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs bg-gray-100 border border-gray-300 px-2 py-0.5 font-bold  flex items-center gap-1">
              {typeIcons[postType]} {typeLabels[postType]}
            </span>
            {pinned && (
              <span className="text-xs bg-bauhaus-yellow text-bauhaus-black border border-bauhaus-black px-2 py-0.5 font-bold  flex items-center gap-1">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>{" "}
                Épinglé
              </span>
            )}
            {locked && (
              <span className="text-xs bg-bauhaus-red text-white border border-bauhaus-red px-2 py-0.5 font-bold  flex items-center gap-1">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>{" "}
                Verrouillé
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Share indicator - shows who shared and when */}
      {thisIsAShare && (
        <div className="border-l-2 border-primary-500 pl-3 mb-3 text-sm text-gray-400">
          <div className="font-medium">Partagé par {getDisplayName(post.users)}</div>
          <div className="text-xs">
            {new Date(getPostShareInfo(post)?.sharedAt).toLocaleString("fr-FR")}
          </div>
          {originalPost && (
            <div className="text-xs text-gray-500 mt-1">
              Article original de {getDisplayName(originalPost.users)}
            </div>
          )}
        </div>
      )}

      {/* Titre */}
      <h3 className="text-xl font-bold text-gray-800 mb-2 font-bauhaus uppercase">{title}</h3>

      {/* Sous-titre */}
      {subtitle && <p className="text-sm text-gray-600 mb-2">{subtitle}</p>}

      {/* Event summary */}
      {event && (
        <div className="text-xs text-gray-500 mb-2">
          {event.date && <span>📅 {new Date(event.date).toLocaleDateString("fr-FR")} </span>}
          {event.location && <span>• 📍 {event.location}</span>}
        </div>
      )}

      {/* Extrait du contenu */}
      {showMarkdown || isGazettePost(post) ? (
        <div className={`text-gray-600 text-sm mb-3 ${expanded ? "" : "line-clamp-3"}`}>
          <MarkdownViewer
            content={expanded ? post.content || "" : (post.content || "").slice(0, 600)}
          />
          {(post.content || "").length > 600 && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="ml-0 mt-2 text-sm text-primary hover:underline"
            >
              {expanded ? "Voir moins" : "Voir plus"}
            </button>
          )}
        </div>
      ) : (
        <p className="text-gray-600 text-sm mb-3 line-clamp-3">{post.content}</p>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {tags.slice(0, 5).map((tag, idx) => (
            <Link
              key={idx}
              to={`/social?tab=posts&tag=${encodeURIComponent(tag)}`}
              className="filter-chip text-xs py-0 px-2"
            >
              #{tag}
            </Link>
          ))}
          {tags.length > 5 && (
            <span className="text-xs text-gray-400 font-bold">+{tags.length - 5}</span>
          )}
        </div>
      )}

      {/* Footer stats */}
      <div className="flex items-center gap-4 text-sm text-gray-500 pt-3 border-t border-gray-200 font-medium">
        <span className="flex items-center gap-1">
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
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>{" "}
          {viewCount} vue{viewCount !== 1 ? "s" : ""}
        </span>
        <span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const params = new URLSearchParams();
              params.set("linkedType", "post");
              params.set("linkedId", post.id);
              if (gazette || post.metadata?.gazette)
                params.set("gazette", gazette || post.metadata?.gazette);
              if (post.metadata?.groupId) params.set("groupId", post.metadata?.groupId);
              navigate(`/posts/new?${params.toString()}`);
            }}
            className="ml-2 text-xs bg-primary-600 text-bauhaus-white px-2 py-0.5 hover:opacity-90"
          >
            ✍️ Démarrer une discussion
          </button>
        </span>
        <span className="flex items-center gap-1">
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
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>{" "}
          {/* Nombre de comments sera ajouté plus tard */}
        </span>
        {/* Share count */}
        {shareCount > 0 && (
          <span className="text-xs text-primary-400 font-bold">
            ↗ {shareCount} partage{shareCount > 1 ? "s" : ""}
          </span>
        )}
        {/* Share button */}
        {currentUserId && !thisIsAShare && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowShareDialog(true);
            }}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded"
          >
            📤 Partager
          </button>
        )}
      </div>

      {/* Share dialog */}
      {showShareDialog && (
        <ShareDialog post={post} onShare={handleShare} onCancel={() => setShowShareDialog(false)} />
      )}
    </Link>
  );
}
