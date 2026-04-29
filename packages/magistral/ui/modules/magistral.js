export function initMagistral(apiEndpoint) {
  const sidebar = `
        <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <h2 class="text-xs font-semibold uppercase tracking-wide text-slate-400">Magistral Status</h2>
            <div class="grid grid-cols-2 gap-3 text-xs">
                <div class="space-y-1">
                    <div class="text-slate-500">Nodes</div>
                    <div id="status-nodes" class="text-sm font-mono text-slate-200">-</div>
                </div>
                <div class="space-y-1">
                    <div class="text-slate-500">Requests</div>
                    <div id="status-requests" class="text-sm font-mono text-slate-200">-</div>
                </div>
            </div>
             <button id="refresh-magistral-btn" class="mt-1 inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-800 transition-colors w-full justify-center">
                <span>Refresh Metrics</span>
            </button>
        </div>
    `;

  const nodesTab = `
        <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <div class="flex items-center justify-between">
                <h2 class="text-xs font-semibold uppercase tracking-wide text-slate-400">Routing Map</h2>
                <div class="flex gap-2">
                    <button id="save-map-btn" class="text-[10px] text-sky-400 hover:text-sky-300">Save Map</button>
                    <button id="refresh-nodes-btn" class="text-[10px] text-slate-500 hover:text-slate-300">Refresh</button>
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left text-[11px]">
                    <thead class="text-slate-500 border-b border-slate-800">
                        <tr>
                            <th class="pb-2 font-medium">ID</th>
                            <th class="pb-2 font-medium">Tier</th>
                            <th class="pb-2 font-medium">Status</th>
                            <th class="pb-2 font-medium">Succ/Req</th>
                            <th class="pb-2 font-medium">Latency</th>
                            <th class="pb-2 font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="metrics-body" class="text-slate-300 divide-y divide-slate-800/50">
                        <tr><td colspan="6" class="py-2 text-center text-slate-600">Loading...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3 mt-4">
            <h2 class="text-xs font-semibold uppercase tracking-wide text-slate-400">Probe Provider</h2>
            <div class="flex gap-2">
                <input type="text" id="probe-url" placeholder="Base URL" class="flex-1 bg-black/40 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300">
                <input type="password" id="probe-key" placeholder="API Key" class="w-24 bg-black/40 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300">
                <button id="probe-btn" class="bg-slate-700 text-slate-200 px-3 py-1 rounded text-xs hover:bg-slate-600">Probe</button>
            </div>
            <div id="probe-results" class="hidden mt-2">
                <table class="w-full text-left text-[11px]">
                    <thead class="text-slate-500 border-b border-slate-800">
                        <tr>
                            <th class="pb-1">Model ID</th>
                            <th class="pb-1">Owner</th>
                            <th class="pb-1">Action</th>
                        </tr>
                    </thead>
                    <tbody id="probe-body" class="text-slate-300 divide-y divide-slate-800/50"></tbody>
                </table>
            </div>
        </div>
    `;

  const logsTab = `
        <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <div class="flex items-center justify-between">
                <h2 class="text-xs font-semibold uppercase tracking-wide text-slate-400">Traffic Logs</h2>
                <div class="flex gap-2">
                    <button id="clear-logs-btn" class="text-[10px] text-red-400 hover:text-red-300">Clear</button>
                    <button id="auto-refresh-logs-btn" class="text-[10px] text-emerald-500">Auto: ON</button>
                </div>
            </div>
            <div class="overflow-x-auto max-h-96 overflow-y-auto">
                <table class="w-full text-left text-[11px]">
                    <thead class="text-slate-500 border-b border-slate-800 sticky top-0 bg-slate-900">
                        <tr>
                            <th class="pb-2 font-medium">Time</th>
                            <th class="pb-2 font-medium">Node</th>
                            <th class="pb-2 font-medium">Status</th>
                            <th class="pb-2 font-medium">Latency</th>
                        </tr>
                    </thead>
                    <tbody id="logs-body" class="text-slate-300 divide-y divide-slate-800/50">
                        <tr><td colspan="4" class="py-2 text-center text-slate-600">No logs</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

  return {
    sidebar: sidebar,
    tabs: [
      { id: "nodes", label: "Nodes", content: nodesTab },
      { id: "logs", label: "Logs", content: logsTab },
    ],
    onLoad: () => setupMagistralLogic(apiEndpoint),
  };
}

function setupMagistralLogic(apiEndpoint) {
  const els = {
    metricsBody: document.getElementById("metrics-body"),
    logsBody: document.getElementById("logs-body"),
    probeUrl: document.getElementById("probe-url"),
    probeKey: document.getElementById("probe-key"),
    probeBtn: document.getElementById("probe-btn"),
    probeResults: document.getElementById("probe-results"),
    probeBody: document.getElementById("probe-body"),
    refreshMetricsBtn: document.getElementById("refresh-magistral-btn"),
    refreshNodesBtn: document.getElementById("refresh-nodes-btn"),
    saveMapBtn: document.getElementById("save-map-btn"),
    clearLogsBtn: document.getElementById("clear-logs-btn"),
    autoRefreshLogsBtn: document.getElementById("auto-refresh-logs-btn"),
    statusNodes: document.getElementById("status-nodes"),
    statusRequests: document.getElementById("status-requests"),
  };

  let autoRefreshTimer = null;
  let isAutoRefresh = true;

  // --- API Helpers ---
  async function apiFetch(path, options = {}) {
    const url = `${apiEndpoint}${path}`;
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }

  // --- Metrics ---
  async function loadMetrics() {
    try {
      const data = await apiFetch("/v1/magistral/metrics");
      const nodes = data.nodes || [];

      // Update Sidebar Status
      els.statusNodes.textContent = nodes.length;
      els.statusRequests.textContent = nodes.reduce((acc, n) => acc + (n.requests || 0), 0);

      // Render Table
      els.metricsBody.innerHTML = nodes
        .map((node) => {
          const isOk = node.status === "active";
          const statusClass = isOk ? "text-emerald-400" : "text-red-400";
          const pct = node.requests > 0 ? Math.round((node.successes / node.requests) * 100) : 0;

          return `
                    <tr class="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td class="py-2 font-mono text-slate-400">${node.id}</td>
                        <td class="py-2"><span class="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 border border-slate-700">${node.tier}</span></td>
                        <td class="py-2 ${statusClass}">${node.status}</td>
                        <td class="py-2 text-slate-400">${node.successes}/${node.requests} (${pct}%)</td>
                        <td class="py-2 font-mono text-slate-400">${node.avgLatencyMs}ms</td>
                        <td class="py-2">
                            ${
                              node.status === "disabled"
                                ? `<button class="text-[10px] text-emerald-400 hover:text-emerald-300" onclick="window.enableNode('${node.id}')">Enable</button>`
                                : `<button class="text-[10px] text-amber-400 hover:text-amber-300" onclick="window.disableNode('${node.id}')">Disable</button>`
                            }
                        </td>
                    </tr>
                `;
        })
        .join("");
    } catch (e) {
      console.error("Metrics Error:", e);
      els.metricsBody.innerHTML = `<tr><td colspan="6" class="py-2 text-center text-red-400">Error loading metrics: ${e.message}</td></tr>`;
    }
  }

  // --- Logs ---
  async function loadLogs() {
    try {
      const data = await apiFetch("/v1/magistral/logs?n=50");
      const logs = data.logs || [];

      if (logs.length === 0) {
        els.logsBody.innerHTML = `<tr><td colspan="4" class="py-2 text-center text-slate-600">No logs</td></tr>`;
        return;
      }

      els.logsBody.innerHTML = logs
        .reverse()
        .map((log) => {
          const date = new Date(log.ts || log.timestamp).toLocaleTimeString();
          const statusColor = log.status === 200 ? "text-emerald-400" : "text-red-400";
          return `
                    <tr class="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td class="py-2 text-slate-500 font-mono text-[10px]">${date}</td>
                        <td class="py-2 font-mono text-slate-300">${log.nodeId || "-"}</td>
                        <td class="py-2 ${statusColor}">${log.status}</td>
                        <td class="py-2 font-mono text-slate-400">${log.latencyMs || log.latency || 0}ms</td>
                    </tr>
                `;
        })
        .join("");
    } catch (e) {
      console.error("Logs Error:", e);
    }
  }

  // --- Probe ---
  async function probeProvider() {
    const baseUrl = els.probeUrl.value;
    const apiKey = els.probeKey.value;
    if (!baseUrl) return alert("Base URL required");

    els.probeBtn.textContent = "Probing...";
    els.probeBtn.disabled = true;

    try {
      const data = await apiFetch("/v1/magistral/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, apiKey }),
      });

      els.probeResults.classList.remove("hidden");
      els.probeBody.innerHTML = (data.data || [])
        .map(
          (m) => `
                <tr class="border-b border-slate-800/50">
                    <td class="py-1 font-mono text-emerald-300">${m.id}</td>
                    <td class="py-1 text-slate-400">${m.owned_by}</td>
                    <td class="py-1">
                        <button class="text-[10px] text-sky-400 hover:text-sky-300" onclick="window.addNode('${m.id}', '${baseUrl}')">Add</button>
                    </td>
                </tr>
            `
        )
        .join("");
    } catch (e) {
      alert("Probe failed: " + e.message);
    } finally {
      els.probeBtn.textContent = "Probe";
      els.probeBtn.disabled = false;
    }
  }

  // --- Global Actions (exposed for inline onclicks) ---
  window.enableNode = async (id) => {
    await apiFetch(`/v1/magistral/nodes/${id}/enable`, { method: "POST" });
    loadMetrics();
  };

  window.disableNode = async (id) => {
    await apiFetch(`/v1/magistral/nodes/${id}/disable`, { method: "POST" });
    loadMetrics();
  };

  window.addNode = async (modelId, baseUrl) => {
    const tier = modelId.includes("8b") || modelId.includes("7b") ? "fast" : "strong";
    const cleanBaseUrl = baseUrl.replace(/\/+$/, "");
    const node = {
      id: modelId,
      url: cleanBaseUrl.endsWith("/chat/completions")
        ? cleanBaseUrl
        : `${cleanBaseUrl}/chat/completions`,
      model: modelId,
      tier: tier,
      weight: 10,
    };

    try {
      await apiFetch("/v1/magistral/map/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(node),
      });
      alert(`Node ${modelId} added!`);
      loadMetrics();
    } catch (e) {
      alert("Failed to add node: " + e.message);
    }
  };

  // --- Event Listeners ---
  if (els.refreshMetricsBtn) els.refreshMetricsBtn.addEventListener("click", loadMetrics);
  if (els.refreshNodesBtn) els.refreshNodesBtn.addEventListener("click", loadMetrics);
  if (els.probeBtn) els.probeBtn.addEventListener("click", probeProvider);

  if (els.saveMapBtn)
    els.saveMapBtn.addEventListener("click", async () => {
      try {
        await apiFetch("/v1/magistral/map/save", { method: "POST" });
        alert("Map saved successfully");
      } catch (e) {
        alert("Save failed: " + e.message);
      }
    });

  if (els.clearLogsBtn)
    els.clearLogsBtn.addEventListener("click", async () => {
      await apiFetch("/v1/magistral/logs", { method: "DELETE" });
      loadLogs();
    });

  if (els.autoRefreshLogsBtn)
    els.autoRefreshLogsBtn.addEventListener("click", () => {
      isAutoRefresh = !isAutoRefresh;
      els.autoRefreshLogsBtn.textContent = isAutoRefresh ? "Auto: ON" : "Auto: OFF";
      els.autoRefreshLogsBtn.className = isAutoRefresh
        ? "text-[10px] text-emerald-500"
        : "text-[10px] text-slate-500";
    });

  // Auto Refresh Loop
  setInterval(() => {
    if (document.getElementById("nodes").classList.contains("active")) {
      loadMetrics();
    }
    if (document.getElementById("logs").classList.contains("active") && isAutoRefresh) {
      loadLogs();
    }
  }, 2000);

  // Initial Load
  loadMetrics();
}
