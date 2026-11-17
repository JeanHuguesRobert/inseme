import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AuthModal from "../components/common/AuthModal";
import { useSupabase } from "../contexts/SupabaseContext";

const PUBLIC_NASA_URL = "https://cogentia.fractavolta.com/ops/dashboard";
const CONTROL_ENDPOINT = "/api/nasa/control";

function Metric({ label, value }) {
  return <div><div className="text-xs text-slate-400">{label}</div><div className="mt-1 text-2xl font-semibold">{value ?? "—"}</div></div>;
}

export default function NasaPage() {
  const { session, loading } = useSupabase();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [control, setControl] = useState(null);
  const [error, setError] = useState(null);

  const refreshControl = useCallback(async () => {
    const token = session?.access_token;
    if (!token) {
      setControl(null);
      setError(null);
      return;
    }
    setError(null);
    try {
      const response = await fetch(CONTROL_ENDPOINT, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
      setControl(body);
    } catch (requestError) {
      setControl(null);
      setError(requestError.message || "nasa_control_unavailable");
    }
  }, [session?.access_token]);

  useEffect(() => {
    refreshControl();
  }, [refreshControl]);

  const connected = Boolean(session?.access_token);
  const accessClass = control?.access_class || null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <main className="mx-auto max-w-4xl px-4 py-12">
        <header className="border-b border-slate-800 pb-8">
          <p className="text-sm font-medium text-emerald-400">John · jhn.baronsmariani.org</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">La Nasa</h1>
          <p className="mt-3 max-w-2xl text-slate-300">
            Principal workspace for the FractaNode serving this site. Local node status and
            fleet observations are read-only. Operational acts remain governed separately.
          </p>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-emerald-800/60 bg-emerald-950/20 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Public</p>
            <h2 className="mt-2 text-xl font-semibold">Read-only Fractanet</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              This public dashboard provides a read-only summary. Detailed observations from the
              serving FractaNode are available only after Principal authorization.
            </p>
            <a
              className="mt-5 inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              href={PUBLIC_NASA_URL}
            >
              Open Fractanet public overview
            </a>
          </article>

          <article className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Private work
            </p>
            <h2 className="mt-2 text-xl font-semibold">Operator workspace</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              {loading
                ? "Checking the John session…"
                : !connected
                  ? "Sign in with your John account to request operator access."
                  : accessClass === "principal"
                    ? "Principal verified. Local FractaNode observations are available below; actions are not enabled here."
                    : accessClass === "delegate"
                      ? "Your session is recognized as a mandated delegate. The action bridge is intentionally not deployed yet."
                      : "You are signed in, but this identity is neither the Principal nor an approved delegate."}
            </p>
            {!connected && !loading ? (
              <button
                className="mt-5 rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800"
                onClick={() => setShowAuthModal(true)}
              >
                Sign in to John
              </button>
            ) : null}
            {connected ? (
              <button
                className="mt-5 rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800"
                onClick={refreshControl}
              >
                Refresh access
              </button>
            ) : null}
            {error ? (
              <p className="mt-3 text-xs text-amber-300">Private boundary: {error}</p>
            ) : null}
          </article>
        </section>

        {accessClass === "principal" && control?.observer ? (
          <section className="mt-8 space-y-5" aria-label="Fracta2 observations">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold">Serving FractaNode — Fracta2</h2>
              <span className="text-sm text-slate-400">
                Observer: {control.observer.status}
              </span>
            </div>
            {control.observer.view?.node ? (
              <article className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
                <p className="text-sm text-slate-400">
                  {control.observer.view.node.node_id} · observed {control.observer.view.generated_at || "unknown"}
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-4">
                  <Metric label="Health score" value={control.observer.view.node.health_score} />
                  <Metric label="Probes failed" value={control.observer.view.node.probes.failed_count} />
                  <Metric label="Jobs enabled" value={control.observer.view.node.jobs.enabled} />
                  <Metric label="COP outbox pending" value={control.observer.view.node.pending_cop_outbox} />
                </div>
                <h3 className="mt-6 font-semibold">Local probes</h3>
                <div className="mt-2 space-y-1 text-sm">
                  {control.observer.view.node.probes.items.map((probe, i) => (
                    <div className="flex justify-between gap-3 border-b border-slate-800 py-2" key={i}>
                      <span className="min-w-0 break-all">{probe.kind} · {probe.target}</span>
                      <span className={probe.ok === true ? "text-emerald-400" : probe.skipped ? "text-slate-400" : "text-amber-300"}>
                        {probe.ok === true ? "ok" : probe.skipped ? "skipped" : "failed/unknown"}
                      </span>
                    </div>
                  ))}
                </div>
                <h3 className="mt-6 font-semibold">Local scheduled jobs</h3>
                <div className="mt-2 space-y-1 text-sm">
                  {control.observer.view.node.jobs.items.map((job, i) => (
                    <div className="flex justify-between gap-3 border-b border-slate-800 py-2" key={job.id || i}>
                      <span className="min-w-0 break-all">{job.kind || job.id}</span>
                      <span className="text-slate-400">
                        {job.enabled ? (job.last_ok === false ? "last run failed" : "enabled") : "disabled"}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            ) : (
              <p className="rounded-xl border border-amber-700/50 p-5 text-amber-200">
                The Fracta2 local observer is not available from this runtime.
              </p>
            )}
            {control.observer.view?.fleet ? (
              <article className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
                <h3 className="text-lg font-semibold">Fleet observed from Fracta2</h3>
                <p className="mt-1 text-xs text-slate-400">
                  An unknown state is not an outage. Snapshot: {control.observer.view.fleet.generated_at || "unknown"}.
                </p>
                <div className="mt-4 divide-y divide-slate-800">
                  {control.observer.view.fleet.nodes.map((node, i) => (
                    <div className="flex items-center justify-between gap-3 py-3 text-sm" key={node.host || i}>
                      <span className="font-medium">{node.label || node.host}<span className="ml-2 text-slate-500">{node.host}</span></span>
                      <span className={node.online === true ? "text-emerald-400" : node.online === false ? "text-amber-300" : "text-slate-400"}>
                        {node.online === true ? "online" : node.online === false ? "offline reported" : "unknown"}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            ) : null}
            <p className="text-sm text-slate-400">
              Read-only projection via John’s authenticated API. The ONA action API is not exposed.
              On the private Fractanet mesh you can also inspect the
              {" "}<a className="text-emerald-400 underline" href="http://fracta2:8794/" target="_blank" rel="noreferrer">native La Nasa observer</a>.
            </p>
          </section>
        ) : null}

        <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900/40 p-5 text-sm text-slate-300">
          <h2 className="font-semibold text-slate-100">Boundary in this increment</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              The browser sends only the current Supabase access token to John’s same-origin control
              endpoint.
            </li>
            <li>
              The server verifies that token, recognizes one Principal subject, then admits only
              explicitly listed delegates.
            </li>
            <li>
              No Fracta credential, service-role key, or write capability is included in the public
              site or this page.
            </li>
          </ul>
        </section>

        <p className="mt-8 text-sm text-slate-400">
          <Link className="text-emerald-400 hover:underline" to="/">
            Back to John
          </Link>
        </p>
      </main>
      {showAuthModal ? (
        <AuthModal onClose={() => setShowAuthModal(false)} onSuccess={refreshControl} />
      ) : null}
    </div>
  );
}
