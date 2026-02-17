import { useState, useCallback, useRef } from "react";
import { getSupabase } from "../../cop-host/src/client/supabase.js";

export function useVocalMessage({ roomMetadata, user, onMessageSent, onError }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const processingRef = useRef(false);
  const supabase = getSupabase();

  const saveVocalMessage = useCallback(
    async (audioBlob, transcription, duration) => {
      if (processingRef.current) {
        console.log("[useVocalMessage] ⚠️ Already processing, skipping");
        return;
      }

      processingRef.current = true;
      setIsProcessing(true);

      console.log("[useVocalMessage] 💾 STARTING VOCAL MESSAGE SAVE", {
        timestamp: new Date().toISOString(),
        audioSize: audioBlob.size,
        audioType: audioBlob.type,
        transcription: transcription?.substring(0, 100) + "...",
        fullTranscriptionLength: transcription?.length || 0,
        duration,
        userId: user?.id,
        userName: user?.name,
        roomId: roomMetadata?.id,
        roomSlug: roomMetadata?.slug,
      });

      try {
        console.log("[useVocalMessage] 📤 STEP 1: Uploading audio file to storage");

        // 1. Upload audio file to storage
        const audioUrl = await uploadAudioFile(audioBlob);
        console.log("[useVocalMessage] ✅ STEP 1 COMPLETE: Audio uploaded:", audioUrl);

        // 2. Save message to inseme_messages with both text and audio
        console.log("[useVocalMessage] 💾 STEP 2: Saving to database");
        const messageData = {
          room_id: roomMetadata?.id || roomMetadata?.slug || "unknown",
          user_id: user?.id || null,
          name: user?.name || "Anonymous",
          message: transcription || "[Message vocal sans transcription]",
          type: "vocal", // New type for vocal messages
          metadata: {
            is_voice: true,
            vocal_payload: {
              url: audioUrl,
              duration: duration,
              size: audioBlob.size,
              mime_type: audioBlob.type,
              transcription: transcription,
              transcription_confidence: transcription ? 0.9 : 0,
              recorded_at: new Date().toISOString(),
              user_id: user?.id,
              room_id: roomMetadata?.id,
            },
            audio_mode: "dual", // Indicates both text and audio available
            transcription: transcription,
            duration: duration,
            file_size: audioBlob.size,
            language: detectLanguage(transcription),
            has_audio: true,
            has_text: !!transcription,
          },
        };

        const { data: savedMessage, error: saveError } = await supabase
          .from("inseme_messages")
          .insert([messageData])
          .select()
          .single();

        if (saveError) {
          throw new Error(`Failed to save message: ${saveError.message}`);
        }

        console.log("[useVocalMessage] Message saved successfully:", savedMessage);

        // 3. Notify parent component
        if (onMessageSent) {
          onMessageSent(savedMessage);
        }

        return savedMessage;
      } catch (error) {
        console.error("[useVocalMessage] Error processing vocal message:", error);

        if (onError) {
          onError(error);
        }

        // Fallback: save as text-only message if audio upload fails
        try {
          const fallbackData = {
            room_id: roomMetadata?.id || roomMetadata?.slug || "unknown",
            user_id: user?.id || null,
            name: user?.name || "Anonymous",
            message: transcription || "[Message vocal - erreur de traitement]",
            type: "chat",
            metadata: {
              is_voice: true,
              vocal_error: error.message,
              transcription: transcription,
              duration: duration,
              fallback_mode: true,
            },
          };

          const { data: fallbackMessage } = await supabase
            .from("inseme_messages")
            .insert([fallbackData])
            .select()
            .single();

          console.log("[useVocalMessage] Fallback message saved:", fallbackMessage);
          return fallbackMessage;
        } catch (fallbackError) {
          console.error("[useVocalMessage] Fallback also failed:", fallbackError);
          throw error; // Throw original error
        }
      } finally {
        processingRef.current = false;
        setIsProcessing(false);
      }
    },
    [roomMetadata, user, onMessageSent, onError, supabase]
  );

  const uploadAudioFile = useCallback(
    async (audioBlob) => {
      const rawRoomName = roomMetadata?.id || roomMetadata?.slug || "unknown";
      const safeRoomName = String(rawRoomName).replace(/[^a-z0-9]/gi, "_");
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(7);

      const fileName = `vocal_messages/${safeRoomName}/${timestamp}_${randomId}.webm`;

      console.log("[useVocalMessage] Uploading audio file:", fileName);

      const { data, error } = await supabase.storage
        .from("vocal-messages")
        .upload(fileName, audioBlob, {
          contentType: "audio/webm;codecs=opus",
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        throw new Error(`Audio upload failed: ${error.message}`);
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("vocal-messages").getPublicUrl(fileName);

      console.log("[useVocalMessage] Audio public URL:", publicUrl);
      return publicUrl;
    },
    [roomMetadata, supabase]
  );

  const detectLanguage = useCallback((text) => {
    if (!text) return "unknown";

    // Simple language detection based on common words
    const frenchWords = [
      "le",
      "la",
      "les",
      "de",
      "du",
      "des",
      "et",
      "est",
      "dans",
      "pour",
      "avec",
      "une",
      "un",
    ];
    const englishWords = [
      "the",
      "and",
      "is",
      "in",
      "to",
      "of",
      "a",
      "for",
      "with",
      "on",
      "at",
      "by",
    ];

    const lowerText = text.toLowerCase();
    const frenchCount = frenchWords.filter((word) => lowerText.includes(word)).length;
    const englishCount = englishWords.filter((word) => lowerText.includes(word)).length;

    if (frenchCount > englishCount) return "fr";
    if (englishCount > frenchCount) return "en";
    return "unknown";
  }, []);

  const getVocalMessages = useCallback(
    async (roomId = null) => {
      try {
        const targetRoomId = roomId || roomMetadata?.id || roomMetadata?.slug;

        const { data, error } = await supabase
          .from("inseme_messages")
          .select("*")
          .eq("room_id", targetRoomId)
          .in("type", ["vocal", "chat"]) // Include vocal messages and chat with vocal metadata
          .order("created_at", { ascending: true });

        if (error) {
          throw new Error(`Failed to fetch vocal messages: ${error.message}`);
        }

        // Filter messages that have vocal content
        const vocalMessages = data.filter(
          (msg) => msg.metadata?.is_voice || msg.metadata?.vocal_payload || msg.metadata?.vocal_url
        );

        console.log("[useVocalMessage] Retrieved vocal messages:", vocalMessages.length);
        return vocalMessages;
      } catch (error) {
        console.error("[useVocalMessage] Error fetching vocal messages:", error);
        if (onError) onError(error);
        return [];
      }
    },
    [roomMetadata, supabase, onError]
  );

  const deleteVocalMessage = useCallback(
    async (messageId) => {
      try {
        // First get the message to find the audio file
        const { data: message, error: fetchError } = await supabase
          .from("inseme_messages")
          .select("metadata")
          .eq("id", messageId)
          .single();

        if (fetchError) {
          throw new Error(`Failed to fetch message: ${fetchError.message}`);
        }

        // Delete audio file if exists
        if (message.metadata?.vocal_payload?.url) {
          const audioUrl = message.metadata.vocal_payload.url;
          const fileName = audioUrl.split("/").pop();

          const { error: deleteError } = await supabase.storage
            .from("vocal-messages")
            .remove([fileName]);

          if (deleteError) {
            console.warn("[useVocalMessage] Failed to delete audio file:", deleteError);
          }
        }

        // Delete message record
        const { error: deleteMessageError } = await supabase
          .from("inseme_messages")
          .delete()
          .eq("id", messageId);

        if (deleteMessageError) {
          throw new Error(`Failed to delete message: ${deleteMessageError.message}`);
        }

        console.log("[useVocalMessage] Message deleted successfully:", messageId);
        return true;
      } catch (error) {
        console.error("[useVocalMessage] Error deleting vocal message:", error);
        if (onError) onError(error);
        return false;
      }
    },
    [supabase, onError]
  );

  return {
    saveVocalMessage,
    getVocalMessages,
    deleteVocalMessage,
    uploadAudioFile,
    isProcessing,
    detectLanguage,
  };
}
