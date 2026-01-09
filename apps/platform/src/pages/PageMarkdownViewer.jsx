import React from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { LegalMarkdown } from "../components/common/LegalLinks";

function appendRawParam(path) {
  if (!path) return path;
  if (path.includes("raw=1")) return path;
  return path.includes("?") ? `${path}&raw=1` : `${path}?raw=1`;
}

function normalizeFileParam(param) {
  if (!param) return null;
  const decoded = decodeURIComponent(param);
  if (!decoded.startsWith("/")) {
    return null;
  }
  const [basePath, search = ""] = decoded.split("?");
  // Only allow /docs/ and /public/ paths
  if (!basePath.startsWith("/docs/") && !basePath.startsWith("/public/")) {
    return null;
  }
  const params = new URLSearchParams(search);
  params.delete("raw");
  const query = params.toString();
  if (!basePath.endsWith(".md")) return null;
  return `${basePath}${query ? `?${query}` : ""}`;
}

export default function MarkdownViewer() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const rawFileParam = searchParams.get("file");
  const decodedFile = rawFileParam ? normalizeFileParam(rawFileParam) : null;

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4">
        {!decodedFile ? (
          <div className="markdown-content space-y-4">
            <p>
              Ce visualiseur nécessite le paramètre <code>?file=/docs/nom-du-fichier.md</code>.
            </p>
            <p>
              Exemple :{" "}
              <Link
                className="text-primary"
                to="/markdown-viewer?file=%2Fdocs%2Fsurvey-mode-emploi.md"
              >
                ouvrir le mode d'emploi
              </Link>
              .
            </p>
            <p>
              Vous êtes arrivé ici via <code>{location.pathname + location.search}</code>.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="markdown-content space-y-6">
              <LegalMarkdown file={appendRawParam(decodedFile)} />
            </div>
            <div className="text-center">
              <a
                className="inline-block px-4 py-2 bg-bauhaus-blue text-bauhaus-white font-semibold shadow hover:bg-blue-700"
                href={appendRawParam(decodedFile)}
              >
                Voir la version brute
              </a>
            </div>
          </div>
        )}

        <div className="mt-10 flex flex-col items-center gap-3">
          <Link
            to="/survey"
            className="inline-block px-4 py-2 bg-bauhaus-blue text-bauhaus-white font-semibold shadow hover:bg-blue-700"
          >
            ← Retour à la présentation
          </Link>
        </div>
      </div>
    </div>
  );
}
