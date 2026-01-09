import React, { useState, useEffect } from "react";
import { MarkdownViewer } from "./MarkdownViewer";

/**
 * Composant générique pour les pages légales.
 * @param {Object} props
 * @param {string} props.title - Titre de la page.
 * @param {string} props.content - Contenu Markdown direct.
 * @param {string} props.url - URL pour charger le contenu Markdown.
 */
export function LegalPage({ title, content: initialContent, url }) {
  const [content, setContent] = useState(initialContent);
  const [loading, setLoading] = useState(!initialContent && !!url);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!initialContent && url) {
      setLoading(true);
      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
          return res.text();
        })
        .then((text) => {
          setContent(text);
          setError(null);
        })
        .catch((err) => {
          console.error("Error loading legal content:", err);
          setError("Impossible de charger le contenu légal.");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [initialContent, url]);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 md:p-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-8 border-b pb-4">
            {title}
          </h1>
          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-slate-200 rounded w-3/4"></div>
              <div className="h-4 bg-slate-200 rounded"></div>
              <div className="h-4 bg-slate-200 rounded w-5/6"></div>
            </div>
          ) : error ? (
            <div className="text-red-500 bg-red-50 p-4 rounded-lg border border-red-100">
              {error}
            </div>
          ) : (
            <MarkdownViewer
              content={content}
              className="prose prose-slate max-w-none"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default LegalPage;
