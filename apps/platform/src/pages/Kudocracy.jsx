import React, { useState, useEffect } from "react";
import { 
  PropositionList, 
  CreateProposition, 
  DelegationManager, 
  GovernanceSettings, 
  VotingDashboard 
} from "@inseme/brique-kudocracy";
import AuthModal from "../components/common/AuthModal";
import { Link } from "react-router-dom";
import { PRIMARY_COLOR, SECONDARY_COLOR } from "../constants.js";
import SiteFooter from "../components/layout/SiteFooter";
import { useCurrentUser } from "@inseme/cop-host";
import { getSupabase } from "../lib/supabase.js";

export default function Kudocracy() {
  // const { supabase } = useSupabase();
  const [activeTab, setActiveTab] = useState("browse");
  const { currentUser, userStatus } = useCurrentUser();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isHowItWorksExpanded, setIsHowItWorksExpanded] = useState(false);

  // Utilisation du composant AuthModal pour gérer l'authentification

  // For sign out, use supabase directly if needed
  const handleSignOut = async () => {
    if (!getSupabase()) return;
    await getSupabase().auth?.signOut?.();
  };

  // If you want to add auth-required UI, you can use userStatus here
  return (
    <div className="min-h-screen">
      <header className="border-b-4 border-primary shadow-sm bg-dark">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-light font-brand">Kudocracy</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="info-accordion">
          <button
            onClick={() => setIsHowItWorksExpanded(!isHowItWorksExpanded)}
            className="info-accordion-header"
          >
            <h2 className="text-xl font-bold">Comment fonctionne Kudocracy ?</h2>
            <svg
              className={`w-6 h-6 transition-transform ${isHowItWorksExpanded ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {isHowItWorksExpanded && (
            <div className="info-accordion-content">
              <ul className="space-y-2">
                <li>
                  <strong>Votez directement</strong> : Approuvez ou désapprouvez les propositions
                  qui vous intéressent
                </li>
                <li>
                  <strong>Déléguez votre vote</strong> : Sur certains sujets, confiez votre voix à
                  quelqu'un en qui vous avez confiance
                </li>
                <li>
                  <strong>Changez d'avis</strong> : Tous les votes sont réversibles, modifiez-les à
                  tout moment
                </li>
                <li>
                  <strong>Transparence totale</strong> : Tous les votes sont publics pour éviter la
                  fraude
                </li>
                <li>
                  <strong>Résultats en temps réel</strong> : Suivez l'évolution des opinions au fil
                  du temps
                </li>
              </ul>
            </div>
          )}
        </div>

        <nav className="tabs-nav">
          {[
            { id: "browse", label: "Propositions" },
            { id: "create", label: "Formuler une proposition" },
            { id: "delegations", label: "Vos délégations" },
            { id: "dashboard", label: "Votre activité" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`tab-item ${activeTab === tab.id ? "active" : ""}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div>
          {activeTab === "browse" && <PropositionList user={currentUser} />}
          {activeTab === "create" &&
            (currentUser ? (
              <CreateProposition user={currentUser} />
            ) : (
              <AuthRequired onAuth={() => setShowAuthModal(true)} />
            ))}
          {activeTab === "delegations" &&
            (currentUser ? (
              <div className="space-y-8">
                <GovernanceSettings user={currentUser} />
                <DelegationManager user={currentUser} />
              </div>
            ) : (
              <AuthRequired onAuth={() => setShowAuthModal(true)} />
            ))}
          {activeTab === "dashboard" && <VotingDashboard />}
        </div>
      </div>

      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => setShowAuthModal(false)}
        />
      )}

      <div className="mt-12">
        <SiteFooter />
      </div>
    </div>
  );
}

function AuthRequired({ onAuth }) {
  return (
    <div className="theme-card p-12 text-center">
      <h3 className="text-2xl font-bold text-gray-100 mb-4">Connexion requise</h3>
      <p className="text-gray-300 mb-6">
        Vous devez être connecté pour accéder à cette fonctionnalité
      </p>
      <button onClick={onAuth} className="btn btn-primary">
        Se connecter
      </button>
    </div>
  );
}
