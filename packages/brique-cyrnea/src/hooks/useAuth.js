// packages/brique-cyrnea/hooks/useAuth.js
//
// === STORAGE ARCHITECTURE ===
//
// 📱 USER DATA (Client-Side localStorage):
// This hook manages user data that is INTENTIONALLY stored in localStorage only.
// NO Supabase auth system is used - this is a deliberate privacy-first design.
//
// What's stored in localStorage:
// - inseme_client_screen: Current navigation screen
// - inseme_client_zone: User's preferred zone (indoor/outdoor)
// - inseme_client_pseudo: User's chosen pseudonym
// - inseme_gabriel_mode: Gabriel assistant mode state
// - inseme_client_public_links: User's shared links
// - inseme_on_duty: Barman service status
//
// What's NOT stored:
// - Personal identifiers (email, phone, etc.)
// - Authentication tokens or credentials
// - Cross-session tracking data
// - Personal behavioral analytics
//
// 🏠 BAR DATA (Supabase inseme_rooms.metadata):
// - Room configuration and settings
// - Service availability and permissions
// - Zone definitions and layout
//
// 💬 MESSAGES (Supabase inseme_messages):
// - All user interactions with pseudonym
// - No personal data, only content and metadata

import { useEffect, useContext } from "react";
import { TheUser } from "../singletons/index.js";
import { useAppContext } from "../contexts/AppContext";
import { CurrentUserContext } from "@inseme/cop-host";

export function useAuth() {
  const { state, actions } = useAppContext();
  const { updateUser } = useContext(CurrentUserContext);

  // Initialisation - utilise TheUser (localStorage déjà géré dans l'entité)
  useEffect(() => {
    // Synchroniser le state avec TheUser.screen
    actions.setScreen(TheUser.screen);

    // Zone - priorité URL puis TheUser (localStorage déjà géré dans l'entité)
    const urlParams = new URLSearchParams(window.location.search);
    const urlZone = urlParams.get("zone");
    if (urlZone) {
      TheUser.setZone(urlZone); // Méthode de classe
    }
    actions.setZone(urlZone || TheUser.zone);

    // Invited by
    const invitedBy = urlParams.get("invited_by") || "";
    actions.setInvitedBy(invitedBy);
  }, [actions]);

  // Sync pseudo avec TheUser
  useEffect(() => {
    if (TheUser.pseudo) {
      actions.setDraftPseudo(TheUser.pseudo);
    }
  }, [actions]);

  // Force disable Gabriel mode si non configuré
  useEffect(() => {
    const gabrielEnabled = TheUser.gabrielConfig?.enabled;
    if (TheUser.isGabrielMode && !gabrielEnabled) {
      TheUser.setGabrielMode(false); // Méthode de classe
    }
  }, []);

  // Synchronisation screen - utilise la méthode de classe
  useEffect(() => {
    TheUser.setScreen(state.screen); // Méthode de classe
  }, [state.screen]);

  // Initialisation édition pseudo
  useEffect(() => {
    const shouldEdit = !TheUser.pseudo;
    actions.setEditingPseudo(shouldEdit);
  }, [actions]);

  // Actions d'authentification - utilise les setters de l'entité User
  const handleEditPseudo = () => {
    actions.setEditingPseudo(true);
  };

  const handleSavePseudo = () => {
    if (state.draftPseudo.trim() && state.draftPseudo !== TheUser.pseudo) {
      TheUser.setPseudo(state.draftPseudo.trim()); // Méthode de classe
      updateUser({ pseudo: state.draftPseudo.trim() });
    }
    actions.setEditingPseudo(false);
  };

  const handleCancelEditPseudo = () => {
    actions.setDraftPseudo(TheUser.pseudo);
    actions.setEditingPseudo(false);
  };

  const handleToggleGabriel = () => {
    const newMode = !TheUser.isGabrielMode;
    TheUser.setGabrielMode(newMode); // Méthode de classe
    actions.setGabrielMode(newMode);
  };

  return {
    // État depuis TheUser
    currentUser: TheUser,
    pseudo: TheUser.pseudo,
    isEditingPseudo: state.isEditingPseudo,
    draftPseudo: state.draftPseudo,
    isGabrielMode: TheUser.isGabrielMode,
    isOnDuty: TheUser.isOnDuty,

    // Actions - respecte l'encapsulation via les méthodes de classe
    setCurrentUser: actions.setCurrentUser,
    setPseudo: (value) => {
      TheUser.setPseudo(value);
      actions.setDraftPseudo(value);
    },
    setDraftPseudo: actions.setDraftPseudo,
    setIsEditingPseudo: actions.setEditingPseudo,
    setIsGabrielMode: actions.setGabrielMode,
    setOnDuty: (value) => TheUser.setOnDuty(value), // Méthode de classe

    // Handlers
    handleEditPseudo,
    handleSavePseudo,
    handleCancelEditPseudo,
    handleToggleGabriel,
  };
}
