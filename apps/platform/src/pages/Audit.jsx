import { MarkdownViewer } from "@inseme/ui";
import { Link } from "react-router-dom";
import { MOVEMENT_NAME, CITY_NAME, BOT_NAME, PARTY_NAME, HASHTAG } from "../constants.js";
import SiteFooter from "../components/layout/SiteFooter";
import { useMarkdownDoc } from "../hooks/useMarkdownDoc.js";
import { useMemo } from "react";

export default function Audit() {
  const replacements = useMemo(
    () => ({
      MOVEMENT_NAME,
      CITY_NAME,
      BOT_NAME,
      PARTY_NAME,
      HASHTAG,
    }),
    []
  );

  const { content, loading, error } = useMarkdownDoc("audit-ethique.md", replacements);

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4 space-y-8">
        <div className="text-center">
          <div className="mb-4">
            <div className="text-5xl font-bold text-accent-orange">{HASHTAG}</div>
            <div className="h-1 bg-blue-900 my-3 max-w-2xl mx-auto"></div>
            <div className="text-4xl font-bold text-blue-900">
              {CITY_NAME.toUpperCase()}
              <br />
              CAPITALE
            </div>
          </div>
        </div>

        <div className=" shadow rounded-xl p-8">
          {loading && (
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto" />
            </div>
          )}
          {error && <div className="text-center text-red-600">Erreur: {error}</div>}
          {!loading && !error && content && <MarkdownViewer content={content} />}
          {!loading && !error && !content && (
            <div className="text-center">No content available</div>
          )}
        </div>

        <div className="mt-8 text-center">
          <Link
            to="/"
            className="px-4 py-2 bg-gray-100 text-blue-900 font-semibold hover:bg-gray-200"
          >
            Retour à la consultation
          </Link>
        </div>

        <div className="mt-8">
          <SiteFooter />
        </div>
      </div>
    </div>
  );
}
