import { useState, useCallback, useEffect } from "react";
import { useVoiceRecorder } from "../../cop-host/src/hooks/useVoiceRecorder.js";
import { useVocalMessage } from "./useVocalMessage.js";
import { storage } from "../../cop-host/src/lib/storage.js";
import { AudioAnalyzer } from "../../cop-host/src/utils/audioAnalyzer.js";
import { vocalLogger } from "../../cop-host/src/lib/axiom.js";

export function useVoiceHandler({
  roomMetadata,
  roomName,
  config,
  sendMessageRef,
  setIsOphéliaThinking,
  nativeLang,
  isHandsFree,
  isOphéliaThinking,
  user, // Add user parameter for vocal message handling
}) {
  const [vocalState, setVocalState] = useState("idle");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [vocalError, setVocalError] = useState(null);

  // Initialize vocal message handler
  const { saveVocalMessage, isProcessing } = useVocalMessage({
    roomMetadata,
    user,
    onError: (error) => setVocalError(error.message),
    onMessageSent: (message) => {
      console.log("[useVoiceHandler] Vocal message saved:", message);
      // Optionally notify parent component
    },
  });

  const uploadVocal = useCallback(
    async (blob, customFileName = null) => {
      if (!roomMetadata?.id) return null;
      return storage.uploadVocal(roomMetadata.id, blob, customFileName);
    },
    [roomMetadata?.id]
  );

  const handleTranscription = useCallback(
    async (blob, finalDuration) => {
      vocalLogger.voiceHandler("🎤 STARTING TRANSCRIPTION PROCESS", {
        timestamp: new Date().toISOString(),
        blobSize: blob.size,
        duration: finalDuration,
        blobType: blob.type,
        roomMetadata: roomMetadata?.id,
        userName: user?.name,
        userId: user?.id,
      });

      setIsTranscribing(true);
      setVocalState("thinking");
      setVocalError(null);

      try {
        vocalLogger.voiceHandler("🔍 STEP 0: Analyzing audio quality");

        // Analyze audio quality before processing
        const audioAnalysis = await AudioAnalyzer.analyzeAudioBlob(blob);
        vocalLogger.audioAnalyzer("📊 Audio analysis complete", audioAnalysis);

        // Check for "you" issue specifically
        const youIssues = AudioAnalyzer.checkForYouIssue(audioAnalysis.audioBuffer || blob);
        if (youIssues.length > 0) {
          vocalLogger.audioAnalyzer("⚠️ POTENTIAL 'YOU' ISSUE DETECTED", { issues: youIssues });
          youIssues.forEach((issue) => {
            vocalLogger.audioAnalyzer(`   - ${issue.message} (${issue.severity})`);
          });
        }

        vocalLogger.voiceHandler("📤 STEP 1: Starting audio upload");

        const rawRoomName = roomMetadata?.id || roomName || "unknown";
        const safeRoomName = String(rawRoomName).replace(/[^a-z0-9]/gi, "_");
        const fileName = `temp/${safeRoomName}_${Date.now()}_${Math.random().toString(36).substring(7)}.webm`;

        console.log("[useVoiceHandler] 📁 File info:", { rawRoomName, safeRoomName, fileName });

        // 1. Upload for persistence (optional, but good for logs)
        const vocalUrl = await uploadVocal(blob, fileName);
        console.log("[useVoiceHandler] ✅ STEP 1 COMPLETE: Vocal uploaded:", vocalUrl);

        // 2. Transcribe via Ophelia API
        console.log("[useVoiceHandler] 🤖 STEP 2: Starting transcription");

        const formData = new FormData();
        formData.append("file", blob, "audio.webm");
        formData.append("room_id", roomMetadata?.id || roomName);
        formData.append("lang", nativeLang);

        console.log("[useVoiceHandler] 📋 FormData prepared:", {
          fileSize: blob.size,
          roomId: roomMetadata?.id || roomName,
          language: nativeLang,
        });

        const transcribeUrl = config?.ophelia?.transcribeUrl || "/api/transcribe";
        console.log("[useVoiceHandler] 🌐 Calling transcription API:", transcribeUrl);

        // Log FormData contents before sending
        console.log("[useVoiceHandler] 📤 FORMDATA CONTENTS:", {
          hasFile: formData.has("file"),
          hasRoomId: formData.has("room_id"),
          hasLang: formData.has("lang"),
          entries: Array.from(formData.entries()).map(([key, value]) => ({
            key,
            value:
              value instanceof File
                ? {
                    name: value.name,
                    size: value.size,
                    type: value.type,
                  }
                : value,
          })),
        });

        const response = await fetch(transcribeUrl, {
          method: "POST",
          body: formData,
        });

        console.log("[useVoiceHandler] 📡 API Response:", {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries()),
          url: response.url,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("[useVoiceHandler] ❌ API Error Response:", errorText);
          throw new Error(`Transcription API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log("[useVoiceHandler] 📝 API Response data:", data);

        const text = data.text || data.transcription;

        if (text) {
          console.log("[useVoiceHandler] ✅ STEP 2 COMPLETE: Transcription Result:", text);

          // Save vocal message with both text and audio
          console.log("[useVoiceHandler] 💾 STEP 3: Saving vocal message");
          try {
            const savedMessage = await saveVocalMessage(blob, text, finalDuration);
            console.log(
              "[useVoiceHandler] ✅ STEP 3 COMPLETE: Vocal message saved successfully:",
              savedMessage
            );
          } catch (saveError) {
            console.error(
              "[useVoiceHandler] ❌ STEP 3 FAILED: Failed to save vocal message:",
              saveError
            );
            console.log("[useVoiceHandler] 🔄 Using fallback method");
            // Fallback to old method
            await sendMessageRef.current?.(text, {
              vocal_payload: {
                url: vocalUrl,
                duration: finalDuration,
              },
              is_voice: true,
            });
            console.log("[useVoiceHandler] ✅ Fallback message sent");
          }
        } else {
          console.warn("[useVoiceHandler] ⚠️ No transcription text in response");
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
    [roomMetadata, roomName, uploadVocal, sendMessageRef, nativeLang, config, saveVocalMessage]
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
    autoStopDelay: 10000,
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
