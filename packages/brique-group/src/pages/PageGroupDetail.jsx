import React from "react";
import { useParams, Link } from "react-router-dom";
import { useGroup, useGroupMembers } from "@inseme/cop-host";
import { Users, Shield, ArrowLeft, Settings, Mail, Calendar } from "lucide-react";

export default function GroupDetail() {
  const { id } = useParams();
  const { group, membership, isMember, isAdmin, loading } = useGroup(id);
  const { members, loading: loadingMembers } = useGroupMembers(id);

  if (loading) return <div className="p-8 text-white/40">Chargement du groupe...</div>;
  if (!group) return <div className="p-8 text-white/40">Groupe introuvable.</div>;

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      {/* Header / Hero */}
      <div className="relative h-64 bg-indigo-600/20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0A0A0B]" />
        <div className="absolute top-8 left-8">
          <Link to="/groups" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-bold uppercase text-xs tracking-widest">Retour aux groupes</span>
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 -mt-32 relative z-10">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Content */}
          <div className="flex-1 space-y-8">
            <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 backdrop-blur-xl">
              <div className="flex items-start justify-between mb-6">
                <div className="w-20 h-20 bg-indigo-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-500/20">
                  <Users className="w-10 h-10 text-white" />
                </div>
                {isAdmin && (
                  <Link 
                    to={`/groups/${id}/admin`}
                    className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all"
                  >
                    <Settings className="w-5 h-5 text-white/60" />
                  </Link>
                )}
              </div>

              <h1 className="text-4xl font-black mb-4">{group.name}</h1>
              <p className="text-xl text-white/60 leading-relaxed max-w-2xl mb-8">
                {group.description || "Aucune description."}
              </p>

              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/5 text-sm text-white/40">
                  <Calendar className="w-4 h-4" />
                  Créé le {new Date(group.created_at).toLocaleDateString()}
                </div>
                {isMember && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-sm text-emerald-400 font-bold">
                    <Shield className="w-4 h-4" />
                    Membre du groupe
                  </div>
                )}
              </div>
            </div>

            {/* Members Section */}
            <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8">
              <h2 className="text-2xl font-black mb-8 flex items-center gap-3">
                Membres
                <span className="text-sm font-medium text-white/20 bg-white/5 px-3 py-1 rounded-full">
                  {members.length}
                </span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold">
                          {m.users?.display_name?.charAt(0) || "?"}
                        </span>
                      </div>
                      <div>
                        <div className="font-bold">{m.users?.display_name || "Anonyme"}</div>
                        <div className="text-xs text-white/20 uppercase font-black tracking-widest">
                          {m.metadata?.role || "Membre"}
                        </div>
                      </div>
                    </div>
                    {m.metadata?.role === 'admin' && (
                      <Shield className="w-4 h-4 text-indigo-400" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar Actions */}
          <div className="w-full lg:w-80 space-y-6">
            {!isMember && (
              <button className="w-full bg-indigo-500 hover:bg-indigo-600 text-white p-6 rounded-3xl font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 active:scale-95">
                Rejoindre le groupe
              </button>
            )}
            
            <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-white/40">À propos</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                Ce groupe est un espace de délibération citoyenne. Les membres peuvent voter et proposer des sujets.
              </p>
              <div className="pt-4 space-y-2">
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <Mail className="w-3 h-3" />
                  TODO: Contact: contact@inseme.org
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
