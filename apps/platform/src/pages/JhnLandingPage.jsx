/**
 * Public entry for John, the personal agent at jhn.baronsmariani.org.
 * It is deliberately separate from civic/collective consultation surfaces.
 */
import { Link } from "react-router-dom";
import { getConfig } from "../common/config/instanceConfig.client.js";

export default function JhnLandingPage() {
  const name =
    getConfig("contact_name") || getConfig("community_name") || "Jean Hugues Noël Robert";
  const canonical = getConfig("canonical_url") || "https://jhn.baronsmariani.org";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <header className="space-y-6 border-b border-slate-800 pb-12">
          <div className="inline-flex items-center rounded-full border border-emerald-800/60 bg-emerald-950/40 px-3 py-1 text-xs font-medium text-emerald-300">
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400" />
            Personal instance · John
          </div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">John</h1>
          <p className="max-w-2xl text-base leading-relaxed text-slate-300">
            The personal conversational agent for <strong className="text-slate-100">{name}</strong>
            . External models and tools are governed capabilities; the public-facing identity is{" "}
            <strong className="text-slate-100">John</strong>.
          </p>
          <p className="text-sm text-slate-500">{canonical}</p>
        </header>

        <main className="mt-10 space-y-8">
          <section className="grid gap-4 sm:grid-cols-2">
            <Card
              title="Talk to John"
              body="The personal conversation space. Sign in when the instance requires an authenticated session."
              to="/john"
              cta="Open the conversation"
              primary
            />
            <Card
              title="La Nasa"
              body="A public window on Fractanet, with a work area reserved for the authenticated Principal and delegated agents."
              to="/nasa"
              cta="Open La Nasa"
            />
            <Card
              title="Interactions Desk"
              body="Read-only operational view of Interaction Packets (SQL projection). Principal or delegate only; no anonymous case data."
              to="/interactions"
              cta="Open the desk"
            />
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-sm text-slate-300">
            <h2 className="mb-3 text-base font-semibold text-slate-100">
              How this space is governed
            </h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>Public reading does not grant publication or editing rights.</li>
              <li>
                The Principal can delegate specific work to agents without making that work public.
              </li>
              <li>
                This is a personal agent space, not a collective consultation or survey service.
              </li>
            </ul>
          </section>

          <section className="flex flex-wrap gap-3 text-sm">
            <Link className="text-emerald-400 hover:underline" to="/legal/privacy">
              Privacy
            </Link>
            <Link className="text-emerald-400 hover:underline" to="/contact">
              Contact
            </Link>
          </section>
        </main>
      </div>
    </div>
  );
}

function Card({ title, body, to, cta, primary }) {
  return (
    <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">{body}</p>
      <Link
        to={to}
        className={
          primary
            ? "mt-4 inline-flex justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            : "mt-4 inline-flex justify-center rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
        }
      >
        {cta}
      </Link>
    </div>
  );
}
