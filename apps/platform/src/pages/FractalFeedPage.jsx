import React, { useState } from "react";
import SiteFooter from "../components/layout/SiteFooter";
import FeedReader from "../components/federation/FeedReader";
import FractalGraph from "../components/federation/FractalGraph";
import { useCurrentUser } from "@inseme/cop-host";
import { getSupabase } from "../lib/supabase.js";
import { useNavigate } from "react-router-dom";

export default function FractalFeedPage() {
  const { currentUser } = useCurrentUser();
  const navigate = useNavigate();
  const [customUrl, setCustomUrl] = useState("");
  const [viewMode, setViewMode] = useState("map"); // 'map' or 'list'
  const [feeds, setFeeds] = useState([
    {
      id: "local-export-props",
      title: "Export Fédéré (Propositions)",
      url: "/api/feed/propositions", // Relative URL works if proxy is set up or same origin
      category: "local-export",
    },
    {
      id: "local-export-posts",
      title: "Export Fédéré (Posts)",
      url: "/api/feed/posts",
      category: "local-export",
    },
    {
      id: "local-export-wiki",
      title: "Export Fédéré (Wiki)",
      url: "/api/feed/wiki",
      category: "local-export",
    },
  ]);

  const handleAddFeed = (e) => {
    e.preventDefault();
    if (!customUrl) return;
    setFeeds([
      ...feeds,
      {
        id: `custom-${Date.now()}`,
        title: "Flux Externe",
        url: customUrl,
        category: "external",
      },
    ]);
    setCustomUrl("");
  };

  const handleImport = async (item) => {
    console.log("Importing item:", item);
    if (!currentUser) {
      alert("Vous devez être connecté pour importer un sujet.");
      return;
    }

    if (!confirm(`Voulez-vous importer "${item.title}" dans votre instance pour en débattre ?`)) {
      return;
    }

    try {
      const { data, error } = await getSupabase()
        .from("propositions")
        .insert({
          title: `[IMPORT] ${item.title}`,
          description: `${item.content_text || item.summary || ""}\n\n---\n> **Source Fédérée** : [Voir l'original](${item.url})\n> **Auteur Original** : ${item.author?.name || "Inconnu"}`,
          author_id: currentUser.id,
          status: "active", // Active immediately? Or draft? Active for MVP.
          metadata: {
            original_url: item.url,
            original_author: item.author?.name,
            fed_import: true,
            source_instance: item._meta?.instance || "unknown",
          },
        })
        .select()
        .single();

      if (error) throw error;

      alert("Sujet importé avec succès !");
      navigate(`/propositions/${data.id}`);
    } catch (err) {
      console.error("Erreur import:", err);
      alert("Erreur lors de l'import: " + err.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 min-h-screen flex flex-col">
      <div className="flex-1">
        <header className="mb-8">
          <h1 className="text-3xl font-bold font-brand mb-2 text-gray-800 dark:text-white">
            Flux Fractal & Fédération
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Cette page visualise le concept de <strong>Subsidiarité Ascendante</strong>. Les flux
            ci-dessous ne contiennent QUE les éléments explicitement fédérés (tagués pour remonter).
          </p>
        </header>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg mb-8">
          <h3 className="font-bold text-yellow-800 dark:text-yellow-200 mb-2">
            🔭 Vérification de l'Ascension
          </h3>
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            Les deux flux par défaut ("Export Fédéré") simulent ce qu'une instance parente (ex:
            Région) verrait de votre instance. Si vous créez une proposition sans cocher "Fédérer",
            elle ne doit <strong>PAS</strong> apparaître ici.
          </p>
        </div>

        <section className="mb-8 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h2 className="text-lg font-bold mb-4">Ajouter une Instance Parente / Voisine</h2>
          <form onSubmit={handleAddFeed} className="flex gap-2">
            <input
              type="url"
              placeholder="https://autre-instance.com/api/feed/propositions"
              className="flex-1 border p-2 rounded"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
            />
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700"
            >
              Ajouter
            </button>
          </form>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 font-brand">Flux Agrégé</h2>
          <p className="text-sm text-gray-500 mb-2">
            Vous pouvez importer des sujets externes pour en débattre localement.
          </p>
          <FeedReader feeds={feeds} limit={20} onImport={handleImport} />
        </section>
      </div>

      <SiteFooter />
    </div>
  );
}
