/**
 * Read-only view of the serving FractaNode's local ONA observer.
 * Only the JHN Principal endpoint may call this module after authentication.
 * Explicit loopback pinning prevents a Vault/environment URL from becoming SSRF.
 */
const LOCAL_OBSERVER = "http://127.0.0.1:8794";
const timeoutMs = 7000; // Fleet observation can take several seconds across the mesh.

const bounded = (value, max = 160) =>
  typeof value === "string" ? value.slice(0, max) : null;
const count = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;
const flag = (value) => typeof value === "boolean" ? value : null;

export function projectLocalNasaStatus(node, fleet) {
  return {
    schema: "inseme.nasa.fractanode_view.v1",
    observer: "fracta2-local-ona",
    generated_at: bounded(node?.generated_at || fleet?.generated_at, 40),
    node: node ? {
      node_id: bounded(node.node_id),
      hostname: bounded(node.hostname),
      ok: flag(node.ok),
      health_score: count(node.health_score),
      uptime_seconds: count(node.uptime_seconds),
      peer_count_fresh: count(node.peer_count_fresh),
      probes: {
        applicable_count: count(node.probes?.applicable_count),
        failed_count: count(node.probes?.failed_count),
        last_at: bounded(node.probes?.last_at, 40),
        items: (Array.isArray(node.probes?.items) ? node.probes.items : []).slice(0, 16).map(p => ({
          kind: bounded(p.probe_kind),
          target: bounded(p.target),
          ok: flag(p.ok),
          skipped: flag(p.skipped),
        })),
      },
      jobs: {
        total: count(node.jobs?.total),
        enabled: count(node.jobs?.enabled),
        failed_last_run: count(node.jobs?.failed_last_run),
        items: (Array.isArray(node.jobs?.items) ? node.jobs.items : []).slice(0, 20).map(j => ({
          id: bounded(j.job_id),
          kind: bounded(j.kind),
          enabled: flag(j.enabled),
          last_ok: flag(j.last_ok),
          last_run_at: bounded(j.last_run_at, 40),
          next_run_at: bounded(j.next_run_at, 40),
        })),
      },
      pending_cop_outbox: count(node.sqlite_stats?.cop_outbox_pending),
    } : null,
    fleet: fleet ? {
      generated_at: bounded(fleet.generated_at, 40),
      nodes: (Array.isArray(fleet.nodes) ? fleet.nodes : []).slice(0, 25).map(n => ({
        host: bounded(n.host),
        label: bounded(n.label),
        online: flag(n.online),
        health_score: count(n.health_score),
        observation_state: bounded(n.observation_state),
        mesh_control_online: flag(n.mesh_control_online),
        mesh_control_observed_at: bounded(n.mesh_control_observed_at, 40),
      })),
    } : null,
  };
}

export async function readLocalNasaObserver(origin, fetchImpl = fetch) {
  if (!origin) return { status: "not_configured", view: null };
  if (origin !== LOCAL_OBSERVER) return { status: "refused", error: "observer_origin_not_permitted", view: null };
  const readJson = async (path) => {
    const response = await fetchImpl(LOCAL_OBSERVER + path, {
      method: "GET", headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs), cache: "no-store",
    });
    if (!response.ok) throw new Error("observer_response_unavailable");
    const json = await response.json();
    if (!json || typeof json !== "object") throw new Error("observer_response_invalid");
    return json;
  };
  const [nodeResult, fleetResult] = await Promise.allSettled([
    readJson("/node/status"),
    readJson("/cgi-bin/fleet"),
  ]);
  const node = nodeResult.status === "fulfilled" ? nodeResult.value : null;
  const fleet = fleetResult.status === "fulfilled" ? fleetResult.value : null;
  return {
    status: node && fleet ? "available" : node || fleet ? "degraded" : "unavailable",
    view: projectLocalNasaStatus(node, fleet),
  };
}
