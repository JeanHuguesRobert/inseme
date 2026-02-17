/**
 * Inseme Message Bus Library
 * Encapsulates message creation and sending logic to prepare for future architectural changes.
 */

/**
 * Generic function to send a message to the Inseme bus (currently Supabase).
 *
 * @param {Object} supabase - The Supabase client instance.
 * @param {Object} params - The message parameters.
 * @param {string} params.roomId - The ID or slug of the room.
 * @param {string|null} [params.userId] - The ID of the sender (or null for anonymous/AI).
 * @param {string} params.name - The display name of the sender.
 * @param {string} params.message - The text content of the message.
 * @param {string} [params.type="chat"] - The type of the message (chat, info, vote, etc.).
 * @param {Object} [params.metadata={}] - Additional metadata.
 * @returns {Promise<Object>} - The inserted message data.
 */
export async function sendMessage(
  supabase,
  { roomId, userId = null, name, message, type = "chat", metadata = {} }
) {
  if (!supabase) {
    throw new Error("MessageBus: Supabase client is missing.");
  }
  if (!roomId) {
    throw new Error("MessageBus: Room ID is missing.");
  }
  if (!name) {
    console.error("MessageBus: Name is missing.");
    return null;
  }
  if (!message) {
    console.error("MessageBus: Message content is missing.");
    return null;
  }

  const contentObj = {
    room_id: roomId,
    name: name,
    message: message,
    type: type,
    metadata: metadata,
  };

  if (userId) {
    contentObj.user_id = userId;
  }

  const { data, error } = await supabase
    .from("inseme_messages")
    .insert([contentObj])
    .select()
    .single();

  if (error) {
    console.error("MessageBus: Error sending message:", error);
    throw error;
  }

  return data;
}

/**
 * Sends a standard chat message.
 */
export async function sendChatMessage(supabase, { roomId, userId, name, message, metadata = {} }) {
  return sendMessage(supabase, {
    roomId,
    userId,
    name,
    message,
    type: "chat",
    metadata,
  });
}

/**
 * Sends a system notification or informational message.
 */
export async function sendSystemMessage(
  supabase,
  { roomId, userId = null, name = "Système", message, type = "info", metadata = {} }
) {
  return sendMessage(supabase, {
    roomId,
    userId,
    name,
    message,
    type,
    metadata,
  });
}

/**
 * Sends a message from the AI Agent (Ophélia).
 */
export async function sendAiMessage(supabase, { roomId, message, type = "chat", metadata = {} }) {
  return sendMessage(supabase, {
    roomId,
    userId: null,
    name: "Ophélia",
    message,
    type,
    metadata: { ...metadata, is_ai: true },
  });
}
