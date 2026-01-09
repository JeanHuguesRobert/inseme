// src/pages/actes/PublicationModeration.jsx
// ============================================================================
// Modération des publications citoyennes
// Contrôle qualité avant publication publique
// ============================================================================

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSupabase, useCurrentUser } from "@inseme/cop-host";

// ============================================================================
// CONSTANTS
// ============================================================================

const PUBLICATION_TYPES = {
  ANALYSE: { label: "Analyse", emoji: "📊", color: "blue" },
  COMMENTAIRE: { label: "Commentaire", emoji: "💬", color: "slate" },
  SIGNALEMENT: { label: "Signalement", emoji: "⚠️", color: "orange" },
  SYNTHESE: { label: "Synthèse", emoji: "📋", color: "purple" },
  QUESTION: { label: "Question", emoji: "❓", color: "cyan" },
};

const STATUS_BADGES = {
  DRAFT: { label: "Brouillon", class: "bg-slate-100 text-slate-600" },
  PENDING_REVIEW: {
    label: "En modération",
    class: "bg-yellow-100 text-yellow-800",
  },
  APPROVED: { label: "Approuvée", class: "bg-green-100 text-green-800" },
  PUBLISHED: { label: "Publiée", class: "bg-blue-100 text-blue-800" },
  REJECTED: { label: "Rejetée", class: "bg-red-100 text-red-800" },
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const StatusBadge = ({ status }) => {
  const badge = STATUS_BADGES[status] || {
    label: status,
    class: "bg-slate-100",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${badge.class}`}
    >
      {badge.label}
    </span>
  );
};

const TypeBadge = ({ type }) => {
  const info = PUBLICATION_TYPES[type] || PUBLICATION_TYPES.COMMENTAIRE;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-${info.color}-100 text-${info.color}-700`}
    >
      <span>{info.emoji}</span>
      <span>{info.label}</span>
    </span>
  );
};

