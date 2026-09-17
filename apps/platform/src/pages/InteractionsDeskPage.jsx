/**
 * Owner-gated read-only Interactions Desk (Inseme #36 / #77).
 * Lists interaction_cases_desk via /api/interactions/desk (service-role server-side).
 */
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AuthModal from "../components/common/AuthModal";
import { useSupabase } from "../contexts/SupabaseContext";

const DESK_ENDPOINT = "/api/interactions/desk";

export default function InteractionsDeskPage() {
  const { session, loading } = useSupabase();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [openOnly, setOpenOnly] = useState(searchParams.get("open") !== "0");
  const [list, setList] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const selectedId = searchParams.get("id");
  const [isEditing, setIsEditing] = useState(false);
  const [editStatus, setEditStatus] = useState("open");
  const [editStatusLabel, setEditStatusLabel] = useState("");
  const [editNextWatch, setEditNextWatch] = useState([]);
  const [newWatchInput, setNewWatchInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(null);

  const fetchList = useCallback(async () => {
    const token = session?.access_token;
    if (!token) {
      setList(null);
      setError(null);
      return;
    }
    setError(null);
    try {
      const url = new URL(DESK_ENDPOINT, window.location.origin);
      if (openOnly) url.searchParams.set("open", "1");
      url.searchParams.set("limit", "100");
      const response = await fetch(url.pathname + url.search, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 403) {
        setList(body);
        setError(body.error || "not_authorized");
        return;
      }
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
      setList(body);
    } catch (requestError) {
      setList(null);
      setError(requestError.message || "desk_unavailable");
    }
  }, [session?.access_token, openOnly]);

  const fetchDetail = useCallback(
    async (packetId) => {
      const token = session?.access_token;
      if (!token || !packetId) {
        setDetail(null);
        return;
      }
      try {
        const url = new URL(DESK_ENDPOINT, window.location.origin);
        url.searchParams.set("packet_id", packetId);
        const response = await fetch(url.pathname + url.search, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
        setDetail(body);
      } catch (requestError) {
        setDetail(null);
        setError(requestError.message || "desk_detail_unavailable");
      }
    },
    [session?.access_token]
  );

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    if (selectedId) fetchDetail(selectedId);
    else setDetail(null);
  }, [selectedId, fetchDetail]);

  useEffect(() => {
    if (detail?.ok && detail.desk) {
      setEditStatus(detail.desk.status || (detail.desk.is_open ? "open" : "closed"));
      setEditStatusLabel(detail.desk.status_label || detail.desk.status_display || "");
      setEditNextWatch(Array.isArray(detail.case?.next_watch) ? [...detail.case.next_watch] : []);
      setIsEditing(false);
      setSaveError(null);
      setSaveSuccess(null);
    }
  }, [detail]);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    const token = session?.access_token;
    if (!token || !detail?.desk) return;

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const payload = {
        packet_id: detail.desk.packet_id,
        expected_revision: detail.desk.revision,
        patch: {
          status: editStatus,
          status_label: editStatusLabel.trim(),
          next_watch: editNextWatch.map((s) => s.trim()).filter(Boolean),
        },
      };

      const response = await fetch(DESK_ENDPOINT, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || body.message || `HTTP ${response.status}`);
      }

      setSaveSuccess(`Updated to revision ${body.revision}`);
      setIsEditing(false);
      await Promise.all([fetchDetail(detail.desk.packet_id), fetchList()]);
    } catch (err) {
      setSaveError(err.message || "Failed to update case");
    } finally {
      setIsSaving(false);
    }
  };

  const connected = Boolean(session?.access_token);
  const authorized = Boolean(list?.authorized);
  const cases = list?.cases || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <main className="mx-auto max-w-6xl px-4 py-10">
        <header className="border-b border-slate-800 pb-8">
          <p className="text-sm font-medium text-emerald-400">John · Interactions Desk</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Interaction cases
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">
            Operational desk projection of public Interaction Packets (Packet-Backed SQL, Inseme #77
            / #36). Write-capable for authorized Principal/Delegates with optimistic revision
            tracking. Git/YAML remains the documentary source. Anonymous visitors never see case
            rows.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link className="text-emerald-400 hover:underline" to="/">
              Home
            </Link>
            <Link className="text-emerald-400 hover:underline" to="/john">
              Talk to John
            </Link>
            <Link className="text-emerald-400 hover:underline" to="/nasa">
              La Nasa
            </Link>
          </div>
        </header>

        <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          {loading ? (
            <p className="text-sm text-slate-400">Checking session…</p>
          ) : !connected ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-300">
                Sign in as the Principal (or an approved delegate) to open the desk.
              </p>
              <button
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800"
                onClick={() => setShowAuthModal(true)}
              >
                Sign in to John
              </button>
            </div>
          ) : !authorized ? (
            <p className="text-sm text-amber-300">
              Signed in, but this identity is not authorized for the Interactions Desk
              {error ? ` (${error})` : ""}.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="inline-flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={openOnly}
                  onChange={(event) => {
                    const next = event.target.checked;
                    setOpenOnly(next);
                    const params = new URLSearchParams(searchParams);
                    if (next) params.delete("open");
                    else params.set("open", "0");
                    setSearchParams(params);
                  }}
                />
                Open cases only
              </label>
              <button
                className="rounded-lg border border-slate-600 px-3 py-1.5 text-slate-100 hover:bg-slate-800"
                onClick={fetchList}
              >
                Refresh
              </button>
              <span className="text-slate-500">
                {list?.count ?? 0} case(s) · access={list?.access_class}
              </span>
            </div>
          )}
          {error && authorized ? (
            <p className="mt-3 text-xs text-amber-300">Desk error: {error}</p>
          ) : null}
        </section>

        {authorized ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <section className="overflow-hidden rounded-xl border border-slate-800">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-3 py-2">ID</th>
                      <th className="px-3 py-2">Open</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">D</th>
                      <th className="px-3 py-2">Watch</th>
                      <th className="px-3 py-2">Counterparty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.map((row) => {
                      const active = row.packet_id === selectedId;
                      return (
                        <tr
                          key={row.packet_id}
                          className={
                            active
                              ? "cursor-pointer bg-emerald-950/40"
                              : "cursor-pointer border-t border-slate-800 hover:bg-slate-900/60"
                          }
                          onClick={() => {
                            const params = new URLSearchParams(searchParams);
                            params.set("id", row.packet_id);
                            setSearchParams(params);
                          }}
                        >
                          <td className="px-3 py-2 font-mono text-xs text-emerald-300">
                            {row.packet_id}
                          </td>
                          <td className="px-3 py-2">{row.is_open ? "yes" : "no"}</td>
                          <td className="max-w-[14rem] truncate px-3 py-2 text-slate-200">
                            {row.status_display || "—"}
                          </td>
                          <td className="px-3 py-2">{row.disclosure || "—"}</td>
                          <td className="px-3 py-2">{row.next_watch_count ?? "—"}</td>
                          <td className="max-w-[12rem] truncate px-3 py-2 text-slate-400">
                            {row.counterparty_label || "—"}
                          </td>
                        </tr>
                      );
                    })}
                    {cases.length === 0 ? (
                      <tr>
                        <td className="px-3 py-6 text-slate-500" colSpan={6}>
                          No cases in this filter.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 text-sm">
              {!selectedId ? (
                <p className="text-slate-400">
                  Select a case to inspect next_watch and provenance.
                </p>
              ) : !detail?.ok ? (
                <p className="text-amber-300">{detail?.error || "Loading…"}</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs text-emerald-300">{detail.desk.packet_id}</p>
                      <h2 className="mt-1 text-lg font-semibold text-slate-100">
                        {detail.desk.subject || "Untitled"}
                      </h2>
                      <p className="mt-1 text-slate-400">{detail.desk.status_display}</p>
                    </div>
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white"
                      >
                        Edit
                      </button>
                    )}
                  </div>

                  <dl className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                    <div>
                      <dt className="uppercase tracking-wide">Disclosure</dt>
                      <dd className="text-slate-200">{detail.desk.disclosure}</dd>
                    </div>
                    <div>
                      <dt className="uppercase tracking-wide">Channel</dt>
                      <dd className="text-slate-200">{detail.desk.channel_kind}</dd>
                    </div>
                    <div>
                      <dt className="uppercase tracking-wide">Revision</dt>
                      <dd className="text-slate-200">{detail.desk.revision}</dd>
                    </div>
                    <div>
                      <dt className="uppercase tracking-wide">Open</dt>
                      <dd className="text-slate-200">{detail.desk.is_open ? "yes" : "no"}</dd>
                    </div>
                  </dl>

                  {!isEditing ? (
                    <>
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Next watch
                        </h3>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300">
                          {(detail.case.next_watch || []).map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                          {(detail.case.next_watch || []).length === 0 ? <li>None</li> : null}
                        </ul>
                      </div>
                      {saveSuccess ? (
                        <p className="rounded border border-emerald-800 bg-emerald-950/50 px-2 py-1 text-xs text-emerald-300">
                          ✓ {saveSuccess}
                        </p>
                      ) : null}
                      {detail.case.source_ref?.path ? (
                        <p className="break-all text-xs text-slate-500">
                          source: {detail.case.source_ref.repository}/{detail.case.source_ref.path}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <form
                      onSubmit={handleSave}
                      className="space-y-4 border-t border-slate-800 pt-4"
                    >
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
                        Edit case (rev {detail.desk.revision})
                      </h3>

                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Status
                        </label>
                        <select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value)}
                          className="w-full rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                        >
                          <option value="open">open</option>
                          <option value="closed">closed</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Status label
                        </label>
                        <input
                          type="text"
                          value={editStatusLabel}
                          onChange={(e) => setEditStatusLabel(e.target.value)}
                          placeholder="e.g. En attente de réponse du TA"
                          className="w-full rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Next watch items
                        </label>
                        <div className="space-y-1.5 mb-2">
                          {editNextWatch.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={item}
                                onChange={(e) => {
                                  const updated = [...editNextWatch];
                                  updated[idx] = e.target.value;
                                  setEditNextWatch(updated);
                                }}
                                className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setEditNextWatch(editNextWatch.filter((_, i) => i !== idx))
                                }
                                className="rounded px-2 py-1 text-xs text-rose-400 hover:bg-slate-800"
                                title="Remove item"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                          {editNextWatch.length === 0 && (
                            <p className="text-xs text-slate-500 italic">No watch items</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newWatchInput}
                            onChange={(e) => setNewWatchInput(e.target.value)}
                            placeholder="Add watch item..."
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                if (newWatchInput.trim()) {
                                  setEditNextWatch([...editNextWatch, newWatchInput.trim()]);
                                  setNewWatchInput("");
                                }
                              }
                            }}
                            className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (newWatchInput.trim()) {
                                setEditNextWatch([...editNextWatch, newWatchInput.trim()]);
                                setNewWatchInput("");
                              }
                            }}
                            className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-700"
                          >
                            Add
                          </button>
                        </div>
                      </div>

                      {saveError ? (
                        <p className="rounded border border-rose-800 bg-rose-950/50 px-2 py-1 text-xs text-rose-300">
                          Error: {saveError}
                        </p>
                      ) : null}

                      <div className="flex gap-2 pt-2">
                        <button
                          type="submit"
                          disabled={isSaving}
                          className="flex-1 rounded-lg bg-emerald-600 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {isSaving ? "Saving…" : "Save changes"}
                        </button>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => {
                            setIsEditing(false);
                            setSaveError(null);
                          }}
                          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </section>
          </div>
        ) : null}
      </main>

      {showAuthModal ? (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => {
            setShowAuthModal(false);
            fetchList();
          }}
        />
      ) : null}
    </div>
  );
}
