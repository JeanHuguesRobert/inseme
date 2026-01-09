import React, { useState, useEffect, useMemo } from "react";
import MarkdownViewer from "./MarkdownViewer";

/**
 * Explorateur de fichiers public.
 * @param {Object} props
 * @param {string} props.apiEndpoint - L'URL de l'API (ex: /api/public_browser)
 * @param {string} props.basePath - Le chemin de base (ex: /public/docs)
 * @param {string} props.title - Titre de l'explorateur
 */
export function PublicBrowser({ 
  apiEndpoint = "/api/public_browser", 
  basePath = "/public/docs",
  title = "Explorateur de documents"
}) {
  const [path, setPath] = useState("/");
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewFile, setViewFile] = useState(null);
  const [content, setContent] = useState("");
  const [backendMessage, setBackendMessage] = useState(null);

  const fullPath = useMemo(() => {
    const p = path.replace(/^\/*/, "").replace(/\/*$/, "");
    return p ? `${basePath}/${p}` : basePath;
  }, [path, basePath]);

  useEffect(() => {
    async function listDir() {
      setLoading(true);
      setItems(null);
      setViewFile(null);
      setContent("");
      setBackendMessage(null);
      try {
        let rel = fullPath.replace(/^\//, "");
        if (rel.startsWith("public/")) rel = rel.slice("public/".length);
        const apiPath = encodeURIComponent(rel);
        const r = await fetch(`${apiEndpoint}?path=${apiPath}`);
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          setItems([]);
          setBackendMessage(j?.message || `Erreur ${r.status}`);
          return;
        }
        const json = await r.json();
        if (Array.isArray(json)) setItems(json);
        else setItems(json.items ?? []);
        setBackendMessage(json.message ?? null);
      } catch (err) {
        console.warn("Listing failed:", err);
        setItems([]);
        setBackendMessage("Impossible de contacter le service d'archives.");
      } finally {
        setLoading(false);
      }
    }
    listDir();
  }, [fullPath, apiEndpoint]);

  function goUp() {
    if (path === "/" || path === "") return;
    const parts = path.replace(/^\//, "").split("/");
    parts.pop();
    const np = parts.length ? `/${parts.join("/")}` : "/";
    setPath(np);
  }

  async function openEntry(entry) {
    if (entry.isDir || (entry.href && entry.href.endsWith("/"))) {
      const name = entry.name.replace(/\/$/, "");
      setPath((prev) => (prev === "/" ? `/${name}` : `${prev}/${name}`));
      return;
    }
    setLoading(true);
    setViewFile(entry);
    setContent("");
    try {
      let filePath = `${fullPath.replace(/^\//, "")}/${entry.name}`;
      if (filePath.startsWith("public/")) filePath = filePath.slice("public/".length);
      const apiPath = encodeURIComponent(filePath);
      const r = await fetch(`${apiEndpoint}?path=${apiPath}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (j?.file) {
        if (!j.base64) setContent(j.body || "");
        else {
          if (/^text\/|json|csv|markdown/.test(j.mime)) {
            const txt = atob(j.body);
            setContent(txt);
          } else {
            setContent(`Fichier binaire (${j.mime}). Utilisez le lien "Télécharger".`);
          }
        }
      } else {
        setContent("Contenu indisponible");
      }
    } catch (e) {
      setContent(`Erreur de lecture: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  function fileDownloadUrl(entry) {
    let filePath = `${fullPath.replace(/^\//, "")}/${entry.name}`;
    if (filePath.startsWith("public/")) filePath = filePath.slice("public/".length);
    return `${apiEndpoint}?path=${encodeURIComponent(filePath)}&download=1`;
  }

  function renderFileContent(name, txt) {
    const ext = (name.split(".").pop() || "").toLowerCase();
    if (ext === "md" || ext === "markdown") {
      return <MarkdownViewer content={txt} />;
    }
    if (ext === "json") {
      try {
        return <pre className="p-4 bg-gray-50 rounded overflow-auto text-sm">{JSON.stringify(JSON.parse(txt || "{}"), null, 2)}</pre>;
      } catch {
        return <pre className="p-4 bg-gray-50 rounded overflow-auto text-sm">{txt}</pre>;
      }
    }
    if (ext === "csv") {
      const lines = (txt || "").trim().split(/\r?\n/).filter(Boolean);
      const rows = lines.map((l) => l.split(","));
      return (
        <div className="overflow-auto border rounded">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {(rows[0] || []).map((c, i) => (
                  <th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r last:border-0">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rows.slice(1).map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci} className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 border-r last:border-0">{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    return <pre className="p-4 bg-gray-50 rounded overflow-auto text-sm whitespace-pre-wrap">{txt}</pre>;
  }

  return (
    <div className="public-browser font-sans text-gray-900">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">{title}</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setPath("/")}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Racine
          </button>
          <button
            onClick={goUp}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Remonter
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="lg:w-1/3 border rounded-lg overflow-hidden flex flex-col bg-white shadow-sm">
          <div className="p-3 bg-gray-50 border-b">
            <p className="text-xs font-mono text-gray-500 truncate" title={path}>
              <span className="font-bold">Chemin :</span> {path}
            </p>
          </div>
          
          <div className="flex-1 overflow-y-auto max-h-[600px]">
            {backendMessage && (
              <div className="m-3 p-3 text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded">
                {backendMessage}
              </div>
            )}
            
            {loading && !items && (
              <div className="p-8 text-center text-gray-400">Chargement...</div>
            )}
            
            {!loading && items && items.length === 0 && !backendMessage && (
              <div className="p-8 text-center text-gray-400">Dossier vide</div>
            )}
            
            {items && items.length > 0 && (
              <ul className="divide-y divide-gray-100">
                {items.map((it, i) => (
                  <li key={i} className="hover:bg-indigo-50 transition-colors">
                    <div className="flex items-center">
                      <button
                        onClick={() => openEntry(it)}
                        className="flex-1 flex items-center gap-3 px-4 py-3 text-left focus:outline-none"
                      >
                        <span className="text-xl">{it.isDir ? "📁" : "📄"}</span>
                        <span className="text-sm font-medium text-gray-700 truncate">{it.name}</span>
                      </button>
                      {!it.isDir && (
                        <a
                          href={fileDownloadUrl(it)}
                          target="_blank"
                          rel="noreferrer"
                          className="px-4 py-3 text-gray-400 hover:text-indigo-600 transition-colors"
                          title="Télécharger"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="lg:w-2/3 border rounded-lg bg-white shadow-sm flex flex-col min-h-[500px]">
          {viewFile ? (
            <>
              <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-800 truncate">{viewFile.name}</h3>
                <a
                  href={fileDownloadUrl(viewFile)}
                  download
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Télécharger
                </a>
              </div>
              <div className="p-6 flex-1 overflow-auto">
                {loading ? (
                  <div className="flex justify-center items-center h-32 text-gray-400">
                    Chargement du contenu...
                  </div>
                ) : (
                  renderFileContent(viewFile.name, content)
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-12">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4 opacity-20"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
              <p>Sélectionnez un fichier pour voir son contenu</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PublicBrowser;
