// src/pages/CafeSessionPage.jsx

import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { CafeSessionProvider, useCafeSession } from "../contexts/CafeSessionContext";
import MicrophoneControl from "../components/cafe/MicrophoneControl";
import TranscriptFeed from "../components/cafe/TranscriptFeed";
import { Icon } from "@inseme/cop-host";  

import HostControls from "../components/cafe/HostControls";

const SessionInner = () => {
  const {
    session,
    joinSession,
    currentUser,
    isConnected,
    sendReaction,
    sendTextMessage,
    isHost,
    hostSecret,
    setHostSecret,
  } = useCafeSession();
  const [name, setName] = useState("");
  const [showHostPanel, setShowHostPanel] = useState(false); // Mobile toggles
  const [messageText, setMessageText] = useState(""); // SMS input
  const [inputMode, setInputMode] = useState("text"); // 'text' ou 'voice'

  if (!isConnected && !session)
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-gray-50">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-purple-200"></div>
          <div className="text-gray-400 font-medium">Connexion au Café...</div>
        </div>
      </div>
    );

  if (!currentUser) {
    return (
      <div className="h-[100dvh] bg-gradient-to-br from-purple-50 to-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/50 text-center">
          <div className="mb-6 flex justify-center">
            <div className="w-16 h-16 bg-gradient-to-tr from-purple-600 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg transform rotate-3">
              <span className="text-3xl">☕</span>
            </div>
          </div>
          <h1 className="text-2xl font-black mb-2 text-gray-900 tracking-tight">
            {session?.venue_name || "Café Ophélia"}
          </h1>
          <p className="text-gray-500 mb-8 font-medium">Rejoignez le cercle de discussion</p>

          <input
            type="text"
            placeholder="Votre prénom ou pseudo"
            className="w-full bg-gray-50 border border-gray-200 text-lg rounded-xl px-5 py-4 mb-4 focus:ring-4 focus:ring-purple-100 focus:border-purple-500 outline-none transition-all placeholder:text-gray-400 font-medium text-center"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && joinSession(name)}
          />
          <button
            onClick={() => joinSession(name)}
            disabled={!name.trim()}
            className="w-full bg-gray-900 text-white font-bold text-lg py-4 rounded-xl shadow-xl shadow-purple-900/10 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:transform-none transition-all flex items-center justify-center gap-2"
          >
            Entrer <Send size={20} />
          </button>
          <p className="mt-6 text-xs text-gray-400 font-medium uppercase tracking-widest">
            Session Sécurisée &bull; Anonyme
          </p>
        </div>
      </div>
    );
  }

  // Main App Layout
  return (
    <div className="h-[100dvh] flex flex-col bg-slate-50 overflow-hidden">
      {/* 1. Header (Compact) */}
      <header className="flex-none bg-white/90 backdrop-blur border-b border-gray-200 px-4 py-3 flex justify-between items-center z-20 shadow-sm relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-indigo-50 rounded-full flex items-center justify-center border border-purple-100 shadow-sm">
            <span className="text-lg">☕</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 leading-tight">
              {session?.venue_name || "Café Ophélia"}
            </h1>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider">
                {session?.current_phase || "Accueil"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isHost && (
            <button
              onClick={() => setShowHostPanel(!showHostPanel)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors flex items-center gap-1 ${showHostPanel ? "bg-purple-900 text-white border-purple-900" : "bg-white text-gray-700 border-gray-300"}`}
            >
              HÔTE {showHostPanel ? "ON" : "OFF"}
            </button>
          )}
          {isHost && hostSecret && (
            <button
              onClick={() => {
                try {
                  navigator.clipboard?.writeText(hostSecret || "");
                  alert("Clé d\u2019hôte copiée dans le presse-papiers");
                } catch (e) {
                  console.warn("copy host secret failed", e.message);
                }
              }}
              className="px-2 py-1 rounded-md border text-xs bg-white/5 text-gray-200 border-gray-600"
              title="Copier la clé d'hôte"
            >
              <Icon name="key" size={16} />
              Clé hôte
            </button>
          )}
          {!isHost && (
            <button
              onClick={() => {
                const input = prompt("Entrer la clé hôte (coller ici)");
                if (input) {
                  setHostSecret(input);
                  alert("Clé hôte définie temporairement pour cette session.");
                }
              }}
              className="px-2 py-1 rounded-md border text-xs bg-white/5 text-gray-200 border-gray-600"
              title="Utiliser une clé d\'hôte"
              <Icon name="brain" size={20} />
            >
              Utiliser clé
            </button>
          )}
          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center border border-gray-200 text-gray-500 font-bold text-xs ring-2 ring-white">
            {currentUser.display_handle.slice(0, 2).toUpperCase()}
          </div>
        </div>
      </header>

      {/* 2. Scrollable Content (Transcript + Host Panel Overlay) */}
      <main className="flex-1 overflow-y-auto relative scroll-smooth overscroll-contain">
        {/* Host Panel Drawer */}
        {isHost && showHostPanel && (
          <div className="sticky top-0 z-10 p-4 bg-gray-900/95 backdrop-blur shadow-xl border-b border-gray-800 animate-in slide-in-from-top-2 duration-200">
            <HostControls />
          </div>
        )}

        <div className="p-4 pb-32 md:pb-10 max-w-2xl mx-auto min-h-full flex flex-col justify-end">
          <TranscriptFeed />
        </div>
      </main>

      {/* 3. Bottom Controls (Fixed & Floating) */}
      <div className="flex-none z-30">
        {/* Floating Reactions Bar - Positioned just above local control */}
        <div className="absolute bottom-[280px] md:bottom-32 right-4 md:right-1/2 md:translate-x-32 flex flex-col gap-3 pointer-events-none">
          {/* Can be used for floating bubbles later */}
        </div>

        <div className="bg-white border-t border-gray-200 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] pb-safe-area">
          <div className="max-w-xl mx-auto p-4">
            {/* SMS-style Text Input */}
            <div className="mb-3 flex gap-2">
              {inputMode === "text" ? (
                <>
                  <input
                    type="text"
                    placeholder="Envoyer un message..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && messageText.trim()) {
                        sendTextMessage(messageText.trim());
                        setMessageText("");
                      }
                    }}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition-all placeholder:text-gray-400"
                    maxLength={280}
                  />
                  <button
                    onClick={() => {
                      if (messageText.trim()) {
                        sendTextMessage(messageText.trim());
                        setMessageText("");
                      }
                    }}
                    disabled={!messageText.trim()}
                    <Icon name="paper-plane-right" weight="bold" size={16} />
                  >
                    <PaperPlaneRight weight="bold" size={16} />
                  </button>
                  <button
                    onClick={() => setInputMode("voice")}
                    className="ml-2 bg-purple-600 text-white px-3 py-2 rounded-full font-medium text-sm hover:bg-purple-700 transition-all flex items-center gap-1 shadow-sm"
                    title="Parler à Ophélia"
                  >
                    <span role="img" aria-label="micro">
                      🎙️
                    </span>{" "}
                    Parler
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    if (inputMode !== "text") {
                      setInputMode("text");
                      // Libère le micro si actif
                      if (typeof window !== "undefined") {
                        const evt = new CustomEvent("release-mic");
                        window.dispatchEvent(evt);
                      }
                    }
                  }}
                  className="ml-2 bg-gray-200 text-gray-700 px-3 py-2 rounded-full font-medium text-sm hover:bg-gray-300 transition-all flex items-center gap-1 shadow-sm"
                  title="Revenir au texte"
                >
                  <span role="img" aria-label="clavier">
                    ⌨️
                  </span>{" "}
                  Écrire
                </button>
              )}
            </div>

            <div className="flex items-end justify-between gap-4">
              {/* Reaction Grid */}
              <div className="hidden md:flex gap-2">
                <ReactionButton
                  icon={<ThumbsUp weight="fill" />}
                  label="Agree"
                  color="text-green-600 bg-green-50"
                  onClick={() => sendReaction("agree")}
                />
                <ReactionButton
                  icon={<Hand weight="fill" />}
                  label="Wait"
                  color="text-orange-600 bg-orange-50"
                  onClick={() => sendReaction("block")}
                />
              </div>

              {/* Center Mic - Focal Point */}
              {inputMode === "voice" && (
                <div className="flex-1 flex justify-center -mt-12 relative z-10">
                  <div className="bg-white p-2 rounded-full shadow-lg border border-gray-100">
                    <MicrophoneControl />
                  </div>
                </div>
              )}

              {/* Mobile Reactions Trigger (or minimal set) */}
              <div className="flex md:hidden gap-2 absolute bottom-6 right-6 z-0 hidden">
                {/* Hidden for now, integrate into Mic Control surrounding area or floating fab? */}
              </div>
            </div>

            {/* Mobile Reactions Row under mic */}
            <div className="flex md:hidden justify-center gap-4 mt-2 pb-2">
              <ReactionButton
                icon={<ThumbsUp size={20} weight="bold" />}
                label="Accord"
                color="text-green-600 bg-green-50 border-green-200"
                onClick={() => sendReaction("agree")}
              />
              <ReactionButton
                icon={<Hand size={20} weight="bold" />}
                label="Attendre"
                color="text-orange-600 bg-orange-50 border-orange-200"
                onClick={() => sendReaction("block")}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ReactionButton = ({ icon, label, color, onClick }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center p-4 rounded-xl ${color} transition-colors border border-transparent hover:border-black/5`}
  >
    {icon}
    <span className="text-xs font-medium mt-1">{label}</span>
  </button>
);

const CafeSessionPage = () => {
  const { id } = useParams(); // Session ID from URL
  // If no ID, maybe show a lobby or list? For now assume /cafe/:id
  return (
    <CafeSessionProvider initialSessionId={id}>
      <SessionInner />
    </CafeSessionProvider>
  );
};

export default CafeSessionPage;
