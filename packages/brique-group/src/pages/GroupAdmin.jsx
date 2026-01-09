import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useGroup, useGroupMembers, getSupabase } from "@inseme/cop-host";
import {
  Shield,
  ArrowLeft,
  UserPlus,
  Trash2,
  Settings,
  Users,
  UserCircle,
  X,
  Check,
} from "lucide-react";

export default function GroupAdmin() {
  const supabase = getSupabase();
  const { id } = useParams();
  const { group, isAdmin, loading, terminology } = useGroup(id);
  const {
    members,
    loading: loadingMembers,
    refreshMembers,
  } = useGroupMembers(id);

  const [showRepresentedModal, setShowRepresentedModal] = useState(false);
  const [newRepresented, setNewRepresented] = useState({
    displayName: "",
    role: "member",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateRepresented = async (e) => {
    e.preventDefault();
    if (!newRepresented.displayName) return;

    setIsSubmitting(true);
    try {
      // 1. Créer l'utilisateur avec le rôle 'represented'
      const { data: user, error: userError } = await supabase
        .from("users")
        .insert({
          display_name: newRepresented.displayName,
          role: "represented",
          metadata: { created_by_group: id },
        })
        .select()
        .single();

      if (userError) throw userError;

      // 2. L'ajouter au groupe
      const { error: memberError } = await supabase
        .from("group_members")
        .insert({
          group_id: id,
          user_id: user.id,
          metadata: { role: newRepresented.role },
        });

      if (memberError) throw memberError;

      // 3. Créer un mandat par défaut pour cet utilisateur représenté
      const { error: mandatError } = await supabase.from("mandats").insert({
        user_id: user.id,
        role: newRepresented.role,
        start_date: new Date().toISOString().split("T")[0],
        subtype: group.metadata?.type || "group_member",
        metadata: {
          created_at: new Date().toISOString(),
          group_id: id,
          schemaVersion: 1,
        },
      });

      if (mandatError) {
        console.warn("Erreur creation mandat (non critique):", mandatError);
      }

      setShowRepresentedModal(false);
      setNewRepresented({ displayName: "", role: "member" });
      refreshMembers();
    } catch (err) {
      console.error("Erreur creation représenté:", err);
      alert("Erreur lors de la création.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-white/40">Chargement...</div>;
  if (!isAdmin)
    return (
      <div className="p-8 text-rose-400 font-bold uppercase tracking-widest">
        Accès réservé aux administrateurs.
      </div>
    );

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white p-6 md:p-12">
      <div className="max-w-5xl mx-auto">
        <header className="mb-12">
          <Link
            to={`/groups/${id}`}
            className="flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-6 group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-bold uppercase text-xs tracking-widest">
              Retour au groupe
            </span>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-black mb-2 flex items-center gap-4">
                Administration
                <Settings className="w-8 h-8 text-indigo-500" />
              </h1>
              <p className="text-white/40 font-medium">
                Gestion des membres et paramètres de {group.name}
              </p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-8">
          {/* Members Management */}
          <section className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden">
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <h2 className="text-xl font-bold flex items-center gap-3">
                <Users className="w-6 h-6 text-indigo-400" />
                Gestion des membres
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowRepresentedModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/20 transition-all font-bold text-sm"
                >
                  <UserCircle className="w-4 h-4" />
                  {terminology?.represented || "Représenté"}
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/20 transition-all font-bold text-sm">
                  <UserPlus className="w-4 h-4" />
                  Inviter
                </button>
              </div>
            </div>

            <div className="divide-y divide-white/5">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="p-6 flex items-center justify-between hover:bg-white/[0.01] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                        m.users?.role === "represented"
                          ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                          : "bg-white/10"
                      }`}
                    >
                      {m.users?.role === "represented" ? (
                        <UserCircle className="w-6 h-6" />
                      ) : (
                        <span className="font-bold">
                          {m.users?.display_name?.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="font-bold flex items-center gap-2">
                        {m.users?.display_name}
                        {m.metadata?.role === "admin" && (
                          <Shield className="w-3 h-3 text-indigo-400" />
                        )}
                        {m.users?.role === "represented" && (
                          <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/20 uppercase tracking-tighter">
                            {terminology?.represented || "Représenté"}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-white/20 font-black uppercase tracking-tighter">
                        {m.users?.id}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50"
                      value={m.metadata?.role || "member"}
                      onChange={() => {}}
                    >
                      <option value="member">Membre</option>
                      <option value="admin">Admin</option>
                      <option value="moderator">Modérateur</option>
                    </select>
                    <button className="p-2 text-white/20 hover:text-rose-400 transition-colors">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Danger Zone */}
          <section className="bg-rose-500/5 border border-rose-500/20 rounded-[2.5rem] p-8">
            <h2 className="text-xl font-bold text-rose-400 mb-4 flex items-center gap-3">
              <Trash2 className="w-6 h-6" />
              Zone de danger
            </h2>
            <p className="text-rose-400/60 text-sm mb-6">
              La suppression du groupe est irréversible. Toutes les données,
              membres et votes associés seront définitivement effacés.
            </p>
            <button className="px-6 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-rose-500/20 active:scale-95">
              Supprimer le groupe
            </button>
          </section>
        </div>
      </div>

      {/* Modal Création Représenté */}
      {showRepresentedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A0A0B]/80 backdrop-blur-sm">
          <div className="bg-[#16161A] border border-white/10 rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-3">
                <UserCircle className="w-6 h-6 text-indigo-400" />
                Nouveau {terminology?.represented || "Représenté"}
              </h3>
              <button
                onClick={() => setShowRepresentedModal(false)}
                className="text-white/20 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateRepresented} className="p-8 space-y-6">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-white/40 mb-2">
                  Nom / Identité
                </label>
                <input
                  autoFocus
                  type="text"
                  placeholder="Ex: Jean-Guy Talamoni"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 focus:outline-none focus:border-indigo-500/50 transition-colors"
                  value={newRepresented.displayName}
                  onChange={(e) =>
                    setNewRepresented({
                      ...newRepresented,
                      displayName: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-white/40 mb-2">
                  Rôle interne au groupe
                </label>
                <select
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 focus:outline-none focus:border-indigo-500/50 transition-colors"
                  value={newRepresented.role}
                  onChange={(e) =>
                    setNewRepresented({
                      ...newRepresented,
                      role: e.target.value,
                    })
                  }
                >
                  <option value="member">
                    {terminology?.member || "Membre"}
                  </option>
                  <option value="board_member">Bureau / Direction</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>

              <div className="pt-4">
                <button
                  disabled={isSubmitting}
                  className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    "Création..."
                  ) : (
                    <>
                      <Check className="w-4 h-4" /> Créer le profil
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
