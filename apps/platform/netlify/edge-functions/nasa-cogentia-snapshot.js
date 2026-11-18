/**
 * Read-only, Principal-scoped summary of the existing Cogentia daemon cockpit.
 * The daemon remains the source of truth; La Nasa never indexes or stores work.
 */
const LOCAL_COGENTIA_DAEMON = "http://127.0.0.1:8790";
const MAX_WAIT_MS = 5000;
const value = (input, max = 160) =>
  typeof input === "string" ? input.slice(0, max) : null;
const number = (input) =>
  Number.isFinite(input) && input >= 0 ? input : null;
const date = (input) => value(input, 40);

export function projectCogentiaSnapshot(raw) {
  if (!raw || raw.protocol !== "cogentia.views_snapshot.v1" || raw.ok !== true) {
    throw new Error("unexpected_cogentia_snapshot");
  }
  const alive = raw.continuations?.alive;
  const actions = raw.next_actions;
  return {
    schema: "inseme.nasa.cogentia_cockpit.v1",
    source: "cogentia-daemon-on-fracta2",
    generated_at: date(raw.generated_at),
    load: {
      level: value(raw.load?.level, 30),
      mode: value(raw.load?.mode_recommendation, 30),
      demand_score: number(raw.load?.demand_score),
      capacity_score: number(raw.load?.capacity_score),
      embedding_coverage_pct: number(raw.load?.inventory?.embedding_coverage_pct),
      index_built: typeof raw.load?.inventory?.index_built === "boolean"
        ? raw.load.inventory.index_built : null,
    },
    continuations: {
      alive_count: number(raw.continuations?.alive_count),
      displayed_count: Array.isArray(alive) ? alive.length : 0,
      recent: (Array.isArray(alive) ? alive : []).slice(0, 10).map(entry => ({
        id: value(entry.id, 90),
        title: value(entry.title, 180),
        status: value(entry.status, 30),
        kind: value(entry.kind, 40),
        priority: value(entry.priority, 35),
        repo: value(entry.subject?.repo, 90),
        updated_at: date(entry.updated_at),
      })),
    },
    issues: {
      open_count: number(raw.issues?.total_open),
      updated_at: date(raw.issues?.generated_at),
    },
    recommendations: (Array.isArray(actions) ? actions : []).slice(0, 10)
      .map(action => ({
        kind: value(action.type, 35),
        id: value(action.id, 90),
        title: value(action.title, 180),
        priority: value(action.priority, 35),
      })),
  };
}

export async function readLocalCogentiaSnapshot(origin, fetchImpl = fetch) {
  if (!origin) return { status: "not_configured", view: null };
  if (origin !== LOCAL_COGENTIA_DAEMON) {
    return { status: "refused", view: null, error: "cogentia_origin_not_permitted" };
  }
  try {
    const result = await fetchImpl(
      LOCAL_COGENTIA_DAEMON + "/api/views/snapshot?limit=8&no_store_probe=1",
      { method: "GET", headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(MAX_WAIT_MS), cache: "no-store" }
    );
    if (!result.ok) return { status: "unavailable", view: null };
    const data = await result.json();
    return { status: "available", view: projectCogentiaSnapshot(data) };
  } catch {
    return { status: "unavailable", view: null };
  }
}
