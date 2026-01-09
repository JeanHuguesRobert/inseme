// src/pages/actes/ProofUpload.jsx
// ============================================================================
// Composant d'upload et gestion des preuves
// Supporte: screenshots, PDF, emails, captures horodatées
// ============================================================================

import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useCurrentUser } from "@inseme/cop-host";
import { wrapFetch, linkProof } from "../lib/api.js";

// ============================================================================
// CONSTANTS
// ============================================================================

const PROOF_TYPES = [
  {
    value: "SCREENSHOT",
    label: "Capture d'écran",
    emoji: "🖼️",
    description: "Capture du site web, d'un document en ligne",
    accept: "image/*",
  },
  {
    value: "PDF",
    label: "Document PDF",
    emoji: "📄",
    description: "Document officiel, courrier scanné",
    accept: "application/pdf",
  },
  {
    value: "EMAIL",
    label: "Email",
    emoji: "📧",
    description: "Copie d'un email reçu ou envoyé",
    accept: ".eml,.msg,application/pdf,image/*",
  },
  {
    value: "AR",
    label: "Accusé de réception",
    emoji: "📬",
    description: "AR postal ou numérique",
    accept: "image/*,application/pdf",
  },
  {
    value: "PHOTO",
    label: "Photo",
    emoji: "📷",
    description: "Photo d'un document, affichage public",
    accept: "image/*",
  },
  {
    value: "VIDEO",
    label: "Vidéo",
    emoji: "🎥",
    description: "Enregistrement vidéo",
    accept: "video/*",
  },
  {
    value: "AUTRE",
    label: "Autre",
    emoji: "📎",
    description: "Autre type de preuve",
    accept: "*/*",
  },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

const calculateHash = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
};

const getFilePreview = (file, type) => {
  if (type.startsWith("image/")) {
    return URL.createObjectURL(file);
  }
  return null;
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const FormField = ({ label, required, help, error, children }) => (
  <div className="space-y-1">
    <label className="block text-sm font-medium text-slate-700">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {help && <p className="text-xs text-slate-500">{help}</p>}
    {error && <p className="text-xs text-red-600">{error}</p>}
  </div>
);

const TypeSelector = ({ value, onChange }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
    {PROOF_TYPES.map((type) => (
      <button
        key={type.value}
        type="button"
        onClick={() => onChange(type.value)}
        className={`p-3 rounded-lg border text-left transition-all ${
          value === type.value
            ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
            : "border-slate-200 hover:border-slate-300"
        }`}
      >
        <div className="text-2xl mb-1">{type.emoji}</div>
        <div className="text-sm font-medium text-slate-700">{type.label}</div>
      </button>
    ))}
  </div>
);

const FileDropzone = ({ accept, onSelect, selectedFile }) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragIn = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOut = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onSelect(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onSelect(e.target.files[0]);
    }
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
        isDragging
          ? "border-blue-500 bg-blue-50"
          : selectedFile
            ? "border-green-500 bg-green-50"
            : "border-slate-300 hover:border-slate-400"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />

      {selectedFile ? (
        <div>
          <div className="text-4xl mb-2">✅</div>
          <div className="font-medium text-slate-700">{selectedFile.name}</div>
          <div className="text-sm text-slate-500">
            {formatFileSize(selectedFile.size)}
          </div>
          <div className="text-xs text-blue-600 mt-2">Cliquez pour changer</div>
        </div>
      ) : (
        <div>
          <div className="text-4xl mb-2">📁</div>
          <div className="font-medium text-slate-700">
            Glissez-déposez un fichier ici
          </div>
          <div className="text-sm text-slate-500">
            ou cliquez pour sélectionner
          </div>
          <div className="text-xs text-slate-400 mt-2">
            Max {formatFileSize(MAX_FILE_SIZE)}
          </div>
        </div>
      )}
    </div>
  );
};

