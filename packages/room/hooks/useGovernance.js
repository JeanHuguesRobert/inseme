import { useCallback } from "react";
import { getGovernanceModel } from "@inseme/kudocracy";

export function useGovernance({
  roomMetadata,
  effectiveUser,
  canVote,
  supabase,
  roomName,
  sendMessageRef, // Passed as Ref to avoid cycles if sendMessage changes
  setRoomMetadata, // Needed for optimistic updates
}) {
  const castVote = useCallback(
    async (option) => {
      if (!effectiveUser.id || !canVote) return;
      const userName = effectiveUser.name;
      const votingPower = effectiveUser.metadata?.voting_power || 1;

      // 1. Send as a system message to trigger real-time updates via subscription
      await sendMessageRef.current?.(`inseme vote ${option}`, {
        type: "vote",
        metadata: {
          option,
          user_name: userName,
          voting_power: votingPower,
          is_flash_poll: true,
        },
      });
    },
    [effectiveUser, canVote, sendMessageRef]
  );

  const declarePower = useCallback(
    async (multiplier, reason) => {
      if (!effectiveUser.id) return;
      await sendMessageRef.current?.(`inseme power ${multiplier} ${reason}`, {
        type: "power_declaration",
        metadata: {
          multiplier,
          reason,
        },
      });
    },
    [effectiveUser, sendMessageRef]
  );

  const setTemplate = useCallback(
    async (id) => {
      const model = getGovernanceModel(id);
      if (!model || !roomMetadata) return;
      const newSettings = { ...roomMetadata.settings, template: id };
      await supabase
        .from("inseme_rooms")
        .update({ settings: newSettings })
        .eq("id", roomMetadata.id);

      // Traçabilité de l'acte de changement de template
      await sendMessageRef.current?.(`inseme template ${id}`, {
        type: "template_change",
        metadata: {
          template_id: id,
          template_label: model.name,
        },
      });

      // Optimistic update
      if (setRoomMetadata) {
        setRoomMetadata({ ...roomMetadata, settings: newSettings });
      }
    },
    [roomMetadata, supabase, sendMessageRef, setRoomMetadata]
  );

  const updateAssemblyType = useCallback(
    async (modelId) => {
      if (!roomMetadata) return;
      const model = getGovernanceModel(modelId);
      const newSettings = {
        ...roomMetadata.settings,
        governance_model: modelId,
        // Optional: clear custom labels to reset to standard
        labels: {},
      };

      await supabase
        .from("inseme_rooms")
        .update({ settings: newSettings })
        .eq("id", roomMetadata.id);

      // Notification
      await sendMessageRef.current?.(
        `L'Assemblée a adopté le modèle **${model.name}**. La terminologie est désormais adaptée (ex: les membres sont des **${model.terminology.members}**).`,
        {
          is_ai: true,
          type: "system_summary",
          metadata: { new_model: modelId },
        }
      );

      // Optimistic update
      if (setRoomMetadata) {
        setRoomMetadata({ ...roomMetadata, settings: newSettings });
      }
    },
    [supabase, roomMetadata, sendMessageRef, setRoomMetadata]
  );

  const setProposition = useCallback(
    async (text, isAi = false) => {
      return sendMessageRef.current?.(`inseme ? ${text}`, { is_ai: isAi });
    },
    [sendMessageRef]
  );

  const promoteToPlenary = useCallback(
    async (content) => {
      const parentSlug = roomMetadata?.settings?.parent_slug;
      if (!parentSlug) {
        await sendMessageRef.current?.(
          "[Erreur] Impossible de remonter à la plénière : aucune salle parente configurée.",
          { is_ai: true }
        );
        return;
      }

      // Simulate sending via Supabase directly (would ideally be Edge Function)
      try {
        await sendMessageRef.current?.(`**Transmission à la Plénière (${parentSlug})...**`, {
          is_ai: true,
        });

        const { data: parentRoom } = await supabase
          .from("inseme_rooms")
          .select("id")
          .eq("slug", parentSlug)
          .single();

        if (parentRoom) {
          const { data: msgData, error: insertError } = await supabase
            .from("inseme_messages")
            .insert([
              {
                room_id: parentRoom.id,
                user_id: effectiveUser.isAnonymous ? null : effectiveUser.id,
                name: `Commission (${roomMetadata.name})`,
                message: `**Proposition de la Commission :**\n\n${content}`,
                type: "proposition",
                metadata: {
                  source_room: roomMetadata?.id || roomName,
                  promoted: true,
                },
              },
            ])
            .select();

          if (insertError) throw new Error(insertError.message);

          if (msgData && msgData[0]) {
            // Auto-embed in parent room
            await fetch("/api/vector-search", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "embed",
                text: content,
                id: msgData[0].id,
              }),
            });
          }

          await sendMessageRef.current?.(`✅ Transmis avec succès à la plénière.`, {
            is_ai: true,
          });
        } else {
          throw new Error("Salle parente introuvable.");
        }
      } catch (error) {
        console.error("Erreur Promotion:", error);
        await sendMessageRef.current?.(`[Erreur] Échec de la transmission : ${error.message}`, {
          is_ai: true,
        });
      }
    },
    [roomMetadata, roomName, sendMessageRef, supabase, effectiveUser]
  );

  const updateAgenda = useCallback(
    async (newAgenda) => {
      // Simulate sending via Supabase real-time update
      // In reality, this might update a 'room_state' table or send a control message
      await sendMessageRef.current?.(
        `[SYSTÈME] Ordre du jour mis à jour par ${effectiveUser.name}`,
        {
          type: "system_summary",
          metadata: {
            type: "agenda_update",
            new_agenda: newAgenda,
          },
        }
      );
      // Optionally update local state via setRoomData if available, dependent on architecture
    },
    [sendMessageRef, effectiveUser]
  );

  return {
    castVote,
    declarePower,
    updateAssemblyType,
    setTemplate,
    setProposition,
    promoteToPlenary,
    updateAgenda,
  };
}
