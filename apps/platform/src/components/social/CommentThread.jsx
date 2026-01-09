import { useState, useEffect } from "react";
import { getSupabase } from "../../lib/supabase.js";
import {
  isDeleted,
  getParentCommentId,
  isReply,
  isEdited,
  CommentForm,
  ReactionPicker,
  getDisplayName,
  getUserInitials,
  enrichUserMetadata,
} from "@inseme/cop-host";
import { Link } from "react-router-dom";

/**
 * Thread de commentaires avec réponses imbriquées
 */
export default function CommentThread({ postId, currentUser }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [replyToId, setReplyToId] = useState(null);

  useEffect(() => {
    if (postId) {
      loadComments();

      // Subscribe to realtime changes
      const channel = getSupabase()
        .channel(`comments:${postId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "comments",
            filter: `post_id=eq.${postId}`,
          },
          () => loadComments()
        )
        .subscribe();

      return () => {
        getSupabase().removeChannel(channel);
      };
    }
  }, [postId]);

  async function loadComments() {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await getSupabase()
        .from("comments")
        .select("*, users(id, display_name, metadata)")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      if (fetchError) throw fetchError;

      // Filtre soft delete et enrichit metadata
      const activeComments = (data || [])
        .filter((c) => !isDeleted(c))
        .map((comment) => ({
          ...comment,
          users: enrichUserMetadata(comment.users),
        }));
      setComments(activeComments);
    } catch (err) {
      console.error("Error loading comments:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCommentSubmit(content, parentId = null) {
    if (!currentUser) {
      alert("Vous devez être connecté");
      return;
    }

    try {
      const { error } = await getSupabase()
        .from("comments")
        .insert({
          post_id: postId,
          user_id: currentUser.id,
          content,
          metadata: {
            schemaVersion: 1,
            parentCommentId: parentId || null,
          },
        });

      if (error) throw error;

      setReplyToId(null);
      loadComments();
    } catch (err) {
      console.error("Error creating comment:", err);
      alert("Erreur : " + err.message);
    }
  }

  async function handleDelete(commentId) {
    if (!confirm("Supprimer ce commentaire ?")) return;

    try {
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
      loadComments();
    } catch (err) {
      console.error("Error deleting comment:", err);
      alert("Erreur : " + err.message);
    }
  }

  // Organise les commentaires en arbre
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
      try {
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
        loadComments();
      } catch (err) {
        console.error("Error editing comment:", err);
        alert("Erreur : " + err.message);
      }
    }

    return (
      <div
        className={`${depth > 0 ? "ml-8 mt-4" : "mt-4"} ${depth > 0 ? "border-l-2 border-gray-200 pl-4" : ""}`}
      >
        <div className="  p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-sm">
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
                  className="px-3 py-1 text-xs bg-primary-600 text-bauhaus-white hover:bg-primary-700"
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
                    className="text-primary-600 hover:text-primary-700 font-medium"
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

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 ">
        Erreur : {error}
      </div>
    );
  }

  const commentTree = buildCommentTree(comments);

  return (
    <div className="   shadow-sm p-6">
      <h2 className="text-xl font-semibold mb-4">
        {comments.length} commentaire{comments.length !== 1 ? "s" : ""}
      </h2>

      {/* New comment form */}
      {currentUser ? (
        <div className="mb-6">
          <CommentForm
            onSubmit={(content) => handleCommentSubmit(content)}
            placeholder="Ajouter un commentaire..."
          />
        </div>
      ) : (
        <div className="mb-6 p-4 text-center text-gray-300">Connectez-vous pour commenter</div>
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
    </div>
  );
}
