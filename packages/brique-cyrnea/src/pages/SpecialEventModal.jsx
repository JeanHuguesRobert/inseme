// SpecialEventModal.jsx
// Modal for barmans to announce a special evening/event.
import React, { useState } from "react";
import { Button } from "@inseme/ui";
import { MondrianBlock } from "@inseme/room";

const SpecialEventModal = ({ isOpen, onClose, onAnnounce }) => {
  if (!isOpen) return null;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleAnnounce = () => {
    if (!title.trim()) return;
    onAnnounce({ title: title.trim(), description: description.trim() });
    setTitle("");
    setDescription("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto">
      <MondrianBlock
        color="white"
        className="w-full max-w-md border-8 border-black shadow-[16px_16px_0px_0px_var(--mondrian-red)] relative overflow-hidden my-auto"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-black text-white p-2 hover:bg-mondrian-red transition-colors border-4 border-black"
        >
          X
        </button>
        <div className="p-4">
          <h2 className="text-3xl font-black uppercase mb-4 text-center">
            Annonce d'événement spécial
          </h2>
          <div className="flex flex-col gap-3 mb-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre de l'événement"
              className="border-2 border-black p-2 text-xs font-bold uppercase focus:bg-mondrian-yellow/10 outline-none"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optionnelle)"
              rows={3}
              className="border-2 border-black p-2 text-xs font-bold uppercase focus:bg-mondrian-yellow/10 outline-none"
            />
          </div>
          <Button
            onClick={handleAnnounce}
            className="w-full bg-black text-white font-black uppercase hover:bg-mondrian-red transition-colors"
            disabled={!title.trim()}
          >
            Diffuser l'annonce
          </Button>
        </div>
      </MondrianBlock>
    </div>
  );
};

export default SpecialEventModal;
