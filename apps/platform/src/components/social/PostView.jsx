import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getSupabase } from "../../lib/supabase.js";
import {
  isDeleted,
  getMetadata,
  getPostTitle,
  getPostType,
  getPostSubtitle,
  getPostSubtype,
  getLinkedEntity,
  hasLinkedEntity,
  incrementViewCount,
  POST_TYPES,
  getPostIncident,
  getLatestModifier,
  getLastModifiedByList,
  getParentId,
  isSubPost,
  getThreadDepth,
  getThreadStats,
} from "@inseme/cop-host";
import {
  isPinnedPost,
  isLockedPost,
  getPostEvent,
  getPostGroupId,
  isGazettePost,
  isAuthor,
  canEditPost,
  canDeletePost,
  getPostGazette,
  getPostSourceUrl,
  isFacebookPost,
} from "../../lib/postPredicates.js";
import CommentThread from "./CommentThread";
import { MarkdownViewer } from "@inseme/ui";
import FacebookEmbed from "../FacebookEmbed";
import { getDisplayName, getUserInitials, enrichUserMetadata } from "@inseme/cop-host";
import SubscribeButton from "../common/SubscribeButton";
import EventInfo from "./EventInfo";
import IncidentInfo from "./IncidentInfo";
import SubPostEditor from "./SubPostEditor";
import SubPostCard from "./SubPostCard";
import ThreadNavigator from "./ThreadNavigator";

/**
 * Vue détaillée d'un article avec commentaires
 */
