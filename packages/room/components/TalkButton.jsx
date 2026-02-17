import React, { useRef, useEffect, useState } from "react";
import { Mic, Square, Loader2, Volume2, Bot, Sparkles, AlertCircle, Play } from "lucide-react";
import { Tooltip } from "../../ui/src/index.js";
import { vocalLogger } from "../../cop-host/src/lib/axiom.js";

// Unified 3-Button Recording Component
export function TalkButton({
  startRecording,
  stopRecording,
  isRecording,
  isTranscribing,
  vocalError,
  transcriptionPreview,
  duration = 0,
  isHandsFree = false,
  microMode = "default",
  onMicroModeChange,
  className = "",
  size = "md",
  showLabel = true,
  disabled = false,
  state,
  vocalState,
}) {
  // Log initial state
  vocalLogger.talkButton("COMPONENT INITIALIZED", {
    hasStartRecording: !!startRecording,
    hasStopRecording: !!stopRecording,
    isRecording,
    isTranscribing,
    hasVocalError: !!vocalError,
    hasTranscriptionPreview: !!transcriptionPreview,
    duration,
    isHandsFree,
    microMode,
    disabled,
    state,
    vocalState,
    timestamp: new Date().toISOString(),
  });

  // Determine current visual state
  let visualState = "idle";
  if (isTranscribing) visualState = "thinking";
  else if (isRecording) visualState = "recording";
  else if (vocalState === "speaking") visualState = "speaking";
  else if (vocalState === "thinking") visualState = "thinking";

  // Chronometer state
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingStartTimeRef = useRef(null);

  // Audio visualization state
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Update chronometer when recording
  useEffect(() => {
    if (isRecording) {
      if (!recordingStartTimeRef.current) {
        recordingStartTimeRef.current = Date.now() - duration * 1000;
      }

      const interval = setInterval(() => {
        const elapsed = (Date.now() - recordingStartTimeRef.current) / 1000;
        setRecordingTime(elapsed);
      }, 100); // Update every 100ms for smooth display

      return () => clearInterval(interval);
    } else {
      recordingStartTimeRef.current = null;
      setRecordingTime(duration);
    }
  }, [isRecording, duration]);

  // Handle tab change - stop recording when page becomes hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isRecording && stopRecording) {
        console.log("Page hidden - stopping recording");
        stopRecording();
        if (onMicroModeChange) onMicroModeChange("OFF");
      }
    };

    const handleBeforeUnload = (event) => {
      if (isRecording) {
        console.log("Page unloading - stopping recording");
        if (stopRecording) stopRecording();
        if (onMicroModeChange) onMicroModeChange("OFF");
        // Message pour l'utilisateur
        event.preventDefault();
        event.returnValue = "Un enregistrement est en cours. Êtes-vous sûr de vouloir quitter ?";
      }
    };

    // Écouter les événements
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isRecording, stopRecording, onMicroModeChange]);

  // Audio level visualization
  useEffect(() => {
    if (isRecording) {
      const setupAudioVisualization = async () => {
        try {
          // Get microphone stream
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

          // Create audio context and analyser
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const analyser = audioContext.createAnalyser();
          const source = audioContext.createMediaStreamSource(stream);

          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.8;
          source.connect(analyser);

          audioContextRef.current = audioContext;
          analyserRef.current = analyser;

          // Animation loop for audio level
          const checkAudioLevel = () => {
            if (!analyserRef.current) return;

            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);

            // Calculate average volume
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const average = sum / dataArray.length;

            // Normalize to 0-100 range
            const normalizedLevel = Math.min(100, (average / 128) * 100);
            setAudioLevel(normalizedLevel);

            animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
          };

          checkAudioLevel();
        } catch (error) {
          console.error("Error setting up audio visualization:", error);
        }
      };

      setupAudioVisualization();
    } else {
      // Cleanup when not recording
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      setAudioLevel(0);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [isRecording]);

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
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
      default:
        return "bg-white text-black border-black hover:bg-black hover:text-white";
    }
  };

  const getLabel = () => {
    if (vocalError) return "Réessayer";
    switch (state) {
      case "recording": {
        const minutes = Math.floor(recordingTime / 60);
        const seconds = Math.floor(recordingTime % 60);
        const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;
        return timeStr;
      }
      case "thinking":
        return "Ophélia réfléchit...";
      case "speaking":
        return "Ophélia parle";
      default:
        return isHandsFree ? "Mode Auto" : "Enregistrement";
    }
  };

  const handleStart = () => {
    vocalLogger.talkButton("START BUTTON CLICKED", {
      disabled,
      isRecording,
      hasStartRecording: !!startRecording,
      timestamp: new Date().toISOString(),
    });

    if (!disabled && startRecording) {
      vocalLogger.talkButton("✅ Starting recording");
      startRecording();
      if (onMicroModeChange) onMicroModeChange("DICTATION");
    } else {
      vocalLogger.talkButton("❌ Cannot start recording", {
        disabled,
        hasStartRecording: !!startRecording,
      });
    }
  };

  const handleStop = () => {
    vocalLogger.talkButton("STOP BUTTON CLICKED", {
      disabled,
      isRecording,
      hasStopRecording: !!stopRecording,
      timestamp: new Date().toISOString(),
    });

    if (!disabled && stopRecording) {
      vocalLogger.talkButton("✅ Stopping recording");
      stopRecording();
      if (onMicroModeChange) onMicroModeChange("OFF");
    } else {
      vocalLogger.talkButton("❌ Cannot stop recording", {
        disabled,
        hasStopRecording: !!stopRecording,
      });
    }
  };

  // Push-to-talk handlers
  const handleMouseDown = (e) => {
    // Prevent default to avoid focus issues and unexpected behaviors
    if (e.cancelable) e.preventDefault();

    console.log("[TalkButton] 🎯 PUSH-TO-TALK START (Down/TouchStart)");

    if (!disabled && !isRecording && startRecording) {
      console.log("[TalkButton] ✅ Starting push-to-talk recording");
      startRecording();
      if (onMicroModeChange) onMicroModeChange("DICTATION");

      // Robustness: handle release outside the button
      const handleGlobalRelease = () => {
        console.log("[TalkButton] 🎯 PUSH-TO-TALK GLOBAL RELEASE");
        if (stopRecording) stopRecording();
        if (onMicroModeChange) onMicroModeChange("OFF");
        window.removeEventListener("mouseup", handleGlobalRelease);
        window.removeEventListener("touchend", handleGlobalRelease);
      };

      window.addEventListener("mouseup", handleGlobalRelease);
      window.addEventListener("touchend", handleGlobalRelease);
    }
  };

  const handleMouseUp = () => {
    // Normal stop logic is handled by global release to avoid double calls
    console.log("[TalkButton] 🎯 PUSH-TO-TALK UP (local)");
  };

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
            className={`${sizeClasses[size]} bg-mondrian-red text-white border-4 border-black rounded-none flex items-center justify-center transition-all hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-x-0 active:translate-y-0 active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-pointer ${disabled || isRecording ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            <Play size={size === "sm" ? 16 : size === "md" ? 20 : 24} strokeWidth={3} />
          </button>
        </Tooltip>

        {/* Stop Button */}
        <Tooltip content="Arrêter l'enregistrement">
          <button
            type="button"
            disabled={disabled || !isRecording}
            onClick={handleStop}
            className={`${sizeClasses[size]} bg-mondrian-red text-white border-4 border-black rounded-none flex items-center justify-center transition-all hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-x-0 active:translate-y-0 active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-pointer ${disabled || !isRecording ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            <Square
              size={size === "sm" ? 16 : size === "md" ? 20 : 24}
              strokeWidth={3}
              className="fill-current"
            />
          </button>
        </Tooltip>

        {/* Push-to-Talk Button */}
        <Tooltip content={isRecording ? "Relâcher pour arrêter" : "Maintenir pour parler"}>
          <button
            type="button"
            disabled={disabled}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchEnd={handleMouseUp}
            className={`${sizeClasses[size]} ${isRecording ? "bg-mondrian-red" : "bg-white text-black"} border-4 border-black rounded-none flex items-center justify-center transition-all hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-x-0 active:translate-y-0 active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-pointer ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            {isRecording ? (
              <Square
                size={size === "sm" ? 16 : size === "md" ? 20 : 24}
                strokeWidth={3}
                className="fill-current"
              />
            ) : (
              <Mic size={size === "sm" ? 16 : size === "md" ? 20 : 24} strokeWidth={3} />
            )}
          </button>
        </Tooltip>
      </div>

      {/* Status and Labels */}
      {showLabel && (
        <div className="flex flex-col items-center">
          {/* State indicator */}
          <div className="flex items-center gap-2 mt-1">
            {state === "recording" && (
              <div className="flex items-center gap-1">
                <span className="text-[8px] font-bold text-mondrian-red uppercase">
                  ENREGISTREMENT
                </span>
              </div>
            )}
            {state === "thinking" && (
              <div className="flex items-center gap-1">
                <Sparkles size={12} className="text-mondrian-blue animate-pulse" />
                <span className="text-[8px] font-bold text-mondrian-blue uppercase">RÉFLEXION</span>
              </div>
            )}
            {state === "speaking" && (
              <div className="flex items-center gap-1">
                <Volume2 size={12} className="text-mondrian-yellow" />
                <span className="text-[8px] font-bold text-mondrian-yellow uppercase">PARLE</span>
              </div>
            )}
            {state === "idle" && (
              <span className="text-[8px] font-bold text-black/40 uppercase">PRÊT</span>
            )}
          </div>

          {/* Combined Recording Display - shows during recording */}
          {state === "recording" && (
            <div className="flex flex-col items-center gap-2 mt-2 w-full max-w-xs">
              {/* Top row: Time + Audio Level */}
              <div className="flex items-center gap-3 w-full">
                {/* Time display with pulse indicator */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-2 h-2 bg-mondrian-red rounded-full animate-pulse" />
                  <span className="text-[11px] font-black text-mondrian-red uppercase tracking-widest font-mono">
                    {getLabel()}
                  </span>
                </div>

                {/* Audio level bar */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Volume2 size={8} className="text-gray-400 flex-shrink-0" />
                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden min-w-0">
                    <div
                      className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-75 ease-out"
                      style={{
                        width: `${audioLevel}%`,
                        boxShadow: audioLevel > 50 ? "0 0 6px rgba(34, 197, 94, 0.4)" : "none",
                      }}
                    />
                  </div>
                  <span className="text-[5px] text-gray-500 font-mono w-6 text-right flex-shrink-0">
                    {Math.round(audioLevel)}%
                  </span>
                </div>
              </div>

              {/* Bottom row: Audio level bars */}
              <div className="flex items-end justify-center gap-1 h-4 w-full">
                {[...Array(7)].map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-mondrian-red transition-all duration-75 ease-out rounded-t max-w-[3px]"
                    style={{
                      height: `${Math.max(1, (audioLevel / 100) * 16 * (1 - i * 0.12))}px`,
                      opacity: audioLevel > i * 15 ? 1 : 0.15,
                      minHeight: "1px",
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Transcription preview */}
          {isRecording && transcriptionPreview && (
            <span className="text-[9px] font-bold text-black/60 italic leading-none max-w-[200px] truncate animate-pulse text-center mt-1">
              "{transcriptionPreview}"
            </span>
          )}
        </div>
      )}
    </div>
  );
}
