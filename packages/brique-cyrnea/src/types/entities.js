// Minimal entity utilities for messages used by MessageService
// This file provides a lightweight Message class, MessageType enum, and
// an EntityFactory.createMessage helper so existing services can use them
// without pulling unrelated code.

function generateId(prefix = "msg_") {
  return prefix + Math.random().toString(16).slice(2, 10) + Date.now().toString(16).slice(-6);
}

export const MessageType = {
  TEXT: "chat",
  SYSTEM: "system",
  VISUAL_SIGNAL: "visual_signal",
};

export class Message {
  constructor({
    id,
    barId,
    authorId,
    content = "",
    type = MessageType.TEXT,
    metadata = {},
    attachment = null,
    createdAt = new Date(),
  } = {}) {
    this.id = id || generateId();
    this.barId = barId || null;
    this.authorId = authorId || null;
    this.content = content || "";
    this.type = type;
    this.metadata = metadata || {};
    this.attachment = attachment || null;
    this.createdAt = createdAt instanceof Date ? createdAt : new Date(createdAt);
    this.updatedAt = new Date();
    this._reactions = new Map(); // Map<reactionType, Set<userId>>
  }

  addReaction(userId, reactionType) {
    if (!this._reactions.has(reactionType)) this._reactions.set(reactionType, new Set());
    this._reactions.get(reactionType).add(userId);
  }

  removeReaction(userId, reactionType) {
    if (!reactionType) {
      // remove user from all reaction types
      for (const set of this._reactions.values()) {
        set.delete(userId);
      }
      return;
    }
    const set = this._reactions.get(reactionType);
    if (set) set.delete(userId);
  }

  getReactionCount(type) {
    if (type) return this._reactions.get(type)?.size || 0;
    // total reactions
    let total = 0;
    for (const s of this._reactions.values()) total += s.size;
    return total;
  }

  hasAttachment() {
    return !!this.attachment;
  }

  isFromUser(userId) {
    return this.authorId === userId;
  }

  isSystemMessage() {
    return this.type === MessageType.SYSTEM;
  }

  toJSON() {
    return {
      id: this.id,
      barId: this.barId,
      authorId: this.authorId,
      content: this.content,
      type: this.type,
      metadata: this.metadata,
      attachment: this.attachment,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

export const EntityFactory = {
  createMessage(payload = {}) {
    if (payload instanceof Message) return payload;
    const msg = new Message({
      id: payload.id,
      barId: payload.barId || payload.bar_id || payload.room || payload.roomId || payload.room_id,
      authorId:
        payload.authorId ||
        payload.author_id ||
        payload.author ||
        payload.userId ||
        payload.user_id,
      content: payload.content || payload.text || payload.body || "",
      type: payload.type || MessageType.TEXT,
      metadata: payload.metadata || payload.meta || {},
      attachment: payload.attachment || payload.media || null,
      createdAt: payload.createdAt || payload.created_at || new Date(),
    });
    return msg;
  },
};
