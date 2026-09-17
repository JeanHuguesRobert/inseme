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
            Read-only operational projection of public Interaction Packets (Packet-Backed SQL,
            Inseme #77). Git/YAML remains the documentary source. Anonymous visitors never see case
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
                  <div>
                    <p className="font-mono text-xs text-emerald-300">{detail.desk.packet_id}</p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-100">
                      {detail.desk.subject || "Untitled"}
                    </h2>
                    <p className="mt-1 text-slate-400">{detail.desk.status_display}</p>
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
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Next watch
                    </h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300">
                      {(detail.case.next_watch || []).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                      {(detail.case.next_watch || []).length === 0 ? <li>None</li> : null}
                    </ul>
                  </div>
                  {detail.case.source_ref?.path ? (
                    <p className="break-all text-xs text-slate-500">
                      source: {detail.case.source_ref.repository}/{detail.case.source_ref.path}
                    </p>
                  ) : null}
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
