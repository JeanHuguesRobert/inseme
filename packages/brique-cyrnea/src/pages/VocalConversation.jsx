import React, { useState, useEffect, useRef } from "react";
import {
  useInsemeContext,
  useVoiceInterface,
  useVoiceRecorder,
  MondrianBlock,
  TalkButton,
  useAIProviders,
  MODEL_MODES,
  MODEL_MODE_LABELS,
} from "@inseme/room";
import { Volume2, Home, ArrowLeft, Trash2, Settings, Loader2 } from "lucide-react";
import { Button } from "@inseme/ui";

const LOCAL_SOVEREIGN_URL = "http://localhost:8080";

const cleanMessage = (text) => {
  if (!text) return "";
  let cleaned = text;
  // 1. Remove <Think> tags and content
  cleaned = cleaned.replace(/<Think>[\s\S]*?<\/Think>/gi, "");
  // 2. Remove __PROVIDERS_STATUS__...
  cleaned = cleaned.replace(/__PROVIDERS_STATUS__[\s\S]*/g, "");
  // 3. Remove __PROVIDER_INFO__...
  cleaned = cleaned.replace(/__PROVIDER_INFO__[\s\S]*/g, "");
  // 4. Remove [VOCAL] : prefix
  cleaned = cleaned.replace(/^\[VOCAL\]\s*:\s*/, "");
  return cleaned.trim();
};

