import React, { useState, useEffect } from "react";
import { getSupabase } from "@inseme/cop-host";
import { Link } from "react-router-dom";
import { Users, Search, Plus, ArrowRight, Shield, Globe, Lock } from "lucide-react";

export default function GroupList() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    setLoading(true);
    const { data } = await getSupabase()
      .from("groups")
      .select("*, group_members(count)")
      .order("created_at", { ascending: false });
    setGroups(data || []);
    setLoading(false);
  };

  const filteredGroups = groups.filter(g => 
    g.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white p-6">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-black tracking-tight mb-2 bg-gradient-to-r from-white to-white/40 bg-clip-text text-transparent">
              Groupes & Communautés
            </h1>
            <p className="text-white/40 font-medium">
              Découvrez et rejoignez les espaces de délibération.
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-indigo-400 transition-colors" />
              <input 
                type="text"
                placeholder="Rechercher un groupe..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-6 w-full md:w-80 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all placeholder:text-white/20"
              />
            </div>
            <button className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20 active:scale-95">
              <Plus className="w-5 h-5" />
              Nouveau
            </button>
          </div>
        </header>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 bg-white/5 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGroups.map(group => (
              <Link 
                key={group.id} 
                to={`/groups/${group.id}`}
                className="group relative bg-white/5 border border-white/10 rounded-3xl p-6 hover:bg-white/[0.08] hover:border-white/20 transition-all"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                    <Users className="w-7 h-7 text-indigo-400" />
                  </div>
                  <div className="flex gap-2">
                    {group.is_private ? (
                      <div className="p-2 bg-amber-500/10 rounded-xl" title="Privé">
                        <Lock className="w-4 h-4 text-amber-400" />
                      </div>
                    ) : (
                      <div className="p-2 bg-emerald-500/10 rounded-xl" title="Public">
                        <Globe className="w-4 h-4 text-emerald-400" />
                      </div>
                    )}
                  </div>
                </div>

                <h3 className="text-xl font-bold mb-2 group-hover:text-indigo-400 transition-colors line-clamp-1">
                  {group.name}
                </h3>
                <p className="text-white/40 text-sm leading-relaxed mb-6 line-clamp-2">
                  {group.description || "Aucune description fournie pour ce groupe."}
                </p>

                <div className="flex items-center justify-between mt-auto pt-6 border-t border-white/5">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white/20">
                    <Users className="w-3 h-3" />
                    {group.group_members?.[0]?.count || 0} membres
                  </div>
                  <div className="text-indigo-400 opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all duration-300">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
