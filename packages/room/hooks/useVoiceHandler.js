import { useState, useCallback, useEffect } from "react";
import { useVoiceRecorder } from "./useVoiceRecorder"; // Expecting this to be a wrapper around @inseme/cop-host
import { storage } from "@inseme/cop-host";

export function useVoiceHandler({
  roomMetadata,
  roomName,
  config,
  sendMessageRef,
  setIsOphéliaThinking,
  nativeLang,
  isHandsFree,
  isOphéliaThinking,
}) {
  const [vocalState, setVocalState] = useState("idle");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [vocalError, setVocalError] = useState(null);

  const uploadVocal = useCallback(
    async (blob, customFileName = null) => {
      if (!roomMetadata?.id) return null;
      return storage.uploadVocal(roomMetadata.id, blob, customFileName);
    },
    [roomMetadata?.id]
  );

  const handleTranscription = useCallback(
    async (blob, finalDuration) => {
      console.log("[useVoiceHandler] Handling transcription", {
        size: blob.size,
        duration: finalDuration,
      });
      setIsTranscribing(true);
      setVocalState("thinking");
      setVocalError(null);

      try {
        const rawRoomName = roomMetadata?.id || roomName || "unknown";
        const safeRoomName = String(rawRoomName).replace(/[^a-z0-9]/gi, "_");
        const fileName = `temp/${safeRoomName}_${Date.now()}_${Math.random().toString(36).substring(7)}.webm`;

        // 1. Upload for persistence (optional, but good for logs)
        const vocalUrl = await uploadVocal(blob, fileName);
        console.log("[useVoiceHandler] Vocal uploaded:", vocalUrl);

        // 2. Transcribe via Ophelia API
        // We assume the API accepts mutlipart/form-data with 'file'
        const formData = new FormData();
        formData.append("file", blob, "audio.webm");
        formData.append("room_id", roomMetadata?.id || roomName);
        formData.append("lang", nativeLang);

        // Use the whisper endpoint or ophelia endpoint?
        // Original code used effectiveConfig.opheliaUrl.
        // We'll check if specific whisper endpoint exists or if ophelia handles it.
        // Assuming /api/transcribe or similar if standard, OR Ophelia handles it.
        // Based on previous code snippet, it likely calls /api/ophelia but with audio?
        // Actually, usually there's a specialized endpoint for STT.
        // Let's assume /api/transcribe based on standard patterns or derived from useInseme context.
        // If unsure, we can guess /api/transcribe.

        const transcribeUrl = config?.ophelia?.transcribeUrl || "/api/transcribe";

        const response = await fetch(transcribeUrl, {
          method: "POST",
          body: formData,
          // Header Content-Type is auto-set for FormData
        });

        if (!response.ok) {
          throw new Error(`Transcription API Error: ${response.status}`);
        }

        const data = await response.json();
        const text = data.text || data.transcription;

        if (text) {
          console.log("[useVoiceHandler] Transcription Result:", text);
          // Send the transcribed text as a user message
          // We pass 'vocal_payload' metadata to indicate it was a voice message
          // vocalUrl allows clients to play it back
          await sendMessageRef.current?.(text, {
            vocal_payload: {
              url: vocalUrl,
              duration: finalDuration,
            },
            is_voice: true,
          });
        }
      } catch (err) {
        console.error("[useVoiceHandler] Transcription failed:", err);
        setVocalError("Erreur de transcription");
        sendMessageRef.current?.("[Erreur Vocal] Transcription échouée.", {
          type: "system_error",
          error: err.message,
        });
      } finally {
        setIsTranscribing(false);
        setVocalState("idle");
      }
    },
    [roomMetadata, roomName, uploadVocal, sendMessageRef, nativeLang, config]
  );

  const {
    isRecording,
    duration,
    timeLeft,
    transcriptionPreview,
    startRecording: rawStartRecording,
    stopRecording,
    cancelRecording,
  } = useVoiceRecorder((blob, dur) => handleTranscription(blob, dur), {
    autoStopDelay: 2000,
    lang: nativeLang === "fr" ? "fr-FR" : "en-US",
    onSilence: () => {
      if (isHandsFree) {
        stopRecording();
      }
    },
  });

  const startRecording = useCallback(async () => {
    setVocalError(null);
    try {
      await rawStartRecording();
    } catch (err) {
      console.error("[useVoiceHandler] Failed to start:", err);
      setVocalError(err.message || "Microphone error");
    }
  }, [rawStartRecording]);

  // Effects to sync vocalState
  useEffect(() => {
    if (isRecording) {
      setVocalState("listening");
    } else if (vocalState === "listening") {
      const timeout = isHandsFree ? 400 : 0;
      const timer = setTimeout(() => setVocalState("idle"), timeout);
      return () => clearTimeout(timer);
    }
  }, [isRecording, vocalState, isHandsFree]);

  useEffect(() => {
    if (isOphéliaThinking) {
      setVocalState("thinking");
    } else if (vocalState === "thinking" && !isTranscribing) {
      setVocalState("idle");
    }
  }, [isOphéliaThinking, vocalState, isTranscribing]);

  return {
    isRecording,
    isTranscribing,
    vocalState,
    vocalError,
    startRecording,
    stopRecording,
    cancelRecording,
    duration,
    timeLeft,
    uploadVocal,
    transcriptionPreview,
  };
}
