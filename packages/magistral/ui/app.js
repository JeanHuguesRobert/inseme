import { initSovereign } from "./modules/sovereign.js";
import { initMagistral } from "./modules/magistral.js";

// Configuration
const STATE = {
  apiEndpoint: localStorage.getItem("inseme_api_endpoint") || window.location.origin,
  modules: [],
  activeTab: null,
};

// DOM Elements
const els = {
  statusPill: document.getElementById("status-pill"),
  statusText: document.getElementById("status-text"),
  statusDot: document.getElementById("status-dot"),
  statusPing: document.getElementById("status-ping"),
  sidebar: document.getElementById("sidebar-container"),
  tabsNav: document.getElementById("tabs-nav"),
  tabsContent: document.getElementById("tabs-content"),
  apiInput: document.getElementById("api-endpoint"),
  saveEndpointBtn: document.getElementById("save-endpoint"),
};

// Initialize
async function init() {
  console.log("[App] Initializing with endpoint:", STATE.apiEndpoint);
  els.apiInput.value = STATE.apiEndpoint;

  // Event Listeners
  els.saveEndpointBtn.addEventListener("click", () => {
    const newEndpoint = els.apiInput.value.replace(/\/$/, "");
    localStorage.setItem("inseme_api_endpoint", newEndpoint);
    window.location.reload();
  });

  // Check Connectivity & Detect Features
  const features = await detectFeatures();
  updateStatus(features.online);

  // Load Modules based on features
  const modulesToLoad = [];

  // Always try to load Sovereign if we detect it or if we are just generic
  if (features.sovereign || features.online) {
    modulesToLoad.push(initSovereign(STATE.apiEndpoint));
  }

  // Always try to load Magistral if we detect it
  if (features.magistral) {
    modulesToLoad.push(initMagistral(STATE.apiEndpoint));
  } else if (!features.sovereign && features.online) {
    // If online but not sovereign, maybe it's just magistral without explicit flag?
    // Let's try loading magistral anyway if sovereign failed
    modulesToLoad.push(initMagistral(STATE.apiEndpoint));
  }

  // Render Modules
  renderModules(modulesToLoad);
}

async function detectFeatures() {
  const result = { online: false, sovereign: false, magistral: false };

  try {
    // Check Sovereign Health
    const healthRes = await fetch(`${STATE.apiEndpoint}/health`).catch(() => null);
    if (healthRes && healthRes.ok) {
      result.online = true;
      result.sovereign = true;
      const data = await healthRes.json();
      console.log("[App] Detected Sovereign:", data);
    }

    // Check Magistral Metrics (works on both Deno and Node.js embedded)
    const magRes = await fetch(`${STATE.apiEndpoint}/v1/magistral/metrics`).catch(() => null);
    if (magRes && magRes.ok) {
      result.online = true;
      result.magistral = true;
      console.log("[App] Detected Magistral");
    }

    // Check Deno Root (if /health failed but /v1/models works, might be Deno)
    if (!result.online) {
      const modelsRes = await fetch(`${STATE.apiEndpoint}/v1/models`).catch(() => null);
      if (modelsRes && modelsRes.ok) {
        result.online = true;
        // If we have models but no health, likely Magistral Deno
        if (!result.magistral) {
          // Double check magistral capability
          result.magistral = true;
        }
      }
    }
  } catch (e) {
    console.warn("[App] Detection failed:", e);
  }

  return result;
}

function updateStatus(online) {
  if (online) {
    els.statusText.textContent = "Connected";
    els.statusText.className = "font-medium text-emerald-400";
    els.statusDot.className = "relative inline-flex h-2 w-2 rounded-full bg-emerald-400";
    els.statusPing.className =
      "absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50 animate-ping";
  } else {
    els.statusText.textContent = "Disconnected";
    els.statusText.className = "font-medium text-red-400";
    els.statusDot.className = "relative inline-flex h-2 w-2 rounded-full bg-red-400";
    els.statusPing.className = "hidden";
  }
}

function renderModules(modules) {
  // 1. Render Sidebars
  modules.forEach((m) => {
    if (m.sidebar) {
      const div = document.createElement("div");
      div.innerHTML = m.sidebar;
      // Execute sidebar scripts/handlers if any
      els.sidebar.appendChild(div);
    }
  });

  // 2. Render Tabs
  let firstTab = true;
  modules.forEach((m) => {
    if (m.tabs) {
      m.tabs.forEach((tab) => {
        // Tab Button
        const btn = document.createElement("button");
        btn.className = `tab-btn px-3 py-1 text-xs font-medium rounded-md transition-colors ${firstTab ? "active" : ""}`;
        btn.textContent = tab.label;
        btn.dataset.target = tab.id;
        btn.onclick = () => window.switchTab(tab.id);
        els.tabsNav.appendChild(btn);

        // Tab Content
        const content = document.createElement("div");
        content.id = tab.id;
        content.className = `view-content ${firstTab ? "active" : ""}`;
        content.innerHTML = tab.content;
        els.tabsContent.appendChild(content);

        firstTab = false;
      });
    }
  });

  // 3. Post-Render Initialization
  modules.forEach((m) => {
    if (m.onLoad) m.onLoad();
  });
}

window.switchTab = function (tabId) {
  STATE.activeTab = tabId;
  // Update Buttons
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    if (btn.dataset.target === tabId) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // Update Content
  document.querySelectorAll(".view-content").forEach((content) => {
    if (content.id === tabId) {
      content.classList.add("active");
      // Trigger specific load events if needed
      const event = new CustomEvent("tab-changed", { detail: { tabId } });
      window.dispatchEvent(event);
    } else {
      content.classList.remove("active");
    }
  });
};

// Start
init();
