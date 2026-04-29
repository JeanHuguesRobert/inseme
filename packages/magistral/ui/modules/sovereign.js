export function initSovereign(apiEndpoint) {
  const sidebar = `
        <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3 mb-4">
            <h2 class="text-xs font-semibold uppercase tracking-wide text-slate-400">Sovereign Status</h2>
            <div class="grid grid-cols-2 gap-3 text-xs">
                <div class="space-y-1">
                    <div class="text-slate-500">LLM backend</div>
                    <div id="status-llm" class="text-sm font-mono text-slate-200">-</div>
                </div>
                <div class="space-y-1">
                    <div class="text-slate-500">TTS</div>
                    <div id="status-tts" class="text-sm font-mono text-slate-200">-</div>
                </div>
            </div>
            <button id="refresh-btn" class="mt-1 inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-800 transition-colors w-full justify-center">
                <span>Refresh Status</span>
            </button>
        </div>
    `;

  const playgroundTab = `
        <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <div class="flex items-center justify-between gap-2">
                <h2 class="text-xs font-semibold uppercase tracking-wide text-slate-400">Quick LLM Check</h2>
                <button id="run-llm-btn" class="inline-flex items-center gap-1 rounded-md border border-emerald-500/60 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-colors">
                    <span>Ask</span>
                </button>
            </div>
            <textarea id="llm-input" class="mt-1 w-full rounded-md border border-slate-700 bg-black/40 px-2 py-2 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-emerald-500" rows="3">Explain in one sentence what this local AI service does.</textarea>
            <pre id="llm-output" class="mt-2 h-32 overflow-auto rounded-md border border-slate-800 bg-black/60 p-2 text-[11px] text-slate-100 font-mono whitespace-pre-wrap"></pre>
        </div>

        <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3 mt-4">
            <div class="flex items-center justify-between gap-2">
                <h2 class="text-xs font-semibold uppercase tracking-wide text-slate-400">Talk</h2>
                <div class="flex items-center gap-2">
                    <select id="voice-select" class="h-6 rounded border border-slate-700 bg-black/40 px-2 text-[10px] text-slate-300 outline-none focus:border-slate-500">
                        <option value="af_bella">af_bella</option>
                        <option value="af_sarah">af_sarah</option>
                    </select>
                    <button id="run-tts-btn" class="inline-flex items-center gap-1 rounded-md border border-sky-500/60 bg-sky-500/10 px-3 py-1 text-[11px] font-semibold text-sky-300 hover:bg-sky-500/20 transition-colors">
                        <span>Speak</span>
                    </button>
                </div>
            </div>
            <div id="tts-status" class="text-[11px] text-slate-400 h-4"></div>
            <div class="mt-2 flex items-center gap-2">
                <audio id="tts-audio" class="w-full h-8" controls></audio>
            </div>
        </div>
    `;

  return {
    sidebar: sidebar,
    tabs: [{ id: "playground", label: "Playground", content: playgroundTab }],
    onLoad: () => setupSovereignLogic(apiEndpoint),
  };
}

function setupSovereignLogic(apiEndpoint) {
  // Elements
  const els = {
    llmInput: document.getElementById("llm-input"),
    llmOutput: document.getElementById("llm-output"),
    runLlmBtn: document.getElementById("run-llm-btn"),
    runTtsBtn: document.getElementById("run-tts-btn"),
    voiceSelect: document.getElementById("voice-select"),
    ttsStatus: document.getElementById("tts-status"),
    ttsAudio: document.getElementById("tts-audio"),
    statusLlm: document.getElementById("status-llm"),
    statusTts: document.getElementById("status-tts"),
    refreshBtn: document.getElementById("refresh-btn"),
  };

  // Helper: API Fetch
  async function apiFetch(path, options = {}) {
    const url = `${apiEndpoint}${path}`;
    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.error(`API Error ${path}:`, e);
      throw e;
    }
  }

  // Status Check
  async function checkStatus() {
    try {
      const data = await apiFetch("/health");
      els.statusLlm.textContent = data.llm ? "Online" : "Offline";
      els.statusLlm.className = data.llm
        ? "text-sm font-mono text-emerald-400"
        : "text-sm font-mono text-red-400";

      els.statusTts.textContent = data.tts ? "Online" : "Offline";
      els.statusTts.className = data.tts
        ? "text-sm font-mono text-emerald-400"
        : "text-sm font-mono text-red-400";
    } catch (e) {
      els.statusLlm.textContent = "Error";
      els.statusTts.textContent = "Error";
    }
  }

  // LLM Chat
  async function runLlm() {
    const prompt = els.llmInput.value.trim();
    if (!prompt) return;

    els.runLlmBtn.disabled = true;
    els.runLlmBtn.textContent = "Thinking...";
    els.llmOutput.textContent = "";

    try {
      const res = await fetch(`${apiEndpoint}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "sovereign", // Or whatever default
          messages: [{ role: "user", content: prompt }],
          stream: false,
        }),
      });

      const data = await res.json();
      if (data.choices && data.choices[0]) {
        els.llmOutput.textContent = data.choices[0].message.content;
      } else {
        els.llmOutput.textContent = JSON.stringify(data, null, 2);
      }
    } catch (e) {
      els.llmOutput.textContent = `Error: ${e.message}`;
    } finally {
      els.runLlmBtn.disabled = false;
      els.runLlmBtn.textContent = "Ask";
    }
  }

  // TTS Generation
  async function runTts() {
    const text = els.llmInput.value.trim(); // Reuse input for TTS demo
    const voice = els.voiceSelect.value;
    if (!text) return;

    els.runTtsBtn.disabled = true;
    els.ttsStatus.textContent = "Generating audio...";

    try {
      const res = await fetch(`${apiEndpoint}/v1/audio/speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: text,
          voice: voice,
          speed: 1.0,
        }),
      });

      if (!res.ok) throw new Error(`TTS Error ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      els.ttsAudio.src = url;
      els.ttsAudio.play();
      els.ttsStatus.textContent = "Playing...";
    } catch (e) {
      els.ttsStatus.textContent = `Error: ${e.message}`;
    } finally {
      els.runTtsBtn.disabled = false;
    }
  }

  // Event Listeners
  if (els.refreshBtn) els.refreshBtn.addEventListener("click", checkStatus);
  if (els.runLlmBtn) els.runLlmBtn.addEventListener("click", runLlm);
  if (els.runTtsBtn) els.runTtsBtn.addEventListener("click", runTts);

  // Initial Check
  checkStatus();
}
