import React from "react";
import { TheUser } from "../singletons/index.js";
import { Icon } from "../components/Icon";
import { TalkButton } from "@inseme/room";
import { Headphones, Camera, Image, Coffee, Heart, QrCode, Moon } from "lucide-react";

const OpheliaActionButtons = ({
  attachment,
  isMobile,
  onAttach,
  onAttachCamera,
  onAttachGallery,
  onTip,
  onSuspendu,
  onInvite,
  onAfter,
}) => {
  // Accès direct au singleton User
  const pseudo = TheUser.pseudo;

  return (
    <div className="flex items-center justify-center gap-4 w-full">
      <button
        onClick={() => {
          const next = !TheUser.isHandsFree;
          TheUser.setIsHandsFree(next);
          localStorage.setItem("inseme_hands_free", next ? "true" : "false");
        }}
        className={`p-3 rounded-full border-4 border-black transition-all ${
          TheUser.isHandsFree
            ? "bg-black text-white"
            : "bg-white text-black hover:bg-black hover:text-white"
        }`}
        title="Mode Mains Libres"
      >
        <Headphones className="w-6 h-6" strokeWidth={3} />
      </button>

      <button
        onClick={() => {
          if (isMobile) {
            onAttach();
          } else {
            onAttachCamera();
          }
        }}
        className={`p-3 rounded-full border-4 border-black transition-all ${
          attachment
            ? "bg-mondrian-red text-white"
            : "bg-white text-black hover:bg-black hover:text-white"
        }`}
        title={isMobile ? "Prendre une photo (Caméra)" : "Prendre une photo (Webcam)"}
      >
        <Camera className="w-6 h-6" strokeWidth={3} />
      </button>

      <button
        onClick={onAttachGallery}
        className={`p-3 rounded-full border-4 border-black transition-all ${
          attachment
            ? "bg-mondrian-red text-white"
            : "bg-white text-black hover:bg-black hover:text-white"
        }`}
        title="Choisir une image"
      >
        <Image className="w-6 h-6" strokeWidth={3} />
      </button>

      <button
        onClick={onTip}
        className="p-3 rounded-full border-4 border-black bg-white text-black hover:bg-mondrian-yellow transition-all"
        title="Offrir une tournée"
      >
        <Heart className="w-6 h-6 text-red-600" strokeWidth={3} />
      </button>

      <button
        onClick={onSuspendu}
        className="p-3 rounded-full border-4 border-black bg-white text-black hover:bg-mondrian-yellow transition-all"
        title="Offrir un café suspendu"
      >
        <Coffee className="w-6 h-6" strokeWidth={3} />
      </button>

      <button
        onClick={onInvite}
        disabled={!pseudo}
        className="p-3 rounded-full border-4 border-black bg-white text-black hover:bg-mondrian-yellow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        title="Inviter un ami"
      >
        <QrCode className="w-6 h-6" strokeWidth={3} />
      </button>

      <button
        onClick={onAfter}
        className="p-3 rounded-full border-4 border-black bg-white text-black hover:bg-black hover:text-mondrian-yellow transition-all"
        title="Proposer un After"
      >
        <Moon className="w-6 h-6" strokeWidth={3} />
      </button>
    </div>
  );
};

export default OpheliaActionButtons;
