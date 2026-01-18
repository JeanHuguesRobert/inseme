import { useState, useEffect } from "react";
import { substituteVariables } from "@inseme/cop-host";

/**
 * Hook pour charger un document Markdown depuis /docs/
 *
 * @param {string} docPath - Chemin du fichier .md dans public/docs
 * @param {Object} replacements - Dictionnaire de remplacements {{KEY}} → valeur
 * @returns {{ content: string, loading: boolean, error: string|null }}
 */
export function useMarkdownDoc(docPath, replacements = {}) {
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

        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("text/html")) {
          console.warn(`[useMarkdownDoc] Le document /docs/${docPath} a renvoyé du HTML.`);
          throw new Error("Format de document invalide (HTML)");
        }

        let text = await res.text();

        if (text.trim().startsWith("<!doctype html>")) {
          console.warn(`[useMarkdownDoc] Le document /docs/${docPath} contient du HTML.`);
          throw new Error("Contenu de document invalide (fallback HTML)");
        }

        // Appliquer les remplacements de variables {{KEY}}
        text = substituteVariables(text, replacements);

        setContent(text);
        setError(null);
      } catch (err) {
        console.error("Erreur chargement document:", err);
        setError(err.message);
        setContent("");
      } finally {
        setLoading(false);
      }
    }
    loadContent();
  }, [docPath, JSON.stringify(replacements)]);

  return { content, loading, error };
}

export default useMarkdownDoc;
