import { useRef, useEffect, useMemo, useCallback } from "react";
import { OPHELIA_ID } from "../constants";

export function useSilenceTrigger({
  roomData,
  connectedUsers,
  effectiveUser,
  messages,
  isOphéliaThinking,
  triggerOphéliaRef,
  isManuallyDisconnected,
  roomName,
  supabase,
  isSpectator,
  roomMetadata,
}) {
  const inactivityTimerRef = useRef(null);

  useEffect(() => {
    // Logic:
    // - Leader Election: To avoid distributed stampede, only the 'Leader' runs the timer.
    // - Priority: Barmen > Others > ID sort.
    // - Re-election happens automatically on any presence change via dependency on [roomData.connectedUsers].
    // - Silence Timeout: 2s for 1:1, 5s for groups.
    // - Reset: Timer clears on any message arrival or if leader status is lost.

    const users = connectedUsers || roomData?.connectedUsers || [];

    // 3.1 Identify Candidates & Determine Leadership
    const candidates = users
      .filter((u) => u.name !== "Ophélia" && !u.is_ai)
      .sort((a, b) => {
        // Priority to Barman
        const roleA = a.role || a.metadata?.role;
        const roleB = b.role || b.metadata?.role;
        const isBarmanA = roleA === "barman";
        const isBarmanB = roleB === "barman";

        if (isBarmanA && !isBarmanB) return -1;
        if (!isBarmanA && isBarmanB) return 1;

        // Fallback to ID sort
        return a.id.localeCompare(b.id);
      });

    const isLeader =
      candidates.length > 0 && candidates[0].id === effectiveUser.id && !isManuallyDisconnected;

    // 3.2 Clear existing timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }

    // 3.3 Guard Clauses
    if (!isLeader || !roomName || !supabase || messages.length === 0 || isSpectator) {
      return;
    }

    const lastMsg = messages[messages.length - 1];

    // Rule 3: No consecutive trigger if last message is already from Ophelia
    if (lastMsg?.name === "Ophélia" || lastMsg?.user_id === OPHELIA_ID) return;

    // Rule 4: Error Recovery
    if (isOphéliaThinking) return;

    // 3.4 Define Dynamic Threshold
    const threshold = candidates.length <= 1 ? 2000 : 5000;

    // 3.5 Set Timer
    inactivityTimerRef.current = setTimeout(() => {
      triggerOphéliaRef.current?.(
        "[SYSTÈME] : Silence détecté. Interviens si pertinent (synthèse, relance, ou question)."
      );
    }, threshold);

    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [
    messages,
    connectedUsers,
    roomData?.connectedUsers,
    isOphéliaThinking,
    roomName,
    supabase,
    isSpectator,
    effectiveUser.id,
    isManuallyDisconnected,
    triggerOphéliaRef,
  ]);

  // Track last AI response time
  const lastAiResponse = useMemo(() => {
    const aiMsgs = messages.filter((m) => m.name === "Ophélia" || m.user_id === OPHELIA_ID);
    if (aiMsgs.length === 0) return null;
    return new Date(aiMsgs[aiMsgs.length - 1].created_at).getTime();
  }, [messages]);

  // Manual Trigger Function (Reset)
  const forceTriggerOphelia = useCallback(async () => {
    if (!roomName || !supabase) return;

    // 1. Send system message to reset context and inform AI
    await supabase.from("inseme_messages").insert([
      {
        room_id: roomMetadata?.id || roomName,
        user_id: effectiveUser.isAnonymous ? null : effectiveUser.id,
        name: "Système",
        message: `[SYSTÈME] : Reset manuel demandé par ${effectiveUser.name}.`,
        type: "info",
        metadata: { status: "manual_reset" },
      },
    ]);

    // 2. Trigger AI manually using Ref to avoid TDZ
    triggerOphéliaRef.current?.(
      "[SYSTÈME] : Intervention manuelle demandée. Veuillez reprendre la main sur la conversation."
    );
  }, [roomName, supabase, roomMetadata, effectiveUser, triggerOphéliaRef]);

  return {
    lastAiResponse,
    forceTriggerOphelia,
    inactivityTimerRef,
  };
}
