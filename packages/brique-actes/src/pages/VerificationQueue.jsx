// src/pages/actes/VerificationQueue.jsx
// ============================================================================
// File d'attente de vérification des preuves
// Modération humaine des documents téléversés
// ============================================================================

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSupabase, useCurrentUser } from "@inseme/cop-host";

// ============================================================================
// CONSTANTS
// ============================================================================

const PROOF_TYPES = {
  SCREENSHOT: { label: "Capture d'écran", emoji: "🖼️" },
  PDF: { label: "Document PDF", emoji: "📄" },
  EMAIL: { label: "Email", emoji: "📧" },
  AR: { label: "Accusé de réception", emoji: "📬" },
  PHOTO: { label: "Photo", emoji: "📷" },
  VIDEO: { label: "Vidéo", emoji: "🎥" },
  AUTRE: { label: "Autre", emoji: "📎" },
};

const STATUS_BADGES = {
  PENDING: { label: "En attente", class: "bg-yellow-100 text-yellow-800" },
  IN_PROGRESS: { label: "En cours", class: "bg-blue-100 text-blue-800" },
  VERIFIED: { label: "Vérifiée", class: "bg-green-100 text-green-800" },
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

const ProofCard = ({ item, onVerify, onReject, onAssign }) => {
  const [showPreview, setShowPreview] = useState(false);
  const typeInfo = PROOF_TYPES[item.proof_type] || PROOF_TYPES.AUTRE;

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Preview thumbnail */}
          <div
            className="w-24 h-24 bg-slate-100 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-200 transition-colors"
            onClick={() => setShowPreview(true)}
          >
            {item.url_fichier ? (
              item.proof_type === "SCREENSHOT" ||
              item.proof_type === "PHOTO" ? (
                <img
                  src={item.url_fichier}
                  alt="Aperçu"
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <span className="text-4xl">{typeInfo.emoji}</span>
              )
            ) : (
              <span className="text-4xl">{typeInfo.emoji}</span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{typeInfo.emoji}</span>
              <span className="font-medium text-slate-800">
                {item.proof_label || typeInfo.label}
              </span>
              <StatusBadge status={item.status} />
            </div>

            {item.date_constat && (
              <div className="text-sm text-slate-500 mb-1">
                📅 Constaté le:{" "}
                {new Date(item.date_constat).toLocaleDateString("fr-FR")}
              </div>
            )}

            {item.uploader_email && (
              <div className="text-sm text-slate-500 mb-1">
                👤 Téléversé par: {item.uploader_email}
              </div>
            )}

            {item.acte_id && (
              <Link
                to={`/actes/${item.acte_id}`}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                📋 Voir l'acte lié
              </Link>
            )}

            {item.demande_admin_id && (
              <Link
                to={`/demandes/${item.demande_admin_id}`}
                className="text-sm text-blue-600 hover:text-blue-800 ml-3"
              >
                📬 Voir la demande liée
              </Link>
            )}
          </div>

          {/* Priority */}
          <div className="text-center">
            <div className="text-xs text-slate-500">Priorité</div>
            <div
              className={`text-lg font-bold ${item.priority <= 2 ? "text-red-600" : item.priority <= 4 ? "text-orange-500" : "text-slate-600"}`}
            >
              {item.priority}/5
            </div>
          </div>
        </div>

        {/* Actions */}
        {item.status === "PENDING" && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => onAssign(item)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              🔄 M'assigner cette vérification
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => onReject(item)}
                className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded"
              >
                ❌ Rejeter
              </button>
              <button
                onClick={() => onVerify(item)}
                className="px-3 py-1.5 text-sm font-medium bg-green-600 text-white hover:bg-green-700 rounded"
              >
                ✅ Valider
              </button>
            </div>
          </div>
        )}

        {item.status === "IN_PROGRESS" && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="text-sm text-blue-600">
              ⏳ En cours de vérification...
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onReject(item)}
                className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded"
              >
                ❌ Rejeter
              </button>
              <button
                onClick={() => onVerify(item)}
                className="px-3 py-1.5 text-sm font-medium bg-green-600 text-white hover:bg-green-700 rounded"
              >
                ✅ Valider
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Preview modal */}
      {showPreview && item.url_fichier && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowPreview(false)}
        >
          <div className="max-w-4xl max-h-full overflow-auto">
            {item.proof_type === "SCREENSHOT" || item.proof_type === "PHOTO" ? (
              <img src={item.url_fichier} alt="Preuve" className="max-w-full" />
            ) : item.proof_type === "PDF" ? (
              <iframe
                src={item.url_fichier}
                className="w-full h-[80vh]"
                title="Document PDF"
              />
            ) : (
              <div className="bg-white rounded-lg p-8 text-center">
                <a
                  href={item.url_fichier}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800"
                >
                  📥 Télécharger le fichier
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MODALS
// ============================================================================

const VerificationModal = ({ item, onClose, onConfirm }) => {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm(item.id, item.proof_id, note);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            ✅ Valider cette preuve
          </h2>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-green-700">
              En validant cette preuve, vous attestez avoir vérifié:
            </p>
            <ul className="text-sm text-green-700 mt-2 list-disc ml-4">
              <li>L'authenticité apparente du document</li>
              <li>La cohérence de la date de constat</li>
              <li>La lisibilité et la pertinence du contenu</li>
            </ul>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Note de vérification (optionnel)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              placeholder="Observations sur la preuve..."
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
            {loading ? "Validation..." : "Confirmer la validation"}
          </button>
        </div>
      </div>
    </div>
  );
};

const RejectionModal = ({ item, onClose, onConfirm }) => {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!reason.trim()) {
      alert("Le motif de rejet est obligatoire");
      return;
    }
    setLoading(true);
    await onConfirm(item.id, reason);
    setLoading(false);
    onClose();
  };

  const commonReasons = [
    "Document illisible",
    "Date de constat incohérente",
    "Contenu non pertinent",
    "Doublon d'une autre preuve",
    "Format non supporté",
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            ❌ Rejeter cette preuve
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
              placeholder="Expliquez pourquoi cette preuve est rejetée..."
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

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function VerificationQueue() {
  const { currentUser: user } = useCurrentUser();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("PENDING");

  const [verifyModal, setVerifyModal] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);

  // Fetch items
  useEffect(() => {
    const fetchItems = async () => {
      if (!getSupabase()) return;

      setLoading(true);

      try {
        const { data, error: fetchError } = await getSupabase()
          .from("v_proofs_to_verify")
          .select("*")
          .order("priority", { ascending: true })
          .order("created_at", { ascending: true });

        if (fetchError) throw fetchError;

        setItems(data || []);
      } catch (err) {
        console.error("[VerificationQueue] Error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [filter]);

  // Assign to self
  const handleAssign = async (item) => {
    if (!user?.id) return;

    try {
      const { error: updateError } = await getSupabase()
        .from("verification_queue")
        .update({
          status: "IN_PROGRESS",
          assigned_to: user.id,
          assigned_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      if (updateError) throw updateError;

      // Refresh
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, status: "IN_PROGRESS", assigned_to: user.id }
            : i
        )
      );
    } catch (err) {
      console.error("[VerificationQueue] Assign error:", err);
      alert("Erreur: " + err.message);
    }
  };

  // Verify proof
  const handleVerify = async (queueId, proofId, note) => {
    if (!user?.id) return;

    try {
      // Update queue
      const { error: queueError } = await getSupabase()
        .from("verification_queue")
        .update({
          status: "VERIFIED",
          verified_by: user.id,
          verified_at: new Date().toISOString(),
          verification_note: note || null,
        })
        .eq("id", queueId);

      if (queueError) throw queueError;

      // Update proof
      const { error: proofError } = await getSupabase()
        .from("proof")
        .update({
          verified_at: new Date().toISOString(),
          verified_by: user.id,
        })
        .eq("id", proofId);

      if (proofError) throw proofError;

      // Refresh
      setItems((prev) => prev.filter((i) => i.id !== queueId));
    } catch (err) {
      console.error("[VerificationQueue] Verify error:", err);
      alert("Erreur: " + err.message);
    }
  };

  // Reject proof
  const handleReject = async (queueId, reason) => {
    if (!user?.id) return;

    try {
      const { error: updateError } = await getSupabase()
        .from("verification_queue")
        .update({
          status: "REJECTED",
          verified_by: user.id,
          verified_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq("id", queueId);

      if (updateError) throw updateError;

      // Refresh
      setItems((prev) => prev.filter((i) => i.id !== queueId));
    } catch (err) {
      console.error("[VerificationQueue] Reject error:", err);
      alert("Erreur: " + err.message);
    }
  };

  // Stats
  const stats = {
    pending: items.filter((i) => i.status === "PENDING").length,
    inProgress: items.filter((i) => i.status === "IN_PROGRESS").length,
  };

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
            <span className="text-slate-700">Vérification des preuves</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            🔍 File de vérification des preuves
          </h1>
          <p className="text-slate-500 mt-1">
            Modération des documents téléversés par les citoyens
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Info banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔍</span>
            <div>
              <h3 className="font-semibold text-blue-800">
                Vérification des preuves
              </h3>
              <p className="text-sm text-blue-700 mt-1">
                Chaque preuve téléversée doit être vérifiée avant d'être
                considérée comme valide. Vérifiez l'authenticité, la date de
                constat et la pertinence du document.
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-lg border border-yellow-200 bg-yellow-50">
            <div className="text-2xl font-bold text-yellow-600">
              {stats.pending}
            </div>
            <div className="text-sm text-slate-500">
              ⏳ En attente de vérification
            </div>
          </div>

          <div className="p-4 rounded-lg border border-blue-200 bg-blue-50">
            <div className="text-2xl font-bold text-blue-600">
              {stats.inProgress}
            </div>
            <div className="text-sm text-slate-500">
              🔄 En cours de traitement
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
            ⚠️ {error}
          </div>
        )}

        {/* Items list */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-500">Chargement...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
            <div className="text-4xl mb-4">✅</div>
            <p className="text-slate-500">
              Aucune preuve en attente de vérification
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <ProofCard
                key={item.id}
                item={item}
                onVerify={() => setVerifyModal(item)}
                onReject={() => setRejectModal(item)}
                onAssign={handleAssign}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {verifyModal && (
        <VerificationModal
          item={verifyModal}
          onClose={() => setVerifyModal(null)}
          onConfirm={handleVerify}
        />
      )}

      {rejectModal && (
        <RejectionModal
          item={rejectModal}
          onClose={() => setRejectModal(null)}
          onConfirm={handleReject}
        />
      )}
    </div>
  );
}
