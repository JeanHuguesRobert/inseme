// src/pages/actes/OutgoingActionsQueue.jsx
// ============================================================================
// File d'attente des actions sortantes - Validation humaine obligatoire
// Human-in-the-Loop: Aucune action automatique sans validation
// ============================================================================

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSupabase, useCurrentUser } from "@inseme/cop-host";

// ============================================================================
// CONSTANTS
// ============================================================================

const ACTION_TYPES = {
  EMAIL_MAIRIE: {
    label: "Email à la mairie",
    emoji: "🏛️",
    color: "bg-blue-100 text-blue-800",
  },
  EMAIL_PREFECTURE: {
    label: "Email à la préfecture",
    emoji: "🏛️",
    color: "bg-indigo-100 text-indigo-800",
  },
  EMAIL_CADA: {
    label: "Email à la CADA",
    emoji: "⚖️",
    color: "bg-purple-100 text-purple-800",
  },
  COURRIER_LRAR: {
    label: "Courrier LRAR",
    emoji: "📬",
    color: "bg-orange-100 text-orange-800",
  },
  PUBLICATION_WEB: {
    label: "Publication web",
    emoji: "🌐",
    color: "bg-green-100 text-green-800",
  },
  NOTIFICATION_PREFET: {
    label: "Notification préfet",
    emoji: "📋",
    color: "bg-red-100 text-red-800",
  },
  SAISINE_TA: {
    label: "Saisine TA",
    emoji: "⚖️",
    color: "bg-slate-100 text-slate-800",
  },
  AUTRE: { label: "Autre", emoji: "📄", color: "bg-slate-100 text-slate-600" },
};

const STATUS_BADGES = {
  PENDING: {
    label: "En attente",
    emoji: "⏳",
    class: "bg-yellow-100 text-yellow-800",
  },
  APPROVED: {
    label: "Approuvée",
    emoji: "✅",
    class: "bg-green-100 text-green-800",
  },
  SENT: { label: "Envoyée", emoji: "📤", class: "bg-blue-100 text-blue-800" },
  CONFIRMED: {
    label: "Confirmée",
    emoji: "✔️",
    class: "bg-green-100 text-green-800",
  },
  FAILED: { label: "Échec", emoji: "❌", class: "bg-red-100 text-red-800" },
  CANCELLED: {
    label: "Annulée",
    emoji: "🚫",
    class: "bg-slate-100 text-slate-600",
  },
  REJECTED: { label: "Rejetée", emoji: "⛔", class: "bg-red-100 text-red-800" },
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const StatusBadge = ({ status }) => {
  const badge = STATUS_BADGES[status] || {
    label: status,
    emoji: "❓",
    class: "bg-slate-100",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${badge.class}`}
    >
      {badge.emoji} {badge.label}
    </span>
  );
};

const TypeBadge = ({ type }) => {
  const info = ACTION_TYPES[type] || {
    label: type,
    emoji: "📄",
    color: "bg-slate-100",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${info.color}`}
    >
      {info.emoji} {info.label}
    </span>
  );
};

const PriorityIndicator = ({ priority }) => {
  const levels = {
    1: { label: "Urgent", class: "text-red-600", icon: "🔴" },
    2: { label: "Haute", class: "text-orange-600", icon: "🟠" },
    3: { label: "Moyenne", class: "text-yellow-600", icon: "🟡" },
    4: { label: "Normale", class: "text-blue-600", icon: "🔵" },
    5: { label: "Faible", class: "text-slate-500", icon: "⚪" },
  };
  const level = levels[Math.min(priority, 5)] || levels[5];
  return (
    <span className={`text-xs ${level.class}`} title={level.label}>
      {level.icon}
    </span>
  );
};

