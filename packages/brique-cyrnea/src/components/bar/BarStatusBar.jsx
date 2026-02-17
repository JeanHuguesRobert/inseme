import React from "react";

export const BarStatusBar = ({ bar }) => {
  if (!bar) return null;

  if (bar.isOpen) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-black uppercase bg-green-500 text-white">
        <div className="w-2 h-2 rounded-full bg-white" />
        Actif
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-black uppercase bg-gray-500 text-white">
      <div className="w-2 h-2 rounded-full bg-white" />
      Fermé
    </div>
  );
};
