import React from "react";
import { MarkdownViewer } from "@inseme/ui";
import { useMarkdownDoc } from "../../hooks/useMarkdownDoc.js";

export default function AuditContent() {
  const { content, loading, error } = useMarkdownDoc("audit-ethique.md");

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4 my-4">
        <p className="text-red-700">Impossible de charger le rapport d'audit éthique: {error}</p>
        <p className="mt-2">Veuillez réessayer ultérieurement ou contacter l'administrateur.</p>
      </div>
    );
  }

  return (
    <div className="prose prose-blue max-w-none">
      <div className="markdown-content">
        <MarkdownViewer content={content} />
      </div>

      <hr />
      <p className="text-sm text-gray-400 mt-8">
        Document public - Reproduction et partage encouragés avec mention de la source
      </p>
    </div>
  );
}