const ActionCard = ({
  action,
  onApprove,
  onReject,
  onMarkSent,
  isExpanded,
  onToggle,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <PriorityIndicator priority={action.priority} />
              <TypeBadge type={action.action_type} />
              <StatusBadge status={action.status} />
            </div>
            <h3 className="font-medium text-slate-800">{action.sujet}</h3>
            {action.destinataire_nom && (
              <p className="text-sm text-slate-500 mt-1">
                → {action.destinataire_nom}
                {action.destinataire_email && ` (${action.destinataire_email})`}
              </p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
              <span>
                Créée le{" "}
                {new Date(action.created_at).toLocaleDateString("fr-FR")}
              </span>
              {action.date_butoir && (
                <span className="text-orange-600">
                  ⏰ Échéance:{" "}
                  {new Date(action.date_butoir).toLocaleDateString("fr-FR")}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-slate-400 hover:text-slate-600"
          >
            {showDetails ? "▲" : "▼"}
          </button>
        </div>

        {showDetails && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="bg-slate-50 rounded-lg p-4 mb-4">
              <div className="text-xs font-medium text-slate-500 mb-2">
                Contenu du message:
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                {action.corps}
              </p>
            </div>

            {action.motif && (
              <div className="mb-4">
                <div className="text-xs font-medium text-slate-500 mb-1">
                  Motif:
                </div>
                <p className="text-sm text-slate-700">{action.motif}</p>
              </div>
            )}

            {action.acte_numero && (
              <div className="mb-4">
                <div className="text-xs font-medium text-slate-500 mb-1">
                  Acte concerné:
                </div>
                <Link
                  to={`/actes/${action.acte_id}`}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {action.acte_numero} - {action.acte_objet}
                </Link>
              </div>
            )}

            {action.pieces_jointes?.length > 0 && (
              <div className="mb-4">
                <div className="text-xs font-medium text-slate-500 mb-1">
                  Pièces jointes:
                </div>
                <ul className="text-sm text-slate-600">
                  {action.pieces_jointes.map((pj, i) => (
                    <li key={i}>📎 {pj.name || pj}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {action.status === "PENDING" && (
        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            ⚠️ Validation humaine requise avant envoi
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onReject(action)}
              className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded"
            >
              ❌ Rejeter
            </button>
            <button
              onClick={() => onApprove(action)}
              className="px-3 py-1.5 text-sm font-medium bg-green-600 text-white hover:bg-green-700 rounded"
            >
              ✅ Approuver
            </button>
          </div>
        </div>
      )}

      {action.status === "APPROVED" && (
        <div className="bg-green-50 px-4 py-3 border-t border-green-200 flex items-center justify-between">
          <div className="text-xs text-green-700">
            ✅ Approuvée par {action.validated_by ? "validateur" : "..."} le{" "}
            {action.validated_at
              ? new Date(action.validated_at).toLocaleDateString("fr-FR")
              : "..."}
          </div>
          <button
            onClick={() => onMarkSent(action)}
            className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded"
          >
            📤 Marquer comme envoyée
          </button>
        </div>
      )}

      {action.status === "SENT" && action.sent_at && (
        <div className="bg-blue-50 px-4 py-3 border-t border-blue-200">
          <div className="text-xs text-blue-700">
            📤 Envoyée le {new Date(action.sent_at).toLocaleDateString("fr-FR")}{" "}
            via {action.send_method}
            {action.send_reference && ` (Réf: ${action.send_reference})`}
          </div>
        </div>
      )}

      {action.status === "REJECTED" && (
        <div className="bg-red-50 px-4 py-3 border-t border-red-200">
          <div className="text-xs text-red-700">
            ⛔ Rejetée: {action.validation_note || "Sans motif"}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MODALS
// ============================================================================

const ApprovalModal = ({ action, onClose, onConfirm }) => {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm(action.id, note);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            ✅ Confirmer l'approbation
          </h2>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="text-sm text-yellow-800">
              <strong>⚠️ Attention:</strong> En approuvant cette action, vous
              autorisez son envoi. Vous serez identifié comme le validateur de
              cette action.
            </div>
          </div>

          <div className="mb-4">
            <div className="text-sm font-medium text-slate-700 mb-2">
              Action à approuver:
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="font-medium">{action.sujet}</div>
              <div className="text-sm text-slate-500 mt-1">
                → {action.destinataire_nom}
              </div>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Note de validation (optionnel)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              placeholder="Observations, conditions..."
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
            {loading ? "Validation..." : "Confirmer l'approbation"}
          </button>
        </div>
      </div>
    </div>
  );
};

const RejectionModal = ({ action, onClose, onConfirm }) => {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!reason.trim()) {
      alert("Le motif de rejet est obligatoire");
      return;
    }
    setLoading(true);
    await onConfirm(action.id, reason);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            ❌ Rejeter l'action
          </h2>

          <div className="mb-4">
            <div className="text-sm font-medium text-slate-700 mb-2">
              Action à rejeter:
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="font-medium">{action.sujet}</div>
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
              placeholder="Expliquez pourquoi cette action est rejetée..."
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

const SendModal = ({ action, onClose, onConfirm }) => {
  const [method, setMethod] = useState("EMAIL");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm(action.id, method, reference);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            📤 Marquer comme envoyée
          </h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Méthode d'envoi
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2"
            >
              <option value="EMAIL">Email</option>
              <option value="LRAR">Lettre recommandée AR</option>
              <option value="DEPOT">Dépôt en main propre</option>
              <option value="FAX">Fax</option>
              <option value="TELESERVICE">Téléservice</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Référence d'envoi (optionnel)
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2"
              placeholder="N° recommandé, accusé réception..."
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
            className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg disabled:opacity-50"
          >
            {loading ? "Enregistrement..." : "Confirmer l'envoi"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function OutgoingActionsQueue() {
  const { currentUser: user } = useCurrentUser();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actions, setActions] = useState([]);
  const [filter, setFilter] = useState("PENDING");

  const [approvalModal, setApprovalModal] = useState(null);
  const [rejectionModal, setRejectionModal] = useState(null);
  const [sendModal, setSendModal] = useState(null);

  // Fetch actions
  useEffect(() => {
    const fetchActions = async () => {
      if (!getSupabase()) return;

      setLoading(true);

      try {
        let query = getSupabase()
          .from("v_actions_pending")
          .select("*")
          .order("priority", { ascending: true })
          .order("created_at", { ascending: true });

        if (filter !== "ALL") {
          // Pour PENDING, on utilise la vue déjà filtrée
          // Pour les autres statuts, on requête directement la table
          if (filter !== "PENDING") {
            query = getSupabase()
              .from("outgoing_action")
              .select(
                `
                *,
                collectivite:collectivite_id (nom),
                acte:acte_id (numero_interne, objet_court)
              `
              )
              .eq("status", filter)
              .order("created_at", { ascending: false });
          }
        }

        const { data, error: fetchError } = await query;

        if (fetchError) throw fetchError;

        // Normaliser les données selon la source
        const normalized = (data || []).map((a) => ({
          ...a,
          collectivite_nom: a.collectivite_nom || a.collectivite?.nom,
          acte_numero: a.acte_numero || a.acte?.numero_interne,
          acte_objet: a.acte_objet || a.acte?.objet_court,
        }));

        setActions(normalized);
      } catch (err) {
        console.error("[OutgoingActionsQueue] Error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchActions();
  }, [filter]);

  // Approve action
  const handleApprove = async (actionId, note) => {
    if (!user?.id) return;

    try {
      const { error: rpcError } = await getSupabase().rpc(
        "approve_outgoing_action",
        {
          p_action_id: actionId,
          p_validator_id: user.id,
          p_note: note || null,
        }
      );

      if (rpcError) throw rpcError;

      // Refresh
      setFilter("PENDING");
    } catch (err) {
      console.error("[OutgoingActionsQueue] Approve error:", err);
      alert("Erreur lors de l'approbation: " + err.message);
    }
  };

  // Reject action
  const handleReject = async (actionId, reason) => {
    if (!user?.id) return;

    try {
      const { error: rpcError } = await getSupabase().rpc(
        "reject_outgoing_action",
        {
          p_action_id: actionId,
          p_validator_id: user.id,
          p_reason: reason,
        }
      );

      if (rpcError) throw rpcError;

      // Refresh
      setFilter("PENDING");
    } catch (err) {
      console.error("[OutgoingActionsQueue] Reject error:", err);
      alert("Erreur lors du rejet: " + err.message);
    }
  };

  // Mark as sent
  const handleMarkSent = async (actionId, method, reference) => {
    if (!user?.id) return;

    try {
      const { error: rpcError } = await getSupabase().rpc("mark_action_sent", {
        p_action_id: actionId,
        p_sender_id: user.id,
        p_method: method,
        p_reference: reference || null,
      });

      if (rpcError) throw rpcError;

      // Refresh
      setFilter("APPROVED");
    } catch (err) {
      console.error("[OutgoingActionsQueue] Mark sent error:", err);
      alert("Erreur: " + err.message);
    }
  };

  // Stats
  const stats = {
    pending: actions.filter((a) => a.status === "PENDING").length,
    approved: actions.filter((a) => a.status === "APPROVED").length,
    sent: actions.filter((a) => a.status === "SENT").length,
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
            <span className="text-slate-700">Actions sortantes</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            📤 File d'attente des actions sortantes
          </h1>
          <p className="text-slate-500 mt-1">
            Validation humaine obligatoire avant tout envoi
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Warning banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-semibold text-amber-800">
                Garde-fou humain actif
              </h3>
              <p className="text-sm text-amber-700 mt-1">
                Aucune action (email, courrier, publication) n'est envoyée
                automatiquement. Chaque action doit être validée manuellement
                par un utilisateur habilité. Votre validation engage votre
                responsabilité.
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <button
            onClick={() => setFilter("PENDING")}
            className={`p-4 rounded-lg border transition-colors ${
              filter === "PENDING"
                ? "border-yellow-500 bg-yellow-50"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="text-2xl font-bold text-yellow-600">
              {stats.pending}
            </div>
            <div className="text-sm text-slate-500">
              ⏳ En attente de validation
            </div>
          </button>

          <button
            onClick={() => setFilter("APPROVED")}
            className={`p-4 rounded-lg border transition-colors ${
              filter === "APPROVED"
                ? "border-green-500 bg-green-50"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="text-2xl font-bold text-green-600">
              {stats.approved}
            </div>
            <div className="text-sm text-slate-500">
              ✅ Approuvées (à envoyer)
            </div>
          </button>

          <button
            onClick={() => setFilter("SENT")}
            className={`p-4 rounded-lg border transition-colors ${
              filter === "SENT"
                ? "border-blue-500 bg-blue-50"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="text-2xl font-bold text-blue-600">{stats.sent}</div>
            <div className="text-sm text-slate-500">📤 Envoyées</div>
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
            ⚠️ {error}
          </div>
        )}

        {/* Actions list */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-500">Chargement...</p>
          </div>
        ) : actions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
            <div className="text-4xl mb-4">📭</div>
            <p className="text-slate-500">
              Aucune action {filter === "PENDING" ? "en attente" : "trouvée"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {actions.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                onApprove={() => setApprovalModal(action)}
                onReject={() => setRejectionModal(action)}
                onMarkSent={() => setSendModal(action)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {approvalModal && (
        <ApprovalModal
          action={approvalModal}
          onClose={() => setApprovalModal(null)}
          onConfirm={handleApprove}
        />
      )}

      {rejectionModal && (
        <RejectionModal
          action={rejectionModal}
          onClose={() => setRejectionModal(null)}
          onConfirm={handleReject}
        />
      )}

      {sendModal && (
        <SendModal
          action={sendModal}
          onClose={() => setSendModal(null)}
          onConfirm={handleMarkSent}
        />
      )}
    </div>
  );
}
