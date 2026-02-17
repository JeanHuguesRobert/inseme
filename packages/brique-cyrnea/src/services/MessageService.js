// ========================================
// SERVICE MÉTIER - MESSAGE
// ========================================

import { Message, EntityFactory, MessageType } from "../types/entities.js";

/**
 * Service de gestion des messages
 */
export class MessageService {
  constructor() {
    this.messages = new Map(); // Map<messageId, Message>
    this.messagesByBar = new Map(); // Map<barId, Set<messageId>>
  }

  /**
   * Envoyer un message
   */
  async sendMessage(messageData) {
    const message = EntityFactory.createMessage(messageData);

    // Validation
    if (!message.barId || !message.authorId || !message.content) {
      throw new Error("barId, authorId et content sont obligatoires");
    }

    // Simulation de sauvegarde
    this.messages.set(message.id, message);

    // Ajouter au bar
    if (!this.messagesByBar.has(message.barId)) {
      this.messagesByBar.set(message.barId, new Set());
    }
    this.messagesByBar.get(message.barId).add(message.id);

    return message;
  }

  /**
   * Créer un message texte simple
   */
  async sendTextMessage(barId, authorId, content) {
    return this.sendMessage({
      barId,
      authorId,
      content,
      type: MessageType.TEXT,
      createdAt: new Date(),
    });
  }

  /**
   * Créer un message système
   */
  async sendSystemMessage(barId, content, metadata = {}) {
    return this.sendMessage({
      barId,
      authorId: "system",
      content,
      type: MessageType.SYSTEM,
      metadata,
      createdAt: new Date(),
    });
  }

  /**
   * Créer un message avec pièce jointe
   */
  async sendMessageWithAttachment(barId, authorId, content, attachment) {
    return this.sendMessage({
      barId,
      authorId,
      content,
      type: MessageType.VISUAL_SIGNAL,
      attachment,
      createdAt: new Date(),
    });
  }

  /**
   * Récupérer un message par son ID
   */
  async getMessageById(messageId) {
    return this.messages.get(messageId) || null;
  }

  /**
   * Lister les messages d'un bar
   */
  async getMessagesByBar(barId, limit = 50, offset = 0) {
    const messageIds = this.messagesByBar.get(barId) || new Set();
    const messages = [];

    for (const messageId of messageIds) {
      const message = this.messages.get(messageId);
      if (message) {
        messages.push(message);
      }
    }

    // Trier par date (plus récent en premier)
    messages.sort((a, b) => b.createdAt - a.createdAt);

    // Appliquer pagination
    return messages.slice(offset, offset + limit);
  }

  /**
   * Lister les messages récents d'un bar
   */
  async getRecentMessages(barId, count = 20) {
    return this.getMessagesByBar(barId, count);
  }

  /**
   * Ajouter une réaction à un message
   */
  async addReaction(messageId, userId, reactionType) {
    const message = await this.getMessageById(messageId);
    if (!message) {
      throw new Error("Message non trouvé");
    }

    message.addReaction(userId, reactionType);
    this.messages.set(messageId, message);

    return message;
  }

  /**
   * Retirer une réaction d'un message
   */
  async removeReaction(messageId, userId) {
    const message = await this.getMessageById(messageId);
    if (!message) {
      throw new Error("Message non trouvé");
    }

    message.removeReaction(userId);
    this.messages.set(messageId, message);

    return message;
  }

  /**
   * Compter les réactions d'un message
   */
  async getReactionCount(messageId, type) {
    const message = await this.getMessageById(messageId);
    if (!message) {
      return 0;
    }

    return message.getReactionCount(type);
  }

  /**
   * Vérifier si un message a une pièce jointe
   */
  async hasAttachment(messageId) {
    const message = await this.getMessageById(messageId);
    if (!message) {
      return false;
    }

    return message.hasAttachment();
  }

  /**
   * Vérifier si un message vient d'un utilisateur
   */
  async isFromUser(messageId, userId) {
    const message = await this.getMessageById(messageId);
    if (!message) {
      return false;
    }

    return message.isFromUser(userId);
  }

  /**
   * Vérifier si un message est un message système
   */
  async isSystemMessage(messageId) {
    const message = await this.getMessageById(messageId);
    if (!message) {
      return false;
    }

    return message.isSystemMessage();
  }

  /**
   * Mettre à jour le statut d'un message
   */
  async updateMessageStatus(messageId, status) {
    const message = await this.getMessageById(messageId);
    if (!message) {
      throw new Error("Message non trouvé");
    }

    message.status = status;
    message.updatedAt = new Date();
    this.messages.set(messageId, message);

    return message;
  }

  /**
   * Supprimer un message
   */
  async deleteMessage(messageId) {
    const message = await this.getMessageById(messageId);
    if (!message) {
      throw new Error("Message non trouvé");
    }

    // Retirer du bar
    if (this.messagesByBar.has(message.barId)) {
      this.messagesByBar.get(message.barId).delete(messageId);
      if (this.messagesByBar.get(message.barId).size === 0) {
        this.messagesByBar.delete(message.barId);
      }
    }

    this.messages.delete(messageId);
    return true;
  }

  /**
   * Compter les messages d'un bar
   */
  async getMessageCount(barId) {
    const messageIds = this.messagesByBar.get(barId) || new Set();
    return messageIds.size;
  }

  /**
   * Nettoyer les anciens messages d'un bar
   */
  async cleanupOldMessages(barId, olderThanDays = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const messageIds = this.messagesByBar.get(barId) || new Set();
    const toDelete = [];

    for (const messageId of messageIds) {
      const message = this.messages.get(messageId);
      if (message && message.createdAt < cutoffDate) {
        toDelete.push(messageId);
      }
    }

    // Supprimer les anciens messages
    for (const messageId of toDelete) {
      await this.deleteMessage(messageId);
    }

    return toDelete.length;
  }

  /**
   * Rechercher des messages dans un bar
   */
  async searchMessages(barId, query, limit = 20) {
    const messages = await this.getMessagesByBar(barId, 100); // Limiter la recherche
    const results = [];

    const lowerQuery = query.toLowerCase();
    for (const message of messages) {
      if (message.content.toLowerCase().includes(lowerQuery)) {
        results.push(message);
        if (results.length >= limit) break;
      }
    }

    return results;
  }
}
