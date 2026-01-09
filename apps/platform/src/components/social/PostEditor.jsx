import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getSupabase } from "../../lib/supabase.js";
import {
  createPostMetadata,
  POST_TYPES,
  LINKED_TYPES,
  getPostTitle,
  getPostSubtitle,
  getPostType,
  getPostSubtype,
  getPostIncident,
  appendOrMergeLastModifiedBy,
  getMetadata,
} from "@inseme/cop-host";
import { isAnonymous } from "@inseme/cop-host";
import {
  getPostGroupId,
  getPostEvent,
  getPostGazette,
  getPostSourceUrl,
  isPinnedPost,
  isLockedPost,
} from "../../lib/postPredicates.js";
import { getConfig } from "../../common/config/instanceConfig.client.js";

/**
 * Éditeur de post (nouveau ou édition)
 */
export default function PostEditor({ post = null, currentUser }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEditing = !!post;
  const draftStorageKey = useMemo(
    () => (post?.id ? `post-editor-${post.id}` : "post-editor-new"),
    [post?.id]
  );
  const editorReturnPath = isEditing && post?.id ? `/posts/${post.id}/edit` : "/posts/new";

  // Récupérer groupId depuis URL si création depuis un groupe
  const groupIdFromUrl = searchParams.get("groupId");
  const linkedTypeFromUrl = searchParams.get("linkedType");
  const linkedIdFromUrl = searchParams.get("linkedId");
  const gazetteFromUrl = searchParams.get("gazette");

  const [formData, setFormData] = useState({
    title: getPostTitle(post) || "",
    subtitle: getPostSubtitle(post) || "",
    content: post?.content || "",
    subtype: getPostSubtype(post) || "",
    eventDate: getPostEvent(post)?.date || "",
    eventLocation: getPostEvent(post)?.location || "",
    eventDuration: getPostEvent(post)?.duration || "",
    incidentStatus: getPostIncident(post)?.status || "open",
    incidentSeverity: getPostIncident(post)?.severity || "medium",
    incidentImpact: getPostIncident(post)?.impact || "",
    incidentNextUpdate: getPostIncident(post)?.nextUpdate || "",
    incidentContact: getPostIncident(post)?.contact || "",
    postType: getPostType(post) || POST_TYPES.FORUM,
    groupId: getPostGroupId(post) || groupIdFromUrl || "",
    linkedType: getMetadata(post, "linkedType") || linkedTypeFromUrl || "",
    linkedId: getMetadata(post, "linkedId") || linkedIdFromUrl || "",
    tags: getMetadata(post, "tags")?.join(", ") || "",
    gazette: getPostGazette(post) || gazetteFromUrl || "",
    sourceUrl: getPostSourceUrl(post) || "",
    isPinned: isPinnedPost(post) || false,
    isLocked: isLockedPost(post) || false,
    location: getMetadata(post, "location") || null,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isEditor, setIsEditor] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !draftStorageKey) return;
    const savedDraft = window.sessionStorage.getItem(draftStorageKey);
    if (!savedDraft) return;
    try {
      const parsed = JSON.parse(savedDraft);
      if (parsed && typeof parsed === "object") {
        setFormData((prev) => ({
          ...prev,
          ...parsed,
        }));
      }
    } catch (err) {
      console.warn("Erreur chargement brouillon localisation:", err);
    } finally {
      window.sessionStorage.removeItem(draftStorageKey);
    }
  }, [draftStorageKey]);

  useEffect(() => {
    let mounted = true;
    async function check() {
      if (!currentUser) return setIsEditor(false);
      const gaz = formData.gazette || gazetteFromUrl;
      if (!gaz) return setIsEditor(false);
      const res = await checkEditorForGazette(gaz, currentUser.id);
      if (mounted) setIsEditor(res);
    }
    check();
    return () => (mounted = false);
  }, [currentUser, formData.gazette, gazetteFromUrl]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function persistFormDraft() {
    if (typeof window === "undefined" || !draftStorageKey) return;
    try {
      window.sessionStorage.setItem(draftStorageKey, JSON.stringify(formData));
    } catch (err) {
      console.warn("Impossible d'enregistrer le brouillon du post:", err);
    }
  }

  function handleOpenLocationPage() {
    persistFormDraft();
    const params = new URLSearchParams({
      draft: draftStorageKey,
      returnTo: editorReturnPath,
    });
    navigate(`/posts/location-picker?${params.toString()}`, {
      state: {
        location: formData.location,
        returnTo: editorReturnPath,
        title: formData.title,
        subtype: formData.subtype,
      },
    });
  }

  function handleUseMyLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setFormData((prev) => ({
        ...prev,
        location: {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          source: "gps",
        },
      }));
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
      setError("Le titre et le contenu sont requis");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const tagsArray = formData.tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      // Construct event object if subtype is 'event'
      const eventData =
        formData.subtype === "event"
          ? {
              date: formData.eventDate || null,
              location: formData.eventLocation || null,
              duration: formData.eventDuration || null,
            }
          : null;

      const incidentData =
        formData.subtype === "incident"
          ? {
              status: formData.incidentStatus || "open",
              severity: formData.incidentSeverity || "medium",
              impact: formData.incidentImpact || "",
              nextUpdate: formData.incidentNextUpdate || null,
              contact: formData.incidentContact || "",
            }
          : null;

      let metadata = createPostMetadata(formData.postType, formData.title, {
        subtitle: formData.subtitle || null,
        subtype: formData.subtype || null,
        event: eventData,
        incident: incidentData,
        groupId: formData.groupId || null,
        linkedType: formData.linkedType || null,
        linkedId: formData.linkedId || null,
        isPinned: formData.isPinned,
        isLocked: formData.isLocked,
        tags: tagsArray,
        gazette: formData.gazette || null,
        sourceUrl: formData.sourceUrl || null,
        location: formData.location || null,
      });

      // Stamp lastModifiedBy (append/merge) for audit trail
      metadata = appendOrMergeLastModifiedBy(metadata, {
        id: currentUser.id,
        displayName: currentUser.display_name || currentUser.displayName || null,
      });

      if (isEditing) {
        // Update existing post
        // Check what is sourceUrl, did it change, if so log it
        if (getPostSourceUrl(post) !== formData.sourceUrl) {
          console.log(
            `Post ${post.id} sourceUrl changed from ${getPostSourceUrl(post)} to ${formData.sourceUrl}`
          );
          // Check that metadata.sourceUrl is what formData.sourceUrl is
          if (metadata.sourceUrl !== formData.sourceUrl) {
            console.error("Metadata sourceUrl does not match formData sourceUrl");
          }
        }
        if (!post?.id) {
          throw new Error("Impossible de mettre à jour : 'post.id' manquant");
        }

        const { data: updatedPost, error: updateError } = await getSupabase()
          .from("posts")
          .update({
            content: formData.content,
            metadata,
          })
          .eq("id", post.id)
          .select()
          .single();

        if (updateError) {
          console.error("Supabase update error:", updateError);
          throw updateError;
        }

        if (!updatedPost) {
          throw new Error("Mise à jour échouée : aucun enregistrement retourné");
        }

        navigate(`/posts/${post.id}`);
      } else {
        // Create new post
        const { data: newPost, error: insertError } = await getSupabase()
          .from("posts")
          .insert({
            author_id: currentUser.id,
            content: formData.content,
            metadata,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Auto-subscribe to created post
        await getSupabase().from("content_subscriptions").insert({
          user_id: currentUser.id,
          content_type: "post",
          content_id: newPost.id,
        });

        // Recompute editor status in case it wasn't available at mount
        let finalIsEditor = isEditor;
        try {
          finalIsEditor =
            finalIsEditor || (await checkEditorForGazette(formData.gazette, currentUser?.id));
        } catch (err) {
          // ignore, default to false
        }

        // Prefer editor redirect if it's a gazette and creator is an editor
        if (formData.gazette && finalIsEditor) {
          navigate(`/posts/${newPost.id}/edit`);
        } else if (formData.groupId) {
          // Otherwise, redirect to the group if it was a group post
          navigate(`/groups/${formData.groupId}`);
        } else {
          navigate(`/posts/${newPost.id}`);
        }
      }
    } catch (err) {
      console.error("Error saving post:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">
        {isEditing ? "Modifier l'article" : "Nouvel article"}
      </h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 mb-4">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="   shadow-sm p-6 space-y-6">
        {/* Type de post */}
        <div>
          <label className="block text-sm font-medium text-gray-200 mb-2">
            Type de publication
          </label>
          <select
            name="postType"
            value={formData.postType}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value={POST_TYPES.FORUM}>Discussion (Forum)</option>
            <option value={POST_TYPES.BLOG}>Article (Blog)</option>
            <option value={POST_TYPES.ANNOUNCEMENT}>Annonce</option>
          </select>
        </div>

        {/* Titre */}
        <div>
          <label className="block text-sm font-medium text-gray-200 mb-2">Titre *</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Titre de votre publication..."
          />
        </div>

        {/* Sous-titre (optionnel) */}
        <div>
          <label className="block text-sm font-medium text-gray-200 mb-2">
            Sous-titre (optionnel)
          </label>
          <input
            type="text"
            name="subtitle"
            value={formData.subtitle}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Court sous-titre qui complète le titre"
          />
        </div>

        {/* Contenu */}
        <div>
          <label className="block text-sm font-medium text-gray-200 mb-2">Contenu *</label>
          <textarea
            name="content"
            value={formData.content}
            onChange={handleChange}
            required
            rows={12}
            className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
            placeholder="Écrivez votre message... (Markdown supporté)"
          />
          <p className="text-xs text-gray-400 mt-1">
            Vous pouvez utiliser Markdown pour formater votre texte
          </p>
        </div>

        {/* Subtype (event) */}
        <div>
          <label className="block text-sm font-medium text-gray-200 mb-2">
            Type spécial (optionnel)
          </label>
          <div className="flex items-center gap-3">
            <select
              name="subtype"
              value={formData.subtype}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 "
            >
              <option value="">Aucun</option>
              <option value="event">Événement</option>
              <option value="incident">Incident</option>
            </select>
            <button
              type="button"
              onClick={() => {
                const params = formData.groupId
                  ? `groupId=${encodeURIComponent(formData.groupId)}`
                  : "";
                const path = isEditing
                  ? `/incidents/${post.id}/edit`
                  : `/incidents/new${params ? `?${params}` : ""}`;
                navigate(path);
              }}
              className="text-sm underline text-primary-600"
            >
              Basculer vers l'éditeur incidents
            </button>
          </div>
        </div>

        {/* Event fields shown when subtype=event */}
        {formData.subtype === "event" && (
          <div className="border-t pt-4 space-y-3">
            <h3 className="text-sm font-medium text-gray-200">Détails de l'événement</h3>
            <div>
              <label className="block text-xs text-gray-300 mb-1">Date et heure</label>
              <input
                type="datetime-local"
                name="eventDate"
                value={formData.eventDate}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-gray-300 "
              />
            </div>
            <div>
              <label className="block text-xs text-gray-300 mb-1">Lieu</label>
              <input
                type="text"
                name="eventLocation"
                value={formData.eventLocation}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-gray-300 "
                placeholder="Adresse, ville, lien de réunion..."
              />
            </div>
            <div>
              <label className="block text-xs text-gray-300 mb-1">Durée (optionnel)</label>
              <input
                type="text"
                name="eventDuration"
                value={formData.eventDuration}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-gray-300 "
                placeholder="ex: 2h, 90 minutes, 2025-12-01T10:00/2025-12-01T12:00"
              />
            </div>
          </div>
        )}

        {/* Incident fields shown when subtype=incident */}
        {formData.subtype === "incident" && (
          <div className="border-t pt-4 space-y-3">
            <h3 className="text-sm font-medium text-gray-200">Détails de l'incident</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-300 mb-1">Statut</label>
                <select
                  name="incidentStatus"
                  value={formData.incidentStatus}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 "
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
                  name="incidentSeverity"
                  value={formData.incidentSeverity}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 "
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
                name="incidentImpact"
                value={formData.incidentImpact}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-300 "
                placeholder="Services impactés, zones concernées, symptômes..."
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-300 mb-1">Prochaine mise à jour</label>
                <input
                  type="datetime-local"
                  name="incidentNextUpdate"
                  value={formData.incidentNextUpdate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 "
                />
              </div>
              <div>
                <label className="block text-xs text-gray-300 mb-1">Contact</label>
                <input
                  type="text"
                  name="incidentContact"
                  value={formData.incidentContact}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 "
                  placeholder="Email, canal chat, téléphone..."
                />
              </div>
            </div>
          </div>
        )}

        {/* Location Picker for Events and Incidents */}
        {(formData.subtype === "event" || formData.subtype === "incident") && (
          <div className="border-t pt-4 space-y-3">
            <h3 className="text-sm font-medium text-gray-200">Localisation</h3>
            <p className="text-xs text-gray-400">
              Utilisez la page carte dédiée pour placer précisément l'adresse ou la position GPS de
              votre {formData.subtype === "event" ? "événement" : "incident"}.
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
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleOpenLocationPage}
                className="px-3 py-2 text-sm bg-gray-900 text-white border border-gray-700 hover:bg-gray-800"
              >
                {formData.location ? "Modifier sur la carte" : "Choisir sur la carte"}
              </button>
              <button
                type="button"
                onClick={handleUseMyLocation}
                className="text-xs text-blue-500 underline"
              >
                📍 Me localiser automatiquement
              </button>
              {formData.location && (
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      location: null,
                    }))
                  }
                  className="text-xs text-red-500 underline"
                >
                  Effacer la localisation
                </button>
              )}
            </div>
          </div>
        )}

        {/* Lien vers entité existante (optionnel) */}
        {!groupIdFromUrl && (
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-200 mb-3">
              Lier à une page existante (optionnel)
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-300 mb-1">Type</label>
                <select
                  name="linkedType"
                  value={formData.linkedType}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Aucun lien</option>
                  <option value={LINKED_TYPES.WIKI_PAGE}>Page Wiki</option>
                  <option value={LINKED_TYPES.PROPOSITION}>Proposition</option>
                  <option value={LINKED_TYPES.GROUP}>Groupe</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-300 mb-1">ID de l'entité</label>
                <input
                  type="text"
                  name="linkedId"
                  value={formData.linkedId}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-primary-500"
                  placeholder="UUID..."
                  disabled={!formData.linkedType}
                />
              </div>
            </div>
          </div>
        )}

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
            placeholder="démocratie, participation, environnement..."
          />
        </div>

        {/* Options modérateur */}
        {currentUser && (
          <div className="border-t pt-4 space-y-3">
            <h3 className="text-sm font-medium text-gray-200">Options</h3>

            <label>
              <span className="text-sm text-gray-200">📌 Épingler ce post (en haut de liste)</span>
              <input
                type="checkbox"
                name="isPinned"
                checked={formData.isPinned}
                onChange={handleChange}
                className="w-4 h-4 text-primary-600 focus:ring-2 focus:ring-primary-500"
              />
            </label>

            <label>
              <span className="text-sm text-gray-200">
                🔒 Verrouiller (empêcher nouveaux commentaires)
              </span>
              <input
                type="checkbox"
                name="isLocked"
                checked={formData.isLocked}
                onChange={handleChange}
                className="w-4 h-4 text-primary-600 focus:ring-2 focus:ring-primary-500"
              />
            </label>
          </div>
        )}

        {/* Gazette Option */}
        <div className="border-t pt-4">
          <label className="block text-sm font-medium text-gray-200 mb-2">
            Publication dans une Gazette (optionnel)
          </label>
          <input
            type="text"
            name="gazette"
            value={formData.gazette}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Nom de la gazette, cad nom du groupe des éditeurs"
          />
          <p className="text-xs text-gray-400 mt-1">
            Laissez vide pour une publication standard. Mettez "global" pour la Gazette principale.
          </p>
        </div>

        {/* Source URL (Facebook) */}
        <div className="border-t pt-4">
          <label className="block text-sm font-medium text-gray-200 mb-2">
            Lien source (Facebook, etc.)
          </label>
          <input
            type="url"
            name="sourceUrl"
            value={formData.sourceUrl}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="https://www.facebook.com/..."
          />
          <p className="text-xs text-gray-400 mt-1">
            Si vous mettez un lien Facebook, le post sera intégré directement dans l'article.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2 bg-orange-600 text-bauhaus-white hover:bg-orange-700 disabled:bg-gray-400 font-semibold"
          >
            {loading ? "Enregistrement..." : isEditing ? "Mettre à jour" : "Publier"}
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

// Helper to check if the current user is an editor for a given gazette
async function checkEditorForGazette(gazetteName, userId) {
  if (!gazetteName) return false;
  // Use the same mapping as Gazette.jsx for global
  let targetGroupName = gazetteName;
  if (gazetteName === "global") {
    targetGroupName = getConfig("global_gazette_editor_group", "La Gazette");
  }
  try {
    const { data: group } = await getSupabase()
      .from("groups")
      .select("id")
      .eq("name", targetGroupName)
      .single();
    if (!group) return false;
    // Check membership for current user (must be passed by callers who have currentUser in scope)
    if (!userId) return false;
    const { data: member } = await getSupabase()
      .from("group_members")
      .select("id")
      .eq("group_id", group.id)
      .eq("user_id", userId)
      .single();
    return !!member;
  } catch (err) {
    return false;
  }
}
