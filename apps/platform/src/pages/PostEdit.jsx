import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSupabase } from "../lib/supabase.js";
import { useCurrentUser } from "@inseme/cop-host";
import { isDeleted } from "@inseme/cop-host";
import PostEditor from "../components/social/PostEditor";
import SiteFooter from "../components/layout/SiteFooter";
import { getConfig } from "../common/config/instanceConfig.client.js";

// Helper to check if a user is an editor for a given gazette (copied from PostEditor)
async function checkEditorForGazette(gazetteName, userId) {
  if (!gazetteName) return false;
  // Use the same mapping as Gazette.jsx for global
  let targetGroupName = gazetteName;
  if (gazetteName === "global") {
    targetGroupName = getConfig(
      "global_gazette_editor_group",
      import.meta.env.VITE_GLOBAL_GAZETTE_EDITOR_GROUP || "La Gazette"
    );
  }
  try {
    const { data: group } = await getSupabase()
      .from("groups")
      .select("id")
      .eq("name", targetGroupName)
      .single();
    if (!group) return false;
    // Check membership for current user
    if (!userId) return false;
    const { data: member } = await getSupabase()
      .from("group_members")
      .select("id")
      .eq("group_id", group.id)
      .eq("user_id", userId)
      .single();
    return !!member;
  } catch (err) {
    return false;
  }
}

/**
 * Page d'édition de post
 */
export default function PostEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, userStatus } = useCurrentUser();

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    if (userStatus !== "signed_in" || !currentUser) return; // Attendre que currentUser soit chargé

    async function loadPost() {
      try {
        setLoading(true);
        setError(null);

        // Charger le post
        const { data: postData, error: postError } = await getSupabase()
          .from("posts")
          .select("*")
          .eq("id", id)
          .single();

        if (postError) throw postError;

        if (isDeleted(postData)) {
          throw new Error("Ce post a été supprimé");
        }

        // Vérifier que l'utilisateur est l'auteur ou éditeur de la gazette
        if (postData.author_id !== currentUser.id) {
          const gaz = postData?.metadata?.gazette || null;
          const isEditor = await checkEditorForGazette(gaz, currentUser?.id);
          if (!isEditor) {
            throw new Error("Vous n'êtes pas autorisé à modifier ce post");
          }
        }

        setPost(postData);
      } catch (err) {
        console.error("Error loading post:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadPost();
  }, [id, currentUser, userStatus]);

  if (userStatus === "signing_in") {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (userStatus === "signed_out" || !currentUser) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-300 mb-4">Vous devez être connecté pour modifier une publication</p>
        <button onClick={() => navigate("/social")} className="text-primary-600 hover:underline">
          Retour au Café
        </button>
      </div>
    );
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
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 mb-4">{error}</div>
        <button onClick={() => navigate(-1)} className="text-primary-600 hover:underline">
          ← Retour
        </button>
      </div>
    );
  }

  if (!post) return null;

  return (
    <>
      <PostEditor post={post} currentUser={currentUser} />
      <SiteFooter />
    </>
  );
}
