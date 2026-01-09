import { defineEdgeFunction } from "../../cop-host/src/runtime/edge.js";

export const config = {
  path: "/api/sessions",
};

export default async (request, runtime, context) => {
  const { getSupabase, json, error } = runtime;
  console.log("[Sessions] Request received:", request.url);

  try {
    let body = {};
    try {
      if (request.body) {
        body = await request.json();
      }
    } catch (e) {
      console.warn("[Sessions] Malformed JSON or empty body");
    }

    const { room_id } = body;

    if (!room_id) {
      // If no room_id in body, maybe it's a GET request with query params
      const url = new URL(request.url);
      const qRoomId = url.searchParams.get("room_id");
      if (!qRoomId) {
        return error("room_id is required", 400);
      }
      // Use query param if available
      var targetRoomId = qRoomId;
    } else {
      var targetRoomId = room_id;
    }

    const supabase = getSupabase();

    // 1. Fetch room metadata to handle UUID/Slug mapping
    const { data: room } = await supabase
      .from("inseme_rooms")
      .select("id, slug")
      .or(`slug.eq.${targetRoomId},id.eq.${targetRoomId}`)
      .maybeSingle();

    const finalRoomId = room?.id || targetRoomId;

    // 2. Fetch all messages for the room, ordered by creation date
    const { data: messages, error: dbError } = await supabase
      .from("inseme_messages")
      .select("created_at, message, type, metadata")
      .eq("room_id", finalRoomId)
      .order("created_at", { ascending: true });

    if (dbError) throw dbError;

    if (!messages || messages.length === 0) {
      return json({ sessions: [] });
    }

    // 3. Grouping logic
    const sessions = [];
    let currentSession = null;
    const INACTIVITY_GAP = 2 * 60 * 60 * 1000; // 2 hours

    messages.forEach((m, index) => {
      const msgTime = new Date(m.created_at).getTime();
      const isStartSignal = m.message?.toLowerCase().includes("inseme open");
      const isEndSignal =
        m.message?.toLowerCase().includes("inseme close") ||
        m.metadata?.type === "report";

      if (!currentSession) {
        // Start a new session
        currentSession = {
          id: `session-${msgTime}`,
          start: m.created_at,
          messages: [m],
        };
      } else {
        const lastMsgTime = new Date(
          currentSession.messages[currentSession.messages.length - 1].created_at
        ).getTime();
        const gap = msgTime - lastMsgTime;

        if (gap > INACTIVITY_GAP || isStartSignal) {
          // Close current session and start a new one
          const lastMsg =
            currentSession.messages[currentSession.messages.length - 1];
          sessions.push({
            id: currentSession.id,
            start: currentSession.start,
            end: lastMsg.created_at,
            label: new Date(currentSession.start).toLocaleString("fr-FR"),
          });

          currentSession = {
            id: `session-${msgTime}`,
            start: m.created_at,
            messages: [m],
          };
        } else {
          currentSession.messages.push(m);
          if (isEndSignal) {
            // Close current session
            sessions.push({
              id: currentSession.id,
              start: currentSession.start,
              end: m.created_at,
              label: new Date(currentSession.start).toLocaleString("fr-FR"),
            });
            currentSession = null;
          }
        }
      }

      // Handle the last message if session is still open
      if (index === messages.length - 1 && currentSession) {
        sessions.push({
          id: currentSession.id,
          start: currentSession.start,
          end: m.created_at,
          label: new Date(currentSession.start).toLocaleString("fr-FR"),
        });
      }
    });

    // Sort sessions by newest first
    const sortedSessions = sessions.reverse();

    // Deduplicate sessions (sometimes the loop might push twice)
    const uniqueSessions = sortedSessions.filter(
      (s, i, self) => i === self.findIndex((t) => t.id === s.id)
    );

    return json({ sessions: uniqueSessions });
  } catch (err) {
    console.error("[Sessions] Error:", err);
    return error(err.message, 500);
  }
};
