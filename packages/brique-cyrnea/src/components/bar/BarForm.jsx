import React, { useState } from "react";

/**
 * Formulaire d'édition de bar
 */
export const BarForm = ({ bar, initialFormData = {}, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: bar?.displayName || bar?.name || initialFormData.name || "",
    slug: bar?.slug || initialFormData.slug || "",
    description: bar?.settings?.description || initialFormData.description || "",
    commune: bar?.commune || initialFormData.commune || "",
    facebook_url:
      bar?.settings?.facebook_url || bar?.facebookUrl || initialFormData.facebook_url || "",
    instagram_url:
      bar?.settings?.instagram_url || bar?.instagramUrl || initialFormData.instagram_url || "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-black uppercase mb-2">Nom du bar</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full border-2 border-black p-2 font-black"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-black uppercase mb-2">Slug</label>
        <input
          type="text"
          value={formData.slug}
          onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
          className="w-full border-2 border-black p-2 font-black"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-black uppercase mb-2">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full border-2 border-black p-2 font-black"
          rows={3}
        />
      </div>

      <div>
        <label className="block text-sm font-black uppercase mb-2">Commune</label>
        <input
          type="text"
          value={formData.commune}
          onChange={(e) => setFormData({ ...formData, commune: e.target.value })}
          className="w-full border-2 border-black p-2 font-black"
          placeholder="Bastia"
        />
      </div>

      <div>
        <label className="block text-sm font-black uppercase mb-2">Facebook URL</label>
        <input
          type="url"
          value={formData.facebook_url}
          onChange={(e) => setFormData({ ...formData, facebook_url: e.target.value })}
          className="w-full border-2 border-black p-2 font-black"
          placeholder="https://facebook.com/bar-cyrnea"
        />
      </div>

      <div>
        <label className="block text-sm font-black uppercase mb-2">Instagram URL</label>
        <input
          type="url"
          value={formData.instagram_url}
          onChange={(e) => setFormData({ ...formData, instagram_url: e.target.value })}
          className="w-full border-2 border-black p-2 font-black"
          placeholder="https://instagram.com/bar-cyrnea"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 bg-mondrian-blue text-white py-2 font-black uppercase hover:bg-blue-700"
        >
          {bar ? "Mettre à jour" : "Créer"}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-gray-200 text-black py-2 font-black uppercase hover:bg-gray-300"
          >
            Annuler
          </button>
        )}
      </div>
    </form>
  );
};
