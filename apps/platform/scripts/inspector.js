let requests = [];
let selectedId = null;
let filter = "";
let sidebarFilterType = "all"; // all, source, destination
let sidebarFilterValue = "all";
let showIncoming = true;
let showOutgoing = true;
let isTunnelRunning = true;
let isProxyEnabled = true;
let debugLogs = [];
let debugModeActive = false;
const terminalOutputEl = document.getElementById("terminal-output");
const terminalInputEl = document.getElementById("terminal-input");
const opheliaOutputEl = document.getElementById("ophelia-output");
const opheliaInputEl = document.getElementById("ophelia-input");

let currentView = "traffic"; // traffic, debug, terminal, ophelia
let opheliaHistory = [];

const listEl = document.getElementById("request-list");
const searchInput = document.getElementById("search");

// SSE Setup
const evtSource = new EventSource("/__inspector/events");
evtSource.onmessage = (event) => {
  const data = JSON.parse(event.data);

  // Handle status updates
  if (data.type === "status") {
    updateTargetStatus(
      data.online,
      data.url,
      data.debug,
      data.port,
      data.proxyPort,
      data.supervision,
      data.isNodemon,
      data.localIp
    );
    return;
  }

  // Handle stats updates
  if (data.type === "stats") {
    updateStats(data.stats);
    return;
  }

  // Handle debug logs
  if (data.type === "debug") {
    addDebugLog(data);
    return;
  }

  // Handle terminal output
  if (data.type === "terminal") {
    appendTerminalOutput(data);
    return;
  }

  // Handle traffic logs
  if (!requests.find((r) => r.id === data.id)) {
    requests.unshift(data);
    if (requests.length > 100) requests.pop();
    render();
  }
};

function ansiToHtml(text) {
  if (!text) return "";

  // Basic ANSI color support
  const colors = {
    0: "text-gray-300", // Reset
    30: "text-gray-900", // Black
    31: "text-red-500", // Red
    32: "text-green-500", // Green
    33: "text-yellow-500", // Yellow
    34: "text-blue-500", // Blue
    35: "text-purple-500", // Magenta
    36: "text-cyan-500", // Cyan
    37: "text-white", // White
    90: "text-gray-500", // Bright Black (Gray)
  };

  let result = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Replace ANSI escape codes with spans
  // Match \x1b[XXm or \x1b[Xm
  result = result.replace(/\x1b\[(\d+)(;\d+)?m/g, (match, code) => {
    const cls = colors[code];
    if (code === "0") return "</span>";
    if (cls) return `</span><span class="${cls}">`;
    return ""; // Ignore unknown codes
  });

  return result;
}

function appendTerminalOutput(data) {
  if (!terminalOutputEl) return;
  const div = document.createElement("div");
  div.className = "inline";

  const html = ansiToHtml(data.message);
  div.innerHTML = html;

  if (data.source === "stderr") div.className += " text-red-400";
  if (data.source === "system") div.className += " text-yellow-400 italic";

  terminalOutputEl.appendChild(div);
  terminalOutputEl.scrollTop = terminalOutputEl.scrollHeight;

  // Show terminal tab in sidebar if we get output
  const sbTerminal = document.getElementById("sb-terminal");
  if (sbTerminal) sbTerminal.classList.remove("hidden");
}

async function handleTerminalKey(e) {
  if (e.key === "Enter") {
    const command = terminalInputEl.value.trim();
    if (!command) return;

    terminalInputEl.value = "";
    // Echo command to terminal
    appendTerminalOutput({ message: `\n$ ${command}\n`, source: "system" });

    try {
      await fetch("/__inspector/terminal-input", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ command }),
      });
    } catch (err) {
      appendTerminalOutput({ message: `Error: ${err.message}\n`, source: "stderr" });
    }
  }
}

function clearTerminal() {
  if (terminalOutputEl) terminalOutputEl.innerHTML = "";
}

