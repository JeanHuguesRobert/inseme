import React from "react";
import { Mic, Square, Loader2, Volume2, Bot, Sparkles } from "lucide-react";
import { Tooltip } from "../../ui/src/index.js";

export function TalkButton({
  vocalState,
  isRecording,
  isTranscribing,
  duration = 0,
  startRecording,
  stopRecording,
  isHandsFree,
  className = "",
  size = "md", // sm, md, lg
  showLabel = true,
}) {
  // Determine current visual state
  let state = "idle";
  if (isTranscribing) state = "thinking";
  else if (isRecording) state = "recording";
  else if (vocalState === "speaking") state = "speaking";
  else if (vocalState === "thinking") state = "thinking";

  const sizeClasses = {
    sm: "w-10 h-10",
    md: "w-14 h-14",
    lg: "w-20 h-20",
  };

  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-10 h-10",
  };

  const getStyles = () => {
    switch (state) {
      case "recording":
        return "bg-[#E10600] text-white border-black";
      case "thinking":
        return "bg-[#0055A4] text-white border-black";
      case "speaking":
        return "bg-[#FFD500] text-black border-black";
      default:
        return "bg-white text-black border-black hover:bg-black hover:text-white";
    }
  };

  const getLabel = () => {
    switch (state) {
      case "recording":
        const minutes = Math.floor(duration / 60);
        const seconds = Math.floor(duration % 60);
        const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;
        return timeStr;
      case "thinking":
        return "Analysing";
      case "speaking":
        return "Ophélia";
      default:
        return isHandsFree ? "Auto" : "Talk";
    }
  };

  return (
    <div className={`flex flex-row items-center gap-4 ${className}`}>
      <Tooltip
        content={isRecording ? "Stop listening" : "Click to talk"}
      >
        <button
          type="button"
          onClick={() => (isRecording ? stopRecording() : startRecording())}
          className={`${sizeClasses[size]} rounded-none flex items-center justify-center transition-all active:translate-x-1 active:translate-y-1 border-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] group relative cursor-pointer ${getStyles()}`}
        >
          {/* Outer Ring Animation for active states */}
          {(state === "recording" || state === "speaking") && (
            <div className="absolute inset-0 bg-current opacity-10 animate-ping" />
          )}

          <div className="relative z-10">
            {state === "idle" && <Mic size={32} strokeWidth={3} />}
            {state === "recording" && (
              <Square size={32} strokeWidth={3} className="fill-current" />
            )}
            {state === "thinking" && (
              <Sparkles size={32} strokeWidth={3} className="animate-pulse" />
            )}
            {state === "speaking" && <Volume2 size={32} strokeWidth={3} />}
          </div>
        </button>
      </Tooltip>
      {showLabel && (
        <div className="flex flex-row items-center gap-2 bg-black text-white px-3 py-1 border-2 border-black">
          <span className="text-[12px] font-black uppercase tracking-[0.2em] leading-none">
            {getLabel()}
          </span>
          {state === "recording" && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-[#E10600] rounded-full animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-[#E10600]">
                Live
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
