import React, { useRef, useEffect } from "react";
import { Mic, Square, Loader2, Volume2, Bot, Sparkles, AlertCircle } from "lucide-react";
import { Tooltip } from "../../ui/src/index.js";

export function TalkButton({
  vocalState,
  isRecording,
  isTranscribing,
  vocalError,
  transcriptionPreview,
  duration = 0,
  startRecording,
  stopRecording,
  isHandsFree,
  className = "",
  size = "md", // sm, md, lg
  showLabel = true,
  disabled = false,
  microMode = "OFF",
  onMicroModeChange,
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
    if (vocalError) return "bg-mondrian-red text-white border-black";
    switch (state) {
      case "recording":
        return "bg-mondrian-red text-white border-black";
      case "thinking":
        return "bg-mondrian-blue text-white border-black";
      case "speaking":
        return "bg-mondrian-yellow text-black border-black";
      default: {
        if (!onMicroModeChange || microMode === "OFF") {
          return "bg-white text-black border-black hover:bg-black hover:text-white";
        }
        if (microMode === "AMBIANCE") {
          return "bg-mondrian-blue/10 text-mondrian-blue border-black hover:bg-mondrian-blue/20";
        }
        if (microMode === "DICTATION") {
          return "bg-purple-600 text-white border-black hover:bg-purple-700";
        }
        return "bg-white text-black border-black hover:bg-black hover:text-white";
      }
    }
  };

  const getLabel = () => {
    if (vocalError) return "Réessayer";
    switch (state) {
      case "recording":
        const minutes = Math.floor(duration / 60);
        const seconds = Math.floor(duration % 60);
        const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;
        return timeStr;
      case "thinking":
        return "Ophélia réfléchit...";
      case "speaking":
        return "Ophélia parle";
      default:
        return isHandsFree ? "Mode Auto" : "Maintenir pour parler";
    }
  };

  const pressStartRef = useRef(0);
  const ignoreNextClickRef = useRef(false);
  const stopTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
    };
  }, []);

  const tooltipContent = vocalError
    ? `Error: ${vocalError}`
    : isHandsFree
      ? isRecording
        ? "Stop listening"
        : "Click to talk"
      : onMicroModeChange
        ? microMode === "AMBIANCE"
          ? "Cliquer pour arrêter"
          : microMode === "DICTATION" && isRecording
            ? "Relâcher pour envoyer"
            : "Maintenir pour parler, Clic pour verrouiller"
        : "Appuyer pour parler";

  const handlePointerDown = (e) => {
    if (disabled || isHandsFree) return;
    if (!onMicroModeChange) return; // Fallback handled by onClick

    // If locked (AMBIANCE), ignore down (wait for click to stop)
    if (microMode === "AMBIANCE") return;

    // PTT Start
    pressStartRef.current = Date.now();

    // Use immediate local logic if props lag
    if (onMicroModeChange) onMicroModeChange("DICTATION");
    if (startRecording) {
      startRecording();
    }
  };

  const handlePointerUp = (e) => {
    if (disabled || isHandsFree) return;
    if (!onMicroModeChange) return;

    // If locked, ignore up
    if (microMode === "AMBIANCE") return;

    const pressDuration = Date.now() - pressStartRef.current;

    // Hybrid Logic:
    // < 300ms -> Treat as Click -> Handled in handleClick (Latch)
    // >= 300ms -> Treat as Hold -> Stop (PTT)

    if (pressDuration >= 300) {
      // Long press: Stop (PTT)
      if (stopRecording) stopRecording();
      if (onMicroModeChange) onMicroModeChange("OFF");

      // Prevent the subsequent click from triggering the Latch logic
      ignoreNextClickRef.current = true;
    }
    // Else (Short press): Do nothing here.
    // The recording continues (started in Down), and handleClick will latch it to AMBIANCE.
  };

  const handlePointerLeave = () => {
    if (disabled || isHandsFree) return;
    if (!onMicroModeChange) return;

    // If we leave the button area while holding down (PTT), we should stop.
    // However, if we were doing a click (<300ms), leaving might be accidental drag?
    // Let's treat Leave as Up.

    if (microMode === "AMBIANCE") return;

    // Trigger Up logic
    handlePointerUp();
  };

  // Double Click no longer needed for locking, but can stay as failsafe or removed.
  // User asked for "start on click", so single click is enough.
  // We remove double click handler to avoid confusion/conflict.

  const handleClick = (e) => {
    if (disabled) return;

    // Legacy / No-MicroMode behavior
    if (!onMicroModeChange || isHandsFree) {
      if (isRecording) {
        if (stopRecording) stopRecording();
      } else {
        if (startRecording) startRecording();
      }
      return;
    }

    // Check if this click should be ignored (because it was part of a Long Press PTT)
    if (ignoreNextClickRef.current) {
      ignoreNextClickRef.current = false;
      return;
    }

    // Unlock behavior (Simple Click stops AMBIANCE)
    if (microMode === "AMBIANCE") {
      if (isRecording && stopRecording) {
        stopRecording();
      }
      onMicroModeChange("OFF");
    } else {
      // Latch behavior (Short Click starts/confirms AMBIANCE)
      // Recording was already started in PointerDown (DICTATION)
      // Now we lock it to AMBIANCE
      onMicroModeChange("AMBIANCE");
    }
  };

  return (
    <div className={`flex flex-row items-center gap-4 ${className}`}>
      <Tooltip content={tooltipContent}>
        <button
          type="button"
          disabled={disabled}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onClick={handleClick}
          className={`${sizeClasses[size]} rounded-none flex items-center justify-center transition-all hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-x-0 active:translate-y-0 active:shadow-none border-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] group relative cursor-pointer ${getStyles()} ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
        >
          {(state === "recording" ||
            state === "speaking" ||
            (state === "idle" && onMicroModeChange && microMode === "AMBIANCE")) && (
            <div className="absolute inset-0 bg-current opacity-10 animate-ping" />
          )}

          <div className="relative z-10">
            {state === "idle" && <Mic size={32} strokeWidth={3} />}
            {state === "recording" && <Square size={32} strokeWidth={3} className="fill-current" />}
            {state === "thinking" && (
              <Sparkles size={32} strokeWidth={3} className="animate-pulse" />
            )}
            {state === "speaking" && <Volume2 size={32} strokeWidth={3} />}
          </div>
        </button>
      </Tooltip>

      {showLabel && (
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-widest text-black/40">
            {getLabel()}
          </span>
          {isRecording && transcriptionPreview && (
            <span className="text-[9px] font-bold text-black/60 italic leading-none max-w-[120px] truncate animate-pulse">
              "{transcriptionPreview}"
            </span>
          )}
        </div>
      )}
    </div>
  );
}