async function handleOpheliaKey(e) {
  if (e.key === "Enter") {
    const question = opheliaInputEl.value.trim();
    if (!question) return;

    opheliaInputEl.value = "";
    opheliaInputEl.disabled = true;

    // Echo question
    const qDiv = document.createElement("div");
    qDiv.className = "text-white mt-4 mb-2";
    qDiv.innerText = `>> ${question}`;
    opheliaOutputEl.appendChild(qDiv);
    opheliaOutputEl.scrollTop = opheliaOutputEl.scrollHeight;

    const responseDiv = document.createElement("div");
    responseDiv.className = "text-green-400";
    opheliaOutputEl.appendChild(responseDiv);

    try {
      const response = await fetch("/__inspector/ophelia-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ question, history: opheliaHistory }),
      });

      if (!response.ok) throw new Error(await response.text());

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        // Filter out tool traces if any
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("__TOOL_TRACE__")) continue;
          if (line.trim()) {
            responseDiv.innerText += line + "\n";
            fullResponse += line + "\n";
            opheliaOutputEl.scrollTop = opheliaOutputEl.scrollHeight;
          }
        }
      }

      opheliaHistory.push({ role: "user", content: question });
      opheliaHistory.push({ role: "assistant", content: fullResponse });
      if (opheliaHistory.length > 20) opheliaHistory.shift();
    } catch (err) {
      const errDiv = document.createElement("div");
      errDiv.className = "text-red-500 italic mt-2";
      errDiv.innerText = `Error: ${err.message}`;
      opheliaOutputEl.appendChild(errDiv);
    } finally {
      opheliaInputEl.disabled = false;
      opheliaInputEl.focus();
    }
  }
}

function clearOphelia() {
  opheliaHistory = [];
  opheliaOutputEl.innerHTML = `
    <div class="text-green-600 mb-4 opacity-80">
*** OPHÉLIA CIVIC SYSTEM v3.0 ***
Connection established via local tunnel.
Ready for civic interaction.
---------------------------------
    </div>
  `;
}

