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

/**
 * A discovered peer is a time-bounded local observation, never a route grant.
 * Keep all network addresses and private attractor metadata server-side.
 */
export function projectNasaNeighbors(peers, node, fleet, now = new Date()) {
  if (!node || !peers || peers.schema !== "operium.node.peers.v1" ||
      peers.node_id !== node.node_id) return null;
  const nodeList = Array.isArray(peers.peers) ? peers.peers : [];
  const fleetList = Array.isArray(fleet?.nodes) ? fleet.nodes : [];
  const nowMs = now.getTime();
  const neighbors = nodeList.slice(0, 32).map(p => {
    const lastSeenMs = Date.parse(String(p.last_seen || ""));
    const ttlSeconds = Number(p.ttl_seconds);
    const ageMs = nowMs - lastSeenMs;
    const fresh = p.fresh === true && Number.isFinite(ageMs) && ageMs >= 0 &&
      Number.isFinite(ttlSeconds) && ttlSeconds > 0 &&
      ageMs <= ttlSeconds * 1000;
    const pathObservation = fleetList.find(f => f.host === p.hostname) || null;
    const capabilities = (Array.isArray(p.capabilities) ? p.capabilities : [])
      .filter(v => typeof v === "string").slice(0, 16).map(v => bounded(v, 80));
    return {
      node_id: bounded(p.node_id, 120),
      hostname: bounded(p.hostname, 120),
      last_seen: bounded(p.last_seen, 40),
      expires_at: Number.isFinite(lastSeenMs) && Number.isFinite(ttlSeconds) &&
        ttlSeconds > 0 ? new Date(lastSeenMs + ttlSeconds * 1000).toISOString() : null,
      fresh,
      claimed_status: bounded(p.status, 40),
      capabilities,
      // The old fleet's direct mesh probe, if any, is separate evidence.
      // Neither ONA reachability nor the transport path is inferred from TTL.
      direct_mesh_reachable: pathObservation ? flag(pathObservation.mesh_reachable) : null,
      direct_mesh_observed_at: pathObservation ? bounded(fleet?.generated_at, 40) : null,
      // Informational Gravity is packet-relative: mandate, compute slots, path,
      // latency, privacy and budget are NOT established by this view.
      routing_admissible: null,
    };
  });
  return {
    schema: "inseme.nasa.local_neighbors.v1",
    observer_node_id: bounded(peers.node_id, 120),
    source: "operium.node.peers.v1/local-ONA-registrar",
    observed_at: bounded(peers.generated_at, 40),
    last_blackboard_sync_at: bounded(peers.last_blackboard_sync_at, 40),
    known_count: nodeList.length,
    displayed_count: neighbors.length,
    fresh_count: neighbors.filter(n => n.fresh).length,
    nodes: neighbors,
  };
}

export function projectNasaComputeEvidence(soma, node) {
  if (!node || !soma || soma.id !== node.node_id ||
      soma.schema !== "soma.object.v0") return null;
  const attrs = soma.attributes || {};
  function metric(key) {
    const a = attrs[key];
    if (!a || a.source !== node.node_id || a.quality !== "measured" ||
        typeof a.value !== "number" || !Number.isFinite(a.value) ||
        a.value < 0) return null;
    return { value: a.value, unit: bounded(a.unit, 20),
      observed_at: bounded(a.observed_at, 40) };
  }
  return {
    schema: "inseme.nasa.local_compute_evidence.v1",
    observer_node_id: bounded(node.node_id, 120),
    // Raw load averages and memory observations are NOT an estimate
    // of queue delay, inference throughput or packet-specific capacity.
    cpu_load_1m: metric("system.cpu.load1"),
    cpu_load_5m: metric("system.cpu.load5"),
    memory_total: metric("system.memory.total"),
    memory_free: metric("system.memory.free"),
    memory_used_percent: metric("system.memory.used_percent"),
    compute_slots: null,
    packet_service_rate: null,
    predicted_queue_delay_ms: null,
  };
}

export function projectLocalNasaStatus(node, fleet, peers = null, soma = null, now = new Date()) {
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
    neighbors: projectNasaNeighbors(peers, node, fleet, now),
    compute: projectNasaComputeEvidence(soma, node),
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
  const [nodeResult, fleetResult, peerResult, somaResult] = await Promise.allSettled([
    readJson("/node/status"),
    readJson("/cgi-bin/fleet"),
    readJson("/node/peers?fresh=0"),
    readJson("/soma/object"),
  ]);
  const node = nodeResult.status === "fulfilled" ? nodeResult.value : null;
  const fleet = fleetResult.status === "fulfilled" ? fleetResult.value : null;
  const peers = peerResult.status === "fulfilled" ? peerResult.value : null;
  const soma = somaResult.status === "fulfilled" ? somaResult.value : null;
  const full = node && fleet && peers?.node_id === node.node_id && soma?.id === node.node_id;
  return {
    status: full ? "available" : node || fleet ? "degraded" : "unavailable",
    view: projectLocalNasaStatus(node, fleet, peers, soma),
  };
}
