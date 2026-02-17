import { useState, useEffect } from "react";

/**
 * Hook pour gérer les informations de présence des utilisateurs
 * Stocke et récupère les données depuis localStorage
 */
export const usePresenceData = () => {
  const [presenceData, setPresenceData] = useState(() => {
    // Charger les données depuis localStorage au montage
    try {
      const stored = localStorage.getItem("inseme_presence_data");
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error("Erreur lors du chargement des données de présence:", error);
      return {};
    }
  });

  // Sauvegarder dans localStorage à chaque modification
  useEffect(() => {
    try {
      localStorage.setItem("inseme_presence_data", JSON.stringify(presenceData));
    } catch (error) {
      console.error("Erreur lors de la sauvegarde des données de présence:", error);
    }
  }, [presenceData]);

  // Mettre à jour les informations d'un utilisateur
  const updateUserPresence = (userId, data) => {
    setPresenceData((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        user_id: userId,
        ...data,
        last_updated: new Date().toISOString(),
      },
    }));
  };

  // Récupérer les informations d'un utilisateur
  const getUserPresence = (userId) => {
    return presenceData[userId] || null;
  };

  // Mettre à jour la zone d'un utilisateur
  const updateUserZone = (userId, zone) => {
    updateUserPresence(userId, { zone });
  };

  // Mettre à jour les liens publics d'un utilisateur
  const updateUserLinks = (userId, links) => {
    updateUserPresence(userId, { public_links: links });
  };

  // Fusionner les données de présence avec les données utilisateur existantes
  const enrichUserData = (user) => {
    if (!user || !user.user_id) return user;

    const presence = getUserPresence(user.user_id);
    if (!presence) return user;

    return {
      ...user,
      zone: user.zone || presence.zone,
      public_links: user.public_links || presence.public_links || [],
      metadata: {
        ...user.metadata,
        ...presence.metadata,
      },
    };
  };

  // Enrichir une liste d'utilisateurs
  const enrichUsersList = (users) => {
    if (!Array.isArray(users)) return users;
    return users.map(enrichUserData);
  };

  // Nettoyer les anciennes données (plus de 24h)
  const cleanupOldData = () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    setPresenceData((prev) => {
      const cleaned = {};
      Object.entries(prev).forEach(([userId, data]) => {
        if (data.last_updated && new Date(data.last_updated) > oneDayAgo) {
          cleaned[userId] = data;
        }
      });
      return cleaned;
    });
  };

  return {
    presenceData,
    updateUserPresence,
    getUserPresence,
    updateUserZone,
    updateUserLinks,
    enrichUserData,
    enrichUsersList,
    cleanupOldData,
  };
};
