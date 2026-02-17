import React, { useState } from "react";
import { X, Camera, Loader2, RefreshCw } from "lucide-react";
import { MondrianBlock } from "../utils/uiUtils";

/**
 * CameraModal
 *
 * Ce composant ne contient plus la logique caméra directe (gérée par PersistentCamera).
 * Il sert d'overlay de contrôle pour capturer, basculer la caméra ou annuler.
 */
export function CameraModal({ isOpen, cameraRef, onClose, onCapture }) {
  const [isCapturing, setIsCapturing] = useState(false);

  const handleCapture = async () => {
    if (!cameraRef.current) return;

    try {
      setIsCapturing(true);
      const photoDataUri = cameraRef.current.takePhoto();

      if (!photoDataUri) throw new Error("Échec de la capture");

      // Conversion DataURI -> Blob pour le stockage
      const res = await fetch(photoDataUri);
      const blob = await res.blob();

      // Créer un objet fichier pour compatibilité avec le reste de l'app
      const file = new File([blob], `capture_${Date.now()}.jpg`, {
        type: "image/jpeg",
      });

      // Créer une preview URL
      const previewUrl = URL.createObjectURL(blob);

      onCapture({ file, previewUrl });
    } catch (err) {
      console.error("[CameraModal] Failed to capture photo:", err);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleSwitch = () => {
    if (cameraRef.current) {
      cameraRef.current.switchCamera();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center p-4">
      {/*
          Le fond noir flouté est géré par PersistentCamera pour englober la caméra.
          Le Modal ici ne contient que les contrôles et le cadre.
      */}
      <MondrianBlock
        color="blue"
        className="w-full max-w-md aspect-square border-8 border-black shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] relative p-8 pointer-events-auto bg-transparent"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-white text-black p-2 hover:bg-mondrian-red hover:text-white transition-colors border-4 border-black"
        >
          <X className="w-6 h-6" strokeWidth={4} />
        </button>

        <div className="flex flex-col h-full justify-between gap-6">
          <header className="text-center">
            <Camera className="w-12 h-12 mx-auto mb-4 text-white" />
            <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none text-white">
              Cyrnea Cam
            </h2>
          </header>

          {/* Espace vide central pour laisser voir la caméra derrière */}
          <div className="flex-1 rounded-lg pointer-events-none border-4 border-white/20" />

          <div className="flex gap-2">
            <button
              onClick={handleSwitch}
              className="bg-white text-black p-4 border-4 border-black hover:bg-mondrian-blue hover:text-white transition-colors"
              title="Changer de caméra"
            >
              <RefreshCw className="w-6 h-6" />
            </button>

            <button
              onClick={handleCapture}
              disabled={isCapturing}
              className="flex-1 bg-mondrian-yellow text-black py-4 border-4 border-black font-black uppercase tracking-widest hover:bg-black hover:text-white transition-colors shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCapturing ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : "Capturer"}
            </button>
          </div>
        </div>
      </MondrianBlock>
    </div>
  );
}
