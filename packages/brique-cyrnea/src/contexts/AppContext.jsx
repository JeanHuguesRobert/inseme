import React, { createContext, useReducer, useMemo, useContext } from "react";

const initialState = {
  // Auth & User
  currentUser: null,
  isEditingPseudo: false,
  draftPseudo: "",
  isGabrielMode: false,
  // Navigation
  screen: "fil",

  // Location
  invitedBy: "",

  // Barman
  barmanToken: null,
  barmanPlace: null,
  isBarman: false,
  isBarmanModalOpen: false,

  // Presence
  zone: "indoor",
  publicLinks: [],

  // Ophelia (Chat)
  text: "",
  attachment: null,
  isOpheliaThinking: false,
  isCameraOpen: false,

  // Modals
  isTippingModalOpen: false,
  isInviteModalOpen: false,
  isErrorModalOpen: false,
  errorModalData: null,

  // UI State
  isMobile: false,
  broadcastEvent: null,
  showTipSuccess: false,
  tipSuccessData: null,
  barmanUpdateTrigger: 0,
};

// Actions possibles
const actionTypes = {
  // Auth & User
  SET_CURRENT_USER: "SET_CURRENT_USER",
  SET_EDITING_PSEUDO: "SET_EDITING_PSEUDO",
  SET_DRAFT_PSEUDO: "SET_DRAFT_PSEUDO",
  SET_GABRIEL_MODE: "SET_GABRIEL_MODE",

  // Navigation
  SET_SCREEN: "SET_SCREEN",

  // Location
  SET_INVITED_BY: "SET_INVITED_BY",

  // Presence
  SET_ZONE: "SET_ZONE",
  SET_PUBLIC_LINKS: "SET_PUBLIC_LINKS",

  // Barman
  SET_BARMAN_TOKEN: "SET_BARMAN_TOKEN",
  SET_BARMAN_PLACE: "SET_BARMAN_PLACE",
  SET_BARMAN_MODAL_OPEN: "SET_BARMAN_MODAL_OPEN",
  INCREMENT_BARMAN_UPDATE_TRIGGER: "INCREMENT_BARMAN_UPDATE_TRIGGER",

  // Ophelia (Chat)
  SET_TEXT: "SET_TEXT",
  SET_ATTACHMENT: "SET_ATTACHMENT",
  SET_OPHELIA_THINKING: "SET_OPHELIA_THINKING",
  SET_CAMERA_OPEN: "SET_CAMERA_OPEN",

  // Modals
  SET_TIPPING_MODAL_OPEN: "SET_TIPPING_MODAL_OPEN",
  SET_INVITE_MODAL_OPEN: "SET_INVITE_MODAL_OPEN",
  SET_ERROR_MODAL_OPEN: "SET_ERROR_MODAL_OPEN",
  SET_ERROR_MODAL_DATA: "SET_ERROR_MODAL_DATA",

  // UI State
  SET_MOBILE: "SET_MOBILE",
  SET_BROADCAST_EVENT: "SET_BROADCAST_EVENT",
  SET_TIP_SUCCESS: "SET_TIP_SUCCESS",
  SET_TIP_SUCCESS_DATA: "SET_TIP_SUCCESS_DATA",
};

// Reducer pour gérer les mutations d'état
function appReducer(state, action) {
  switch (action.type) {
    // Auth & User
    case actionTypes.SET_CURRENT_USER:
      return { ...state, currentUser: action.payload };
    case actionTypes.SET_EDITING_PSEUDO:
      return { ...state, isEditingPseudo: action.payload };
    case actionTypes.SET_DRAFT_PSEUDO:
      return { ...state, draftPseudo: action.payload };
    case actionTypes.SET_GABRIEL_MODE:
      return { ...state, isGabrielMode: action.payload };

    // Navigation
    case actionTypes.SET_SCREEN:
      return { ...state, screen: action.payload };

    // Zone & Location
    // Location
    case actionTypes.SET_INVITED_BY:
      return { ...state, invitedBy: action.payload };

    // Presence
    case actionTypes.SET_ZONE:
      return { ...state, zone: action.payload };
    case actionTypes.SET_PUBLIC_LINKS:
      return { ...state, publicLinks: action.payload };

    // Barman
    case actionTypes.SET_BARMAN_TOKEN:
      return {
        ...state,
        barmanToken: action.payload,
        isBarman: !!action.payload,
      };

    case actionTypes.SET_BARMAN_PLACE:
      return { ...state, barmanPlace: action.payload };

    case actionTypes.SET_BARMAN_MODAL_OPEN:
      return { ...state, isBarmanModalOpen: action.payload };

    case actionTypes.INCREMENT_BARMAN_UPDATE_TRIGGER:
      return { ...state, barmanUpdateTrigger: state.barmanUpdateTrigger + 1 };

    // Ophelia (Chat)
    case actionTypes.SET_TEXT:
      return { ...state, text: action.payload };

    case actionTypes.SET_ATTACHMENT:
      return { ...state, attachment: action.payload };

    case actionTypes.SET_OPHELIA_THINKING:
      return { ...state, isOpheliaThinking: action.payload };

    case actionTypes.SET_CAMERA_OPEN:
      return { ...state, isCameraOpen: action.payload };

    // Modals
    case actionTypes.SET_TIPPING_MODAL_OPEN:
      return { ...state, isTippingModalOpen: action.payload };

    case actionTypes.SET_INVITE_MODAL_OPEN:
      return { ...state, isInviteModalOpen: action.payload };

    case actionTypes.SET_ERROR_MODAL_OPEN:
      return { ...state, isErrorModalOpen: action.payload };

    case actionTypes.SET_ERROR_MODAL_DATA:
      return { ...state, errorModalData: action.payload };

    // UI State
    case actionTypes.SET_MOBILE:
      return { ...state, isMobile: action.payload };

    case actionTypes.SET_BROADCAST_EVENT:
      return { ...state, broadcastEvent: action.payload };

    case actionTypes.SET_TIP_SUCCESS:
      return { ...state, showTipSuccess: action.payload };

    case actionTypes.SET_TIP_SUCCESS_DATA:
      return { ...state, tipSuccessData: action.payload };

    default:
      return state;
  }
}

