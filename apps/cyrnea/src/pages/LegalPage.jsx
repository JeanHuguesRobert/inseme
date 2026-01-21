import React from "react";
import { LegalPage as UILegalPage } from "@inseme/ui";
import { Link } from "react-router-dom";

// Paths from @inseme/kudocracy (mapped to Cyrnea public folder structure)
const LEGAL_PATHS = {
  TERMS_OF_USE: "/briques/democracy/legal/terms-of-use.md",
  PRIVACY_POLICY: "/briques/democracy/legal/privacy-policy.md",
};

export default function LegalPage({ type }) {
  const isPrivacy = type === "privacy";
  const title = isPrivacy ? "Politique de confidentialité" : "Conditions d'utilisation";
  const url = isPrivacy ? LEGAL_PATHS.PRIVACY_POLICY : LEGAL_PATHS.TERMS_OF_USE;

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <UILegalPage title={title} url={url} />
      <div className="mt-8 text-center pb-12">
        <Link
          to="/"
          className="inline-block px-4 py-2 bg-mondrian-blue text-white hover:opacity-90 font-semibold rounded-lg shadow-sm transition-colors"
        >
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}
