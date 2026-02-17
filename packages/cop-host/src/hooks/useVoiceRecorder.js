// src/hooks/useVoiceRecorder.js
import { useState, useRef, useCallback, useEffect } from "react";

export function useVoiceRecorder(onTranscription, options = {}) {
  const { autoStopDelay = 2000 } = options;
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [transcriptionPreview, setTranscriptionPreview] = useState("");
  const durationRef = useRef(0);
  const recognitionRef = useRef(null);
  const startTimeRef = useRef(null);
  const [timeLeft, setTimeLeft] = useState(300);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const isCancelledRef = useRef(false);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const animationFrameRef = useRef(null);

  const stopRecording = useCallback((cancelled = false) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      isCancelledRef.current = cancelled;
      mediaRecorderRef.current.stop();
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    // Capture the current duration at the moment stop is called
    const finalDuration = durationRef.current;

    // Don't close audio context or stop tracks here if we want to reuse them
    // But for safety in current architecture, we only do it if not cancelled
    if (cancelled) {
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }

    setIsRecording(false);
    return finalDuration;
  }, []);

  const startRecording = useCallback(async () => {
    try {
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
      }
      const stream = streamRef.current;

      // Silence Detection
      if (!audioContextRef.current) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 256;
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
      }

      const analyser = analyserRef.current;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkSilence = () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== "recording") return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;

        if (average < 10) {
          // Silence threshold
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              if (options.onSilence) {
                options.onSilence();
              } else {
                stopRecording(false);
              }
            }, autoStopDelay);
          }
        } else {
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        }
        animationFrameRef.current = requestAnimationFrame(checkSilence);
      };

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      isCancelledRef.current = false;
      setDuration(0);
      setTranscriptionPreview("");
      durationRef.current = 0;
      startTimeRef.current = Date.now();
      setTimeLeft(300);

      // Local Transcription Preview (Web Speech API)
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition && !options.disableLocalPreview) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = options.lang || "fr-FR";

        recognition.onresult = (event) => {
          let interimTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              // Final results are handled by the cloud transcription (Whisper)
              // but we keep them in preview until Whisper finishes
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          setTranscriptionPreview(interimTranscript);
        };

        recognition.onerror = (err) => {
          console.warn("[useVoiceRecorder] Local SpeechRecognition error:", err.error);
        };

        recognition.start();
        recognitionRef.current = recognition;
      }

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        // We don't stop tracks here anymore to allow reuse and avoid flickering
        if (!isCancelledRef.current && chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: "audio/webm;codecs=opus" });

          // OpenAI Whisper requires at least 0.1s.
          // We calculate the precise duration to avoid 400 errors.
          const preciseDuration = startTimeRef.current
            ? (Date.now() - startTimeRef.current) / 1000
            : durationRef.current;

          // If the blob is too small or duration too short, we ignore it
          if (blob.size < 500 || preciseDuration < 0.2) {
            console.warn(
              `Audio trop court (${preciseDuration.toFixed(2)}s, ${blob.size} bytes) ignoré.`
            );
            return;
          }

          if (onTranscription) {
            onTranscription(blob, preciseDuration);
          }
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      checkSilence();

      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          const next = prev + 1;
          durationRef.current = next;
          return next;
        });
        setTimeLeft((prev) => {
          if (prev <= 1) {
            stopRecording(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Erreur d'accès au microphone:", err);
      if (err.name === "NotAllowedError") {
        throw new Error(
          "L'accès au microphone a été refusé. Veuillez vérifier les permissions de votre navigateur."
        );
      } else if (err.name === "NotFoundError") {
        throw new Error("Aucun microphone n'a été trouvé sur cet appareil.");
      }
      throw err;
    }
  }, [onTranscription, stopRecording, autoStopDelay, options]);

  const addTime = useCallback(() => {
    setTimeLeft(300);
  }, []);

  const cancelRecording = useCallback(() => {
    stopRecording(true);
  }, [stopRecording]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return {
    isRecording,
    duration,
    timeLeft,
    transcriptionPreview,
    startRecording,
    stopRecording: () => stopRecording(false),
    cancelRecording,
    addTime,
  };
}
