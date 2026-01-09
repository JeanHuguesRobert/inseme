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
} from "lucide-react";
import { TalkButton } from "./TalkButton";

const colors = {
  red: "bg-[#E10600]",
  blue: "bg-[#0055A4]",
  yellow: "bg-[#FFD500]",
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
  startRecording,
  stopRecording,
  isHandsFree,
  isSilent,
  setIsSilent,
  canVote,
  sessionStatus,
}) {
  const [mode, setMode] = useState("main");
  const [vibe, setVibe] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  const vibes = [
    "L'AMBIANCE RÉPOND",
    "ICI ÇA PARLE, ICI ÇA VIT",
    "PAS DE PLAYLIST MORTE",
    "CYRNEA BAR · CORTE",
  ];

  if (sessionStatus === "closed") {
    return (
      <div className="fixed bottom-6 left-4 right-4 z-50">
        <div className="bg-white border-8 border-black p-4 text-center shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-black font-black uppercase tracking-[0.2em] text-sm">
            La séance est close
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
          className="self-start bg-[#FFD500] border-t-4 border-x-4 border-black px-6 py-2 shadow-none cursor-pointer active:brightness-90 transition-all flex items-center gap-2"
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
                  onClick={() => { onVote("yes"); setMode("main"); }}
                  bg="bg-[#0055A4]"
                  color="text-white"
                  icon={Check}
                  label="Pour"
                />
                <ActionButton
                  onClick={() => { onVote("no"); setMode("main"); }}
                  bg="bg-[#E10600]"
                  color="text-white"
                  icon={X}
                  label="Contre"
                />
                <button 
                  onClick={() => setMode("main")}
                  className="p-4 bg-black text-white active:bg-slate-800"
                >
                  <X size={24} strokeWidth={3} />
                </button>
              </div>
            ) : (
              <>
                {/* Left Block - White/Secondary */}
                <div className="flex flex-col divide-y-4 divide-black bg-white">
                  <button
                    onClick={() => setIsSilent(!isSilent)}
                    className={`p-4 transition-all active:brightness-90 ${isSilent ? "bg-[#E10600] text-white" : "bg-white text-black"}`}
                  >
                    {isSilent ? <VolumeX size={20} strokeWidth={3} /> : <Volume2 size={20} strokeWidth={3} />}
                  </button>
                  {canVote && (
                    <button
                      onClick={onParole}
                      className="p-4 bg-white text-black active:bg-[#FFD500]"
                    >
                      <Hand size={20} strokeWidth={3} />
                    </button>
                  )}
                </div>

                {/* Center Block - Large Primary (Talk) */}
                <div className="flex-1 flex items-center justify-center p-4 bg-white">
                  <div className="relative group">
                    <div className="absolute -inset-1 bg-black translate-x-1 translate-y-1 group-active:translate-x-0 group-active:translate-y-0 transition-transform" />
                    <TalkButton
                      vocalState={vocalState}
                      isRecording={isRecording}
                      isTranscribing={isTranscribing}
                      startRecording={startRecording}
                      stopRecording={stopRecording}
                      isHandsFree={isHandsFree}
                      size="lg"
                      showLabel={false}
                      className="relative z-10 border-4 border-black rounded-none"
                    />
                  </div>
                </div>

                {/* Right Block - Yellow/Actions */}
                <div className="flex flex-col divide-y-4 divide-black bg-[#FFD500]">
                  {canVote && (
                    <button
                      onClick={() => setMode("vote")}
                      className="p-4 bg-[#FFD500] text-black active:bg-black active:text-white"
                    >
                      <LogOut size={20} strokeWidth={3} className="rotate-90" />
                    </button>
                  )}
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={`p-4 transition-all ${isExpanded ? "bg-black text-white" : "bg-white text-black"}`}
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
                className="flex-1 flex items-center gap-3 px-4 py-3 bg-[#0055A4] text-white active:brightness-90"
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


