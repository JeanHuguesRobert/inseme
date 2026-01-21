import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSupabase } from "../lib/supabase.js";
import { useCurrentUser } from "@inseme/cop-host";
import SiteFooter from "../components/layout/SiteFooter";

export default function CivicNetwork() {
  const { currentUser, loading: userLoading } = useCurrentUser();
  const [activeTab, setActiveTab] = useState("delegates"); // 'delegates' or 'delegators' (My Power)
  const [myDelegates, setMyDelegates] = useState([]);
  const [myDelegators, setMyDelegators] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    loadNetwork();
  }, [currentUser]);

  const loadNetwork = async () => {
    setLoading(true);
    try {
      // 1. My Delegates (People I give power to)
      const { data: delegates, error: err1 } = await getSupabase()
        .from("delegations")
        .select(
          `
            id,
            tag_id,
            tag:tags(name),
            delegate:users!delegations_delegate_id_fkey(id, display_name, avatar_url)
        `
        )
        .eq("delegator_id", currentUser.id);

      if (err1) throw err1;
      setMyDelegates(delegates);

      // 2. My Delegators (People giving me power)
      const { data: delegators, error: err2 } = await getSupabase()
        .from("delegations")
        .select(
          `
            id,
            tag_id,
            tag:tags(name),
            delegator:users!delegations_delegator_id_fkey(id, display_name, avatar_url)
        `
        )
        .eq("delegate_id", currentUser.id);

      if (err2) throw err2;
      setMyDelegators(delegators);
    } catch (err) {
      console.error("Error loading network", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (delegationId) => {
    if (!window.confirm("Êtes-vous sûr de vouloir révoquer cette délégation ?")) return;
    try {
      const { error } = await getSupabase().from("delegations").delete().eq("id", delegationId);
      if (error) throw error;
      loadNetwork(); // Reload
    } catch (e) {
      alert("Erreur lors de la révocation");
    }
  };

  if (userLoading || loading) {
    return (
      <div className="p-8 text-center text-gray-500">Chargement de votre réseau citoyen...</div>
    );
  }

  if (!currentUser) {
    return (
      <div className="p-8 text-center">
        <p>Veuillez vous connecter pour voir votre réseau.</p>
        <Link to="/login" className="btn btn-primary mt-4 inline-block">
          Connexion
        </Link>
      </div>
    );
  }

  const votingPower = 1 + myDelegators.length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Votre Réseau Citoyen
        </h1>
        <p className="text-gray-500">
          Gérez vos délégations et visualisez votre impact (Démocratie Liquide).
        </p>
      </div>

      {/* Stats Card */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-6 text-white shadow-lg mb-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <h2 className="text-xl font-semibold opacity-90">Votre Force de Vote</h2>
            <div className="text-5xl font-bold mt-2">{votingPower}</div>
            <p className="text-sm opacity-75 mt-1">
              1 voix personnelle + {myDelegators.length} mandat(s)
            </p>
          </div>
          <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm">
            <div className="text-sm font-semibold">Délégués mandatés</div>
            <div className="text-2xl font-bold">{myDelegates.length}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-700 mb-6">
        <button
          onClick={() => setActiveTab("delegates")}
          className={`pb-3 px-4 text-sm font-medium transition-colors border-b-2 ${
            activeTab === "delegates"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          Vos Délégués
        </button>
        <button
          onClick={() => setActiveTab("delegators")}
          className={`pb-3 px-4 text-sm font-medium transition-colors border-b-2 ${
            activeTab === "delegators"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          Votre Force (Ils vous délèguent)
        </button>
      </div>

      {/* Content */}
      <div className="min-h-[300px]">
        {activeTab === "delegates" ? (
          <div className="grid gap-4">
            {myDelegates.length === 0 ? (
              <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <p className="text-gray-500 mb-4">Vous n'avez désigné aucun délégué.</p>
                <p className="text-sm text-gray-400">
                  Pour déléguer, allez dans "Paramètres / Gouvernance" ou sur le profil d'un
                  utilisateur.
                </p>
                <Link to="/settings/governance" className="btn btn-secondary mt-4 text-sm">
                  Configurer vos délégations
                </Link>
              </div>
            ) : (
              myDelegates.map((del) => (
                <div
                  key={del.id}
                  className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 btn-circle bg-gray-200 flex items-center justify-center text-lg">
                      {del.delegate?.display_name?.charAt(0) || "?"}
                    </div>
                    <div>
                      <div className="font-semibold">
                        {del.delegate?.display_name || "Utilisateur supprimé"}
                      </div>
                      <div className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full inline-block mt-1">
                        Sur le thème : #{del.tag?.name || "Tous"}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevoke(del.id)}
                    className="text-red-500 hover:text-red-700 text-sm font-medium px-3 py-1 hover:bg-red-50 rounded"
                  >
                    Révoquer
                  </button>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {myDelegators.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                Personne ne vous a encore délégué son vote.
                <p className="text-sm mt-2">
                  Participez davantage aux débats pour gagner la confiance de la communauté !
                </p>
              </div>
            ) : (
              myDelegators.map((del) => (
                <div
                  key={del.id}
                  className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 btn-circle bg-green-100 text-green-700 flex items-center justify-center text-lg">
                      {del.delegator?.display_name?.charAt(0) || "?"}
                    </div>
                    <div>
                      <div className="font-semibold">
                        {del.delegator?.display_name || "Utilisateur"}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Vous délègue son vote pour : #{del.tag?.name || "Tous"}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs font-bold text-green-600">+1 Voix</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}