function updateStats(stats) {
  document.getElementById("stat-in").innerText = stats.in_count;
  document.getElementById("stat-out").innerText = stats.out_count;
  document.getElementById("stat-errors").innerText = stats.error_count;

  const totalBytes = stats.bytes_in + stats.bytes_out;
  document.getElementById("stat-data").innerText = formatBytes(totalBytes);

  const sinceDate = new Date(stats.since).toLocaleTimeString();
  document.getElementById("stat-since").innerText = "Depuis : " + sinceDate;
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function updateTargetStatus(online, url, debug, port, proxyPort, supervision, isNodemon, localIp) {
  const badge = document.getElementById("target-badge");
  const text = document.getElementById("target-status-text");
  const link = document.getElementById("target-url-link");
  const urlText = document.getElementById("target-url-text");
  const debugBtn = document.getElementById("sb-debug");
  const portText = document.getElementById("target-port-text");
  const proxyPortText = document.getElementById("proxy-port-text");
  const ngrokLinks = document.getElementById("ngrok-links");
  const nodemonWarning = document.getElementById("nodemon-warning");
  const localIpText = document.getElementById("local-ip-text");

  if (localIp && localIpText) {
    localIpText.innerText = localIp;
  }

  if (supervision) {
    isTunnelRunning = supervision.isTunnelRunning !== false;
    isProxyEnabled = supervision.isProxyEnabled !== false;

    updateButtonUI("in", isTunnelRunning);
    updateButtonUI("out", isProxyEnabled);
  }

  if (port) portText.innerText = `:${port}`;
  if (proxyPort) proxyPortText.innerText = proxyPort;

  // Nodemon detection
  if (isNodemon === false) {
    nodemonWarning.classList.remove("hidden");
  } else {
    nodemonWarning.classList.add("hidden");
  }

  if (supervision && supervision.ngrok_local) {
    ngrokLinks.classList.remove("hidden");
  } else {
    ngrokLinks.classList.add("hidden");
  }

  if (debug !== undefined) {
    debugModeActive = debug;
    if (debug) {
      debugBtn.classList.remove("hidden");
    } else {
      debugBtn.classList.add("hidden");
      if (currentView === "debug") showTraffic();
    }
  }

  if (online) {
    badge.className =
      "flex items-center gap-2 bg-green-100 text-green-700 px-2 py-1 rounded border border-green-200";
    text.innerText = "ONLINE";

    if (url) {
      link.href = url;
      urlText.innerText = url.replace(/^https?:\/\//, "");
      link.classList.remove("hidden");
    } else {
      link.classList.add("hidden");
    }
  } else {
    badge.className =
      "flex items-center gap-2 bg-red-100 text-red-700 px-2 py-1 rounded border border-red-200";
    text.innerText = "OFFLINE";
    link.classList.add("hidden");
  }
}

searchInput.addEventListener("input", (e) => {
  filter = e.target.value.toLowerCase();
  render();
});

function setSidebarFilter(type, value) {
  if (currentView !== "traffic") {
    showTraffic();
  }
  sidebarFilterType = type;
  sidebarFilterValue = value;
  render();
}

function render() {
  // Update sidebar aggregators first
  updateSidebar();

  // Apply general search filter
  let filtered = requests.filter(
    (r) =>
      r.url.toLowerCase().includes(filter.toLowerCase()) ||
      r.method.toLowerCase().includes(filter.toLowerCase())
  );

  // Apply sidebar filters (Source/Destination)
  if (sidebarFilterType === "problems") {
    filtered = filtered.filter((r) => r.status !== 200);
  } else if (sidebarFilterType === "source") {
    filtered = filtered.filter(
      (r) => r.direction === "in" && getSourceLabel(r) === sidebarFilterValue
    );
  } else if (sidebarFilterType === "destination") {
    filtered = filtered.filter(
      (r) => r.direction === "out" && getDestinationLabel(r) === sidebarFilterValue
    );
  }

  listEl.innerHTML = "";
  filtered.forEach((r) => {
    const dirClass =
      r.direction === "out" ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600";
    const dirLabel = r.direction === "out" ? "OUT" : "IN";
    const statusColor = getStatusColor(r.status);
    const timeStr = new Date(r.timestamp).toLocaleTimeString();
    const selectedClass = selectedId === r.id ? "selected" : "";

    // Extract domain for outgoing
    let displayUrl = r.url.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    if (r.direction === "out") {
      try {
        const u = new URL(r.url);
        displayUrl =
          '<span class="text-purple-700 font-black">' +
          u.hostname +
          "</span>" +
          u.pathname.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") +
          u.search.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      } catch (e) {}
    }

    const div = document.createElement("div");
    div.className =
      "req-row p-3 border-b border-gray-100 cursor-pointer transition-all " + selectedClass;
    div.onclick = () => selectRequest(r.id);
    div.innerHTML =
      '<div class="flex justify-between items-center mb-1">' +
      '<div class="flex items-center gap-2">' +
      '<span class="text-[10px] font-black px-1 rounded ' +
      dirClass +
      '">' +
      dirLabel +
      "</span>" +
      '<span class="text-[10px] text-gray-400">' +
      timeStr +
      "</span>" +
      "</div>" +
      '<span class="text-[10px] font-bold ' +
      statusColor +
      '">' +
      r.status +
      "</span>" +
      "</div>" +
      '<div class="flex items-center gap-2">' +
      '<span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">' +
      r.method +
      "</span>" +
      '<span class="text-xs font-bold truncate flex-1 text-gray-700">' +
      displayUrl +
      "</span>" +
      '<span class="text-[10px] text-gray-400">' +
      r.duration +
      "ms</span>" +
      "</div>";
    listEl.appendChild(div);
  });

  lucide.createIcons();
}

async function launchProxiedBrowser() {
  try {
    await fetch("/__inspector/launch-browser");
  } catch (err) {
    console.error("Failed to launch browser:", err);
  }
}

function updateButtonUI(direction, active) {
  const btn = document.getElementById(`toggle-${direction}`);
  if (!btn) return;

  if (direction === "in") {
    if (active) {
      btn.className =
        "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all border border-blue-800/50 bg-blue-600/20 text-blue-400 hover:bg-blue-600/40";
    } else {
      btn.className =
        "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all border border-gray-800/50 bg-gray-800/20 text-gray-500 hover:bg-gray-800/40 grayscale";
    }
  } else {
    if (active) {
      btn.className =
        "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all border border-purple-800/50 bg-purple-600/20 text-purple-400 hover:bg-purple-600/40";
    } else {
      btn.className =
        "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all border border-gray-800/50 bg-gray-800/20 text-gray-500 hover:bg-gray-800/40 grayscale";
    }
  }
}

async function toggleFlow(direction) {
  if (direction === "in") {
    try {
      await fetch("/__inspector/toggle-in");
    } catch (err) {
      console.error("Failed to toggle tunnel:", err);
    }
  } else {
    try {
      await fetch("/__inspector/toggle-out");
    } catch (err) {
      console.error("Failed to toggle proxy:", err);
    }
  }
}

function getSourceLabel(r) {
  if (r.direction === "out") return null;
  const forwarded = r.req_headers["x-forwarded-for"];
  return forwarded ? forwarded.split(",")[0].trim() : "Tunnel";
}

function getDestinationLabel(r) {
  if (r.direction === "in") return null;
  try {
    return new URL(r.url).hostname;
  } catch (e) {
    return "Unknown";
  }
}

function updateSidebar() {
  const sources = {};
  const destinations = {};
  let problemCount = 0;

  requests.forEach((r) => {
    if (r.status !== 200) problemCount++;

    if (r.direction === "in") {
      const s = getSourceLabel(r);
      sources[s] = (sources[s] || 0) + 1;
    } else {
      const d = getDestinationLabel(r);
      destinations[d] = (destinations[d] || 0) + 1;
    }
  });

  document.getElementById("count-all").innerText = requests.length;
  document.getElementById("sb-all").className =
    `sidebar-item w-full text-left px-3 py-2 rounded text-xs flex justify-between items-center transition-all ${sidebarFilterType === "all" ? "active" : ""}`;

  const probEl = document.getElementById("sb-problems");
  probEl.className = `sidebar-item w-full text-left px-3 py-2 rounded text-xs flex justify-between items-center transition-all text-red-600 hover:bg-red-50 ${sidebarFilterType === "problems" ? "active bg-red-50 font-bold" : ""}`;
  document.getElementById("count-problems").innerText = problemCount;
  document.getElementById("count-problems").style.display =
    problemCount > 0 ? "inline-block" : "none";

  // Render Sources
  const srcList = document.getElementById("sources-list");
  srcList.innerHTML = "";
  Object.entries(sources)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, count]) => {
      const active = sidebarFilterType === "source" && sidebarFilterValue === name;
      const btn = document.createElement("button");
      btn.onclick = () => setSidebarFilter("source", name);
      btn.className = `sidebar-item w-full text-left px-3 py-1.5 rounded text-[10px] flex justify-between items-center transition-all ${active ? "active" : ""}`;
      btn.innerHTML = `<span class="truncate pr-2">${name}</span> <span class="opacity-50">${count}</span>`;
      srcList.appendChild(btn);
    });

  // Render Destinations
  const destList = document.getElementById("destinations-list");
  destList.innerHTML = "";
  Object.entries(destinations)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, count]) => {
      const active = sidebarFilterType === "destination" && sidebarFilterValue === name;
      const btn = document.createElement("button");
      btn.onclick = () => setSidebarFilter("destination", name);
      btn.className = `sidebar-item w-full text-left px-3 py-1.5 rounded text-[10px] flex justify-between items-center transition-all ${active ? "active" : ""}`;
      btn.innerHTML = `<span class="truncate pr-2">${name}</span> <span class="opacity-50">${count}</span>`;
      destList.appendChild(btn);
    });
}

