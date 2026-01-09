import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { substituteVariables } from "@inseme/cop-host";
import MarkdownViewer from "./MarkdownViewer";

/**
 * Composant générique pour afficher un document Markdown statique depuis /docs/
 *
 * @param {string} docPath - Chemin du fichier .md dans public/docs (ex: "guide-citoyen-actes.md")
 * @param {string} title - Titre affiché dans le header (optionnel, extrait du H1 sinon)
 * @param {string} backLink - Lien de retour (ex: "/actes/accueil")
 * @param {string} backLabel - Label du lien retour (ex: "Retour à l'accueil")
 * @param {boolean} showHeader - Afficher le header de navigation (défaut: true)
 * @param {Object} replacements - Dictionnaire de remplacements {{KEY}} → valeur
 * @param {React.ReactNode} customHeader - Header personnalisé (remplace le header par défaut)
 * @param {React.ReactNode} customFooter - Footer personnalisé (remplace le footer par défaut)
 * @param {string} containerClassName - Classes CSS additionnelles pour le conteneur
 * @param {string} contentClassName - Classes CSS additionnelles pour le contenu
 */
export default function MarkdownDoc({
  docPath,
  title,
  backLink = "/",
  backLabel = "Retour",
  showHeader = true,
  replacements = {},
  customHeader = null,
  customFooter = null,
  containerClassName = "",
  contentClassName = "",
}) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadContent() {
      try {
        const res = await fetch(`/docs/${docPath}`);
        if (!res.ok) {
          throw new Error(`Document non trouvé (${res.status})`);
        }
        let text = await res.text();

        // Appliquer les remplacements de variables {{KEY}}
        text = substituteVariables(text, replacements);

        setContent(text);
      } catch (err) {
        console.error("Erreur chargement document:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadContent();
  }, [docPath, replacements]);

  // Extraire le titre du H1 si non fourni
  const extractedTitle =
    title || content.match(/^#\s+(.+)$/m)?.[1] || "Documentation";

  if (loading) {
    return (
      <div
        className={`min-h-screen bg-slate-50 flex items-center justify-center ${containerClassName}`}
      >
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen bg-slate-50 p-8 ${containerClassName}`}>
        <div className="max-w-3xl mx-auto">
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
            <h2 className="text-red-700 font-bold">Document non disponible</h2>
            <p className="text-red-600 mt-2">{error}</p>
            <Link
              to={backLink}
              className="text-blue-600 hover:underline mt-4 inline-block"
            >
              ← {backLabel}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Header par défaut
  const defaultHeader = showHeader && !customHeader && (
    <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 shadow-md">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to={backLink}
            className="text-white/80 hover:text-white transition-colors"
          >
            ← {backLabel}
          </Link>
          <span className="text-white/40">|</span>
          <h1 className="text-xl font-bold">{extractedTitle}</h1>
        </div>
      </div>
    </header>
  );

  return (
    <div className={`min-h-screen bg-white ${containerClassName}`}>
      {customHeader || defaultHeader}

      <main className={`max-w-4xl mx-auto p-6 md:p-12 ${contentClassName}`}>
        <article className="prose prose-slate lg:prose-lg max-w-none">
          <MarkdownViewer content={content} />
        </article>
      </main>

      {customFooter}
    </div>
  );
}
