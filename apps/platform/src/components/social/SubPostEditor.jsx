import { useState } from "react";
import { getSupabase } from "../../lib/supabase.js";
import {
  createSubPostMetadata,
  getPostTitle,
  getMetadata,
} from "@inseme/cop-host";
import { getDisplayName } from "@inseme/cop-host";

/**
 * Lightweight editor for creating a sub-post (reply to another post)
 */
export default function SubPostEditor({ parentPost, currentUser, onSubmit, onCancel }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!title.trim() || !content.trim()) {
      setError("Le titre et le contenu sont requis");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const metadata = createSubPostMetadata("forum", title, parentPost.id, parentPost, {
        groupId: getMetadata(parentPost, "groupId"),
        gazette: getMetadata(parentPost, "gazette"),
        tags: getMetadata(parentPost, "tags", []),
      });

      const { data: newPost, error: insertError } = await getSupabase()
        .from("posts")
        .insert({
          author_id: currentUser.id,
          content,
          metadata,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Auto-subscribe to the new post
      await getSupabase().from("content_subscriptions").insert({
        user_id: currentUser.id,
        content_type: "post",
        content_id: newPost.id,
      });

      if (onSubmit) onSubmit(newPost);
    } catch (err) {
      console.error("Error creating sub-post:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-gray-700 rounded p-4 bg-gray-900/50">
      {/* Parent post context */}
      <div className="mb-4 p-3 bg-blue-900/30 border-l-4 border-blue-500 rounded">
        <p className="text-xs text-blue-300 mb-1">↳ En réponse à</p>
        <p className="font-medium text-sm text-gray-100">{getPostTitle(parentPost)}</p>
        <p className="text-xs text-gray-400 mt-1">
          Par {getDisplayName(parentPost.users)} •{" "}
          {new Date(parentPost.created_at).toLocaleDateString("fr-FR")}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-3 p-2 bg-red-900/50 border border-red-500 text-red-200 text-sm rounded">
            {error}
          </div>
        )}

        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-200 mb-1">
            Titre de votre réponse *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-600 bg-gray-800 text-gray-100 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Re: ..."
            required
          />
        </div>

        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-200 mb-1">Contenu *</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full px-3 py-2 border border-gray-600 bg-gray-800 text-gray-100 rounded font-mono text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            rows={6}
            placeholder="Markdown supporté..."
            required
          />
          <p className="text-xs text-gray-400 mt-1">
            Vous pouvez utiliser Markdown pour formater votre texte
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-primary-600 text-bauhaus-white rounded hover:bg-primary-700 disabled:bg-gray-600 font-semibold transition-colors"
          >
            {loading ? "Publication..." : "📝 Publier la réponse"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition-colors"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}