function selectRequest(id) {
  selectedId = id;
  const r = requests.find((req) => req.id === id);
  if (!r) return;

  document.getElementById("empty-details").classList.add("hidden");
  document.getElementById("details-panel").classList.remove("hidden");

  document.getElementById("det-url").innerText = r.url;
  document.getElementById("det-method").innerText = r.method;
  document.getElementById("det-status").innerText = r.status;

  const statusColor = getStatusColor(r.status);
  document.getElementById("det-status").className =
    "px-2 py-0.5 rounded text-xs font-bold " + statusColor + " bg-white border";
  document.getElementById("det-duration").innerText = r.duration + "ms";

  // Add direction indicator in details
  const dirLabel = r.direction === "out" ? "OUTGOING (APP -> API)" : "INCOMING (TUNNEL -> APP)";
  const dirClass =
    r.direction === "out" ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600";

  const urlEl = document.getElementById("det-url");
  urlEl.innerHTML = "";
  const badge = document.createElement("span");
  badge.className = "px-2 py-0.5 rounded text-[10px] font-black mb-2 inline-block " + dirClass;
  badge.innerText = dirLabel;
  urlEl.appendChild(badge);
  urlEl.appendChild(document.createElement("br"));
  const urlText = document.createElement("span");
  urlText.className = "text-sm font-mono";
  urlText.innerText = r.url;
  urlEl.appendChild(urlText);

  renderHeaders("det-req-headers", r.req_headers);
  renderHeaders("det-res-headers", r.res_headers);

  render();
}

