// src/components/SaaS/LandingPage.jsx

import React, { useState } from "react";
import { submitLead } from "../../lib/leads.js";
import {
  ArrowRight,
  Bot,
  Users,
  Vote,
  Shield,
  MessageSquare,
  Sparkles,
} from "lucide-react";

export function LandingPage({ onLogin, onViewTerms, onViewPrivacy }) {
  const [email, setEmail] = useState("");
  const [leadType, setLeadType] = useState("citoyen_engage");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const { success } = await submitLead({
      email,
      lead_type: leadType,
      metadata: {
        context: "inseme_landing_v3",
      },
    });
    setIsSubmitting(false);
    if (success) {
      setIsSuccess(true);
      setEmail("");
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 px-8 py-6 flex justify-between items-center backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-black italic">
            K
          </div>
          <span className="text-xl font-black tracking-tighter">KUDOCRACY</span>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative pt-40 pb-20 px-4 overflow-hidden">
        {/* Background Blobs */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/10 blur-[150px] -z-10 rounded-full animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-[700px] h-[700px] bg-rose-600/5 blur-[180px] -z-10 rounded-full"></div>

        <div className="max-w-5xl mx-auto text-center space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <h1 className="text-7xl md:text-9xl font-black tracking-tighter leading-[0.8] text-white">
            KUDOCRACY
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-300 to-indigo-400">
              INSEME.
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-white/50 max-w-2xl mx-auto font-medium leading-relaxed">
            Le pouvoir aux citoyens. Une assemblée liquide guidée par Ophélia,
            votre IA médiatrice qui facilite le consensus sans jamais s'imposer.
          </p>

          <div className="flex flex-col md:flex-row items-center justify-center gap-4 pt-8">
            <button
              onClick={() => onLogin("anonymous")}
              className="w-full md:w-auto px-10 py-5 bg-white text-black text-lg font-black rounded-2xl flex items-center justify-center gap-3 hover:bg-rose-50 transition-all active:scale-95 shadow-2xl shadow-white/10"
            >
              ACCÈS INVITÉ (RAPIDE)
              <ArrowRight className="w-5 h-5" />
            </button>

            <button
              onClick={() => onLogin("signin")}
              className="w-full md:w-auto px-10 py-5 bg-white/5 border border-white/10 text-white text-lg font-black rounded-2xl flex items-center justify-center gap-3 hover:bg-white/10 transition-all active:scale-95"
            >
              CONNEXION MEMBRE
            </button>
          </div>

          <div className="max-w-xl mx-auto pt-8">
            <div className="group">
              <form
                onSubmit={handleSubmit}
                className="flex flex-col md:flex-row gap-2 p-1.5 bg-white/5 border border-white/10 rounded-2xl focus-within:ring-2 focus-within:ring-rose-500/50 transition-all"
              >
                <select
                  value={leadType}
                  onChange={(e) => setLeadType(e.target.value)}
                  className="bg-white/5 text-white/70 px-4 py-3 outline-none rounded-xl text-sm font-medium border border-white/5"
                >
                  <option value="citoyen_engage">🙋 Citoyen</option>
                  <option value="liste_electorale">🗳️ Liste électorale</option>
                  <option value="maire_elu">🏛️ Élu / Mairie</option>
                  <option value="collectif_citoyen">✊ Collectif / Asso</option>
                </select>
                <input
                  type="email"
                  required
                  placeholder="Votre email..."
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-transparent px-4 py-3 outline-none flex-grow text-sm font-medium"
                />
                <button
                  disabled={isSubmitting || isSuccess}
                  className="px-6 py-3 bg-rose-600 hover:bg-rose-700 disabled:bg-white/10 disabled:text-white/40 text-white rounded-xl font-bold transition-all text-sm whitespace-nowrap"
                >
                  {isSuccess ? "REÇU !" : isSubmitting ? "..." : "S'INSCRIRE"}
                </button>
              </form>
              {isSuccess && (
                <p className="text-[10px] text-rose-400 font-bold mt-2 uppercase tracking-widest text-center">
                  On vous recontacte très vite.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Features Preview */}
      <div className="max-w-7xl mx-auto px-8 py-40 grid grid-cols-1 md:grid-cols-3 gap-12">
        <div className="space-y-6 group">
          <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center group-hover:border-rose-500/50 group-hover:bg-rose-500/10 transition-all duration-500">
            <Bot className="w-8 h-8 text-rose-300" />
          </div>
          <h3 className="text-2xl font-black tracking-tight">
            Ophélia Médiatrice
          </h3>
          <p className="text-white/40 leading-relaxed font-medium">
            Ni police, ni juge. Ophélia facilite les débats, détecte les
            conflits et documente l'histoire. Elle rationalise vos échanges sans
            jamais imposer sa loi.
          </p>
        </div>
        <div className="space-y-6 group">
          <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center group-hover:border-rose-500/50 group-hover:bg-rose-500/10 transition-all duration-500">
            <Users className="w-8 h-8 text-rose-300" />
          </div>
          <h3 className="text-2xl font-black tracking-tight">Rôles Liquides</h3>
          <p className="text-white/40 leading-relaxed font-medium">
            Oubliez les permissions rigides. Chacun peut ouvrir la séance ou
            proposer un vote. Le système s'adapte à votre confiance, du Conseil
            Municipal à la réunion de quartier.
          </p>
        </div>
        <div className="space-y-6 group">
          <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center group-hover:border-rose-500/50 group-hover:bg-rose-500/10 transition-all duration-500">
            <MessageSquare className="w-8 h-8 text-rose-300" />
          </div>
          <h3 className="text-2xl font-black tracking-tight">
            Mémoire Vivante
          </h3>
          <p className="text-white/40 leading-relaxed font-medium">
            Tout est archivé, rien n'est perdu. Reprenez une séance exactement
            là où elle s'est arrêtée, avec un contexte parfait et des décisions
            traçables.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="px-8 py-20 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8 text-white/20 font-bold uppercase tracking-widest text-[10px]">
        <p>© 2025 ASSOCIATION C.O.R.S.I.C.A. — MADE IN CORSICA</p>
        <div className="flex gap-8">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onViewTerms?.();
            }}
            className="hover:text-white transition-colors"
          >
            Conditions d'utilisation
          </a>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onViewPrivacy?.();
            }}
            className="hover:text-white transition-colors"
          >
            Privacy
          </a>
          <a href="#" className="hover:text-white transition-colors">
            Twitter
          </a>
        </div>
      </footer>
    </div>
  );
}
