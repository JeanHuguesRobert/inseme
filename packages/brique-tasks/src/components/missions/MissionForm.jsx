import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getSupabase,
  getDisplayName,
  createGroupMetadata,
  appendOrMergeLastModifiedBy,
} from "@inseme/cop-host";

/**
 * Formulaire de création/édition de mission (basé sur les groupes)
 */
export default function MissionForm({ mission = null, currentUser }) {
  const navigate = useNavigate();
  const isEditing = !!mission;

  const [formData, setFormData] = useState({
    title: mission?.name || "",
    description: mission?.description || "",
    location: mission?.metadata?.mission_details?.location || "",
    startDate: mission?.metadata?.mission_details?.start_date || "",
    endDate: mission?.metadata?.mission_details?.end_date || "",
    maxVolunteers: mission?.metadata?.mission_details?.max_volunteers || "",
    tags: mission?.metadata?.tags?.join(", ") || "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!currentUser) {
      setError("Vous devez être connecté");
      return;
    }

    if (!formData.title.trim()) {
      setError("Le titre est requis");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const tagsArray = formData.tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const missionDetails = {
        location: formData.location,
        start_date: formData.startDate,
        end_date: formData.endDate,
        max_volunteers: formData.maxVolunteers ? parseInt(formData.maxVolunteers) : null,
        status: "open", // Default status
      };

      let metadata = createGroupMetadata("mission", {
        location: formData.location,
        tags: tagsArray,
        mission_details: missionDetails,
      });

      // Stamp lastModifiedBy for audit trail
      metadata = appendOrMergeLastModifiedBy(metadata, {
        id: currentUser.id,
        displayName: getDisplayName(currentUser),
      });

      if (isEditing) {
        // Update existing mission (group)
        const { error: updateError } = await getSupabase()
          .from("groups")
          .update({
            name: formData.title,
            description: formData.description,
            metadata,
          })
          .eq("id", mission.id);

        if (updateError) throw updateError;

        navigate(`/missions/${mission.id}`);
      } else {
        // Create new mission (group)
        const { data: newMission, error: insertError } = await getSupabase()
          .from("groups")
          .insert({
            name: formData.title,
            description: formData.description,
            created_by: currentUser.id,
            metadata,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Add creator as organizer (member)
        await getSupabase()
          .from("group_members")
          .insert({
            group_id: newMission.id,
            user_id: currentUser.id,
            metadata: {
              role: "organizer",
              status: "confirmed",
              schemaVersion: 1,
            },
          });

        navigate(`/missions/${newMission.id}`);
      }
    } catch (err) {
      console.error("Error saving mission:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">
        {isEditing ? "Modifier la mission" : "Créer une mission"}
      </h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 mb-4">{error}</div>
      )}

      <form
        onSubmit={handleSubmit}
        className="shadow-sm p-6 space-y-6 bg-white border border-gray-200"
      >
        {/* Titre */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Titre de la mission *
          </label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Ex: Nettoyage de la plage, Aide aux devoirs..."
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Décrivez la mission en détail..."
          />
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Lieu</label>
          <input
            type="text"
            name="location"
            value={formData.location}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Adresse ou lieu de rendez-vous"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date de début</label>
            <input
              type="datetime-local"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date de fin</label>
            <input
              type="datetime-local"
              name="endDate"
              value={formData.endDate}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Max Volunteers */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nombre maximum de bénévoles
          </label>
          <input
            type="number"
            name="maxVolunteers"
            value={formData.maxVolunteers}
            onChange={handleChange}
            min="1"
            className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Laisser vide si illimité"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tags (séparés par des virgules)
          </label>
          <input
            type="text"
            name="tags"
            value={formData.tags}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="environnement, social, éducation..."
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2 bg-primary-600 text-white hover:bg-primary-700 disabled:bg-gray-400 font-bold"
          >
            {loading ? "Enregistrement..." : isEditing ? "Mettre à jour" : "Créer la mission"}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-gray-200 text-gray-800 hover:bg-gray-300"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}
