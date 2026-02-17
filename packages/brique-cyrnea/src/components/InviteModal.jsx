import React from "react";
import { TheBar, TheUser } from "../singletons/index.js";
import { X, Share2 } from "lucide-react";
import { MondrianBlock } from "../utils/uiUtils";

const InviteModal = ({ isOpen, onClose, currentUser, roomMetadata, clientUrl }) => {
  // Accès direct aux singletons
  const pseudo = TheUser.pseudo || currentUser?.pseudo || "";
  const barName = TheBar.name;

  if (!isOpen) return null;

  const inviteUrl = `${clientUrl}/app?room=${roomMetadata?.slug}&invited_by=${encodeURIComponent(pseudo)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(inviteUrl)}&bgcolor=FFD500`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${barName} - Rejoins-moi au bar !`,
          text: `Je suis au ${barName} sous le pseudo ${pseudo}. Rejoins-moi !`,
          url: inviteUrl,
        });
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
      navigator.clipboard.writeText(inviteUrl);
      alert("Lien d'invitation copié !");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <MondrianBlock
        color="white"
        className="w-full max-w-md border-8 border-black shadow-[16px_16px_0px_0px_var(--mondrian-red)] relative overflow-hidden"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-black text-white p-2 hover:bg-mondrian-red transition-colors border-4 border-black"
        >
          <X className="w-6 h-6" strokeWidth={4} />
        </button>

        <div className="p-8 flex flex-col items-center">
          <MondrianBlock
            color="yellow"
            className="mb-8 p-4 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
          >
            <img src={qrUrl} alt="Invitation QR Code" className="w-64 h-64 mix-blend-multiply" />
          </MondrianBlock>

          <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-2 text-center leading-none">
            Invite un Ami
          </h2>
          <p className="text-[10px] font-bold text-center uppercase tracking-widest opacity-60 mb-6 px-3 py-1 bg-slate-100 border border-black/10 rounded-full">
            Fais scanner ce code pour l'aider à entrer
          </p>

          <button
            onClick={handleShare}
            className="w-full bg-black text-white py-4 border-4 border-black font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-mondrian-red transition-colors"
          >
            <Share2 className="w-5 h-5" />
            Partager le Lien
          </button>
        </div>
      </MondrianBlock>
    </div>
  );
};

export default InviteModal;
