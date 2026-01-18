// src/components/SaaS/SaaSDashboard.jsx
//
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase.js";
import {
  Plus,
  Settings,
  Play,
  Trash2,
  Bot,
  Layout,
  Globe,
  ArrowLeft,
  Save,
  Users,
  CheckCircle2,
  Loader2,
  Scale,
  Gavel,
  ShieldAlert,
  FileText,
  Link,
} from "lucide-react";
import { GOVERNANCE_MODELS } from "../../../../../packages/brique-kudocracy/src/governance.js";

export function SaaSDashboard({ user, onSelectRoom }) {
  const [rooms, setRooms] = useState([]);
  const [participatedRooms, setParticipatedRooms] = useState([]);
  const [view, setView] = useState("list"); // 'list', 'edit'
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinSlug, setJoinSlug] = useState("");
  const [newRoom, setNewRoom] = useState({ name: "", slug: "" });
  const [editingRoom, setEditingRoom] = useState(null);

  const fetchRooms = useCallback(async () => {
    const { data, error } = await supabase
      .from("inseme_rooms")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (!error) setRooms(data);
  }, [user?.id]);

  const fetchParticipatedRooms = useCallback(async () => {
    // Find rooms where user has sent messages, but doesn't own
    const { data: messages, error: msgError } = await supabase
      .from("inseme_messages")
      .select("room_id")
      .eq("user_id", user.id)
      .limit(100);

    if (msgError || !messages) return;

    const roomIds = [...new Set(messages.map((m) => m.room_id))];
    if (roomIds.length === 0) return;

    const { data: foundRooms, error: roomsError } = await supabase
      .from("inseme_rooms")
      .select("*")
      .in(
        "slug",
        roomIds.filter((id) => typeof id === "string")
      ) // Filter out UUIDs if stored as such
      .not("owner_id", "eq", user.id);

    if (!roomsError && foundRooms) {
      setParticipatedRooms(foundRooms);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      fetchRooms();
      fetchParticipatedRooms();
    }
  }, [user, fetchRooms, fetchParticipatedRooms]);

  const handleJoin = async (e) => {
    e.preventDefault();
    const slug = joinSlug.trim().toLowerCase();
    if (!slug) return;

    setIsJoining(true);
    try {
      // Check if room exists
      const { data, error } = await supabase
        .from("inseme_rooms")
        .select("slug")
        .eq("slug", slug)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        onSelectRoom(slug);
      } else {
        alert(`La salle "${slug}" n'existe pas.`);
      }
    } catch (err) {
      console.error("Error joining room:", err);
      alert("Erreur lors de la vérification de la salle.");
    } finally {
      setIsJoining(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();

    // 1. Sanitize base slug
    let baseSlug =
      newRoom.slug ||
      newRoom.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    if (!baseSlug) baseSlug = "salle";

    // 2. Check if user already owns a room with the exact same name
    const { data: nameMatch } = await supabase
      .from("inseme_rooms")
      .select("slug, name")
      .eq("owner_id", user.id)
      .eq("name", newRoom.name.trim())
      .maybeSingle();

    if (nameMatch) {
      const proceed = window.confirm(
        `Vous possédez déjà une assemblée nommée "${nameMatch.name}". \n\nVoulez-vous en créer une nouvelle (avec un identifiant différent) ou rejoindre l'existante ?\n\n[OK] Créer une nouvelle\n[Annuler] Rejoindre l'existante`
      );
      if (!proceed) {
        onSelectRoom(nameMatch.slug);
        setIsCreating(false);
        return;
      }
    }

    // 3. Find a unique slug (auto-increment if collision)
    let slug = baseSlug;
    let counter = 0;
    let isUnique = false;

    while (!isUnique) {
      const { data: existing } = await supabase
        .from("inseme_rooms")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (!existing) {
        isUnique = true;
      } else {
        counter++;
        slug = `${baseSlug}-${counter}`;
      }
    }

    // 4. Create the room
    const { data, error } = await supabase
      .from("inseme_rooms")
      .insert([
        {
          name: newRoom.name.trim(),
          slug: slug,
          owner_id: user.id,
          settings: {
            ophelia: {
              voice: "nova",
              prompt:
                "Tu es Ophélia, une médiatrice experte. Ton rôle est de faciliter les échanges, de résumer les débats et de veiller au respect du protocole Inseme.",
            },
          },
        },
      ])
      .select();

    if (!error && data) {
      setRooms([data[0], ...rooms]);
      setIsCreating(false);
      setNewRoom({ name: "", slug: "" });

      // Redirect immediately to the new room
      onSelectRoom(slug);

      // Optional: notify user if slug was changed
      if (slug !== baseSlug) {
        alert(
          `Note : L'identifiant "${baseSlug}" était déjà pris. Votre salle a été créée avec l'identifiant "${slug}".`
        );
      }
    } else {
      alert("Erreur lors de la création de la salle : " + (error?.message || "Erreur inconnue"));
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const { error } = await supabase
      .from("inseme_rooms")
      .update({
        name: editingRoom.name,
        settings: editingRoom.settings,
      })
      .eq("id", editingRoom.id);

    if (!error) {
      setRooms(rooms.map((r) => (r.id === editingRoom.id ? editingRoom : r)));
      setView("list");
    } else {
      alert("Erreur lors de la mise à jour: " + error.message);
    }
  };

  if (view === "edit" && editingRoom) {
    return (
      <div className="max-w-4xl mx-auto p-8 animate-in fade-in duration-500">
        <button
          onClick={() => setView("list")}
          className="flex items-center gap-2 text-white/40 hover:text-white mb-8 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          RETOUR AU HUB
        </button>

        <div className="bg-neutral-900/40 border border-white/5 rounded-[2rem] p-10 backdrop-blur-3xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Settings className="w-32 h-32" />
          </div>

          <form onSubmit={handleUpdate} className="space-y-10 relative z-10">
            <div>
              <h2 className="text-3xl font-black text-white tracking-tighter mb-2">
                Réglages de l'Espace
              </h2>
              <p className="text-xs text-white/30 font-mono italic">ID: {editingRoom.slug}</p>
            </div>

            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-1">
                    Nom de l'Assemblée
                  </label>
                  <input
                    type="text"
                    value={editingRoom.name}
                    onChange={(e) => setEditingRoom({ ...editingRoom, name: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-1">
                    Assemblée Parente (Plénière)
                  </label>
                  <input
                    type="text"
                    value={editingRoom.settings?.parent_slug || ""}
                    onChange={(e) =>
                      setEditingRoom({
                        ...editingRoom,
                        settings: {
                          ...editingRoom.settings,
                          parent_slug: e.target.value,
                        },
                      })
                    }
                    placeholder="ex: assemblee-generale (laisser vide si racine)"
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                  />
                  <p className="text-[9px] text-white/20 italic">
                    Définir un parent transforme cette salle en Commission. Les PV pourront être
                    remontés à la plénière.
                  </p>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                    <Scale className="w-3 h-3" />
                    Modèle de Gouvernance
                  </label>
                  <select
                    value={editingRoom.settings?.governance_model || "democratie_directe"}
                    onChange={(e) =>
                      setEditingRoom({
                        ...editingRoom,
                        settings: {
                          ...editingRoom.settings,
                          governance_model: e.target.value,
                          // Clear custom labels when changing model to use model defaults
                          // unless we want to keep them. Let's clear them for now for a clean switch.
                          labels: {},
                        },
                      })
                    }
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white appearance-none cursor-pointer focus:ring-2 focus:ring-indigo-500/50 outline-none"
                  >
                    {GOVERNANCE_MODELS.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[9px] text-white/20 italic">
                    Définit les règles de vote et la terminologie par défaut (
                    {(() => {
                      const model = GOVERNANCE_MODELS.find(
                        (m) =>
                          m.id === (editingRoom.settings?.governance_model || "democratie_directe")
                      );
                      return model
                        ? `${model.terminology.member}, ${model.terminology.session}, ${model.terminology.dashboard}`
                        : "";
                    })()}
                    ).
                  </p>
                </div>

                <div className="space-y-4 pt-4 border-t border-white/5">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-1">
                    Personnalisation de la Terminologie (Optionnel)
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-[9px] text-white/30 uppercase font-bold px-1">
                        Membre
                      </label>
                      <input
                        type="text"
                        placeholder={
                          GOVERNANCE_MODELS.find(
                            (m) =>
                              m.id ===
                              (editingRoom.settings?.governance_model || "democratie_directe")
                          )?.terminology.member
                        }
                        value={editingRoom.settings?.labels?.member || ""}
                        onChange={(e) =>
                          setEditingRoom({
                            ...editingRoom,
                            settings: {
                              ...editingRoom.settings,
                              labels: {
                                ...editingRoom.settings?.labels,
                                member: e.target.value,
                              },
                            },
                          })
                        }
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-indigo-500/30 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] text-white/30 uppercase font-bold px-1">
                        Séance
                      </label>
                      <input
                        type="text"
                        placeholder={
                          GOVERNANCE_MODELS.find(
                            (m) =>
                              m.id ===
                              (editingRoom.settings?.governance_model || "democratie_directe")
                          )?.terminology.session
                        }
                        value={editingRoom.settings?.labels?.session || ""}
                        onChange={(e) =>
                          setEditingRoom({
                            ...editingRoom,
                            settings: {
                              ...editingRoom.settings,
                              labels: {
                                ...editingRoom.settings?.labels,
                                session: e.target.value,
                              },
                            },
                          })
                        }
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-indigo-500/30 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] text-white/30 uppercase font-bold px-1">
                        Synthèse
                      </label>
                      <input
                        type="text"
                        placeholder={
                          GOVERNANCE_MODELS.find(
                            (m) =>
                              m.id ===
                              (editingRoom.settings?.governance_model || "democratie_directe")
                          )?.terminology.dashboard
                        }
                        value={editingRoom.settings?.labels?.dashboard || ""}
                        onChange={(e) =>
                          setEditingRoom({
                            ...editingRoom,
                            settings: {
                              ...editingRoom.settings,
                              labels: {
                                ...editingRoom.settings?.labels,
                                dashboard: e.target.value,
                              },
                            },
                          })
                        }
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-indigo-500/30 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-1">
                    Bucket de Documents (Stockage)
                  </label>
                  <input
                    type="text"
                    value={editingRoom.settings?.storage_bucket || "public-documents"}
                    onChange={(e) =>
                      setEditingRoom({
                        ...editingRoom,
                        settings: {
                          ...editingRoom.settings,
                          storage_bucket: e.target.value,
                        },
                      })
                    }
                    placeholder="ex: public-documents"
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all font-mono text-sm"
                  />
                  <p className="text-[9px] text-white/20 italic">
                    Nom du bucket Supabase pour l'archivage des PV (défaut: public-documents).
                  </p>
                </div>
              </div>

              {/* AI Settings */}
              <div className="pt-6 space-y-6 border-t border-white/5">
                <div className="flex items-center gap-3">
                  <Bot className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-lg font-bold text-white uppercase tracking-wider">
                    Ophélia (Module IA)
                  </h3>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-1 flex justify-between items-center">
                    Vocalité
                    <span className="text-indigo-400 capitalize">
                      {editingRoom.settings?.ophelia?.voice || "nova"}
                    </span>
                  </label>
                  <select
                    value={editingRoom.settings?.ophelia?.voice || "nova"}
                    onChange={(e) =>
                      setEditingRoom({
                        ...editingRoom,
                        settings: {
                          ...editingRoom.settings,
                          ophelia: {
                            ...editingRoom.settings?.ophelia,
                            voice: e.target.value,
                          },
                        },
                      })
                    }
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white appearance-none cursor-pointer focus:ring-2 focus:ring-indigo-500/50 outline-none"
                  >
                    <option value="nova">Nova (Énergique)</option>
                    <option value="shimmer">Shimmer (Douce)</option>
                    <option value="alloy">Alloy (Neutre)</option>
                    <option value="echo">Echo (Profonde)</option>
                    <option value="fable">Fable (Narrative)</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                    <Link className="w-3 h-3" />
                    URL du Prompt (Fichier .txt ou .md)
                  </label>
                  <input
                    type="url"
                    value={editingRoom.settings?.ophelia?.prompt_url || ""}
                    onChange={(e) =>
                      setEditingRoom({
                        ...editingRoom,
                        settings: {
                          ...editingRoom.settings,
                          ophelia: {
                            ...editingRoom.settings?.ophelia,
                            prompt_url: e.target.value,
                          },
                        },
                      })
                    }
                    placeholder="https://raw.githubusercontent.com/.../prompt.md"
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all font-mono text-sm"
                  />
                  <p className="text-[9px] text-white/20 italic">
                    Si défini, ce fichier sera chargé comme prompt prioritaire. Permet de gérer les
                    règles de la salle via GitHub ou un Drive.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                    <FileText className="w-3 h-3" />
                    Prompt Système (Fallback Texte)
                  </label>
                  <textarea
                    rows={8}
                    value={editingRoom.settings?.ophelia?.prompt || ""}
                    onChange={(e) =>
                      setEditingRoom({
                        ...editingRoom,
                        settings: {
                          ...editingRoom.settings,
                          ophelia: {
                            ...editingRoom.settings?.ophelia,
                            prompt: e.target.value,
                          },
                        },
                      })
                    }
                    placeholder="Décrivez comment Ophélia doit se comporter..."
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white text-sm leading-relaxed focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all font-mono"
                  />
                  <p className="text-[9px] text-white/20 italic">
                    Note: Le prompt définit les règles de médiation et le ton d'Ophélia.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-8">
              <button
                type="submit"
                className="flex items-center gap-3 px-10 py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-black transition-all shadow-2xl shadow-indigo-500/20 active:scale-95 group"
              >
                <Save className="w-5 h-5 group-hover:scale-110 transition-transform" />
                ENREGISTRER LES MODIFICATIONS
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-12 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex justify-between items-end border-b border-white/5 pb-8">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter mb-2">
            Hub <span className="text-indigo-500">KUDOCRACY</span>
          </h1>
          <p className="text-white/40 font-bold uppercase tracking-widest text-[10px] mb-4">
            Gestion des Assemblées Synchrones (Inseme)
          </p>
          <div className="max-w-2xl text-white/50 text-sm leading-relaxed">
            Bienvenue dans votre espace de gestion. Ici, vous pouvez **organiser vos assemblées**,
            inviter des décideurs et personnaliser l'intervention de la Médiatrice pour faciliter
            vos débats. Chaque assemblée est un lieu de délibération unique, prêt à accueillir la
            parole de chacun.
          </div>
        </div>
        <div className="flex items-center gap-4">
          <form onSubmit={handleJoin} className="relative group">
            <input
              type="text"
              disabled={isJoining}
              value={joinSlug}
              onChange={(e) => setJoinSlug(e.target.value)}
              placeholder="Rejoindre une séance..."
              className="bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none w-48 focus:w-64 transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isJoining}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-white/20 group-hover:text-white transition-colors disabled:opacity-50"
            >
              {isJoining ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </button>
          </form>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            NOUVELLE SÉANCE
          </button>
        </div>
      </div>

      {/* Creation Modal/Form */}
      {isCreating && (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl animate-in slide-in-from-top-4 duration-300">
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">
                Nom de l'Assemblée
              </label>
              <input
                type="text"
                required
                value={newRoom.name}
                onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                placeholder="ex: Coopérative Bastiaise"
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-white/10 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">
                Slug URL (facultatif)
              </label>
              <input
                type="text"
                value={newRoom.slug}
                onChange={(e) => setNewRoom({ ...newRoom, slug: e.target.value })}
                placeholder="ex: coop-bastia"
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-white/10 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
              />
            </div>
            <div className="md:col-span-2 flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-6 py-3 text-white/40 hover:text-white font-bold transition-all"
              >
                ANNULER
              </button>
              <button
                type="submit"
                className="px-8 py-3 bg-white text-black rounded-2xl font-bold hover:bg-indigo-50 transition-all active:scale-95 shadow-xl"
              >
                CRÉER L'ASSEMBLÉE
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rooms Grid */}
      <div className="space-y-12">
        {/* Owned Rooms */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <Layout className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-black text-white/40 uppercase tracking-widest">
              Vos Assemblées
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onSelect={onSelectRoom}
                onEdit={(r) => {
                  setEditingRoom(r);
                  setView("edit");
                }}
                onDelete={async (id) => {
                  if (confirm("Supprimer cette assemblée ? Toutes les données seront perdues.")) {
                    const { error } = await supabase.from("inseme_rooms").delete().eq("id", id);
                    if (!error) setRooms(rooms.filter((r) => r.id !== id));
                  }
                }}
                isOwner={true}
              />
            ))}
            {rooms.length === 0 && !isCreating && (
              <div className="col-span-full py-12 border-2 border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center text-white/20">
                <p className="font-bold uppercase tracking-widest text-[10px]">
                  Aucune assemblée créée
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Participated Rooms */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <Users className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-black text-white/40 uppercase tracking-widest">
              Assemblées visitées
            </h2>
          </div>
          {participatedRooms.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {participatedRooms.map((room) => (
                <RoomCard key={room.id} room={room} onSelect={onSelectRoom} isOwner={false} />
              ))}
            </div>
          ) : (
            <div className="py-12 border-2 border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center text-white/20">
              <p className="font-bold uppercase tracking-widest text-[10px]">
                Aucune assemblée rejointe récemment
              </p>
              <p className="text-[9px] mt-2 italic opacity-50">
                Participez à des débats pour les voir apparaître ici.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function RoomCard({ room, onSelect, onEdit, onDelete, isOwner }) {
  const modelId = room.settings?.governance_model || "democratie_directe";
  const model = GOVERNANCE_MODELS.find((m) => m.id === modelId) || GOVERNANCE_MODELS[0];
  const ostracizedCount = room.settings?.ostracized
    ? Object.keys(room.settings.ostracized).length
    : 0;
  const isProportional = model.rules.vote_weight === "proportional_to_shares";

  return (
    <div className="bg-neutral-900/40 border border-white/5 hover:border-indigo-500/30 rounded-3xl p-6 transition-all group relative overflow-hidden flex flex-col h-full">
      <div
        className={`absolute top-0 left-0 w-1 h-full transition-opacity ${isOwner ? "bg-indigo-500 opacity-20 group-hover:opacity-100" : "bg-emerald-500 opacity-10 group-hover:opacity-50"}`}
      ></div>

      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-white/5 rounded-2xl">
          <Globe className="w-5 h-5 text-indigo-400" />
        </div>
        {isOwner && (
          <div className="flex gap-2">
            <button
              onClick={() => onEdit(room)}
              className="p-2 text-white/20 hover:text-white/60 transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(room.id)}
              className="p-2 text-white/20 hover:text-rose-500 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="flex-grow">
        <h3 className="text-xl font-bold text-white mb-1 leading-tight">{room.name}</h3>
        <p className="text-[10px] text-white/30 font-mono mb-4 uppercase tracking-wider">
          /{room.slug}
        </p>

        {/* Governance Badge */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
            <Gavel className="w-3 h-3 text-indigo-400" />
            <span className="text-[9px] font-black text-indigo-300 uppercase tracking-tighter">
              {model.name}
            </span>
          </div>
          {isProportional && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <Scale className="w-3 h-3 text-amber-400" />
              <span className="text-[9px] font-black text-amber-300 uppercase tracking-tighter">
                Poids Variable
              </span>
            </div>
          )}
          {ostracizedCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/10 border border-rose-500/20 rounded-lg animate-pulse">
              <ShieldAlert className="w-3 h-3 text-rose-400" />
              <span className="text-[9px] font-black text-rose-300 uppercase tracking-tighter">
                {ostracizedCount} EXCLU(S)
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 py-4 border-t border-white/5 mb-6">
        <div className="flex items-center gap-2">
          <Bot className="w-3 h-3 text-indigo-400" />
          <span className="text-[10px] font-bold text-white/60 uppercase">
            {room.settings?.ophelia?.voice || "Nova"} active
          </span>
        </div>
        {!isOwner && (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span className="text-[10px] font-bold text-white/60 uppercase">
              {room.settings?.labels?.member || model.terminology.member}
            </span>
          </div>
        )}
      </div>

      <button
        onClick={() => onSelect(room.slug)}
        className="w-full flex items-center justify-center gap-2 py-4 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-2xl font-bold transition-all border border-indigo-500/20 active:scale-95 group/btn"
      >
        <Play className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
        ENTRER DANS L'ASSEMBLÉE
      </button>
    </div>
  );
}
