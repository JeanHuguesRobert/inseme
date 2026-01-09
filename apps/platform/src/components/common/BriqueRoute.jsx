// src/components/common/BriqueRoute.jsx
import React, { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import FeatureRoute from "./FeatureRoute";
import SiteFooter from "../layout/SiteFooter";
import { BRIQUE_COMPONENTS } from "../../generated/brique-registry.js";

/**
 * Composant pour rendre dynamiquement les routes d'une brique
 */
export function BriqueRoutes({ brique }) {
  if (!brique.routes || brique.routes.length === 0) return null;

  return (
    <FeatureRoute feature={brique.feature}>
      <Routes>
        {brique.routes.map((route) => {
          const componentKey = `${brique.id}:${route.path}`;
          const LazyComponent = lazy(BRIQUE_COMPONENTS[componentKey]);

          return (
            <Route
              key={route.path}
              path={
                route.path === brique.routes[0].path
                  ? "/*"
                  : route.path.replace(brique.routes[0].path, "")
              }
              element={
                <Suspense
                  fallback={
                    <div className="p-8 text-center text-gray-500">
                      Chargement du module {brique.name}...
                    </div>
                  }
                >
                  <div className="flex flex-col min-h-screen">
                    <main className="flex-grow">
                      <LazyComponent />
                    </main>
                    <SiteFooter />
                  </div>
                </Suspense>
              }
            />
          );
        })}
      </Routes>
    </FeatureRoute>
  );
}

// Version simplifiée pour une route unique
export function BriqueRoute({ brique, route }) {
  const componentKey = `${brique.id}:${route.path}`;
  const LazyComponent = lazy(BRIQUE_COMPONENTS[componentKey]);

  return (
    <FeatureRoute feature={brique.feature}>
      <Suspense
        fallback={
          <div className="p-8 text-center text-gray-500">Chargement de {brique.name}...</div>
        }
      >
        <div className="flex flex-col min-h-screen">
          <main className="flex-grow">
            <LazyComponent />
          </main>
          <SiteFooter />
        </div>
      </Suspense>
    </FeatureRoute>
  );
}
