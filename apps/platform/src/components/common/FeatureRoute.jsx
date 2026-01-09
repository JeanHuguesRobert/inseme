// src/components/common/FeatureRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { isFeatureEnabled } from "../../lib/features.js";

/**
 * Un composant wrapper pour les routes qui dépendent d'une feature flag.
 * Si la feature est désactivée, redirige vers la page d'accueil ou une page 404.
 */
export default function FeatureRoute({ feature, children, fallback = "/" }) {
  const enabled = isFeatureEnabled(feature, true); // Par défaut true pour les routes existantes si non spécifié

  if (!enabled) {
    console.warn(`Feature ${feature} is disabled. Redirecting to ${fallback}`);
    return <Navigate to={fallback} replace />;
  }

  return children;
}
