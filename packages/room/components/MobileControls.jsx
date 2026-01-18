import React, { useState } from "react";
import {
  Hand,
  Check,
  X,
  Ban,
  Volume2,
  VolumeX,
  LogOut,
  Sparkles,
  MoreHorizontal,
  Headphones,
} from "lucide-react";
import { TalkButton } from "./TalkButton";

const colors = {
  red: "bg-mondrian-red",
  blue: "bg-mondrian-blue",
  yellow: "bg-mondrian-yellow",
  black: "bg-black",
  white: "bg-white",
};

function ActionButton({ onClick, bg, color, icon: Icon, label, className = "" }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 border-4 border-black transition-all active:translate-x-1 active:translate-y-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${bg} ${color} ${className}`}
    >
      <Icon size={16} strokeWidth={3} />
      <span className="text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
        {label}
      </span>
    </button>
  );
}

export function MobileControls({
  onParole,
  onVote,
  onDelegate,
  isRecording,
  vocalState,
  isTranscribing,
  vocalError,
  transcriptionPreview,
  duration,
  startRecording,
  stopRecording,
  isHandsFree,
  setIsHandsFree,
  isSilent,
  setIsSilent,
  canVote,
  sessionStatus,
  showLifecycleOverlay = true,
  lifecycleClosedMessage = "La séance est close",
  barName = "Le Bar",
  commune = "CORTE",
}) {
  const [mode, setMode] = useState("main");
  const [vibe, setVibe] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  const vibes = [
    "L'AMBIANCE RÉPOND",
    "ICI ÇA PARLE, ICI ÇA VIT",
    "PAS DE PLAYLIST MORTE",
    `${barName.toUpperCase()} · ${commune.toUpperCase()}`,
  ];

  if (sessionStatus === "closed" && showLifecycleOverlay) {
    return (
      <div className="fixed bottom-6 left-4 right-4 z-50">
        <div className="bg-white border-8 border-black p-4 text-center shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-black font-black uppercase tracking-[0.2em] text-sm">
            {lifecycleClosedMessage}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pointer-events-none">
      <div className="max-w-md mx-auto flex flex-col gap-0 pointer-events-auto">
        {/* Top Floating Badge - Vibe */}
        <div
          onClick={() => setVibe((v) => (v + 1) % vibes.length)}
          className="self-start bg-mondrian-yellow border-t-4 border-x-4 border-black px-6 py-2 shadow-none cursor-pointer active:brightness-90 transition-all flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4 text-black" />
          <span className="text-[11px] font-black text-black uppercase tracking-widest">
            {vibes[vibe]}
          </span>
        </div>

        {/* Main Controls Island - Mondrian Grid */}
        <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
          <div className="flex items-stretch divide-x-4 divide-black">
            {mode === "vote" ? (
              <div className="flex flex-1 items-center justify-around p-2 bg-white">
                <ActionButton
                  onClick={() => {
                    onVote("yes");
                    setMode("main");
                  }}
                  bg="bg-mondrian-blue"
                  color="text-white"
                  icon={Check}
                  label="Pour"
                />
                <ActionButton
                  onClick={() => {
                    onVote("no");
                    setMode("main");
                  }}
                  bg="bg-mondrian-red"
                  color="text-white"
                  icon={X}
                  label="Contre"
                />
                <button
                  onClick={() => setMode("main")}
                  className="p-4 bg-mondrian-black text-white active:bg-black/80"
                >
                  <X size={24} strokeWidth={3} />
                </button>
              </div>
            ) : (
              <>
                {/* Left Block - White/Secondary */}
                <div className="flex-1 grid grid-cols-3 divide-x-4 divide-black bg-white">
                  <button
                    onClick={() => setIsSilent(!isSilent)}
                    className={`p-4 transition-all active:brightness-90 flex items-center justify-center ${isSilent ? "bg-mondrian-red text-white" : "bg-white text-black"}`}
                  >
                    {isSilent ? (
                      <VolumeX size={20} strokeWidth={3} />
                    ) : (
                      <Volume2 size={20} strokeWidth={3} />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      const nextHF = !isHandsFree;
                      setIsHandsFree(nextHF);
                      localStorage.setItem("inseme_hands_free", nextHF ? "true" : "false");
                      if (!nextHF) {
                        stopRecording();
                      }
                    }}
                    className={`p-4 transition-all active:brightness-90 flex items-center justify-center ${isHandsFree ? "bg-mondrian-red text-white" : "bg-white text-black"}`}
                  >
                    <Headphones size={20} strokeWidth={3} />
                  </button>
                  {canVote && (
                    <button
                      onClick={onParole}
                      className="p-4 bg-white text-black active:bg-mondrian-yellow flex items-center justify-center"
                    >
                      <Hand size={20} strokeWidth={3} />
                    </button>
                  )}
                </div>

                {/* Right Block - Yellow/Actions */}
                <div className="flex flex-col divide-y-4 divide-black bg-mondrian-yellow">
                  {canVote && (
                    <button
                      onClick={() => setMode("vote")}
                      className="p-4 bg-mondrian-yellow text-black active:bg-black active:text-white flex items-center justify-center"
                    >
                      <LogOut size={20} strokeWidth={3} className="rotate-90" />
                    </button>
                  )}
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={`p-4 transition-all flex items-center justify-center ${isExpanded ? "bg-black text-white" : "bg-white text-black"}`}
                  >
                    <MoreHorizontal size={20} strokeWidth={3} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Expanded Menu - Mondrian Overlay */}
        {isExpanded && (
          <div className="bg-white border-x-4 border-b-4 border-black p-0 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] animate-in slide-in-from-top-4">
            <div className="flex divide-x-4 divide-black">
              <button
                onClick={() => {
                  setVibe((v) => (v + 1) % vibes.length);
                  setIsExpanded(false);
                }}
                className="flex-1 flex items-center gap-3 px-4 py-3 bg-mondrian-blue text-white active:brightness-90"
              >
                <Sparkles size={16} strokeWidth={3} />
                <span className="text-[11px] font-black uppercase tracking-wider">Vibe Check</span>
              </button>
              <div className="px-4 py-3 bg-white flex items-center">
                <span className="text-[8px] font-black text-black uppercase tracking-[0.2em]">
                  Powered by Ophélia
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
