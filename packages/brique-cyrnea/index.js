// ========================================
// EXPORTS DU PACKAGE BRIQUE-CYRNEA
// ========================================

// Export des singletons
export { TheBar, TheUser } from "./src/singletons/index.js";

// Export des fonctions d'initialisation
export { initializeTheBar, initializeTheUser } from "./src/singletons/index.js";

// Export des hooks
export { useTheBar } from "./src/hooks/useTheBar.js";
export { useTheUser } from "./src/hooks/useTheUser.js";

// Export des composants principaux
export { default as ClientMiniApp } from "./src/pages/ClientMiniApp";
export { default as BarmanDashboard } from "./src/pages/BarmanDashboard";
export { default as VocalConversation } from "./src/pages/VocalConversation";
export { default as RadioView } from "./src/pages/RadioView";

// Export des écrans
export { default as LegendsScreen } from "./src/screens/LegendsScreen";
export { default as CityScreen } from "./src/screens/CityScreen";
export { default as GamesScreen } from "./src/screens/GamesScreen";
export { default as ProfileScreen } from "./src/screens/ProfileScreen";

// Export des hooks utilitaires
export { useHybridPresence } from "./src/hooks/useHybridPresence.js";

// Export des utilitaires URL
export { getRoomIdFromURL } from "./src/utils/urlUtils.js";

// Export des entités
export { Bar } from "./src/entities/Bar.js";
export { User } from "./src/entities/User.js";
