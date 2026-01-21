import { useCallback, useEffect } from "react";
import { storage } from "@inseme/cop-host";

export function useReporting({
  roomMetadata,
  messages,
  roomName,
  isEphemeral,
  supabase,
  sendMessageRef,
  setIsOphéliaThinking,
  currentSessionId,
  applyBehavioralAnonymization, // Helper function to be passed or imported
}) {
  const generateReport = useCallback(async () => {
    setIsOphéliaThinking(true);
    try {
      await sendMessageRef.current?.("**Édition du Procès-Verbal en cours...**", {
        is_ai: true,
      });

      // --- ANONYMISATION ---
      let messagesForReport = messages;
      if (isEphemeral && applyBehavioralAnonymization) {
        // We assume applyBehavioralAnonymization is passed or imported.
        // Ideally imported if it's a pure function.
        messagesForReport = applyBehavioralAnonymization(messages);
      }
      // ---------------------

      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messagesForReport,
          room_settings: roomMetadata?.settings,
          is_ephemeral: isEphemeral,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Report API Error (${response.status}): ${errorText || "Unknown error"}`);
      }

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Invalid JSON from report API: ${responseText.substring(0, 100)}`);
      }
      const { report, error } = data || {};

      if (error) throw new Error(error);

      if (report) {
        const { data: insertData, error: insertError } = await supabase
          .from("inseme_messages")
          .insert([
            {
              room_id: roomMetadata?.id || roomName,
              user_id: null,
              name: "Ophélia",
              message: report,
              type: "report",
              metadata: { type: "report", generated: true },
            },
          ])
          .select();

        if (insertError) throw new Error(insertError.message);

        if (insertData && insertData[0]) {
          await fetch("/api/vector-search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "embed",
              text: report,
              id: insertData[0].id,
            }),
          });
        }

        await sendMessageRef.current?.("📜 Le Procès-Verbal a été généré et archivé.", {
          is_ai: true,
        });
      }
    } catch (error) {
      console.error("Erreur Report:", error);
      await sendMessageRef.current?.("[Erreur] Génération du rapport échouée.", {
        is_ai: true,
      });
    } finally {
      setIsOphéliaThinking(false);
    }
  }, [
    messages,
    roomMetadata,
    roomName,
    isEphemeral,
    supabase,
    sendMessageRef,
    setIsOphéliaThinking,
    applyBehavioralAnonymization,
  ]);

  const archiveReport = useCallback(
    async (reportText) => {
      if (!roomMetadata?.id) return;
      try {
        const sessionId = currentSessionId || `manual-${Date.now()}`;
        const fileName = `reports/${roomName}/${sessionId}.md`;
        const blob = new Blob([reportText], { type: "text/markdown" });

        const { url } = await storage.upload("public-documents", fileName, blob);

        await sendMessageRef.current?.(
          `📄 **PV Archivé dans le Cloud**\nLien : [Consulter le document](${url})`,
          {
            is_ai: true,
            type: "system_summary",
            metadata: {
              type: "archive_link",
              url,
            },
          }
        );
        return url;
      } catch (err) {
        console.error("Erreur d'archivage:", err);
        throw err;
      }
    },
    [roomMetadata?.id, currentSessionId, roomName, sendMessageRef]
  );

  const cleanupEphemeralLogs = useCallback(
    async (days = 3) => {
      if (!isEphemeral || !supabase || !roomMetadata) return;

      const roomId = roomMetadata.id || roomName;
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - days);

      console.log(`[CLEANUP] Tentative de nettoyage pour ${roomName} (seuil: ${days} jours)`);

      const { error } = await supabase
        .from("inseme_messages")
        .delete()
        .eq("room_id", roomId)
        .lt("created_at", thresholdDate.toISOString())
        .neq("type", "report");

      if (error) {
        console.error("[CLEANUP] Erreur:", error);
      } else {
        console.log(`[CLEANUP] Nettoyage réussi pour ${roomName}`);
      }
    },
    [isEphemeral, supabase, roomMetadata, roomName]
  );

  // Trigger automatique de nettoyage pour les salles éphémères (1 fois par chargement si besoin)
  useEffect(() => {
    if (isEphemeral && roomMetadata) {
      // On attend un peu après le chargement pour ne pas surcharger
      const timer = setTimeout(() => {
        cleanupEphemeralLogs(3); // Garde 3 jours par défaut
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isEphemeral, roomMetadata, cleanupEphemeralLogs]);

  const searchMemory = useCallback(
    async (query) => {
      try {
        const res = await fetch("/api/vector-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "search",
            query: query,
            room_id: roomMetadata?.id,
            match_threshold: 0.7,
            match_count: 5,
          }),
        });
        const data = await res.json();
        // Assuming data is array of matches
        const results = (data.matches || [])
          .map((m) => `- "${m.content}" (Sim: ${Math.round(m.similarity * 100)}%)`)
          .join("\n");

        return results || "Aucun souvenir trouvé.";
      } catch (error) {
        console.error("Search Error:", error);
        return "Erreur lors de la recherche mémoire.";
      }
    },
    [roomMetadata?.id]
  );

  return {
    generateReport,
    archiveReport,
    cleanupEphemeralLogs,
    searchMemory,
  };
}
