import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSupabase } from "../../lib/supabase.js";
import { createGroupMetadata, GROUP_TYPES } from "../../../../../packages/cop-host/src/lib/socialMetadata.js";

/**
 * Formulaire de création/édition de groupe
 */
export default function GroupForm({ group = null, currentUser }) {
  const navigate = useNavigate();
  const isEditing = !!group;

  const [formData, setFormData] = useState({
    name: group?.name || "",
    description: group?.description || "",
    groupType: group?.metadata?.groupType || GROUP_TYPES.COMMUNITY,
    location: group?.metadata?.location || "",
    avatarUrl: group?.metadata?.avatarUrl || "",
    tags: group?.metadata?.tags?.join(", ") || "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!currentUser) {
      setError("Vous devez être connecté");
      return;
    }

    if (!formData.name.trim()) {
      setError("Le nom est requis");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const tagsArray = formData.tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const metadata = createGroupMetadata(formData.groupType, {
        location: formData.location || null,
        avatarUrl: formData.avatarUrl || null,
        tags: tagsArray,
      });

      if (isEditing) {
        // Update existing group
        const { error: updateError } = await getSupabase()
          .from("groups")
          .update({
            name: formData.name,
            description: formData.description,
            metadata,
          })
          .eq("id", group.id);

        if (updateError) throw updateError;

        navigate(`/groups/${group.id}`);
      } else {
        // Create new group
        const { data: newGroup, error: insertError } = await getSupabase()
          .from("groups")
          .insert({
            name: formData.name,
            description: formData.description,
            created_by: currentUser.id,
            metadata,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Add creator as member
        await getSupabase()
          .from("group_members")
          .insert({
            group_id: newGroup.id,
            user_id: currentUser.id,
            metadata: { schemaVersion: 1 },
          });

        navigate(`/groups/${newGroup.id}`);
      }
    } catch (err) {
      console.error("Error saving group:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">
        {isEditing ? "Modifier le groupe" : "Créer un groupe"}
      </h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 mb-4">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="   shadow-sm p-6 space-y-6">
        {/* Nom */}
        <div>
          <label className="block text-sm font-medium text-gray-200 mb-2">Nom du groupe *</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Ex: Quartier Saint-Joseph, Association Culturelle..."
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-200 mb-2">Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Décrivez votre groupe..."
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-gray-200 mb-2">Type de groupe</label>
          <select
            name="groupType"
            value={formData.groupType}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value={GROUP_TYPES.COMMUNITY}>Communauté générale</option>
            <option value={GROUP_TYPES.NEIGHBORHOOD}>Quartier</option>
            <option value={GROUP_TYPES.ASSOCIATION}>Association</option>
            <option value={GROUP_TYPES.FORUM}>Forum de discussion</option>
            <option value={GROUP_TYPES.GAZETTE}>Gazette (groupe d'éditeurs)</option>
          </select>
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-200 mb-2">Localisation</label>
          <input
            type="text"
            name="location"
            value={formData.location}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Ex: Centre-ville, Quartier Porette..."
          />
        </div>

        {/* Avatar URL */}
        <div>
          <label className="block text-sm font-medium text-gray-200 mb-2">
            URL de l'avatar (optionnel)
          </label>
          <input
            type="url"
            name="avatarUrl"
            value={formData.avatarUrl}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="https://..."
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-200 mb-2">
            Tags (séparés par des virgules)
          </label>
          <input
            type="text"
            name="tags"
            value={formData.tags}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="culture, sport, environnement..."
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2 bg-primary-600 text-bauhaus-white hover:bg-primary-700 disabled:bg-gray-400"
          >
            {loading ? "Enregistrement..." : isEditing ? "Mettre à jour" : "Créer le groupe"}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-gray-200 text-gray-800  hover:bg-gray-400"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}
