// packages/brique-cyrnea/hooks/useBarman.js

import { useEffect } from "react";
import { useAppContext } from "../contexts/AppContext";
import { StorageManager } from "../utils/storageUtils.js";

export function useBarman() {
  const { state, actions } = useAppContext();

  // Initialisation depuis localStorage
  useEffect(() => {
    // Barman token avec gestion d'erreurs améliorée
    const token = StorageManager.getItem("inseme_barman_token", null, (_error) => {
      actions.showError(
        "Erreur de Stockage",
        "Impossible de récupérer vos informations de barman. Veuillez réessayer."
      );
    });

    if (token) {
      // Vérifier l'expiration du token
      if (token.expiresAt && token.expiresAt < Date.now()) {
        console.debug("Token barman expiré, suppression...");
        StorageManager.removeItem("inseme_barman_token");
        StorageManager.removeItem("inseme_barman_place");
      } else {
        actions.setBarmanToken(token);
      }
    }

    // Barman place
    const place = StorageManager.getItem("inseme_barman_place", null);
    if (place) {
      actions.setBarmanPlace(place);
    }
  }, [actions]);

  // Synchronisation localStorage avec gestion d'erreurs
  useEffect(() => {
    if (state.barmanToken) {
      StorageManager.setItem("inseme_barman_token", state.barmanToken, (_error) => {
        console.warn("Failed to save barman token to storage");
      });
    } else {
      StorageManager.removeItem("inseme_barman_token");
    }
  }, [state.barmanToken]);

  useEffect(() => {
    if (state.barmanPlace) {
      StorageManager.setItem("inseme_barman_place", state.barmanPlace, (_error) => {
        console.warn("Failed to save barman place to storage");
      });
    } else {
      StorageManager.removeItem("inseme_barman_place");
    }
  }, [state.barmanPlace]);

  // Actions barman
  const handleOpenBarmanModal = () => {
    actions.setBarmanModalOpen(true);
  };

  const handleCloseBarmanModal = () => {
    actions.setBarmanModalOpen(false);
  };

  const handleDeclareBarman = (data, pseudo, sendMessage) => {
    const { TheUser } = import.meta.glob("../singletons/TheUser.js", { eager: true }); // Avoid circular or just use global
    // Actually, TheUser is already imported via singletons/index.js in components,
    // but in hooks we might need to be careful.

    if (data === null) {
      // Cesser d'être barman
      actions.setBarmanToken(null);
      if (window.TheUser) window.TheUser.promoteTo("client");
      actions.setBarmanPlace(null);
      actions.incrementBarmanUpdateTrigger();
      actions.setBarmanModalOpen(false);
      return;
    }

    // Vérifier le sésame (Code normal ou Super Sésame "42")
    const barmanSesame = import.meta.env.VITE_BARMAN_SESAME;
    const isSuperSesame = data.sesame === "42";
    const isNormalSesame = barmanSesame && data.sesame === barmanSesame;

    console.debug("[Barman] Déclaration:", {
      sesame: data.sesame,
      isSuper: isSuperSesame,
      isNormal: isNormalSesame,
    });

    if (isSuperSesame || isNormalSesame) {
      const finalPlace = data.place || "Bar";

      // Token sécurisé avec crypto.randomUUID()
      const newToken = {
        token: crypto.randomUUID(),
        place: finalPlace,
        timestamp: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 heures
      };

      actions.setBarmanToken(newToken);
      actions.setBarmanPlace(finalPlace);

      // Update TheUser role
      if (window.TheUser) {
        window.TheUser.promoteTo("barman");
        window.TheUser.setZone(finalPlace); // Use place as zone/metadata
      }

      actions.incrementBarmanUpdateTrigger();
      actions.setBarmanModalOpen(false);

      // Envoyer un message système
      if (sendMessage) {
        sendMessage(`[SYSTÈME] ${pseudo} est maintenant barman au poste "${finalPlace}"`, {
          type: "system",
          metadata: {
            type: "barman_success",
            user: pseudo,
            place: finalPlace,
          },
        });
      }
    } else {
      actions.showError(
        "Code d'accès Incorrect",
        "Désolé, ce code ne permet pas de devenir barman. (Vérifiez le Sésame)"
      );
    }
  };

  return {
    // État barman
    barmanToken: state.barmanToken,
    barmanPlace: state.barmanPlace,
    isBarman: state.isBarman,
    isBarmanModalOpen: state.isBarmanModalOpen,
    barmanUpdateTrigger: state.barmanUpdateTrigger,

    // Actions
    setBarmanToken: actions.setBarmanToken,
    setBarmanPlace: actions.setBarmanPlace,
    setBarmanModalOpen: actions.setBarmanModalOpen,
    incrementBarmanUpdateTrigger: actions.incrementBarmanUpdateTrigger,

    // Handlers
    handleOpenBarmanModal,
    handleCloseBarmanModal,
    handleDeclareBarman,
  };
}