function renderHeaders(elId, headers) {
  const el = document.getElementById(elId);
  if (!headers) {
    el.innerHTML = '<div class="text-gray-400 italic">Aucun header</div>';
    return;
  }

  let html = "";
  for (const [k, v] of Object.entries(headers)) {
    html +=
      '<div class="flex border-b border-gray-50 py-1 last:border-0">' +
      '<span class="font-bold text-blue-600 min-w-[120px]">' +
      k +
      ":</span>" +
      '<span class="text-gray-600 break-all ml-2">' +
      String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") +
      "</span>" +
      "</div>";
  }
  el.innerHTML = html || '<div class="text-gray-400 italic">Aucun header</div>';
}

function getStatusColor(s) {
  if (s >= 500) return "text-red-600";
  if (s >= 400) return "text-orange-500";
  if (s >= 300) return "text-blue-500";
  if (s >= 200) return "text-green-600";
  return "text-gray-600";
}

function closeDetails() {
  selectedId = null;
  document.getElementById("empty-details").classList.remove("hidden");
  document.getElementById("details-panel").classList.add("hidden");
  render();
}

async function clearHistory() {
  try {
    await fetch("/__inspector/reset");
    requests = [];
    closeDetails();
    render();
  } catch (e) {
    alert("Erreur lors de la remise à zéro.");
  }
}

async function stopTunnel(event) {
  try {
    const btn = event.currentTarget;
    btn.disabled = true;
    btn.innerHTML = "<span>STOPPING...</span>";

    // On envoie le signal de sortie
    await fetch("/__exit").catch(() => {});

    // Message de fermeture
    const statusBadge = document.getElementById("target-status-text");
    if (statusBadge) {
      statusBadge.innerText = "TUNNEL STOPPED";
      statusBadge.parentElement.className =
        "flex items-center gap-2 bg-gray-100 text-gray-700 px-2 py-1 rounded border border-gray-200";
    }

    // On désactive l'interface après un court délai
    setTimeout(() => {
      document.body.style.opacity = "0.5";
      document.body.style.pointerEvents = "none";
    }, 1000);
  } catch (e) {
    console.error("Erreur stop:", e);
  }
}