export default function VocalConversation() {
  const {
    messages: contextMessages,
    sendMessage: sendContextMessage,
    user,
    vocalState,
    isOphéliaThinking: isContextThinking,
    stopVocal,
    config,
    uploadVocal,
  } = useInsemeContext();

  const {
    isListening,
    transcript,
    lastFinalTranscript,
    startListening,
    stopListening,
    setTranscript,
  } = useVoiceInterface();

  const aiProviders = useAIProviders();
  const [useSovereign, setUseSovereign] = useState(() => {
    const saved = localStorage.getItem("ophelia_vocal_use_sovereign");
    return saved === null ? true : saved === "true";
  });

  const [useBrowserSTT, setUseBrowserSTT] = useState(() => {
    const saved = localStorage.getItem("ophelia_vocal_use_browser_stt");
    return saved === null ? true : saved === "true";
  });
  const [isWhisperTranscribing, setIsWhisperTranscribing] = useState(false);

  useEffect(() => {
    localStorage.setItem("ophelia_vocal_use_browser_stt", useBrowserSTT);
  }, [useBrowserSTT]);

  const [lastCleared, setLastCleared] = useState(() => {
    return localStorage.getItem("ophelia_vocal_last_cleared") || null;
  });

  const [localMessages, setLocalMessages] = useState([]);
  const [isLocalServiceAvailable, setIsLocalServiceAvailable] = useState(false);
  const [isLocalThinking, setIsLocalThinking] = useState(false);
  const [isLocalSpeaking, setIsLocalSpeaking] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);
  const [modalTab, setModalTab] = useState("sovereign"); // sovereign or cloud
  const [availableModels, setAvailableModels] = useState([]);
  const [currentModel, setCurrentModel] = useState(
    localStorage.getItem("ophelia_local_model") || "qwen-2.5-coder-1.5b"
  );

  const handleWhisperTranscription = async (blob, duration) => {
    // 1. Always upload raw audio to storage (PV / Archive)
    let vocalUrl = null;
    try {
      if (uploadVocal) {
        console.debug("Uploading raw vocal for archive...");
        vocalUrl = await uploadVocal(blob);
      }
    } catch (e) {
      console.warn("Failed to upload raw vocal:", e);
    }

    // 2. If Browser STT is active, we stop here (text already handled)
    // BUT we want to ensure the vocal is archived in DB even if text was sent incrementally
    if (useBrowserSTT) {
      if (vocalUrl && sendContextMessage) {
        // Send a silent system message to link the audio blob to the session
        sendContextMessage("Audio Archive", {
          type: "voice_trace",
          vocal_url: vocalUrl,
          voice_duration: duration,
          is_hidden: true,
        });
      }
      return;
    }

    // 3. Otherwise, use Server Transcription (Whisper)
    setIsWhisperTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("file", blob, "audio.webm");

      const opheliaUrl = config?.opheliaUrl || "/api/ophelia";
      let transcribeUrl = "/api/transcribe";
      if (opheliaUrl && opheliaUrl.startsWith("http")) {
        try {
          const url = new URL(opheliaUrl);
          transcribeUrl = `${url.origin}/api/transcribe`;
        } catch (e) {
          // Silence errors if the component is unmounting
        }
      }

      const resp = await fetch(transcribeUrl, {
        method: "POST",
        body: formData,
      });

      if (!resp.ok) throw new Error("Transcription failed");
      const data = await resp.json();
      const text = data.text;

      if (text) {
        handleSendMessage(text, vocalUrl);
      }
    } catch (e) {
      console.error("Whisper error", e);
    } finally {
      setIsWhisperTranscribing(false);
    }
  };

  const {
    isRecording: isWhisperRecording,
    transcriptionPreview: whisperPreview,
    startRecording: startWhisper,
    stopRecording: stopWhisper,
  } = useVoiceRecorder(handleWhisperTranscription, {
    disableLocalPreview: true, // We use useVoiceInterface for preview
  });

  const handleStartVocal = () => {
    // Always start recorder (for archive or whisper)
    startWhisper();
    // Always start browser listener (for preview or transcript)
    startListening();
  };

  const handleStopVocal = () => {
    stopWhisper();
    stopListening();
  };

  useEffect(() => {
    localStorage.setItem("ophelia_vocal_use_sovereign", useSovereign);
  }, [useSovereign]);
  const [audioSource, setAudioSource] = useState(null);

  const scrollRef = useRef(null);
  const audioRef = useRef(new Audio());

  // Load history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("ophelia_vocal_history");
    if (saved) {
      try {
        setLocalMessages(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }

    checkLocalService();

    // Setup audio listeners
    const audio = audioRef.current;
    const handlePlay = () => setIsLocalSpeaking(true);
    const handleEnd = () => setIsLocalSpeaking(false);
    const handlePause = () => setIsLocalSpeaking(false);

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("ended", handleEnd);
    audio.addEventListener("pause", handlePause);

    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("ended", handleEnd);
      audio.removeEventListener("pause", handlePause);
    };
  }, []);

  // Save history to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("ophelia_vocal_history", JSON.stringify(localMessages));
  }, [localMessages]);

  const checkLocalService = async () => {
    try {
      const resp = await fetch(`${LOCAL_SOVEREIGN_URL}/status`);
      if (resp.ok) {
        const data = await resp.json();
        setIsLocalServiceAvailable(true);
        // Also fetch models if available
        const healthResp = await fetch(`${LOCAL_SOVEREIGN_URL}/health`);
        if (healthResp.ok) {
          const healthData = await healthResp.json();
          setAvailableModels(healthData.models || []);
        }
      } else {
        setIsLocalServiceAvailable(false);
      }
    } catch (e) {
      setIsLocalServiceAvailable(false);
    }
  };

  // Stop Ophélia if user starts speaking
  useEffect(() => {
    if (isListening || isWhisperRecording) {
      stopVocal();
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
  }, [isListening, isWhisperRecording, stopVocal]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [localMessages, contextMessages, transcript]);

  // Handle final transcript (Browser STT)
  useEffect(() => {
    if (lastFinalTranscript && useBrowserSTT) {
      handleSendMessage(lastFinalTranscript);
      setTranscript("");
    }
  }, [lastFinalTranscript, useBrowserSTT]);

  const handleSendMessage = async (text, vocalUrl = null) => {
    if (!text.trim()) return;

    // Use local service if available AND enabled
    if (isLocalServiceAvailable && useSovereign) {
      const userMsg = {
        id: Date.now(),
        name: user?.display_name || "Moi",
        message: text,
        type: "chat",
        isLocal: true,
        timestamp: new Date().toISOString(),
      };
      setLocalMessages((prev) => [...prev, userMsg]);
      handleLocalResponse(text);

      // Even in Sovereign mode, we might want to archive the vocal trace if available
      if (vocalUrl && sendContextMessage) {
        sendContextMessage("Audio Archive (Sovereign)", {
          type: "voice_trace",
          vocal_url: vocalUrl,
          is_hidden: true,
          sovereign_text: text,
        });
      }
    } else {
      // Fallback to cloud context with the selected AI settings
      sendContextMessage(text, {
        is_vocal_input: true,
        sender_name: user?.display_name || "Client",
        directive_prefix: aiProviders.directivePrefix,
        vocal_url: vocalUrl, // Attach vocal URL if available (Server STT)
      });
    }
  };

  const handleLocalResponse = async (text) => {
    setIsLocalThinking(true);

    // Create a unique ID for this AI response
    const aiMsgId = Date.now() + 1;

    try {
      // 1. Prepare both calls
      const ttsPromise = fetch(`${LOCAL_SOVEREIGN_URL}/v1/vocalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          model: currentModel,
          voice: "hf_alpha",
          speed: 1.0,
        }),
      });

      const llmPromise = fetch(`${LOCAL_SOVEREIGN_URL}/v1/llm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          model: currentModel,
          stream: false,
        }),
      });

      // 2. Start both but handle them as they arrive
      // We want the text to appear as soon as possible, and audio to play as soon as possible.

      const [ttsResp, llmResp] = await Promise.all([ttsPromise, llmPromise]);

      if (!llmResp.ok || !ttsResp.ok) throw new Error("Local service error");

      // Handle Text
      const llmData = await llmResp.json();
      const aiText = llmData.choices[0].text;

      const aiMsg = {
        id: aiMsgId,
        name: "Ophélia",
        message: aiText,
        type: "chat",
        isLocal: true,
        timestamp: new Date().toISOString(),
      };
      setLocalMessages((prev) => [...prev, aiMsg]);

      // Handle Audio
      const blob = await ttsResp.blob();
      const url = URL.createObjectURL(blob);

      // If user hasn't started speaking in the meantime
      if (!isListening) {
        audioRef.current.src = url;
        audioRef.current.play().catch((e) => console.warn("Audio play blocked", e));
      }
    } catch (e) {
      console.error("Local response failed", e);
      // Fallback to context if local fails
      sendContextMessage(`[VOCAL] : ${text}`, {
        is_vocal_input: true,
        sender_name: user?.display_name || "Client",
      });
    } finally {
      setIsLocalThinking(false);
    }
  };

  const clearHistory = () => {
    if (window.confirm("Effacer l'historique de cette conversation ?")) {
      setLocalMessages([]);
      localStorage.removeItem("ophelia_vocal_history");

      const now = new Date().toISOString();
      setLastCleared(now);
      localStorage.setItem("ophelia_vocal_last_cleared", now);
    }
  };

  const handleReturn = () => {
    window.history.back();
  };

  // Combine and sort messages
  const allMessages = [...localMessages];

  // If we're NOT using local service, we might want to include context messages
  // but for a "vocal" page, local history is often preferred.
  // Let's only show context messages if local history is empty and we're not in local mode
  const visibleMessages = (
    isLocalServiceAvailable
      ? allMessages
      : contextMessages.filter(
          (m) => m.type === "chat" || m.type === "system_summary" || m.type === "ophelia_thought"
        )
  )
    .filter((msg) => !lastCleared || (msg.timestamp && msg.timestamp > lastCleared))
    .slice(-10);

  return (
    <div className="h-full flex flex-col bg-slate-100 p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2">
          <button
            onClick={handleReturn}
            className="bg-white text-black border-4 border-black p-3 hover:bg-black hover:text-white transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1"
          >
            <ArrowLeft className="w-6 h-6" strokeWidth={2.5} />
          </button>
          <button
            onClick={clearHistory}
            className="bg-white text-black border-4 border-black p-3 hover:bg-mondrian-red hover:text-white transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1"
            title="Effacer l'historique"
          >
            <Trash2 className="w-6 h-6" strokeWidth={2.5} />
          </button>
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-black italic tracking-tighter uppercase">Ophélia Vocal</h2>
          <div className="flex flex-col items-center gap-1">
            {isLocalServiceAvailable && useSovereign ? (
              <div className="flex items-center justify-center gap-1 text-[8px] font-black uppercase text-green-600">
                <div className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse" />
                Souverain: {currentModel}
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1 text-[8px] font-black uppercase text-mondrian-blue">
                <div className="w-1.5 h-1.5 rounded-full bg-mondrian-blue" />
                Cloud: {aiProviders.modalProvider} ({aiProviders.modalMode})
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => setShowModelModal(true)}
          className="bg-white text-black border-4 border-black p-3 hover:bg-mondrian-yellow hover:text-black transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1"
          title="Paramètres du modèle"
        >
          <Settings className="w-6 h-6" strokeWidth={2.5} />
        </button>
      </div>

      {/* Main Content: Chat History */}
      <MondrianBlock
        color="white"
        className="flex-1 border-8 border-black flex flex-col shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] overflow-hidden relative mb-8"
      >
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-4 bg-[radial-gradient(var(--color-border-subtle)_1px,transparent_1px)] bg-[size:20px_20px]"
        >
          {visibleMessages.length === 0 && !transcript && (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-80">
              <Volume2 className="w-16 h-16 mb-4 animate-pulse" />
              <p className="font-black uppercase text-sm max-w-[200px]">
                {isLocalServiceAvailable
                  ? "Mode Souverain Actif. Parlez à Ophélia."
                  : "Appuyez sur le micro pour parler à Ophélia"}
              </p>
            </div>
          )}

          {visibleMessages.map((msg, i) => {
            const isOphelia = msg.name === "Ophélia";
            return (
              <div
                key={msg.id || i}
                className={`flex ${isOphelia ? "justify-start" : "justify-end"} animate-in zoom-in duration-300`}
              >
                <div
                  className={`
                    max-w-[85%] p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
                    ${isOphelia ? "bg-mondrian-yellow" : "bg-mondrian-blue text-white"}
                  `}
                >
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-[10px] font-black uppercase opacity-80">{msg.name}</p>
                    {msg.isLocal && (
                      <span className="text-[8px] font-black bg-black text-white px-1 ml-2">
                        LOCAL
                      </span>
                    )}
                  </div>
                  <p className="font-bold leading-tight italic">{cleanMessage(msg.message)}</p>
                </div>
              </div>
            );
          })}

          {/* Current Transcript */}
          {transcript && (
            <div className="flex justify-end animate-in fade-in duration-200">
              <div className="max-w-[85%] p-4 border-4 border-black border-dashed bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-[10px] font-black uppercase mb-1 opacity-40 italic">
                  En train de parler...
                </p>
                <p className="font-bold leading-tight italic opacity-60">{transcript}</p>
              </div>
            </div>
          )}

          {/* Thinking Indicator */}
          {(isLocalThinking || isContextThinking) && (
            <div className="flex justify-start animate-in fade-in duration-200">
              <div className="bg-black text-white p-2 border-4 border-black text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                Ophélia réfléchit...
              </div>
            </div>
          )}
        </div>
      </MondrianBlock>

      {/* Footer: Controls */}
      <div className="flex justify-center items-center pb-8">
        <TalkButton
          vocalState={isLocalSpeaking ? "speaking" : vocalState}
          isRecording={isListening || isWhisperRecording}
          isTranscribing={isLocalThinking || isContextThinking || isWhisperTranscribing}
          transcriptionPreview={transcript || whisperPreview}
          startRecording={handleStartVocal}
          stopRecording={handleStopVocal}
          size="lg"
          className="scale-125"
        />
      </div>

      {/* Model Selection Modal */}
      {showModelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <MondrianBlock
            color="white"
            className="w-full max-w-lg border-8 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] p-6 flex flex-col max-h-[90vh]"
          >
            <header className="flex justify-between items-center mb-6 border-b-4 border-black pb-2">
              <h3 className="text-xl font-black uppercase">Configuration AI</h3>
              <button onClick={() => setShowModelModal(false)} className="font-black text-2xl">
                ×
              </button>
            </header>

            {/* Tabs */}
            <div className="flex border-4 border-black mb-6">
              <button
                onClick={() => setModalTab("sovereign")}
                className={`flex-1 p-2 font-black uppercase text-xs transition-all ${modalTab === "sovereign" ? "bg-mondrian-yellow" : "bg-white hover:bg-slate-50"}`}
              >
                Souverain
              </button>
              <button
                onClick={() => setModalTab("cloud")}
                className={`flex-1 p-2 font-black uppercase text-xs transition-all border-l-4 border-black ${modalTab === "cloud" ? "bg-mondrian-blue text-white" : "bg-white hover:bg-slate-50"}`}
              >
                Cloud
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
              {modalTab === "sovereign" ? (
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black uppercase mb-2">
                      Statut Service
                    </label>
                    <div
                      className={`p-3 border-4 border-black font-bold flex items-center justify-between ${isLocalServiceAvailable ? "bg-green-100" : "bg-red-100"}`}
                    >
                      <span>
                        {isLocalServiceAvailable ? "SOUVERAIN CONNECTÉ" : "SOUVERAIN HORS-LIGNE"}
                      </span>
                      <div
                        className={`w-3 h-3 rounded-full ${isLocalServiceAvailable ? "bg-green-600 animate-pulse" : "bg-red-600"}`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase mb-2">
                      Méthode de Transcription
                    </label>
                    <div className="flex border-4 border-black">
                      <button
                        onClick={() => setUseBrowserSTT(true)}
                        className={`flex-1 p-2 font-black uppercase text-xs transition-all ${useBrowserSTT ? "bg-black text-white" : "bg-white hover:bg-slate-50"}`}
                      >
                        Navigateur (Local)
                      </button>
                      <button
                        onClick={() => setUseBrowserSTT(false)}
                        className={`flex-1 p-2 font-black uppercase text-xs transition-all border-l-4 border-black ${!useBrowserSTT ? "bg-black text-white" : "bg-white hover:bg-slate-50"}`}
                      >
                        Serveur (Whisper)
                      </button>
                    </div>
                    <p className="text-[10px] opacity-60 mt-1">
                      {useBrowserSTT
                        ? "Utilise l'API Web Speech du navigateur (Rapide, Gratuit)."
                        : "Utilise OpenAI Whisper via le serveur (Plus précis, Latence)."}
                    </p>
                  </div>

                  <div>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={useSovereign}
                          onChange={(e) => setUseSovereign(e.target.checked)}
                        />
                        <div
                          className={`w-12 h-6 border-4 border-black transition-colors ${useSovereign ? "bg-mondrian-green" : "bg-slate-200"}`}
                        />
                        <div
                          className={`absolute top-1 left-1 w-2 h-2 border-2 border-black bg-white transition-transform ${useSovereign ? "translate-x-6" : ""}`}
                        />
                      </div>
                      <span className="font-black uppercase text-xs">Utiliser en priorité</span>
                    </label>
                    <p className="text-[10px] opacity-60 mt-2">
                      Si activé, Ophélia utilisera le LLM et le TTS locaux pour plus de rapidité et
                      de confidentialité.
                    </p>
                  </div>

                  {isLocalServiceAvailable && availableModels.length > 0 && (
                    <div>
                      <label className="block text-[10px] font-black uppercase mb-2">
                        Modèle Local
                      </label>
                      <div className="grid grid-cols-1 gap-2">
                        {availableModels.map((model) => (
                          <button
                            key={model}
                            onClick={() => {
                              setCurrentModel(model);
                              localStorage.setItem("ophelia_local_model", model);
                            }}
                            className={`p-3 border-4 border-black font-black text-left text-xs transition-all ${currentModel === model ? "bg-mondrian-yellow translate-x-1 translate-y-1 shadow-none" : "bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-50"}`}
                          >
                            {model}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Provider Selection */}
                  <div>
                    <label className="block text-[10px] font-black uppercase mb-2">
                      Fournisseur Cloud
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {aiProviders.sortedAvailableProviders().map((p) => (
                        <button
                          key={p}
                          onClick={() => aiProviders.setModalProvider(p)}
                          className={`p-2 border-4 border-black font-black text-xs uppercase transition-all ${aiProviders.modalProvider === p ? "bg-mondrian-blue text-white translate-x-1 translate-y-1 shadow-none" : "bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-50"}`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mode Selection */}
                  <div>
                    <label className="block text-[10px] font-black uppercase mb-2">
                      Mode / Puissance
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.keys(MODEL_MODES[aiProviders.modalProvider] || {}).map((m) => (
                        <button
                          key={m}
                          onClick={() => aiProviders.setModalMode(m)}
                          className={`p-2 border-4 border-black font-black text-xs uppercase transition-all ${aiProviders.modalMode === m ? "bg-mondrian-yellow translate-x-1 translate-y-1 shadow-none" : "bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-50"}`}
                        >
                          {MODEL_MODE_LABELS[m] || m}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Directive Prefix */}
                  <div>
                    <label className="block text-[10px] font-black uppercase mb-2">
                      Directive Système (Prefix)
                    </label>
                    <textarea
                      value={aiProviders.directivePrefix}
                      onChange={(e) => aiProviders.setDirectivePrefix(e.target.value)}
                      placeholder="Ex: Réponds toujours de manière très courte..."
                      className="w-full p-3 border-4 border-black font-bold text-xs min-h-[100px] focus:outline-none focus:ring-4 focus:ring-mondrian-yellow/20"
                    />
                    <p className="text-[10px] opacity-60 mt-1 italic">
                      Ce texte sera ajouté au début de chaque prompt envoyé au Cloud.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 border-t-4 border-black pt-6">
              <Button
                onClick={() => setShowModelModal(false)}
                className="w-full bg-black text-white hover:bg-slate-800 p-4 font-black uppercase shadow-[8px_8px_0px_0px_rgba(0,0,0,0.2)] hover:shadow-none transition-all"
              >
                Appliquer les réglages
              </Button>
            </div>
          </MondrianBlock>
        </div>
      )}
    </div>
  );
}
