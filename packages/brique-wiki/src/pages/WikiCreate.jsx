import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { getSupabase } from "@inseme/cop-host";
import wikiFederation from "../lib/wikiFederation.js";

export default function WikiCreate() {
  const { slug: initialSlugParam } = useParams();
  const location = useLocation();

  const normalizeSlug = (str) => {
    if (!str) return "";
    return String(str)
      .normalize("NFD")
      .replace(/\p{Diacritic}+/gu, "") // remove accents
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-");
  };

  const rawSlug = useMemo(() => {
    const querySlug = new URLSearchParams(location.search).get("slug");
    const source = initialSlugParam || querySlug || "";
    return source ? decodeURIComponent(source) : "";
  }, [initialSlugParam, location.search]);
  const prefilledSlug = useMemo(
    () => (rawSlug ? normalizeSlug(rawSlug) : "nouvelle-page"),
    [rawSlug]
  );
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState(prefilledSlug);
  const [content, setContent] = useState("");
  const [allowSlugEdit, setAllowSlugEdit] = useState(!initialSlugParam);
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [federated, setFederated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Si le paramètre change (navigation), réinitialiser les champs
    setTitle("");
    setSlug(prefilledSlug);
    setAllowSlugEdit(!initialSlugParam);
    setIsSlugManuallyEdited(false);
    setFederated(false);
  }, [prefilledSlug, initialSlugParam]);

  const handleTitleChange = (e) => {
    const t = e.target.value;
    setTitle(t);
  };

  const handleSlugChange = (e) => {
    setSlug(e.target.value);
    setIsSlugManuallyEdited(true);
  };

  const handleSave = async () => {
    try {
      const { data: existing, error: slugError } = await getSupabase()
        .from("wiki_pages")
        .select("*")
        .eq("slug", slug)
        .single();

      if (!slugError && existing) {
        alert("Une page avec cette adresse existe déjà. Veuillez en choisir une autre.");
        return;
      }

      const res = await wikiFederation.upsertLocalPage({
        pageKey: slug,
        slug,
        title,
        content,
        authorId: null,
        status: "active",
        extraMetadata: { federated: federated ? "true" : "false" },
      });
      if (!res?.success) {
        console.error("Erreur création page :", res?.error);
        alert("Une erreur est survenue lors de la création.");
        return;
      }
      navigate(`/wiki/${slug}`);
    } catch (err) {
      console.error("Erreur inattendue :", err);
      alert("Une erreur inattendue est survenue.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Créer une nouvelle page</h1>
      <div className="space-y-4">
        <input
          value={title}
          onChange={handleTitleChange}
          placeholder="Titre"
          className="w-full px-4 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div>
          {initialSlugParam && (
            <div className="text-sm text-gray-300 mb-2">
              Adresse pré-remplie à partir de l’URL.{" "}
              <button
                type="button"
                onClick={() => setAllowSlugEdit((prev) => !prev)}
                className="underline text-blue-600 hover:text-blue-800"
              >
                {allowSlugEdit ? "Verrouiller l’adresse" : "Modifier l’adresse"}
              </button>
            </div>
          )}
          <input
            value={slug}
            onChange={handleSlugChange}
            placeholder="Adresse de la page (ex : page-exemple)"
            className={`w-full px-4 py-2 border focus:outline-none focus:ring-2 ${allowSlugEdit ? "border-gray-300 focus:ring-blue-500" : "border-gray-200 bg-gray-100 cursor-not-allowed"}`}
            disabled={!allowSlugEdit}
          />
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={20}
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
          <button onClick={() => navigate("/wiki")} className="btn btn-secondary px-6 py-2 ">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
