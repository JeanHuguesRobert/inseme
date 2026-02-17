import React, { useState, useEffect } from "react";
import { Icon } from "./Icon";
import { MondrianBlock } from "../utils/uiUtils";
import { TalkButton } from "@inseme/room";
import { storage } from "@inseme/cop-host";
import { TheUser } from "../singletons/index.js";

const TipModal = ({ isOpen, onClose, barmans, onTip, currentUser, context, userZone }) => {
  // Accès direct au singleton User
  const _pseudo = TheUser.pseudo || currentUser?.pseudo || "";
  const [selectedBarman, setSelectedBarman] = useState(null);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [privacy, setPrivacy] = useState("all"); // all, recipient, anon
  const [_tipMethod, _setTipMethod] = useState("manual"); // Exclusively manual
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [_phoneRevealed, setPhoneRevealed] = useState(false);

  useEffect(() => {
    setPhoneRevealed(false);
  }, [selectedBarman]);

  // Pre-select barman based on zone if available
  useEffect(() => {
    if (isOpen && !selectedBarman && barmans.length > 0) {
      // Logic could be added here to pre-select based on context/zone
      if (userZone) {
        // Try to match barman's zone with user's zone
        // Check both 'zone' property and 'metadata.zone' as fallback
        const barmanInZone = barmans.find((b) => (b.zone || b.metadata?.zone) === userZone);
        if (barmanInZone) {
          setSelectedBarman(barmanInZone);
          return;
        }
      }

      // Fallback: if only one barman, select them
      if (barmans.length === 1) setSelectedBarman(barmans[0]);
    }
  }, [isOpen, barmans, selectedBarman, userZone]);

  if (!isOpen) return null;

  const suggestedAmounts = [2, 5, 10, 20];

  const handleSubmit = async () => {
    if (!selectedBarman) return;
    setIsSubmitting(true);
    try {
      await onTip({
        barman: selectedBarman,
        amount: parseFloat(amount) || 0,
        message,
        privacy,
        attachment,
        method: "manual", // Force manual
      });
      onClose();
    } catch (_err) {
      alert("Erreur lors de l'opération.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCapturePhoto = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          const roomId =
            context.roomMetadata?.id || context.roomMetadata?.slug || context.roomName || "tips";
          const url = await storage.uploadEphemeral(roomId, file);
          setAttachment({ type: "photo", url });
        } catch (err) {
          console.error("Photo upload failed:", err);
          alert("Erreur lors de l'upload de la photo.");
        }
      }
    };
    input.click();
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300 overflow-y-auto">
      <MondrianBlock
        color="white"
        className="w-full max-w-md border-8 border-black shadow-[16px_16px_0px_0px_var(--mondrian-yellow)] relative p-8"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-black text-white p-2 hover:bg-mondrian-red transition-colors border-4 border-black"
        >
          <Icon name="x" className="w-6 h-6" strokeWidth={4} />
        </button>

        <div className="flex flex-col gap-6">
          <header className="text-center">
            <Icon name="coins" className="w-12 h-12 mx-auto mb-4 text-mondrian-yellow" />
            <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">
              Déclarer un Pourboire
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mt-2">
              Signalez votre geste au staff !
            </p>
          </header>

          {/* SÉLECTION BARMAN */}
          <div>
            <label className="text-xs font-black uppercase mb-2 block">Pour qui ?</label>
            <div className="flex flex-wrap gap-2">
              {barmans.length > 0 ? (
                barmans.map((b) => (
                  <button
                    key={b.user_id}
                    onClick={() => setSelectedBarman(b)}
                    className={`px-4 py-2 border-4 border-black font-black uppercase text-xs transition-all ${
                      selectedBarman?.user_id === b.user_id
                        ? "bg-mondrian-yellow translate-y-1 shadow-none"
                        : "bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                    }`}
                  >
                    {b.name} ({b.place || "Bar"})
                  </button>
                ))
              ) : (
                <div className="flex flex-col items-center gap-4 py-8 bg-slate-50 border-4 border-dashed border-black/20">
                  <p className="text-[10px] font-bold text-black/40 uppercase text-center px-4">
                    Aucun barman n'est connecté pour le moment.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* MONTANT (Facultatif mais recommandé pour la déclaration) */}
          <div>
            <label className="text-xs font-black uppercase mb-2 block">
              Combien ? (Approximatif)
            </label>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {suggestedAmounts.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setAmount(amt.toString())}
                  className={`py-2 border-4 border-black font-black text-sm transition-all ${
                    amount === amt.toString()
                      ? "bg-black text-white translate-y-1 shadow-none"
                      : "bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                  }`}
                >
                  {amt}€
                </button>
              ))}
            </div>
            <div className="relative">
              <input
                type="number"
                placeholder="Montant libre..."
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-white border-4 border-black p-4 font-black text-xl focus:ring-0 focus:outline-none"
              />
            </div>
          </div>

          <div className="bg-slate-50 border-4 border-dashed border-black/20 p-4 text-center animate-in zoom-in duration-300">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-white border-4 border-black mb-2 rotate-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Icon name="handshake" className="w-6 h-6 text-black" />
            </div>
            <p className="text-[10px] font-bold uppercase leading-tight max-w-[250px] mx-auto">
              Ceci est une déclaration manuelle. Vous donnez le pourboire directement au barman
              (espèces, etc.).
            </p>
          </div>

          {/* MESSAGE & ATTACHMENTS */}
          <div>
            <label className="text-xs font-black uppercase mb-2 block">Un petit mot ?</label>
            <div className="relative">
              <textarea
                placeholder="EX: C'est pour la tournée ! ✨"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-white border-4 border-black p-4 font-bold text-sm focus:ring-0 focus:outline-none h-24 resize-none"
              />
              <div className="absolute bottom-2 right-2 flex gap-2">
                <button
                  onClick={handleCapturePhoto}
                  title="Prendre une photo"
                  className={`p-2 border-2 border-black transition-colors ${attachment?.type === "photo" ? "bg-mondrian-yellow" : "bg-white hover:bg-slate-100"}`}
                >
                  <Icon name="camera" className="w-4 h-4" />
                </button>
                <div title="Enregistrer un vocal">
                  <TalkButton
                    size="sm"
                    showLabel={false}
                    vocalState={context.vocalState}
                    isRecording={context.isRecording}
                    isTranscribing={context.isTranscribing}
                    vocalError={context.vocalError}
                    duration={context.duration}
                    startRecording={() => {
                      if (context.startRecording) context.startRecording();
                    }}
                    stopRecording={async () => {
                      if (context.stopRecording) {
                        const blob = await context.stopRecording();
                        if (blob) {
                          try {
                            const roomId =
                              context.roomMetadata?.id ||
                              context.roomMetadata?.slug ||
                              context.roomName ||
                              "tips";
                            const url = await storage.uploadVocal(roomId, blob);
                            setAttachment({
                              type: "vocal",
                              url,
                            });
                          } catch (err) {
                            console.error("Vocal upload failed:", err);
                            alert("Erreur lors de l'upload du message vocal.");
                          }
                        }
                      }
                    }}
                    className="border-2 border-black shadow-none hover:shadow-none translate-x-0 translate-y-0"
                  />
                </div>
              </div>
            </div>
            {attachment && (
              <div className="mt-2 flex items-center justify-between bg-mondrian-yellow/10 border-2 border-black p-2 animate-in slide-in-from-top duration-300">
                <div className="flex items-center gap-2">
                  {attachment.type === "photo" ? (
                    <div className="w-8 h-8 border-2 border-black overflow-hidden">
                      <img
                        src={attachment.url}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                  <span className="text-[10px] font-black uppercase">
                    {attachment.type === "photo" ? "Photo prête" : "Vocal prêt"}
                  </span>
                </div>
                <button
                  onClick={() => setAttachment(null)}
                  className="bg-black text-white p-1 hover:bg-red-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* CONFIDENTIALITÉ */}
          <div>
            <label className="text-xs font-black uppercase mb-2 block">
              Qui voit cette annonce ?
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "all", label: "Tout le bar", icon: () => <Icon name="globe" /> },
                { id: "recipient", label: "Juste lui", icon: () => <Icon name="user" /> },
                { id: "anon", label: "Anonyme", icon: () => <Icon name="volumeX" /> },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPrivacy(p.id)}
                  className={`p-2 border-2 border-black flex flex-col items-center gap-1 transition-all ${
                    privacy === p.id ? "bg-black text-white" : "bg-white text-black"
                  }`}
                >
                  <p.icon className="w-4 h-4" />
                  <span className="text-[8px] font-black uppercase leading-none text-center">
                    {p.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <button
            disabled={!selectedBarman || isSubmitting}
            onClick={handleSubmit}
            className={`w-full py-4 border-4 border-black font-black uppercase tracking-widest transition-colors shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-1 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed bg-black text-white hover:bg-mondrian-blue`}
          >
            {isSubmitting ? "Envoi..." : "Annoncer le pourboire"}
          </button>
        </div>
      </MondrianBlock>
    </div>
  );
};

export default TipModal;