const PublicationCard = ({ publication, onApprove, onReject, onEdit }) => {
  const [expanded, setExpanded] = useState(false);
  const typeInfo =
    PUBLICATION_TYPES[publication.publication_type] ||
    PUBLICATION_TYPES.COMMENTAIRE;

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <TypeBadge type={publication.publication_type} />
              <StatusBadge status={publication.status} />
            </div>

            {/* Title */}
            <h3 className="text-lg font-medium text-slate-800 mb-1">
              {publication.title}
            </h3>

            {/* Author */}
            <div className="text-sm text-slate-500 mb-2">
              👤 {publication.author_name || "Anonyme"} • 📅{" "}
              {new Date(publication.created_at).toLocaleDateString("fr-FR")}
            </div>

            {/* Linked items */}
            <div className="flex flex-wrap gap-2 mb-3">
              {publication.acte_id && (
                <Link
                  to={`/actes/${publication.acte_id}`}
                  className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100"
                >
                  📋 Acte lié
                </Link>
              )}
              {publication.demande_admin_id && (
                <Link
                  to={`/demandes/${publication.demande_admin_id}`}
                  className="text-xs px-2 py-1 rounded bg-purple-50 text-purple-600 hover:bg-purple-100"
                >
                  📬 Demande liée
                </Link>
              )}
            </div>
          </div>

          {/* Expand button */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            {expanded ? "▲" : "▼"}
          </button>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            {/* Content preview */}
            <div className="bg-slate-50 rounded-lg p-4 mb-4">
              <div className="text-sm text-slate-600 whitespace-pre-wrap">
                {publication.content}
              </div>
            </div>

            {/* Summary if exists */}
            {publication.summary && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-slate-700 mb-1">
                  Résumé:
                </h4>
                <p className="text-sm text-slate-600">{publication.summary}</p>
              </div>
            )}

            {/* Sources */}
            {publication.sources && publication.sources.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-slate-700 mb-1">
                  Sources citées:
                </h4>
                <ul className="text-sm text-slate-600 list-disc ml-4">
                  {publication.sources.map((source, idx) => (
                    <li key={idx}>{source}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {publication.status === "PENDING_REVIEW" && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => onEdit(publication)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              ✏️ Demander modifications
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => onReject(publication)}
                className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded"
              >
                ❌ Rejeter
              </button>
              <button
                onClick={() => onApprove(publication)}
                className="px-3 py-1.5 text-sm font-medium bg-green-600 text-white hover:bg-green-700 rounded"
              >
                ✅ Approuver
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// MODALS
// ============================================================================

const ApprovalModal = ({ publication, onClose, onConfirm }) => {
  const [note, setNote] = useState("");
  const [publishImmediately, setPublishImmediately] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm(publication.id, note, publishImmediately);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            ✅ Approuver cette publication
          </h2>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-green-700">
              En approuvant cette publication, vous attestez avoir vérifié:
            </p>
            <ul className="text-sm text-green-700 mt-2 list-disc ml-4">
              <li>La véracité des informations présentées</li>
              <li>Le respect des règles de modération</li>
              <li>L'absence de contenu diffamatoire</li>
            </ul>
          </div>

          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={publishImmediately}
                onChange={(e) => setPublishImmediately(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-slate-700">
                Publier immédiatement (sinon: statut "Approuvée")
              </span>
            </label>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Note de modération (optionnel)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              placeholder="Observations..."
            />
          </div>
        </div>

        <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm bg-green-600 text-white hover:bg-green-700 rounded-lg disabled:opacity-50"
          >
            {loading
              ? "Approbation..."
              : publishImmediately
                ? "Approuver et Publier"
                : "Approuver"}
          </button>
        </div>
      </div>
    </div>
  );
};

const RejectionModal = ({ publication, onClose, onConfirm }) => {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!reason.trim()) {
      alert("Le motif de rejet est obligatoire");
      return;
    }
    setLoading(true);
    await onConfirm(publication.id, reason);
    setLoading(false);
    onClose();
  };

  const commonReasons = [
    "Informations non vérifiables",
    "Contenu hors sujet",
    "Ton inapproprié",
    "Doublon",
    "Sources manquantes",
    "Contenu potentiellement diffamatoire",
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            ❌ Rejeter cette publication
          </h2>

          <div className="mb-4">
            <div className="text-sm text-slate-500 mb-2">Motifs fréquents:</div>
            <div className="flex flex-wrap gap-2">
              {commonReasons.map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`text-xs px-2 py-1 rounded border ${
                    reason === r
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Motif du rejet <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              placeholder="Expliquez pourquoi cette publication est rejetée..."
              required
            />
          </div>
        </div>

        <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !reason.trim()}
            className="px-4 py-2 text-sm bg-red-600 text-white hover:bg-red-700 rounded-lg disabled:opacity-50"
          >
            {loading ? "Rejet..." : "Confirmer le rejet"}
          </button>
        </div>
      </div>
    </div>
  );
};

const EditRequestModal = ({ publication, onClose, onConfirm }) => {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!message.trim()) {
      alert("Le message est obligatoire");
      return;
    }
    setLoading(true);
    await onConfirm(publication.id, message);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            ✏️ Demander des modifications
          </h2>

          <p className="text-sm text-slate-600 mb-4">
            L'auteur recevra une notification avec vos commentaires et pourra
            modifier sa publication.
          </p>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Modifications demandées <span className="text-red-500">*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              placeholder="Décrivez les modifications souhaitées..."
              required
            />
          </div>
        </div>

        <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !message.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg disabled:opacity-50"
          >
            {loading ? "Envoi..." : "Envoyer la demande"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PublicationModeration() {
  const { currentUser: user } = useCurrentUser();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [publications, setPublications] = useState([]);
  const [filterType, setFilterType] = useState("");

  const [approveModal, setApproveModal] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [editModal, setEditModal] = useState(null);

  // Fetch publications
  useEffect(() => {
    const fetchPublications = async () => {
      if (!getSupabase()) return;

      setLoading(true);

      try {
        let query = getSupabase()
          .from("v_publications_pending")
          .select("*")
          .order("created_at", { ascending: true });

        if (filterType) {
          query = query.eq("publication_type", filterType);
        }

        const { data, error: fetchError } = await query;

        if (fetchError) throw fetchError;

        setPublications(data || []);
      } catch (err) {
        console.error("[PublicationModeration] Error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPublications();
  }, [filterType]);

  // Approve publication
  const handleApprove = async (id, note, publishImmediately) => {
    if (!user?.id) return;

    try {
      const newStatus = publishImmediately ? "PUBLISHED" : "APPROVED";

      const { error: updateError } = await getSupabase()
        .from("publication_citoyenne")
        .update({
          status: newStatus,
          moderated_by: user.id,
          moderated_at: new Date().toISOString(),
          moderation_note: note || null,
          published_at: publishImmediately ? new Date().toISOString() : null,
        })
        .eq("id", id);

      if (updateError) throw updateError;

      // Log responsibility
      await getSupabase().rpc("log_responsibility", {
        p_user_id: user.id,
        p_responsibility_type: "VALIDATION",
        p_entity_type: "publication_citoyenne",
        p_entity_id: id,
        p_summary: `Publication ${publishImmediately ? "publiée" : "approuvée"}`,
        p_metadata: { note },
      });

      // Refresh
      setPublications((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("[PublicationModeration] Approve error:", err);
      alert("Erreur: " + err.message);
    }
  };

  // Reject publication
  const handleReject = async (id, reason) => {
    if (!user?.id) return;

    try {
      const { error: updateError } = await getSupabase()
        .from("publication_citoyenne")
        .update({
          status: "REJECTED",
          moderated_by: user.id,
          moderated_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq("id", id);

      if (updateError) throw updateError;

      // Log responsibility
      await getSupabase().rpc("log_responsibility", {
        p_user_id: user.id,
        p_responsibility_type: "VALIDATION",
        p_entity_type: "publication_citoyenne",
        p_entity_id: id,
        p_summary: "Publication rejetée",
        p_metadata: { reason },
      });

      // Refresh
      setPublications((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("[PublicationModeration] Reject error:", err);
      alert("Erreur: " + err.message);
    }
  };

  // Request edits
  const handleEditRequest = async (id, message) => {
    if (!user?.id) return;

    try {
      const { error: updateError } = await getSupabase()
        .from("publication_citoyenne")
        .update({
          status: "DRAFT",
          edit_request: message,
          edit_requested_by: user.id,
          edit_requested_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) throw updateError;

      // Refresh
      setPublications((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("[PublicationModeration] Edit request error:", err);
      alert("Erreur: " + err.message);
    }
  };

  // Stats by type
  const statsByType = Object.keys(PUBLICATION_TYPES).reduce((acc, type) => {
    acc[type] = publications.filter((p) => p.publication_type === type).length;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link to="/actes" className="hover:text-blue-600">
              Tableau de bord
            </Link>
            <span>/</span>
            <span className="text-slate-700">Modération des publications</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            📢 Modération des publications citoyennes
          </h1>
          <p className="text-slate-500 mt-1">
            Contrôle qualité avant publication sur la plateforme
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Guidelines */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📢</span>
            <div>
              <h3 className="font-semibold text-purple-800">
                Règles de modération
              </h3>
              <ul className="text-sm text-purple-700 mt-1 list-disc ml-4">
                <li>
                  Vérifier que les faits avancés sont sourcés ou vérifiables
                </li>
                <li>S'assurer que le ton reste respectueux et constructif</li>
                <li>
                  Refuser tout contenu diffamatoire ou atteinte à la vie privée
                </li>
                <li>
                  Privilégier les publications qui apportent une vraie valeur
                  ajoutée
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Filter by type */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
          <h3 className="text-sm font-medium text-slate-700 mb-3">
            Filtrer par type
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterType("")}
              className={`px-3 py-1.5 rounded text-sm ${
                !filterType
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Tous ({publications.length})
            </button>
            {Object.entries(PUBLICATION_TYPES).map(([type, info]) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded text-sm flex items-center gap-1 ${
                  filterType === type
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <span>{info.emoji}</span>
                <span>{info.label}</span>
                <span className="text-xs opacity-70">
                  ({statsByType[type]})
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
            ⚠️ {error}
          </div>
        )}

        {/* Publications list */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-500">Chargement...</p>
          </div>
        ) : publications.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
            <div className="text-4xl mb-4">✅</div>
            <p className="text-slate-500">
              {filterType
                ? `Aucune publication de type "${PUBLICATION_TYPES[filterType]?.label}" en attente`
                : "Aucune publication en attente de modération"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {publications.map((publication) => (
              <PublicationCard
                key={publication.id}
                publication={publication}
                onApprove={() => setApproveModal(publication)}
                onReject={() => setRejectModal(publication)}
                onEdit={() => setEditModal(publication)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {approveModal && (
        <ApprovalModal
          publication={approveModal}
          onClose={() => setApproveModal(null)}
          onConfirm={handleApprove}
        />
      )}

      {rejectModal && (
        <RejectionModal
          publication={rejectModal}
          onClose={() => setRejectModal(null)}
          onConfirm={handleReject}
        />
      )}

      {editModal && (
        <EditRequestModal
          publication={editModal}
          onClose={() => setEditModal(null)}
          onConfirm={handleEditRequest}
        />
      )}
    </div>
  );
}