export default function PostView({ currentUser }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const [post, setPost] = useState(null);
  const [group, setGroup] = useState(null);
  const [linkedEntity, setLinkedEntity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [subPosts, setSubPosts] = useState([]);
  const [showSubPostEditor, setShowSubPostEditor] = useState(false);
  const [threadPath, setThreadPath] = useState([]);

  useEffect(() => {
    if (id) {
      loadPost();
      trackView();
      loadSubPosts();
      loadThreadPath();
    }
  }, [id]);

  async function loadThreadPath() {
    try {
      const path = await getThreadPath(id, supabase);
      setThreadPath(path);
    } catch (err) {
      console.error("Error loading thread path:", err);
    }
  }

  async function loadPost() {
    try {
      setLoading(true);
      setError(null);

      // Charger le post
      const { data: postData, error: postError } = await getSupabase()
        .from("posts")
        .select("*, users(id, display_name, metadata)")
        .eq("id", id)
        .single();

      if (postError) throw postError;
      if (isDeleted(postData)) {
        throw new Error("Ce post a été supprimé");
      }

      // Enrich user metadata
      if (postData.users) {
        postData.users = enrichUserMetadata(postData.users);
      }

      setPost(postData);

      // Charger le groupe si le post appartient à un groupe
      const groupId = getPostGroupId(postData);
      if (groupId) {
        const { data: groupData } = await getSupabase()
          .from("groups")
          .select("*")
          .eq("id", groupId)
          .single();

        if (groupData && !isDeleted(groupData)) {
          setGroup(groupData);
        }
      }

      // Charger l'entité liée si présente
      if (hasLinkedEntity(postData)) {
        const linked = getLinkedEntity(postData);
        if (linked.type === "wiki_page") {
          const { data } = await getSupabase()
            .from("wiki_pages")
            .select("id, title")
            .eq("id", linked.id)
            .single();
          setLinkedEntity({ type: "wiki_page", data });
        } else if (linked.type === "proposition") {
          const { data } = await getSupabase()
            .from("propositions")
            .select("id, title")
            .eq("id", linked.id)
            .single();
          setLinkedEntity({ type: "proposition", data });
        }
      }
    } catch (err) {
      console.error("Error loading post:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function trackView() {
    // Incrémenter le compteur de vues (sans attendre la réponse)
    try {
      const { data: currentPost } = await getSupabase()
        .from("posts")
        .select("metadata")
        .eq("id", id)
        .single();

      if (currentPost) {
        const updated = incrementViewCount(currentPost);
        await getSupabase().from("posts").update({ metadata: updated.metadata }).eq("id", id);
      }
    } catch (err) {
      console.error("Error tracking view:", err);
    }
  }

  async function loadSubPosts() {
    try {
      const { data, error: fetchError } = await getSupabase()
        .from("posts")
        .select("*, users(id, display_name, metadata), comments(count)")
        .eq("metadata->>parent_id", id)
        .order("created_at", { ascending: true });

      if (fetchError) throw fetchError;

      // Filter soft-deleted and enrich metadata
      const activePosts = (data || [])
        .filter((p) => !isDeleted(p))
        .map((p) => ({
          ...p,
          users: enrichUserMetadata(p.users),
        }));

      setSubPosts(activePosts);
    } catch (err) {
      console.error("Error loading sub-posts:", err);
    }
  }

  function handleSubPostSubmit(newPost) {
    setShowSubPostEditor(false);
    loadSubPosts(); // Reload sub-posts to show the new one
  }

  async function handleDelete() {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce post ?")) return;

    try {
      const { error } = await getSupabase()
        .from("posts")
        .update({
          metadata: {
            ...post.metadata,
            isDeleted: true,
            deletedAt: new Date().toISOString(),
            deletedBy: currentUser.id,
          },
        })
        .eq("id", id);

      if (error) throw error;

      navigate("/social");
    } catch (err) {
      console.error("Error deleting post:", err);
      alert("Erreur : " + err.message);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 ">{error}</div>
        <button onClick={() => navigate(-1)} className="mt-4 text-primary-600 hover:underline">
          ← Retour
        </button>
      </div>
    );
  }

  if (!post) return null;

  const title = getPostTitle(post);
  const postType = getPostType(post);
  const pinned = isPinnedPost(post);
  const locked = isLockedPost(post);
  const subtitle = getPostSubtitle(post);
  const subtype = getPostSubtype(post);
  const event = getPostEvent(post);
  const incident = getPostIncident(post);
  const tags = getMetadata(post, "tags", []);
  const viewCount = getMetadata(post, "viewCount", 0);
  const isPostAuthor = isAuthor(post, currentUser);
  const canEdit = canEditPost(post, currentUser);
  const canDelete = canDeletePost(post, currentUser);
  const lastModifiedList = getLastModifiedByList(post.metadata);
  const latestModifier = getLatestModifier(post.metadata, post);

  const typeIcons = {
    [POST_TYPES.BLOG]: "📝",
    [POST_TYPES.FORUM]: "💬",
    [POST_TYPES.ANNOUNCEMENT]: "📢",
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Thread Navigation / Breadcrumb */}
      {threadPath.length > 1 ? (
        <ThreadNavigator threadPath={threadPath} />
      ) : (
        <div className="text-sm text-gray-400 mb-4 flex items-center gap-2">
          <Link to="/social" className="hover:underline">
            Social
          </Link>
          {group && (
            <>
              <span>›</span>
              <Link to={`/groups/${group.id}`} className="hover:underline">
                {group.name}
              </Link>
            </>
          )}
          <span>›</span>
          <span className="text-gray-50">{title}</span>
        </div>
      )}

      {/* Gazette Banner */}
      {isGazettePost(post) && (
        <div className="mb-6 p-4 bg-[#f4e4bc] text-[#2c241b] border border-[#d4c49c] flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📰</span>
            <div>
              <p className="font-serif text-sm italic">Cet article est publié dans la Gazette.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-3 items-center">
              <Link
                to={
                  getPostGazette(post) === "global"
                    ? "/gazette"
                    : `/gazette/${getPostGazette(post)}`
                }
                className="px-4 py-2 font-serif hover:bg-opacity-90 transition-colors"
              >
                Lire dans la Gazette
              </Link>
              <Link
                to={`/posts/new?linkedType=post&linkedId=${encodeURIComponent(post.id)}${getPostGazette(post) ? `&gazette=${encodeURIComponent(getPostGazette(post))}` : ""}${getPostGroupId(post) ? `&groupId=${encodeURIComponent(getPostGroupId(post))}` : ""}`}
                className="px-4 py-2 font-serif hover:bg-opacity-90 transition-colors"
              >
                ✍️ Démarrer une discussion
              </Link>
            </div>
            <Link
              to={`/social?tab=posts&gazette=${encodeURIComponent(getPostGazette(post))}&linkedType=post&linkedId=${post.id}${getPostGroupId(post) ? `&groupId=${getPostGroupId(post)}` : ``}`}
              className="px-4 py-2 font-serif hover:bg-opacity-90 transition-colors"
            >
              ☕ Discuter au Café
            </Link>
          </div>
        </div>
      )}

      {/* Post */}
      <article className="   shadow-sm p-8 mb-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-start gap-4 flex-1">
            <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
              {getUserInitials(post.users)}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Link
                  to={`/users/${post.users?.id}`}
                  className="font-medium text-gray-50 hover:underline"
                >
                  {getDisplayName(post.users)}
                </Link>
                <span className="text-gray-400">•</span>
                <span className="text-sm text-gray-400">
                  {new Date(post.created_at).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs bg-gray-100 px-2 py-1 flex items-center gap-1">
                  {typeIcons[postType]} {postType}
                </span>
                {pinned && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 ">
                    📌 Épinglé
                  </span>
                )}
                {locked && (
                  <span className="text-xs bg-red-100 text-red-800 px-2 py-1 ">🔒 Verrouillé</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            {/* Subscribe Button */}
            <SubscribeButton contentType="post" contentId={post.id} currentUser={currentUser} />

            {/* Actions */}
            {(canEdit || canDelete) && (
              <div className="flex gap-2">
                {canEdit && (
                  <button
                    onClick={() =>
                      navigate(
                        subtype === "incident" ? `/incidents/${id}/edit` : `/posts/${id}/edit`
                      )
                    }
                    className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 "
                  >
                    Modifier
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={handleDelete}
                    className="text-sm px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 "
                  >
                    Supprimer
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Titre */}
        <h1 className="text-3xl font-bold text-gray-50 mb-4">{title}</h1>

        {/* Sous-titre si présent */}
        {subtitle && <h2 className="text-xl font-semibold text-gray-300 mb-4">{subtitle}</h2>}

        {/* Event / Incident info */}
        {subtype === "event" && <EventInfo event={event} />}
        {subtype === "incident" && <IncidentInfo incident={incident} />}

        {/* Entité liée */}
        {linkedEntity && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 ">
            <span className="text-sm text-blue-800">
              🔗 Lié à{" "}
              <Link
                to={
                  linkedEntity.type === "wiki_page"
                    ? `/wiki/${linkedEntity.data.id}`
                    : `/propositions/${linkedEntity.data.id}`
                }
                className="font-medium hover:underline"
              >
                {linkedEntity.data.title}
              </Link>
            </span>
          </div>
        )}

        {/* Contenu (Markdown rendu) */}
        <div className="markdown-content prose prose-slate max-w-none mb-10">
          <MarkdownViewer content={post.content || ""} />
        </div>

        {/* Facebook embed if post.metadata.sourceUrl is a Facebook URL */}
        {isFacebookPost(post) && (
          <div className="mb-6 flex justify-center">
            <FacebookEmbed url={getPostSourceUrl(post)} className="w-full" />
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {tags.map((tag, idx) => (
              <Link
                key={idx}
                to={`/social?tab=posts&tag=${encodeURIComponent(tag)}`}
                className="text-sm bg-blue-50 text-blue-700 px-3 py-1 "
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}

        {/* Footer stats */}
        <div className="flex items-center gap-4 text-sm text-gray-400 pt-4 border-t">
          <span>
            👁️ {viewCount} vue{viewCount !== 1 ? "s" : ""}
          </span>
          {latestModifier && latestModifier.id !== post.author_id && (
            <span>
              • Dernière mise à jour par {latestModifier.displayName || "--"} le{" "}
              {new Date(latestModifier.timestampISO).toLocaleString("fr-FR")}
            </span>
          )}
          {lastModifiedList.length > 0 && (
            <button onClick={() => setShowHistory((s) => !s)} className="text-xs ml-2 underline">
              Historique
            </button>
          )}
        </div>
      </article>

      {showHistory && lastModifiedList.length > 0 && (
        <div className="mt-3 text-sm text-gray-400 max-w-4xl mx-auto px-4">
          <strong>Historique des modifications:</strong>
          <ul className="ml-3 list-disc">
            {lastModifiedList.map((entry, idx) => (
              <li key={idx}>
                {entry.displayName || entry.id} —{" "}
                {new Date(entry.timestampISO).toLocaleString("fr-FR")}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Reply with Post Button */}
      {currentUser && !locked && (
        <div className="my-6">
          <button
            onClick={() => setShowSubPostEditor(!showSubPostEditor)}
            className="px-4 py-2 bg-primary-600 text-bauhaus-white rounded hover:bg-primary-700 font-semibold transition-colors flex items-center gap-2"
          >
            📝 {showSubPostEditor ? "Annuler" : "Répondre avec un post"}
          </button>
        </div>
      )}

      {/* Sub-Post Editor */}
      {showSubPostEditor && currentUser && post && (
        <div className="mb-6">
          <SubPostEditor
            parentPost={post}
            currentUser={currentUser}
            onSubmit={handleSubPostSubmit}
            onCancel={() => setShowSubPostEditor(false)}
          />
        </div>
      )}

      {/* Sub-Posts List */}
      {subPosts.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-gray-200 mb-4">
            {subPosts.length} Réponse{subPosts.length > 1 ? "s" : ""}
          </h3>
          <div className="space-y-4">
            {subPosts.map((subPost) => (
              <SubPostCard key={subPost.id} post={subPost} currentUser={currentUser} />
            ))}
          </div>
        </div>
      )}

      {/* Commentaires */}
      {!locked ? (
        <CommentThread postId={id} currentUser={currentUser} />
      ) : (
        <div className="border border-gray-200 p-4 text-center text-gray-400">
          🔒 Les commentaires sont désactivés sur ce post
        </div>
      )}
    </div>
  );
}
