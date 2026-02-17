import { useState, useRef, useCallback, useEffect } from "react";

export function useVoiceTranscriber(options = {}) {
  const {
    mode = "free", // 'free' ou 'pro'
    apiKey = null,
    onResult = (text) => console.log("Transcription:", text),
    onError = (error) => console.error("Voice error:", error),
    onVolumeChange = (volume) => {},
    silenceThreshold = 2000, // 2 secondes
    language = "fr-FR",
  } = options;

  // États
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [volume, setVolume] = useState(0);
  const [duration, setDuration] = useState(0);

  // Refs
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const silenceNodeRef = useRef(null);
  const streamRef = useRef(null);
  const startTimeRef = useRef(null);
  const durationIntervalRef = useRef(null);

  // Nettoyage
  const cleanup = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    setIsRecording(false);
    setIsTranscribing(false);
    setVolume(0);
    setDuration(0);
  }, []);

  // Mode FREE - Web Speech API
  const startFree = useCallback(() => {
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        throw new Error("Speech recognition not supported in this browser");
      }

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      recognition.continuous = false; // Auto-stop sur silence
      recognition.interimResults = true;
      recognition.lang = language;

      recognition.onstart = () => {
        setIsRecording(true);
        startTimeRef.current = Date.now();
        durationIntervalRef.current = setInterval(() => {
          setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }, 100);
      };

      recognition.onresult = (event) => {
        const result = event.results[0];
        if (result.isFinal) {
          const text = result[0].transcript;
          setIsTranscribing(true);
          onResult(text);
          setIsTranscribing(false);
        }
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        onError(new Error(`Speech recognition error: ${event.error}`));
        cleanup();
      };

      recognition.onend = () => {
        cleanup();
      };

      recognition.start();
    } catch (error) {
      onError(error);
    }
  }, [language, onResult, onError, cleanup]);

  // Mode PRO - MediaRecorder + AudioWorklet
  const startPro = useCallback(async () => {
    try {
      // Demander permissions microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Setup AudioContext et AudioWorklet
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;

      // Charger le processeur de silence
      await audioContext.audioWorklet.addModule("/workers/silence-processor.js");

      const source = audioContext.createMediaStreamSource(stream);
      const silenceNode = new AudioWorkletNode(audioContext, "silence-processor");
      silenceNodeRef.current = silenceNode;

      // Setup MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      mediaRecorderRef.current = mediaRecorder;

      const chunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstart = () => {
        setIsRecording(true);
        startTimeRef.current = Date.now();
        durationIntervalRef.current = setInterval(() => {
          setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }, 100);
      };

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
        }

        if (chunks.length > 0) {
          setIsTranscribing(true);
          try {
            const blob = new Blob(chunks, { type: "audio/webm;codecs=opus" });
            await transcribeAudio(blob);
          } catch (error) {
            onError(error);
          } finally {
            setIsTranscribing(false);
          }
        }
        cleanup();
      };

      // Gérer les messages du processeur de silence
      silenceNode.port.onmessage = (event) => {
        const { type, volume: vol, isSilent, duration: silenceDuration } = event.data;

        if (type === "volume") {
          setVolume(vol);
          onVolumeChange(vol);
        } else if (type === "silence_detected") {
          console.log(`Silence detected after ${silenceDuration}ms`);
          stop();
        }
      };

      // Connecter les nodes audio
      source.connect(silenceNode);

      // Démarrer l'enregistrement
      mediaRecorder.start(100); // Collect data every 100ms
    } catch (error) {
      onError(error);
      cleanup();
    }
  }, [onResult, onError, onVolumeChange, cleanup]);

  // Transcription avec API (mode PRO)
  const transcribeAudio = useCallback(
    async (blob) => {
      if (!apiKey) {
        // Fallback vers Web Speech API si pas de clé API
        console.warn("No API key provided, falling back to Web Speech API");
        return;
      }

      const formData = new FormData();
      formData.append("file", blob, "audio.webm");
      formData.append("model", "whisper-1");
      formData.append("language", language.split("-")[0]); // 'fr' au lieu de 'fr-FR'

      try {
        const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();
        onResult(data.text);
      } catch (error) {
        console.error("Whisper API error:", error);
        // Fallback vers Web Speech API
        onError(error);
      }
    },
    [apiKey, language, onResult, onError]
  );

  // Démarrer l'enregistrement
  const start = useCallback(async () => {
    if (isRecording) return;

    try {
      if (mode === "free") {
        startFree();
      } else {
        await startPro();
      }
    } catch (error) {
      onError(error);
    }
  }, [mode, isRecording, startFree, startPro, onError]);

  // Gestion du changement d'onglet/page
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isRecording) {
        console.log("Page hidden - stopping recording");
        stop();
        onError(new Error("Enregistrement arrêté : changement d'onglet"));
      }
    };

    const handleBeforeUnload = (event) => {
      if (isRecording) {
        console.log("Page unloading - stopping recording");
        stop();
        // Message pour l'utilisateur (optionnel)
        event.preventDefault();
        event.returnValue = "Un enregistrement est en cours. Êtes-vous sûr de vouloir quitter ?";
      }
    };

    // Écouter les événements de visibilité et de fermeture
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isRecording, stop, onError]);

  return {
    // États
    isRecording,
    isTranscribing,
    volume,
    duration,

    // Actions
    start,
    stop,

    // Utilitaires
    cleanup,

    // Info
    mode,
    isSupported: !!(
      window.SpeechRecognition ||
      window.webkitSpeechRecognition ||
      navigator.mediaDevices
    ),
  };
}
