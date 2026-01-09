import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { 
  getSupabase, 
  useCurrentUser, 
  appendOrMergeLastModifiedBy, 
  getDisplayName 
} from "@inseme/cop-host";
import wikiFederation from "../lib/wikiFederation.js";

export default function WikiEdit() {
  const { slug: initialSlug } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState(initialSlug);
  const [content, setContent] = useState("");
  const [pageId, setPageId] = useState(null);
  const [pageMetadata, setPageMetadata] = useState({});
  const [federated, setFederated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPage = async () => {
      const { data, error } = await getSupabase()
        .from("wiki_pages")
        .select("*")
        .eq("slug", initialSlug)
        .single();

      if (error || !data) {
        alert("Page introuvable.");
        navigate("/wiki");
        return;
      }

      setPageId(data.id);
      setTitle(data.title || "");
      setSlug(data.slug || "");
      setContent(data.content || "");
      setPageMetadata(data.metadata || {});
      setFederated(data.metadata?.federated === "true"); // Check string 'true'
      setLoading(false);
    };

    loadPage();
  }, [initialSlug, navigate]);

  const handleSave = async () => {
    try {
      const { data: slugPage, error: slugError } = await getSupabase()
        .from("wiki_pages")
        .select("*")
        .eq("slug", slug)
        .single();

      if (slugError && slugError.code !== "PGRST116") {
        console.error("Erreur vérification slug :", slugError);
        alert("Une erreur est survenue lors de la vérification de l’adresse.");
        return;
      }

      if (slugPage && slugPage.id !== pageId) {
        alert("Une autre page utilise déjà cette adresse.");
        return;
      }

      // Update lastModifiedBy in metadata
      const updatedMetadata = appendOrMergeLastModifiedBy(
        pageMetadata,
        currentUser ? { id: currentUser.id, displayName: getDisplayName(currentUser) } : null
      );

      updatedMetadata.federated = federated ? "true" : "false";

      const res = await wikiFederation.upsertLocalPage({
        pageKey: slug,
        slug,
        title,
        content,
        authorId: currentUser?.id || null,
        status: updatedMetadata?.wiki_page?.status || "active",
        parent_revision_global_id: updatedMetadata?.wiki_page?.parent_revision_global_id || null,
        extraMetadata: updatedMetadata,
      });
      if (!res?.success) {
        console.error("Erreur mise à jour :", res?.error);
        alert("Une erreur est survenue lors de la mise à jour.");
        return;
      }

      navigate(`/wiki/${slug}`);
    } catch (err) {
      console.error("Erreur inattendue :", err);
      alert("Une erreur inattendue est survenue.");
    }
  };

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Modifier la page</h1>
      <div className="space-y-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre"
          className="w-full px-4 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="Adresse de la page (ex : page-exemple)"
          className="w-full px-4 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={16}
          placeholder="Contenu de la page..."
          className="w-full px-4 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />

        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded">
          <input
            type="checkbox"
            id="federated"
            checked={federated}
            onChange={(e) => setFederated(e.target.checked)}
            className="h-5 w-5 text-blue-600 rounded"
          />
          <label
            htmlFor="federated"
            className="text-sm font-semibold text-blue-900 cursor-pointer select-none"
          >
            Propager vers le haut (Fédérer ce savoir)
          </label>
        </div>
        <div className="flex gap-4">
          <button onClick={handleSave} className="btn btn-success px-6 py-2 ">
            Enregistrer
          </button>
          <button
            onClick={async () => {
              try {
                const response = await fetch("/api/wiki-propose", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ slug }),
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || "Propose failed");
                alert(
                  "Proposition envoyée au parent" + (data.forwarded ? " (envoyée au parent)" : "")
                );
              } catch (err) {
                alert("Erreur lors de la proposition: " + (err.message || err));
              }
            }}
            className="btn btn-outline"
          >
            Proposer au parent
          </button>
          <button
            onClick={() => navigate(`/wiki/${initialSlug}`)}
            className="btn btn-secondary px-6 py-2 "
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
