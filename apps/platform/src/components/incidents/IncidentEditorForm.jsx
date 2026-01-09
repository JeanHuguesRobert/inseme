import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getSupabase } from "../../lib/supabase.js";
import {
  createPostMetadata,
  POST_TYPES,
  appendOrMergeLastModifiedBy,
  getPostIncident,
  getPostTitle,
  getPostSubtitle,
  getPostGroupId,
  getMetadata,
} from "@inseme/cop-host";
import { isAnonymous } from "@inseme/cop-host";
import { getDisplayName } from "@inseme/cop-host";
import { validatePetitionUrl } from "@inseme/brique-kudocracy";
import { PetitionUrlField } from "../common/PetitionLink";

export default function IncidentEditorForm({ post, currentUser }) {
  const navigate = useNavigate();
  const isEditing = !!post;
  const draftStorageKey = useMemo(
    () => (post?.id ? `incident-editor-${post.id}` : "incident-editor-new"),
    [post?.id]
  );

  const [formData, setFormData] = useState({
    title: getPostTitle(post) || "",
    subtitle: getPostSubtitle(post) || "",
    content: post?.content || "",
    postType: POST_TYPES.FORUM,
    groupId: getPostGroupId(post) || "",
    tags: getMetadata(post, "tags")?.join(", ") || "",
    // Incident-specific
    status: getPostIncident(post)?.status || "open",
    severity: getPostIncident(post)?.severity || "medium",
    impact: getPostIncident(post)?.impact || "",
    nextUpdate: getPostIncident(post)?.nextUpdate || "",
    contact: getPostIncident(post)?.contact || "",
    location: getPostIncident(post)?.location || post?.metadata?.location || null,
    // Petition URL
    petitionUrl: getMetadata(post, "petition_url") || "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPetitionField, setShowPetitionField] = useState(!!getMetadata(post, "petition_url"));
  const [petitionWarning, setPetitionWarning] = useState("");

  useEffect(() => {
    if (typeof window === "undefined" || !draftStorageKey) return;
    const savedDraft = window.sessionStorage.getItem(draftStorageKey);
    if (!savedDraft) return;
    try {
      const parsed = JSON.parse(savedDraft);
      if (parsed && typeof parsed === "object") {
        setFormData((prev) => ({ ...prev, ...parsed }));
      }
    } catch (err) {
      console.warn("Erreur chargement brouillon incident:", err);
    } finally {
      window.sessionStorage.removeItem(draftStorageKey);
    }
  }, [draftStorageKey]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }

  function persistFormDraft() {
    if (typeof window === "undefined" || !draftStorageKey) return;
    try {
      window.sessionStorage.setItem(draftStorageKey, JSON.stringify(formData));
    } catch (err) {
      console.warn("Impossible d'enregistrer le brouillon:", err);
    }
  }

  function handleOpenLocationPage() {
    persistFormDraft();
    const params = new URLSearchParams({
      draft: draftStorageKey,
      returnTo: isEditing ? `/incidents/${post.id}/edit` : "/incidents/new",
    });
    navigate(`/posts/location-picker?${params.toString()}`, {
      state: {
        location: formData.location,
        returnTo: isEditing ? `/incidents/${post.id}/edit` : "/incidents/new",
        title: formData.title,
        subtype: "incident",
      },
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!currentUser) {
      setError("Vous devez être connecté");
      return;
    }
    if (isAnonymous(currentUser)) {
      setError("Bloqué. Contactez un administrateur");
      return;
    }
    if (!formData.title.trim() || !formData.content.trim()) {
      setError("Titre et contenu requis");
      return;
    }

    // Validate petition URL if provided
    if (formData.petitionUrl?.trim()) {
      const validation = validatePetitionUrl(formData.petitionUrl);
      if (!validation.valid) {
        setError(validation.error);
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);
      const tagsArray = formData.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const incidentData = {
        status: formData.status || "open",
        severity: formData.severity || "medium",
        impact: formData.impact || "",
        nextUpdate: formData.nextUpdate || null,
        contact: formData.contact || "",
        location: formData.location || null,
      };

      let metadata = createPostMetadata(formData.postType, formData.title, {
        subtype: "incident",
        incident: incidentData,
        groupId: formData.groupId || null,
        tags: tagsArray,
        gazette: formData.gazette || null,
        sourceUrl: formData.sourceUrl || null,
        location: formData.location || null,
        petition_url: formData.petitionUrl?.trim() || null,
      });

      // Stamp lastModifiedBy
      metadata = appendOrMergeLastModifiedBy(metadata, {
        id: currentUser.id,
        displayName: getDisplayName(currentUser),
      });

      if (isEditing) {
        if (!post?.id) throw new Error("Impossible de mettre à jour : 'post.id' manquant");
        const { data: updatedPost, error: updateError } = await getSupabase()
          .from("posts")
          .update({ content: formData.content, metadata })
          .eq("id", post.id)
          .select()
          .single();
        if (updateError) throw updateError;
        navigate(`/incidents/${post.id}`);
      } else {
        const { data: newPost, error: insertError } = await getSupabase()
          .from("posts")
          .insert({ author_id: currentUser.id, content: formData.content, metadata })
          .select()
          .single();
        if (insertError) throw insertError;
        // Auto-subscribe
        await getSupabase()
          .from("content_subscriptions")
          .insert({ user_id: currentUser.id, content_type: "post", content_id: newPost.id });
        navigate(`/incidents/${newPost.id}`);
      }
    } catch (err) {
      console.error("Erreur enregistrement incident:", err);
      setError(err.message || "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">
        {isEditing ? "Modifier l'incident" : "Nouvel incident"}
      </h1>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 mb-4">{error}</div>
      )}
      <form onSubmit={handleSubmit} className="shadow-sm p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-200 mb-2">Titre *</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300"
            placeholder="Titre de l\'incident..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-200 mb-2">Contenu *</label>
          <textarea
            name="content"
            value={formData.content}
            onChange={handleChange}
            required
            rows={8}
            className="w-full px-3 py-2 border border-gray-300 font-mono text-sm"
            placeholder="Description, symptômes, services impactés..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-300 mb-1">Statut</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-3 py-2 text-sm border border-gray-300"
            >
              <option value="open">Ouvert</option>
              <option value="investigating">Investigation</option>
              <option value="monitoring">Surveillance</option>
              <option value="resolved">Résolu</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-300 mb-1">Sévérité</label>
            <select
              name="severity"
              value={formData.severity}
              onChange={handleChange}
              className="w-full px-3 py-2 text-sm border border-gray-300"
            >
              <option value="low">Faible</option>
              <option value="medium">Modérée</option>
              <option value="high">Élevée</option>
              <option value="critical">Critique</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-300 mb-1">Impact</label>
          <textarea
            name="impact"
            value={formData.impact}
            onChange={handleChange}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-300"
            placeholder="Services impactés, zones..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-300 mb-1">Prochaine mise à jour</label>
            <input
              type="datetime-local"
              name="nextUpdate"
              value={formData.nextUpdate}
              onChange={handleChange}
              className="w-full px-3 py-2 text-sm border border-gray-300"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-300 mb-1">Contact</label>
            <input
              type="text"
              name="contact"
              value={formData.contact}
              onChange={handleChange}
              className="w-full px-3 py-2 text-sm border border-gray-300"
              placeholder="Email, canal chat, téléphone..."
            />
          </div>
        </div>

        <div className="border-t pt-4">
          <h3 className="text-sm font-medium text-gray-200">Localisation</h3>
          <p className="text-xs text-gray-400">
            Placez l'incident avec la carte dédiée pour une position précise.
          </p>
          {formData.location ? (
            <div className="text-xs text-gray-200 bg-gray-900/30 border border-gray-700 rounded p-3 space-y-1">
              <p className="font-semibold text-green-300">Position enregistrée</p>
              <p>
                Latitude : {formData.location.lat.toFixed(5)} · Longitude :{" "}
                {formData.location.lng.toFixed(5)}
              </p>
              {formData.location.address && <p>Adresse : {formData.location.address}</p>}
              {formData.location.source && <p>Source : {formData.location.source}</p>}
            </div>
          ) : (
            <p className="text-xs text-gray-300">Aucune localisation sélectionnée.</p>
          )}
          <div className="flex gap-3 mt-2">
            <button
              type="button"
              onClick={handleOpenLocationPage}
              className="px-3 py-2 text-sm bg-gray-900 text-white"
            >
              {formData.location ? "Modifier sur la carte" : "Choisir sur la carte"}
            </button>
            {formData.location && (
              <button
                type="button"
                onClick={() => setFormData((p) => ({ ...p, location: null }))}
                className="text-xs text-red-500 underline"
              >
                Effacer la localisation
              </button>
            )}
          </div>
        </div>

        {/* Petition URL Section */}
        <div className="border-t pt-4">
          <PetitionUrlField
            value={formData.petitionUrl}
            onChange={(value, warning) => {
              setFormData((p) => ({ ...p, petitionUrl: value }));
              setPetitionWarning(warning);
            }}
            show={showPetitionField}
            onToggle={setShowPetitionField}
            warning={petitionWarning}
            inputClassName="w-full px-3 py-2 text-sm border border-gray-300"
            labelClassName="block text-sm font-medium text-gray-200"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2 bg-orange-600 text-bauhaus-white hover:bg-orange-700 disabled:bg-gray-400 font-semibold"
          >
            {loading ? "Enregistrement..." : isEditing ? "Mettre à jour" : "Déclarer"}
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