async function restartTunnel(event) {
  try {
    const btn = event.currentTarget;
    btn.disabled = true;
    btn.innerHTML = "<span>RESTARTING...</span>";

    // On envoie le signal de sortie avec restart=true
    await fetch("/__exit?restart=true").catch(() => {});

    // Fonction de vérification de la disponibilité du serveur
    const checkAvailability = async () => {
      try {
        // On utilise /__proxy_status qui est un endpoint JSON simple et rapide
        const res = await fetch("/__proxy_status");
        if (res.ok) {
          console.log("Serveur détecté, rechargement...");
          window.location.reload();
        } else {
          setTimeout(checkAvailability, 1000);
        }
      } catch (e) {
        // Si le serveur ne répond pas (encore éteint), on attend
        setTimeout(checkAvailability, 1000);
      }
    };

    // On commence à vérifier après 3 secondes (temps moyen de restart)
    setTimeout(checkAvailability, 3000);

    // Message d'attente
    const statusBadge = document.getElementById("target-status-text");
    if (statusBadge) {
      statusBadge.innerText = "WAITING FOR SERVER...";
      statusBadge.parentElement.className =
        "flex items-center gap-2 bg-yellow-100 text-yellow-700 px-2 py-1 rounded border border-yellow-200";
    }
  } catch (e) {
    console.error("Erreur restart:", e);
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }
}

function addDebugLog(data) {
  debugLogs.push(data);
  if (debugLogs.length > 500) debugLogs.shift();

  document.getElementById("count-debug").innerText = debugLogs.length;

  if (currentView === "debug") {
    renderDebugLog(data);
  }
}

function renderDebugLog(data) {
  const container = document.getElementById("debug-logs");
  const row = document.createElement("div");
  row.className = "flex gap-2 hover:bg-gray-800 p-0.5 rounded transition-colors";

  const time = new Date(data.timestamp).toLocaleTimeString();
  const context = data.context ? `[${data.context}]` : "";

  row.innerHTML = `
    <span class="text-gray-600 shrink-0">${time}</span>
    <span class="text-blue-500 font-bold shrink-0 w-24">${context}</span>
    <span class="text-gray-300 break-all">${data.message}</span>
  `;

  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
}

function showTerminal() {
  currentView = "terminal";
  document.getElementById("request-list-container").classList.add("hidden");
  document.getElementById("debug-panel").classList.add("hidden");
  document.getElementById("terminal-panel").classList.remove("hidden");
  document.getElementById("ophelia-panel")?.classList.add("hidden");

  document.querySelectorAll(".sidebar-item").forEach((el) => el.classList.remove("active"));
  document.getElementById("sb-terminal")?.classList.add("active");

  setTimeout(() => {
    document.getElementById("terminal-input")?.focus();
  }, 100);
}

function showTraffic() {
  currentView = "traffic";
  document.getElementById("request-list-container").classList.remove("hidden");
  document.getElementById("debug-panel").classList.add("hidden");
  document.getElementById("terminal-panel").classList.add("hidden");
  document.getElementById("ophelia-panel")?.classList.add("hidden");

  render();
}

function showDebugLogs() {
  currentView = "debug";
  document.getElementById("request-list-container").classList.add("hidden");
  document.getElementById("debug-panel").classList.remove("hidden");
  document.getElementById("terminal-panel").classList.add("hidden");
  document.getElementById("ophelia-panel")?.classList.add("hidden");

  document.querySelectorAll(".sidebar-item").forEach((el) => el.classList.remove("active"));
  document.getElementById("sb-debug")?.classList.add("active");
}

function showOphelia() {
  currentView = "ophelia";
  document.getElementById("request-list-container").classList.add("hidden");
  document.getElementById("debug-panel").classList.add("hidden");
  document.getElementById("terminal-panel").classList.add("hidden");
  document.getElementById("ophelia-panel")?.classList.remove("hidden");

  document.querySelectorAll(".sidebar-item").forEach((el) => el.classList.remove("active"));
  document.getElementById("sb-ophelia")?.classList.add("active");

  setTimeout(() => {
    document.getElementById("ophelia-input")?.focus();
  }, 100);
}

function clearDebugLogs() {
  debugLogs = [];
  document.getElementById("count-debug").innerText = "0";
  document.getElementById("debug-logs").innerHTML = "";
}

lucide.createIcons();