const ExistingProofs = ({ proofs, onDelete }) => {
  if (!proofs || proofs.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-800 mb-4">
        📎 Preuves existantes ({proofs.length})
      </h2>
      <div className="space-y-3">
        {proofs.map((proof) => (
          <div
            key={proof.id}
            className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {PROOF_TYPES.find((t) => t.value === proof.type)?.emoji || "📎"}
              </span>
              <div>
                <div className="font-medium text-slate-700">
                  {proof.label || proof.type}
                </div>
                <div className="text-xs text-slate-500">
                  {proof.date_constat
                    ? `Constaté le ${new Date(proof.date_constat).toLocaleDateString("fr-FR")}`
                    : `Ajouté le ${new Date(proof.created_at).toLocaleDateString("fr-FR")}`}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {proof.verified_at && (
                <span className="text-green-500" title="Vérifié">
                  ✅
                </span>
              )}
              {proof.url_fichier && (
                <a
                  href={proof.url_fichier}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  Voir
                </a>
              )}
              <button
                onClick={() => onDelete(proof.id)}
                className="text-red-500 hover:text-red-700 text-sm"
              >
                Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ProofUpload({
  acteId: propActeId,
  demandeId: propDemandeId,
  onUploaded,
}) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { session, currentUser: user } = useCurrentUser();

  const acteId =
    propActeId || searchParams.get("actes") || searchParams.get("acte");
  const demandeId = propDemandeId || searchParams.get("demande");
  const mandatId = searchParams.get("mandat");

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const [existingProofs, setExistingProofs] = useState([]);
  const [linkedItem, setLinkedItem] = useState(null);

  // Form state
  const [proofType, setProofType] = useState("SCREENSHOT");
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [formData, setFormData] = useState({
    label: "",
    date_constat: new Date().toISOString().split("T")[0],
    url_source: "",
    hash_sha256: "",
    notes: "",
  });

  const [errors, setErrors] = useState({});

  // Fetch linked item and existing proofs
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const token = session?.access_token;
      try {
        if (acteId) {
          // Fetch acte summary via edge API
          const acte = await wrapFetch(`/api/actes/${acteId}`, { token });
          if (acte) setLinkedItem({ type: "acte", ...acte });

          // Fetch proof-links for this acte
          const links = await wrapFetch(`/api/proof-links?acte_id=${acteId}`, {
            token,
          });
          // links expected to be an array of { proof: { ... } } or proofs
          const proofs = Array.isArray(links)
            ? links.map((l) => l.proof || l).filter(Boolean)
            : [];
          setExistingProofs(proofs);
        } else if (mandatId) {
          const mandat = await wrapFetch(`/api/mandats/${mandatId}`, { token });
          if (mandat) setLinkedItem({ type: "mandat", ...mandat });

          const links = await wrapFetch(
            `/api/proof-links?mandat_id=${mandatId}`,
            { token }
          );
          const proofs = Array.isArray(links)
            ? links.map((l) => l.proof || l).filter(Boolean)
            : [];
          setExistingProofs(proofs);
        } else if (demandeId) {
          const demande = await wrapFetch(`/api/demandes/${demandeId}`, {
            token,
          });
          if (demande) setLinkedItem({ type: "demande", ...demande });

          const links = await wrapFetch(
            `/api/proof-links?demande_admin_id=${demandeId}`,
            {
              token,
            }
          );
          const proofs = Array.isArray(links)
            ? links.map((l) => l.proof || l).filter(Boolean)
            : [];
          setExistingProofs(proofs);
        }
      } catch (err) {
        console.error("[ProofUpload] Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [acteId, demandeId]);

  // Update preview when file changes
  useEffect(() => {
    if (selectedFile) {
      const previewUrl = getFilePreview(selectedFile, selectedFile.type);
      setPreview(previewUrl);

      // Calculate hash
      calculateHash(selectedFile).then((hash) => {
        setFormData((prev) => ({ ...prev, hash_sha256: hash }));
      });

      // Auto-fill label if empty
      if (!formData.label) {
        setFormData((prev) => ({
          ...prev,
          label: selectedFile.name.replace(/\.[^/.]+$/, ""),
        }));
      }

      return () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
      };
    }
  }, [selectedFile]);

  // Handle field change
  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  // Validate form
  const validate = () => {
    const newErrors = {};

    if (!selectedFile) {
      newErrors.file = "Veuillez sélectionner un fichier";
    } else if (selectedFile.size > MAX_FILE_SIZE) {
      newErrors.file = `Le fichier dépasse la taille maximale (${formatFileSize(MAX_FILE_SIZE)})`;
    }

    if (!formData.label || formData.label.length < 3) {
      newErrors.label = "Le libellé doit faire au moins 3 caractères";
    }

    if (!formData.date_constat) {
      newErrors.date_constat = "La date de constat est requise";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Upload and save
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;
    if (!user?.id) {
      setError("Vous devez être connecté");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const token = session?.access_token;

      // Build FormData for file + metadata
      const fd = new FormData();
      fd.append("file", selectedFile, selectedFile.name);
      fd.append("type", proofType);
      fd.append("label", formData.label);
      fd.append("date_constat", formData.date_constat);
      if (formData.url_source) fd.append("url_source", formData.url_source);
      if (formData.hash_sha256) fd.append("hash_sha256", formData.hash_sha256);
      fd.append(
        "metadata",
        JSON.stringify({
          original_name: selectedFile.name,
          size: selectedFile.size,
          mime_type: selectedFile.type,
          notes: formData.notes,
        })
      );

      // Create proof via edge API (expects multipart/form-data)
      const proof = await wrapFetch("/api/proofs", {
        method: "POST",
        token,
        body: fd,
      });

      // Link proof to acte/demande/mandat
      if ((acteId || demandeId || mandatId) && proof?.id) {
        const payload = {
          proof_id: proof.id,
          entity_type: acteId ? "ACTE" : mandatId ? "MANDAT" : "DEMANDE",
          entity_id: acteId || mandatId || demandeId,
          role: proofType,
        };

        await linkProof(payload, { token });
      }

      setSuccess(true);

      // Callback and redirect after success
      setTimeout(() => {
        if (typeof onUploaded === "function") onUploaded();
        if (acteId) {
          navigate(`/actes/${acteId}`);
        } else if (mandatId) {
          navigate(`/mandats/${mandatId}`);
        } else if (demandeId) {
          navigate(`/demandes/${demandeId}`);
        } else {
          navigate("/actes");
        }
      }, 800);
    } catch (err) {
      console.error("[ProofUpload] Submit error:", err);
      setError(err.message || "Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  };

  // Delete proof
  const handleDeleteProof = async (proofId) => {
    if (!confirm("Supprimer cette preuve ?")) return;

    try {
      const token = session?.access_token;
      // Ask server to delete proof (server should handle unlinking)
      await wrapFetch(`/api/proofs/${proofId}`, { method: "DELETE", token });
      setExistingProofs((prev) => prev.filter((p) => p.id !== proofId));
    } catch (err) {
      console.error("[ProofUpload] Delete error:", err);
      setError(err.message || "Erreur lors de la suppression");
    }
  };

  const selectedTypeInfo = PROOF_TYPES.find((t) => t.value === proofType);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-500">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link to="/actes" className="hover:text-blue-600">
              Tableau de bord
            </Link>
            <span>/</span>
            {linkedItem?.type === "acte" && (
              <>
                <Link to={`/actes/${acteId}`} className="hover:text-blue-600">
                  {linkedItem.numero_interne || "Acte"}
                </Link>
                <span>/</span>
              </>
            )}
            {linkedItem?.type === "mandat" && (
              <>
                <Link
                  to={`/mandats/${mandatId}`}
                  className="hover:text-blue-600"
                >
                  {linkedItem.label || "Mandat"}
                </Link>
                <span>/</span>
              </>
            )}
            {linkedItem?.type === "demande" && (
              <>
                <Link
                  to={`/demandes/${demandeId}`}
                  className="hover:text-blue-600"
                >
                  Demande
                </Link>
                <span>/</span>
              </>
            )}
            <span className="text-slate-700">Ajouter une preuve</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            📎 Ajouter une preuve
          </h1>
          {linkedItem && (
            <p className="text-slate-500 mt-1">
              Lié à:{" "}
              {linkedItem.type === "acte"
                ? linkedItem.objet_court
                : linkedItem.type === "mandat"
                  ? linkedItem.label
                  : linkedItem.objet}
            </p>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Existing proofs */}
        <ExistingProofs proofs={existingProofs} onDelete={handleDeleteProof} />

        {/* Upload form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Success message */}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700 flex items-center gap-2">
              ✅ Preuve ajoutée avec succès ! Redirection...
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              ⚠️ {error}
            </div>
          )}

          {/* Type selection */}
          <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              📂 Type de preuve
            </h2>
            <TypeSelector value={proofType} onChange={setProofType} />
            {selectedTypeInfo && (
              <p className="text-sm text-slate-500 mt-3">
                {selectedTypeInfo.description}
              </p>
            )}
          </div>

          {/* File upload */}
          <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              📁 Fichier
            </h2>

            <FileDropzone
              accept={selectedTypeInfo?.accept || "*/*"}
              selectedFile={selectedFile}
              onSelect={setSelectedFile}
            />

            {errors.file && (
              <p className="text-xs text-red-600 mt-2">{errors.file}</p>
            )}

            {/* Preview */}
            {preview && (
              <div className="mt-4">
                <p className="text-sm text-slate-500 mb-2">Aperçu:</p>
                <img
                  src={preview}
                  alt="Aperçu"
                  className="max-w-full max-h-64 rounded-lg border border-slate-200"
                />
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              📝 Informations
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField label="Libellé" required error={errors.label}>
                <input
                  type="text"
                  value={formData.label}
                  onChange={(e) => handleChange("label", e.target.value)}
                  placeholder="Ex: Capture site mairie 15/01/2024"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </FormField>

              <FormField
                label="Date de constat"
                required
                error={errors.date_constat}
              >
                <input
                  type="date"
                  value={formData.date_constat}
                  onChange={(e) => handleChange("date_constat", e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </FormField>

              <FormField
                label="URL source"
                help="Adresse web de la source (si applicable)"
              >
                <input
                  type="url"
                  value={formData.url_source}
                  onChange={(e) => handleChange("url_source", e.target.value)}
                  placeholder="https://..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </FormField>

              <FormField
                label="Hash SHA-256"
                help="Empreinte numérique du fichier (optionnel)"
              >
                <input
                  type="text"
                  value={formData.hash_sha256}
                  onChange={(e) => handleChange("hash_sha256", e.target.value)}
                  placeholder="e3b0c44298fc1c149afbf4c8..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </FormField>
            </div>

            <div className="mt-4">
              <FormField label="Notes" help="Contexte, observations...">
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  rows={3}
                  placeholder="Notes complémentaires sur cette preuve..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </FormField>
            </div>
          </div>

          {/* Legal notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-amber-800 mb-2">
              ⚠️ Important
            </h3>
            <p className="text-sm text-amber-700">
              Les preuves téléversées constituent des éléments de traçabilité.
              Assurez-vous de leur authenticité et de la date de constat exacte.
              Pour les captures d'écran, privilégiez un horodatage visible.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-4 pt-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700"
            >
              ← Annuler
            </button>

            <button
              type="submit"
              disabled={uploading || !selectedFile}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                uploading || !selectedFile
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {uploading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span> Upload en cours...
                </span>
              ) : (
                "✅ Ajouter la preuve"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
