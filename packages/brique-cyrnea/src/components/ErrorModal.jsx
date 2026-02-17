// packages/brique-cyrnea/components/ErrorModal.jsx

import React from "react";
import { X } from "lucide-react";
import { MondrianBlock } from "../utils/uiUtils";

export function ErrorModal({ isOpen, onClose, title, message, onRetry }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
      <MondrianBlock
        color="red"
        className="w-full max-w-md border-8 border-black shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] relative p-8"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-white text-red-600 p-2 hover:bg-red-50 transition-colors border-4 border-black"
        >
          <X className="w-6 h-6" strokeWidth={4} />
        </button>

        <div className="flex flex-col gap-6">
          <header className="text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none text-white">
              {title || "Erreur"}
            </h2>
          </header>

          <div className="bg-white/10 border-4 border-black p-4 rounded">
            <p className="text-white font-bold text-sm text-center">{message}</p>
          </div>

          <div className="flex gap-2">
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex-1 bg-white text-red-600 py-3 border-4 border-black font-black uppercase text-sm hover:bg-red-50 transition-colors"
              >
                Réessayer
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 bg-red-600 text-white py-3 border-4 border-black font-black uppercase text-sm hover:bg-red-700 transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      </MondrianBlock>
    </div>
  );
}
