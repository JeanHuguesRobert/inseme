import React, { useState } from "react";
import { X, Plus, Link as LinkIcon, ExternalLink } from "lucide-react";

export function LinksManager({
  links = [],
  onChange,
  title = "Liens",
  description = "Gérez vos liens ici.",
  showAddButton = true,
  maxLinks = 10,
  placeholderLabel = "Nom",
  placeholderUrl = "URL",
  className = "",
}) {
  const [draggedIndex, setDraggedIndex] = useState(null);

  const safeLinks = Array.isArray(links) ? links : [];

  const handleAddLink = () => {
    if (safeLinks.length >= maxLinks) {
      alert(`Maximum ${maxLinks} liens autorisés`);
      return;
    }
    const next = [...safeLinks, { label: "", url: "" }];
    if (onChange) onChange(next);
  };

  const handleLinkChange = (index, field, value) => {
    const next = safeLinks.map((link, i) => (i === index ? { ...link, [field]: value } : link));
    if (onChange) onChange(next);
  };

  const handleRemoveLink = (index) => {
    const next = safeLinks.filter((_, i) => i !== index);
    if (onChange) onChange(next);
  };

  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (dropIndex) => {
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const draggedLink = safeLinks[draggedIndex];
    const newLinks = [...safeLinks];
    newLinks.splice(draggedIndex, 1);
    newLinks.splice(dropIndex, 0, draggedLink);

    if (onChange) onChange(newLinks);
    setDraggedIndex(null);
  };

  const isValidUrl = (url) => {
    if (!url) return true; // Empty URLs are allowed during editing
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {title && (
        <div>
          <h3 className="text-sm font-black tracking-widest mb-2 flex items-center gap-2">
            <LinkIcon className="w-4 h-4" />
            {title}
          </h3>
          {description && <p className="text-[9px] font-bold opacity-60">{description}</p>}
        </div>
      )}

      <div className="space-y-2">
        {safeLinks.map((link, index) => (
          <div
            key={index}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(index)}
            className={`grid grid-cols-[1fr_1.2fr_auto] gap-2 items-center transition-all ${
              draggedIndex === index ? "opacity-50" : ""
            } hover:bg-mondrian-yellow/5 p-2 rounded -mx-2`}
          >
            <input
              value={link.label || ""}
              onChange={(e) => handleLinkChange(index, "label", e.target.value)}
              placeholder={placeholderLabel}
              className="border-2 border-black px-2 py-1 text-[10px] font-bold tracking-tighter focus:bg-mondrian-yellow/10 outline-none"
            />
            <div className="relative">
              <input
                value={link.url || ""}
                onChange={(e) => handleLinkChange(index, "url", e.target.value)}
                placeholder={placeholderUrl}
                className={`border-2 px-2 py-1 text-[10px] font-bold tracking-tighter focus:bg-mondrian-yellow/10 outline-none w-full pr-8 ${
                  link.url && !isValidUrl(link.url)
                    ? "border-mondrian-red bg-mondrian-red/10"
                    : "border-black"
                }`}
                type="url"
              />
              {link.url && isValidUrl(link.url) && (
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-mondrian-blue hover:text-mondrian-yellow transition-colors"
                  title="Ouvrir le lien"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleRemoveLink(index)}
              className="border-2 border-black px-2 py-1 text-[10px] font-black bg-black text-white hover:bg-mondrian-red transition-colors flex items-center justify-center"
              title="Supprimer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        {showAddButton && safeLinks.length < maxLinks && (
          <button
            type="button"
            onClick={handleAddLink}
            className="w-full border-2 border-dashed border-black px-3 py-2 text-[10px] font-black bg-white hover:bg-mondrian-yellow/20 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-3 h-3" />
            Ajouter un lien
            {maxLinks > 0 && ` (${safeLinks.length}/${maxLinks})`}
          </button>
        )}

        {maxLinks > 0 && safeLinks.length >= maxLinks && (
          <p className="text-[9px] font-bold uppercase text-mondrian-red text-center">
            Maximum {maxLinks} liens atteint
          </p>
        )}
      </div>

      {safeLinks.some((link) => link.url && !isValidUrl(link.url)) && (
        <p className="text-[9px] font-bold uppercase text-mondrian-red">
          ⚠️ Certains liens ont une URL invalide
        </p>
      )}
    </div>
  );
}

export default LinksManager;
