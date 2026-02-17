import React, { useState } from "react";
import { TheBar, TheUser } from "../singletons/index.js";
import { LinksManager } from "../components/LinksManager";
import UserDisplay from "../components/UserDisplay";
import UserProfile from "../components/UserProfile";
import { MondrianBlock } from "../utils/uiUtils";
import { Icon } from "../components/Icon";

/**
 * Écran du profil utilisateur
 */
const ProfileScreen = ({
  context,
  currentUser,
  toggleService,
  zone,
  isBarman,
  isOnDuty,
  onEditPseudo,
  onZoneChange,
  onOpenBarmanModal,
  publicLinks,
  onPublicLinksChange,
  onSetStatus,
}) => {
  // Accès direct aux singletons
  const slug = TheBar.slug;
  const canTakeService = TheUser.canTakeService || TheUser.role === "barman";
  const canConfigure = TheUser.canConfigure || TheUser.role === "barman";
  const CAN_CONFIGURE = canConfigure;

  const _pseudo = TheUser.pseudo || currentUser?.pseudo || "";
  const _nativeLang = context.nativeLang;
  const _isHandsFree = context.isHandsFree;
  const _isSilent = context.isSilent;
  const _gabrielEnabled = context.gabrielConfig?.enabled;

  const [statusText, setStatusText] = useState("");

  // Current status for this user (try the bar singleton first)
  let currentStatus = null;
  try {
    const { TheBar } = require("@inseme/brique-cyrnea");
    const barUser = TheBar?.getUser?.(TheUser.id || currentUser?.id);
    currentStatus = barUser?.status?.text || null;
  } catch (e) {
    currentStatus = null;
  }

  const canSetStatus = TheUser?.id && TheUser.id === currentUser?.id;

  const handleSubmitStatus = async () => {
    if (!statusText || !statusText.trim() || !onSetStatus) return;
    await onSetStatus(statusText.trim());
    setStatusText("");
  };

  return (
    <div className="h-full flex flex-col pt-4 px-4 pb-4">
      <MondrianBlock
        color="white"
        className="flex-1 border-8 border-black flex flex-col shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] overflow-hidden"
      >
        <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-[radial-gradient(var(--color-border-subtle)_1px,transparent_1px)] bg-[size:20px_20px]">
          <section className="bg-white border-4 border-black p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="text-sm font-black uppercase tracking-widest mb-3 flex items-center gap-2">
              <Icon name="user" className="w-4 h-4" />
              Identité
            </h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-black text-lg">{_pseudo}</p>
                <p className="text-xs text-gray-600">
                  {currentUser?.role === "barman" ? "Barman" : "Client"}
                </p>

                {/* Status preview */}
                {currentStatus && (
                  <div className="text-sm italic text-gray-700 mt-2">“{currentStatus}”</div>
                )}
              </div>

              <div className="flex flex-col items-end gap-2">
                {canSetStatus && (
                  <div className="flex items-center gap-2">
                    <input
                      value={statusText}
                      onChange={(e) => setStatusText(e.target.value)}
                      placeholder="Écrire un statut public..."
                      className="border-2 border-black p-2 text-sm"
                    />
                    <button
                      onClick={handleSubmitStatus}
                      className="bg-mondrian-yellow text-black px-3 py-1 border-2 border-black font-black text-sm hover:bg-black hover:text-white transition-colors"
                    >
                      Publier
                    </button>
                  </div>
                )}

                <button
                  onClick={onEditPseudo}
                  className="bg-mondrian-yellow text-black px-3 py-1 border-2 border-black font-black text-sm hover:bg-black hover:text-white transition-colors"
                >
                  Modifier
                </button>
              </div>
            </div>
          </section>

          <section className="bg-white border-4 border-black p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="text-sm font-black uppercase tracking-widest mb-3 flex items-center gap-2">
              <Icon name="map" className="w-4 h-4" />
              Zone
            </h3>
            <div className="flex gap-2 flex-wrap">
              {TheBar.zones.map((z) => (
                <button
                  key={z.id}
                  onClick={() => onZoneChange(zone === z.id ? null : z.id)}
                  className={`px-3 py-1 border-2 text-xs font-bold transition-colors ${
                    zone === z.id ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100"
                  }`}
                >
                  {z.label}
                </button>
              ))}
            </div>
          </section>

          <section className="bg-white border-4 border-black p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="text-sm font-black uppercase tracking-widest mb-3 flex items-center gap-2">
              <Icon name="coffee" className="w-4 h-4" />
              Service
            </h3>
            <div className="flex flex-col gap-3">
              {isBarman ? (
                <>
                  <button
                    onClick={toggleService}
                    className={`w-full border-4 border-black font-black uppercase py-3 transition-all flex items-center justify-center gap-2 ${
                      isOnDuty
                        ? "bg-mondrian-red text-white hover:bg-black"
                        : "bg-mondrian-yellow text-black hover:bg-black hover:text-white"
                    }`}
                  >
                    <Icon name={isOnDuty ? "power-off" : "power"} className="w-5 h-5" />
                    {isOnDuty ? "Quitter le service" : "Prendre le service"}
                  </button>

                  {isOnDuty && (
                    <button
                      onClick={() => (window.location.href = `/bar/${slug}`)}
                      className="w-full bg-black text-white border-4 border-black hover:bg-mondrian-blue font-black uppercase flex items-center justify-center gap-2 py-3 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1"
                    >
                      <Icon name="zap" className="w-5 h-5" />
                      Tableau de bord
                    </button>
                  )}

                  <p className="text-[10px] font-bold text-center opacity-60 uppercase">
                    Vous êtes identifié comme barman
                  </p>
                </>
              ) : (
                <button
                  onClick={onOpenBarmanModal}
                  className="w-full bg-white text-black border-4 border-black hover:bg-black hover:text-white font-black uppercase py-3 flex items-center justify-center gap-2 transition-all"
                >
                  <Icon name="key" className="w-5 h-5" />
                  S'identifier comme Barman
                </button>
              )}
            </div>
          </section>

          <section className="bg-white border-4 border-black p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <LinksManager
              links={publicLinks || []}
              onChange={onPublicLinksChange}
              title="Carte de liens publique"
              description="Ces liens sont sous votre contrôle et peuvent être partagés publiquement."
              maxLinks={8}
              placeholderLabel="Nom du lien"
              placeholderUrl="URL complète"
            />
          </section>

          <section className="bg-white border-4 border-black p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="text-sm font-black uppercase tracking-widest mb-3 flex items-center gap-2">
              <Icon name="settings" className="w-4 h-4" />
              Mentions Légales
            </h3>
            <div className="space-y-2">
              <a
                href="/briques/democracy/legal/terms-of-use.md"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-2 border-2 border-black bg-white hover:bg-black hover:text-white transition-colors group"
              >
                <span className="text-[10px] font-black uppercase tracking-widest">
                  Conditions Générales d'Utilisation
                </span>
                <Icon name="globe" className="w-3 h-3 group-hover:scale-110 transition-transform" />
              </a>
              <a
                href="/briques/democracy/legal/privacy-policy.md"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-2 border-2 border-black bg-white hover:bg-black hover:text-white transition-colors group"
              >
                <span className="text-[10px] font-black uppercase tracking-widest">
                  Politique de Confidentialité
                </span>
                <Icon name="globe" className="w-3 h-3 group-hover:scale-110 transition-transform" />
              </a>
            </div>
          </section>
        </div>
      </MondrianBlock>
    </div>
  );
};

export default ProfileScreen;