// Création du contexte
const AppContext = createContext();

// Provider component
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Actions creators pour faciliter l'utilisation
  const actions = useMemo(
    () => ({
      // Auth & User
      setCurrentUser: (user) => dispatch({ type: actionTypes.SET_CURRENT_USER, payload: user }),
      setEditingPseudo: (editing) =>
        dispatch({ type: actionTypes.SET_EDITING_PSEUDO, payload: editing }),
      setDraftPseudo: (pseudo) => dispatch({ type: actionTypes.SET_DRAFT_PSEUDO, payload: pseudo }),
      setGabrielMode: (mode) => dispatch({ type: actionTypes.SET_GABRIEL_MODE, payload: mode }),

      // Navigation
      setScreen: (screen) => dispatch({ type: actionTypes.SET_SCREEN, payload: screen }),

      // Location
      setInvitedBy: (invitedBy) =>
        dispatch({ type: actionTypes.SET_INVITED_BY, payload: invitedBy }),

      // Presence
      setZone: (zone) => dispatch({ type: actionTypes.SET_ZONE, payload: zone }),
      setPublicLinks: (links) => dispatch({ type: actionTypes.SET_PUBLIC_LINKS, payload: links }),

      // Barman
      setBarmanToken: (token) => dispatch({ type: actionTypes.SET_BARMAN_TOKEN, payload: token }),
      setBarmanPlace: (place) => dispatch({ type: actionTypes.SET_BARMAN_PLACE, payload: place }),
      setBarmanModalOpen: (open) =>
        dispatch({ type: actionTypes.SET_BARMAN_MODAL_OPEN, payload: open }),
      incrementBarmanUpdateTrigger: () =>
        dispatch({ type: actionTypes.INCREMENT_BARMAN_UPDATE_TRIGGER }),

      // Ophelia (Chat)
      setText: (text) => dispatch({ type: actionTypes.SET_TEXT, payload: text }),
      setAttachment: (attachment) =>
        dispatch({ type: actionTypes.SET_ATTACHMENT, payload: attachment }),
      setOpheliaThinking: (thinking) =>
        dispatch({ type: actionTypes.SET_OPHELIA_THINKING, payload: thinking }),
      setCameraOpen: (open) => dispatch({ type: actionTypes.SET_CAMERA_OPEN, payload: open }),

      // Modals
      setTippingModalOpen: (open) =>
        dispatch({ type: actionTypes.SET_TIPPING_MODAL_OPEN, payload: open }),
      setInviteModalOpen: (open) =>
        dispatch({ type: actionTypes.SET_INVITE_MODAL_OPEN, payload: open }),
      setErrorModalOpen: (open) =>
        dispatch({ type: actionTypes.SET_ERROR_MODAL_OPEN, payload: open }),
      setErrorModalData: (data) =>
        dispatch({ type: actionTypes.SET_ERROR_MODAL_DATA, payload: data }),
      showError: (title, message, onRetry) => {
        dispatch({ type: actionTypes.SET_ERROR_MODAL_DATA, payload: { title, message, onRetry } });
        dispatch({ type: actionTypes.SET_ERROR_MODAL_OPEN, payload: true });
      },

      // UI State
      setMobile: (mobile) => dispatch({ type: actionTypes.SET_MOBILE, payload: mobile }),
      setBroadcastEvent: (event) =>
        dispatch({ type: actionTypes.SET_BROADCAST_EVENT, payload: event }),
      setTipSuccess: (show) => dispatch({ type: actionTypes.SET_TIP_SUCCESS, payload: show }),
      setTipSuccessData: (data) =>
        dispatch({ type: actionTypes.SET_TIP_SUCCESS_DATA, payload: data }),
    }),
    []
  );

  const value = useMemo(
    () => ({
      state,
      actions,
    }),
    [state, actions]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// Hook pour utiliser le contexte
export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
}

export default AppContext;
