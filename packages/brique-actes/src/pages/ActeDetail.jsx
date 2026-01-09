import React from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useCurrentUser } from "@inseme/cop-host";
import { useActe } from "../lib/hooks.js";
import { wrapFetch } from "../lib/api.js";

export default function ActeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, session } = useCurrentUser();

  const query = useActe(id);
  const acte = query.data;

  const loading = query.isLoading;
  const error = query.error;

  if (loading) return <div className="p-4">Chargement…</div>;
  if (error || !acte)
    return <div className="p-4 text-red-600">Erreur: {error?.message || "Acte non trouvé"}</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
            <Link to="/actes" className="hover:text-blue-600">
              Actes
            </Link>
            <span>/</span>
            <span className="text-slate-700">{acte.numero_interne || acte.id}</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-sm font-medium">
                  {acte.type_acte || "ACTE"}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900">{acte.objet_court}</h1>
              <p className="text-slate-600 mt-2 max-w-2xl">{acte.objet_complet}</p>
            </div>

            {isAdmin && (
              <div className="flex gap-2">
                <Link
                  to={`/actes/${id}/modifier`}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
                >
                  ✏️ Modifier
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white rounded-lg shadow border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Informations générales</h2>
              <div className="text-sm text-slate-700">Date: {acte.date_acte}</div>
              {acte.objet_complet && <div className="mt-2 prose">{acte.objet_complet}</div>}
            </section>

            <section className="bg-white rounded-lg shadow border border-slate-200 p-4">
              <h2 className="text-lg font-semibold mb-3">📎 Preuves</h2>
              {Array.isArray(acte.proofs) && acte.proofs.length > 0 ? (
                <ul className="space-y-3">
                  {acte.proofs.map((p) => (
                    <li key={p.id} className="bg-white p-3 rounded border">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium">{p.original_filename || p.type}</div>
                          <div className="text-sm text-gray-600">
                            Force probante: {p.probative_force}
                          </div>
                          <div className="text-sm text-gray-500">
                            Vérifié: {p.verified_by_human ? "oui" : "non"}
                          </div>
                        </div>
                        <div className="text-right">
                          {isAdmin && (
                            <>
                              <div className="text-xs text-gray-700 mb-2">{p.storage_url}</div>
                              <button
                                className="px-2 py-1 bg-green-600 text-white rounded text-xs"
                                onClick={async () => {
                                  try {
                                    await wrapFetch(`/api/proofs/${p.id}/verify`, {
                                      method: "POST",
                                      token: session?.access_token,
                                    });
                                    query.refetch();
                                  } catch (e) {
                                    console.error(e);
                                    alert("Erreur lors de la vérification");
                                  }
                                }}
                              >
                                Marquer vérifié
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-slate-500">Aucune preuve attachée.</div>
              )}

              {isAdmin && (
                <div className="mt-4">
                  <ProofUpload acteId={id} onUploaded={() => query.refetch()} />
                </div>
              )}
            </section>
          </div>

          <div className="space-y-6">
            <section className="bg-white rounded-lg shadow border border-slate-200 p-5">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">⏰ Échéances</h2>
              {Array.isArray(acte.deadlines) && acte.deadlines.length > 0 ? (
                <div className="space-y-3">
                  {acte.deadlines.map((d) => (
                    <div key={d.id} className="p-3 rounded border bg-slate-50">
                      <div className="font-medium">{d.template?.label_fr || d.template_id}</div>
                      <div className="text-xs text-slate-500">Due: {d.due_date}</div>
                      <div className="text-xs text-slate-500">Status: {d.status}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-slate-500">Aucune échéance.</div>
              )}
            </section>
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
