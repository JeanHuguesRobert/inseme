// src/pages/GroupEdit.jsx

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSupabase } from "../lib/supabase.js";
import { useCurrentUser } from "@inseme/cop-host";
import { isDeleted, isAdmin } from "@inseme/cop-host";
import GroupForm from "../components/social/GroupForm";

/**
 * Page d'édition de groupe
 */
export default function GroupEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, userStatus } = useCurrentUser();

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    if (userStatus !== "signed_in" || !currentUser) return;

    async function loadGroup() {
      try {
        setLoading(true);
        setError(null);

        // Charger le groupe
        const { data: groupData, error: groupError } = await getSupabase()
          .from("groups")
          .select("*")
          .eq("id", id)
          .single();

        if (groupError) throw groupError;

        if (isDeleted(groupData)) {
          throw new Error("Ce groupe a été supprimé");
        }

        // Vérifier que l'utilisateur est le créateur ou admin (pour l'instant créateur)
        // TODO: Ajouter vérification admin plus robuste si nécessaire
        if (groupData.created_by !== currentUser.id && !isAdmin(currentUser)) {
          throw new Error("Vous n'êtes pas autorisé à modifier ce groupe");
        }

        setGroup(groupData);
      } catch (err) {
        console.error("Error loading group:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadGroup();
  }, [id, currentUser, userStatus]);

  if (userStatus === "signing_in") {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (userStatus === "signed_out" || !currentUser) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-300 mb-4">Vous devez être connecté pour modifier un groupe</p>
        <button onClick={() => navigate("/social")} className="text-primary-600 hover:underline">
          Retour au Café
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 mb-4">{error}</div>
        <button onClick={() => navigate(-1)} className="text-primary-600 hover:underline">
          ← Retour
        </button>
      </div>
    );
  }

  if (!group) return null;

  return <GroupForm group={group} currentUser={currentUser} />;
}
