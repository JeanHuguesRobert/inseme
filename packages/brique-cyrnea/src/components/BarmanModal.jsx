import React, { useState } from "react";
import { TheBar, TheUser } from "../singletons/index.js";
import { MondrianBlock } from "../utils/uiUtils";
import { Icon } from "./Icon";

/**
 * Modal pour la gestion du statut Barman
 */
const BarmanModal = ({ isOpen, onClose, onDeclare, _toggleService, _isOnDuty }) => {
  const [_place, _setPlace] = useState("");
  const [sesame, setSesame] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Accès direct aux singletons
  const barSlug = TheBar.slug || "cyrnea";
  const userPlace = TheUser.place || "";

  if (!isOpen) return null;

  // Si déjà barman, afficher l'interface de gestion
  if (TheUser.isBarman) {
    return (
      <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
        <MondrianBlock
          color="yellow"
          className="w-full max-w-md border-8 border-black shadow-[16px_16px_0px_0px_var(--mondrian-blue)] relative p-8"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 bg-black text-white p-2 hover:bg-mondrian-red transition-colors border-4 border-black"
          >
            <Icon name="x" className="w-6 h-6" strokeWidth={4} />
          </button>
          <div className="flex flex-col gap-6">
            <header className="text-center">
              <Icon name="user" className="w-12 h-12 mx-auto mb-4 text-mondrian-blue" />
              <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">
                Espace Barman
              </h2>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mt-2">
                Vous êtes déjà déclaré
              </p>
            </header>
            <div className="bg-green-50 border-4 border-green-400 p-4">
              <div className="flex items-center gap-3">
                <Icon name="checkCircle" className="w-6 h-6 text-green-600" />
                <div>
                  <p className="text-sm font-black uppercase text-green-800">Statut Actif</p>
                  <p className="text-xs text-green-600">Poste: {userPlace}</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => (window.location.href = `/bar/${barSlug}`)}
                className="w-full bg-mondrian-blue text-white py-3 border-4 border-black font-black uppercase tracking-widest hover:bg-black transition-colors shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-1"
              >
                Accéder au Tableau de Bord
              </button>
              <button
                onClick={() => onDeclare(null)}
                className="w-full bg-white text-mondrian-red py-3 border-2 border-mondrian-red font-black uppercase text-sm hover:bg-red-50 transition-colors"
              >
                Cesser d&apos;être barman
              </button>
            </div>
          </div>
        </MondrianBlock>
      </div>
    );
  }

  // Interface de déclaration
  return (
    <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
      <MondrianBlock
        color="yellow"
        className="w-full max-w-md border-8 border-black shadow-[16px_16px_0px_0px_var(--mondrian-blue)] relative p-8"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-black text-white p-2 hover:bg-mondrian-red transition-colors border-4 border-black"
        >
          <Icon name="x" className="w-6 h-6" strokeWidth={4} />
        </button>
        <div className="flex flex-col gap-6">
          <header className="text-center">
            <Icon name="briefcase" className="w-12 h-12 mx-auto mb-4 text-mondrian-blue" />
            <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">
              Devenir Barman
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mt-2">
              Accédez aux outils de gestion
            </p>
          </header>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-black uppercase tracking-widest mb-2 block">
                Code d&apos;Accès
              </label>
              <input
                type="password"
                value={sesame}
                onChange={(e) => setSesame(e.target.value)}
                placeholder="Code confidentiel..."
                className="w-full border-4 border-black p-3 font-black uppercase text-sm focus:outline-none focus:bg-mondrian-yellow transition-colors"
                autoFocus
              />
            </div>
          </div>

          <button
            onClick={() => {
              if (!sesame.trim()) {
                alert("Veuillez saisir le code sésame");
                return;
              }
              setIsSubmitting(true);
              onDeclare({ sesame: sesame.trim() });
            }}
            disabled={isSubmitting}
            className="w-full bg-mondrian-blue text-white py-4 border-4 border-black font-black uppercase tracking-widest hover:bg-black transition-colors shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Vérification..." : "Devenir Barman"}
          </button>
        </div>
      </MondrianBlock>
    </div>
  );
};

export default BarmanModal;
