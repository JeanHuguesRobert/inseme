import { useState, useEffect } from "react";
import { getSupabase } from "../../lib/supabase.js";
import { isDeleted, getParentCommentId, isReply, isEdited } from "@inseme/cop-host";
import { CommentForm } from "@inseme/cop-host";
import { ReactionPicker } from "@inseme/cop-host";
import { getDisplayName, getUserInitials } from "@inseme/cop-host";
import { enrichUserMetadata } from "@inseme/cop-host";
import { Link } from "react-router-dom";
import { useDataLoader, useDataSaver, useFormSubmitter } from "@inseme/cop-host";
import { canComment } from "@inseme/cop-host";

/**
 * Section de commentaires réutilisable avec toggle show/hide
 * Peut être utilisée pour n'importe quel type de contenu (wiki, proposition, etc.)
 *
 * @param {Object} props
 * @param {string} props.linkedType - Type de contenu (wiki_page, proposition, etc.)
 * @param {string} props.linkedId - ID du contenu
 * @param {Object} props.currentUser - Utilisateur connecté
 * @param {boolean} props.defaultExpanded - État initial (déplié par défaut ou non)
 */
export default function CommentSection({
  linkedType,
  linkedId,
  currentUser,
  defaultExpanded = false,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [discussionPost, setDiscussionPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [replyToId, setReplyToId] = useState(null);

  // Status monitoring hooks
  const loadDiscussionPostOp = useDataLoader();
  const createDiscussionPostOp = useDataSaver();
  const loadCommentsOp = useDataLoader();
  const submitCommentOp = useFormSubmitter("Posting comment");
  const deleteCommentOp = useDataSaver();
  const editCommentOp = useDataSaver();

  // Charge ou crée le post de discussion associé à ce contenu
  useEffect(() => {
    if (linkedType && linkedId && expanded) {
      loadDiscussionPost();
    }
  }, [linkedType, linkedId, expanded]);

  // Subscribe to realtime changes on comments
  useEffect(() => {
    if (!discussionPost?.id) return;

    loadComments();

    const channel = getSupabase()
      .channel(`comments:${discussionPost.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `post_id=eq.${discussionPost.id}`,
        },
        () => loadComments()
      )
      .subscribe();

    return () => {
      getSupabase().removeChannel(channel);
    };
  }, [discussionPost?.id]);

  async function loadDiscussionPost() {
    await loadDiscussionPostOp(async () => {
      // Cherche un article de discussion existant pour ce contenu
      const { data: existingPosts, error: searchError } = await getSupabase()
        .from("posts")
        .select("*")
        .eq("metadata->>linkedType", linkedType)
        .eq("metadata->>linkedId", linkedId)
        .eq("metadata->>isDiscussionThread", "true")
        .limit(1);

      if (searchError) throw searchError;

      if (existingPosts && existingPosts.length > 0) {
        setDiscussionPost(existingPosts[0]);
      } else {
        // Crée un article de discussion automatiquement si nécessaire
        // (uniquement si l'utilisateur est connecté et tente d'interagir)
        setDiscussionPost(null);
      }
    });
  }

  async function createDiscussionPost() {
    if (!currentUser) return null;

    return await createDiscussionPostOp(async () => {
      const { data, error } = await getSupabase()
        .from("posts")
        .insert({
          user_id: currentUser.id,
          content: `Discussion automatique pour ${linkedType}`,
          metadata: {
            schemaVersion: 1,
            postType: "forum",
            isDiscussionThread: true,
            linkedType,
            linkedId,
            isHidden: true, // Le post est invisible dans le feed social
          },
        })
        .select()
        .single();

      if (error) throw error;

      setDiscussionPost(data);
      return data;
    });
  }

  async function loadComments() {
    if (!discussionPost?.id) return;

    await loadCommentsOp(async () => {
      const { data, error: fetchError } = await getSupabase()
        .from("comments")
        .select("*, users(id, display_name, metadata)")
        .eq("post_id", discussionPost.id)
        .order("created_at", { ascending: true });

      if (fetchError) throw fetchError;

      // Filter deleted and enrich user metadata
      const activeComments = (data || [])
        .filter((c) => !isDeleted(c))
        .map((comment) => ({
          ...comment,
          users: enrichUserMetadata(comment.users),
        }));
      setComments(activeComments);
    });
  }

  async function handleCommentSubmit(content, parentId = null) {
    if (!canComment(currentUser)) {
      alert("Vous devez être connecté pour commenter");
      return;
    }

    await submitCommentOp(async () => {
      let post = discussionPost;

      // Crée le post de discussion si nécessaire
      if (!post) {
        post = await createDiscussionPost();
        if (!post) throw new Error("Impossible de créer la discussion");
      }

      const { error } = await getSupabase()
        .from("comments")
        .insert({
          post_id: post.id,
          user_id: currentUser.id,
          content,
          metadata: {
            schemaVersion: 1,
            parentCommentId: parentId || null,
          },
        });

      if (error) throw error;

      setReplyToId(null);
      await loadComments();
    });
  }

  async function handleDelete(commentId) {
    if (!confirm("Supprimer ce commentaire ?")) return;

    await deleteCommentOp(async () => {
      const comment = comments.find((c) => c.id === commentId);
      if (!comment) return;

      const { error } = await getSupabase()
        .from("comments")
        .update({
          metadata: {
            ...comment.metadata,
            isDeleted: true,
            deletedAt: new Date().toISOString(),
            deletedBy: currentUser.id,
          },
        })
        .eq("id", commentId);

      if (error) throw error;
      await loadComments();
    });
  }

  function buildCommentTree(comments) {
    const topLevel = comments.filter((c) => !isReply(c));

    function getReplies(parentId) {
      return comments
        .filter((c) => getParentCommentId(c) === parentId)
        .map((c) => ({
          ...c,
          replies: getReplies(c.id),
        }));
    }

    return topLevel.map((c) => ({
      ...c,
      replies: getReplies(c.id),
    }));
  }

  function CommentItem({ comment, depth = 0 }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(comment.content);
    const isAuthor = currentUser?.id === comment.user_id;
    const edited = isEdited(comment);

    async function handleEdit() {
      await editCommentOp(async () => {
        const { error } = await getSupabase()
          .from("comments")
          .update({
            content: editContent,
            metadata: {
              ...comment.metadata,
              isEdited: true,
              editedAt: new Date().toISOString(),
            },
          })
          .eq("id", comment.id);

        if (error) throw error;

        setIsEditing(false);
        await loadComments();
      });
    }

    return (
      <div
        className={`${depth > 0 ? "ml-8 mt-4" : "mt-4"} ${depth > 0 ? "border-l-2 border-gray-200 pl-4" : ""}`}
      >
        <div className="  p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm">
                {getUserInitials(comment.users)}
              </div>
              <div>
                <Link
                  to={`/users/${comment.users?.id}`}
                  className="text-sm font-medium text-gray-50 hover:underline"
                >
                  {getDisplayName(comment.users)}
                </Link>
                <div className="text-xs text-gray-400">
                  {new Date(comment.created_at).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {edited && <span className="ml-2 italic">(modifié)</span>}
                </div>
              </div>
            </div>

            {isAuthor && !isEditing && (
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-xs text-gray-300 hover:text-gray-50"
                >
                  Modifier
                </button>
                <button
                  onClick={() => handleDelete(comment.id)}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Supprimer
                </button>
              </div>
            )}
          </div>

          {/* Content */}
          {isEditing ? (
            <div>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 text-sm"
                rows={3}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleEdit}
                  className="px-3 py-1 text-xs bg-blue-600 text-bauhaus-white hover:bg-blue-700"
                >
                  Enregistrer
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(comment.content);
                  }}
                  className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-gray-200 text-sm whitespace-pre-wrap mb-2">{comment.content}</p>

              {/* Actions */}
              <div className="flex items-center gap-4 text-xs">
                <ReactionPicker
                  targetType="comment"
                  targetId={comment.id}
                  currentUser={currentUser}
                />

                {currentUser && (
                  <button
                    onClick={() => setReplyToId(replyToId === comment.id ? null : comment.id)}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Répondre
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Reply form */}
        {replyToId === comment.id && (
          <div className="mt-3 ml-8">
            <CommentForm
              onSubmit={(content) => handleCommentSubmit(content, comment.id)}
              onCancel={() => setReplyToId(null)}
              placeholder={`Répondre à ${getDisplayName(comment.users)}...`}
            />
          </div>
        )}

        {/* Nested replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div>
            {comment.replies.map((reply) => (
              <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  const commentTree = buildCommentTree(comments);
  const commentCount = comments.length;

  return (
    <div className="  shadow-sm border border-gray-200 overflow-hidden mt-8">
      {/* Toggle Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">💬</span>
          <h2 className="text-lg font-semibold text-gray-50">
            Commentaires {commentCount > 0 && `(${commentCount})`}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {!expanded && commentCount > 0 && (
            <span className="text-sm text-gray-400">
              {commentCount} commentaire{commentCount !== 1 ? "s" : ""}
            </span>
          )}
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Comments Content */}
      {expanded && (
        <div className="p-6">
          <>
            {/* New comment form */}
            {canComment(currentUser) ? (
              <div className="mb-6">
                <CommentForm
                  onSubmit={(content) => handleCommentSubmit(content)}
                  placeholder="Ajouter un commentaire..."
                />
              </div>
            ) : (
              <div className="mb-6 p-4 text-center text-gray-300">
                Connectez-vous pour commenter
              </div>
            )}

            {/* Comments tree */}
            {commentTree.length === 0 ? (
              <p className="text-center text-gray-400 py-8">
                Aucun commentaire pour l'instant. Soyez le premier !
              </p>
            ) : (
              <div className="space-y-0">
                {commentTree.map((comment) => (
                  <CommentItem key={comment.id} comment={comment} depth={0} />
                ))}
              </div>
            )}
          </>
        </div>
      )}
    </div>
  );
}
