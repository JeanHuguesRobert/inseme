import React, { useState, useEffect } from "react";
import { Mic, Square, Play, Volume2, Sparkles } from "lucide-react";
import { useVoiceTranscriber } from "../../cop-host/src/hooks/useVoiceTranscriber.js";
import { Tooltip } from "../../ui/src/index.js";

export function AdvancedTalkButton({
  mode = "free", // 'free' ou 'pro'
  apiKey = null,
  onTranscription = (text) => console.log("Transcription:", text),
  onError = (error) => console.error("Error:", error),
  className = "",
  size = "md",
  showLabel = true,
  disabled = false,
  language = "fr-FR",
}) {
  // États visuels
  const [visualVolume, setVisualVolume] = useState(0);

  // Hook de transcription unifié
  const { isRecording, isTranscribing, volume, duration, start, stop, cleanup, isSupported } =
    useVoiceTranscriber({
      mode,
      apiKey,
      onResult: onTranscription,
      onError: onError,
      onVolumeChange: setVisualVolume,
      language,
    });

  // Tailles des boutons
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24,
  };

  // Formater le temps
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Handlers pour les 3 boutons
  const handleStart = () => {
    if (!disabled && !isRecording) {
      start();
    }
  };

  const handleStop = () => {
    if (!disabled && isRecording) {
      stop();
    }
  };

  // Push-to-talk handlers
  const handleMouseDown = () => {
    if (!disabled && !isRecording) {
      start();
    }
  };

  const handleMouseUp = () => {
    if (!disabled && isRecording) {
      stop();
    }
  };

  const handleMouseLeave = () => {
    if (isRecording) {
      stop();
    }
  };

  // Nettoyage au démontage
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // État visuel
  let state = "idle";
  if (isTranscribing) state = "thinking";
  else if (isRecording) state = "recording";

  if (!isSupported) {
    return (
      <div className={`flex flex-col items-center gap-3 ${className}`}>
        <div className="text-red-500 text-sm font-bold">
          🎤 Audio non supporté sur ce navigateur
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      {/* 3 Buttons Row */}
      <div className="flex items-center gap-2">
        {/* Start Button */}
        <Tooltip content="Commencer l'enregistrement">
          <button
            type="button"
            disabled={disabled || isRecording}
            onClick={handleStart}
            className={`${sizeClasses[size]} bg-red-600 text-white border-4 border-black rounded-none flex items-center justify-center transition-all hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-x-0 active:translate-y-0 active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-pointer ${disabled || isRecording ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            <Play size={iconSizes[size]} strokeWidth={3} />
          </button>
        </Tooltip>

        {/* Stop Button */}
        <Tooltip content="Arrêter l'enregistrement">
          <button
            type="button"
            disabled={disabled || !isRecording}
            onClick={handleStop}
            className={`${sizeClasses[size]} bg-red-600 text-white border-4 border-black rounded-none flex items-center justify-center transition-all hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-x-0 active:translate-y-0 active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-pointer ${disabled || !isRecording ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            <Square size={iconSizes[size]} strokeWidth={3} className="fill-current" />
          </button>
        </Tooltip>

        {/* Push-to-Talk Button */}
        <Tooltip content={isRecording ? "Relâcher pour arrêter" : "Maintenir pour parler"}>
          <button
            type="button"
            disabled={disabled}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleMouseDown}
            onTouchEnd={handleMouseUp}
            className={`${sizeClasses[size]} ${isRecording ? "bg-red-600" : "bg-white text-black"} border-4 border-black rounded-none flex items-center justify-center transition-all hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-x-0 active:translate-y-0 active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-pointer ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            {isRecording ? (
              <Square size={iconSizes[size]} strokeWidth={3} className="fill-current" />
            ) : (
              <Mic size={iconSizes[size]} strokeWidth={3} />
            )}
          </button>
        </Tooltip>
      </div>

      {/* Status and Labels */}
      {showLabel && (
        <div className="flex flex-col items-center">
          {/* Chronometer - shows during recording */}
          {state === "recording" && (
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
              <span className="text-[12px] font-black text-red-600 uppercase tracking-widest">
                {formatTime(duration)}
              </span>
            </div>
          )}

          {/* State indicator */}
          <div className="flex items-center gap-2 mt-1">
            {state === "recording" && (
              <div className="flex items-center gap-1">
                <span className="text-[8px] font-bold text-red-600 uppercase">ENREGISTREMENT</span>
                <span className="text-[6px] text-gray-500">({mode})</span>
              </div>
            )}
            {state === "thinking" && (
              <div className="flex items-center gap-1">
                <Sparkles size={12} className="text-blue-600 animate-pulse" />
                <span className="text-[8px] font-bold text-blue-600 uppercase">TRANSCRIPTION</span>
              </div>
            )}
            {state === "idle" && (
              <span className="text-[8px] font-bold text-gray-500 uppercase">PRÊT</span>
            )}
          </div>

          {/* Volume visualizer (mode PRO only) */}
          {mode === "pro" && isRecording && (
            <div className="flex items-center gap-1 mt-2">
              <Volume2 size={10} className="text-gray-400" />
              <div className="w-16 h-1 bg-gray-300 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-100"
                  style={{ width: `${Math.min(visualVolume * 1000, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
