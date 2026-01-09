// src/pages/actes/ExportPDF.jsx
// ============================================================================
// Export PDF des actes et demandes
// Génération de documents légaux au format PDF
// ============================================================================

import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getSupabase, useCurrentUser } from "@inseme/cop-host";

// ============================================================================
// CONSTANTS
// ============================================================================

const EXPORT_TYPES = {
  ACTE_COMPLET: {
    label: "Acte complet",
    description:
      "Inclut l'acte, toutes les versions, preuves et demandes liées",
    emoji: "📋",
  },
  DEMANDE_DOSSIER: {
    label: "Dossier de demande",
    description: "Demande complète avec historique et réponses",
    emoji: "📬",
  },
  CHRONOLOGIE: {
    label: "Chronologie",
    description: "Timeline des événements pour un acte ou une période",
    emoji: "📅",
  },
  RECOURS_TA: {
    label: "Dossier recours TA",
    description: "Document formaté pour le Tribunal Administratif",
    emoji: "⚖️",
  },
  SAISINE_CADA: {
    label: "Dossier saisine CADA",
    description:
      "Pièces pour la Commission d'Accès aux Documents Administratifs",
    emoji: "📨",
  },
};

const PAPER_FORMATS = {
  A4: { label: "A4 (210 × 297 mm)", width: 210, height: 297 },
  LETTER: { label: "Letter (8.5 × 11 in)", width: 216, height: 279 },
  LEGAL: { label: "Legal (8.5 × 14 in)", width: 216, height: 356 },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate HTML content for PDF
 */
const generatePDFHTML = async (exportType, data, options) => {
  const { includeProofs, includeVersions, includeTimeline, format } = options;

  let html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${data.title || "Export"}</title>
  <style>
    @page {
      size: ${format === "A4" ? "A4" : format === "LETTER" ? "letter" : "legal"};
      margin: 2cm;
    }
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 12pt;
      line-height: 1.5;
      color: #000;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 1cm;
      margin-bottom: 1cm;
    }
    .header h1 {
      font-size: 18pt;
      margin: 0;
    }
    .header h2 {
      font-size: 14pt;
      font-weight: normal;
      margin: 0.5cm 0 0 0;
    }
    .metadata {
      background: #f5f5f5;
      padding: 0.5cm;
      margin-bottom: 1cm;
    }
    .metadata table {
      width: 100%;
      border-collapse: collapse;
    }
    .metadata td {
      padding: 0.2cm;
    }
    .metadata td:first-child {
      font-weight: bold;
      width: 30%;
    }
    .section {
      margin-bottom: 1cm;
    }
    .section h3 {
      font-size: 14pt;
      border-bottom: 1px solid #ccc;
      padding-bottom: 0.2cm;
    }
    .timeline {
      border-left: 2px solid #000;
      margin-left: 0.5cm;
      padding-left: 0.5cm;
    }
    .timeline-item {
      margin-bottom: 0.5cm;
      position: relative;
    }
    .timeline-item::before {
      content: "●";
      position: absolute;
      left: -0.75cm;
    }
    .proof {
      border: 1px solid #ccc;
      padding: 0.5cm;
      margin-bottom: 0.5cm;
    }
    .footer {
      position: fixed;
      bottom: 0;
      width: 100%;
      text-align: center;
      font-size: 10pt;
      color: #666;
      border-top: 1px solid #ccc;
      padding-top: 0.2cm;
    }
    .page-break {
      page-break-before: always;
    }
    .legal-notice {
      background: #fff3cd;
      border: 1px solid #856404;
      padding: 0.5cm;
      margin: 1cm 0;
      font-size: 10pt;
    }
  </style>
</head>
<body>
`;

  // Header
  html += `
  <div class="header">
    <h1>COMMUNE DE CORTE</h1>
    <h2>${EXPORT_TYPES[exportType]?.label || exportType}</h2>
    <p>Document généré le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}</p>
  </div>
`;

  // Content based on type
  if (exportType === "ACTE_COMPLET" && data.acte) {
    html += generateActeSection(data.acte, includeVersions);
    if (includeProofs && data.proofs?.length > 0) {
      html += generateProofsSection(data.proofs);
    }
    if (data.demandes?.length > 0) {
      html += generateDemandesSection(data.demandes);
    }
    if (includeTimeline && data.timeline?.length > 0) {
      html += generateTimelineSection(data.timeline);
    }
  } else if (exportType === "DEMANDE_DOSSIER" && data.demande) {
    html += generateDemandeSection(data.demande);
    if (data.responses?.length > 0) {
      html += generateResponsesSection(data.responses);
    }
    if (includeProofs && data.proofs?.length > 0) {
      html += generateProofsSection(data.proofs);
    }
  } else if (exportType === "RECOURS_TA") {
    html += generateRecoursSection(data);
  } else if (exportType === "SAISINE_CADA") {
    html += generateCADASection(data);
  } else if (exportType === "CHRONOLOGIE") {
    html += generateTimelineSection(data.timeline);
  }

  // Footer
  html += `
  <div class="footer">
    Système citoyen de contrôle des actes municipaux - Document à valeur informative
  </div>
</body>
</html>
`;

  return html;
};

const generateActeSection = (acte, includeVersions) => {
  let html = `
  <div class="section">
    <h3>📋 ACTE MUNICIPAL</h3>
    <div class="metadata">
      <table>
        <tr><td>Référence</td><td>${acte.reference || "-"}</td></tr>
        <tr><td>Type</td><td>${acte.type_acte || "-"}</td></tr>
        <tr><td>Date d'adoption</td><td>${acte.date_adoption ? new Date(acte.date_adoption).toLocaleDateString("fr-FR") : "-"}</td></tr>
        <tr><td>Statut</td><td>${acte.statut || "-"}</td></tr>
        <tr><td>Transmission préfecture</td><td>${acte.transmis_prefecture ? "Oui" : "Non"}</td></tr>
        ${acte.date_transmission ? `<tr><td>Date transmission</td><td>${new Date(acte.date_transmission).toLocaleDateString("fr-FR")}</td></tr>` : ""}
        <tr><td>Version actuelle</td><td>${acte.version || 1}</td></tr>
      </table>
    </div>
    <h4>Titre</h4>
    <p>${acte.titre || "-"}</p>
    ${acte.resume ? `<h4>Résumé</h4><p>${acte.resume}</p>` : ""}
    ${acte.observation ? `<h4>Observations</h4><p>${acte.observation}</p>` : ""}
  </div>
`;

  if (includeVersions && acte.versions?.length > 0) {
    html += `
  <div class="section">
    <h3>📜 HISTORIQUE DES VERSIONS</h3>
    <table style="width:100%; border-collapse:collapse;">
      <tr style="background:#f5f5f5;">
        <th style="border:1px solid #ccc; padding:0.3cm;">Version</th>
        <th style="border:1px solid #ccc; padding:0.3cm;">Date</th>
        <th style="border:1px solid #ccc; padding:0.3cm;">Auteur</th>
        <th style="border:1px solid #ccc; padding:0.3cm;">Notes</th>
      </tr>
      ${acte.versions
        .map(
          (v) => `
      <tr>
        <td style="border:1px solid #ccc; padding:0.3cm;">v${v.version_number}</td>
        <td style="border:1px solid #ccc; padding:0.3cm;">${new Date(v.created_at).toLocaleDateString("fr-FR")}</td>
        <td style="border:1px solid #ccc; padding:0.3cm;">${v.created_by_email || "-"}</td>
        <td style="border:1px solid #ccc; padding:0.3cm;">${v.change_notes || "-"}</td>
      </tr>
      `
        )
        .join("")}
    </table>
  </div>
`;
  }

  return html;
};

const generateDemandeSection = (demande) => `
  <div class="section">
    <h3>📬 DEMANDE ADMINISTRATIVE</h3>
    <div class="metadata">
      <table>
        <tr><td>Type</td><td>${demande.type_demande || "-"}</td></tr>
        <tr><td>Référence</td><td>${demande.reference || "-"}</td></tr>
        <tr><td>Date d'envoi</td><td>${demande.date_envoi ? new Date(demande.date_envoi).toLocaleDateString("fr-FR") : "-"}</td></tr>
        <tr><td>Statut</td><td>${demande.statut || "-"}</td></tr>
        <tr><td>Date limite</td><td>${demande.date_limite_reponse ? new Date(demande.date_limite_reponse).toLocaleDateString("fr-FR") : "-"}</td></tr>
      </table>
    </div>
    <h4>Objet</h4>
    <p>${demande.objet || "-"}</p>
    ${demande.contenu ? `<h4>Contenu de la demande</h4><p style="white-space:pre-wrap;">${demande.contenu}</p>` : ""}
  </div>
`;

const generateProofsSection = (proofs) => `
  <div class="section page-break">
    <h3>📎 PIÈCES JUSTIFICATIVES</h3>
    ${proofs
      .map(
        (proof, idx) => `
    <div class="proof">
      <strong>Pièce ${idx + 1}:</strong> ${proof.type_preuve || "Document"}<br>
      <strong>Date du constat:</strong> ${proof.date_constat ? new Date(proof.date_constat).toLocaleDateString("fr-FR") : "-"}<br>
      ${proof.description ? `<strong>Description:</strong> ${proof.description}<br>` : ""}
      ${proof.hash_sha256 ? `<strong>Hash SHA-256:</strong> <code style="font-size:9pt;">${proof.hash_sha256}</code>` : ""}
    </div>
    `
      )
      .join("")}
  </div>
`;

const generateDemandesSection = (demandes) => `
  <div class="section">
    <h3>📬 DEMANDES LIÉES</h3>
    ${demandes
      .map(
        (d) => `
    <div style="border:1px solid #ccc; padding:0.5cm; margin-bottom:0.5cm;">
      <strong>${d.type_demande}</strong> - ${d.reference || "Sans référence"}<br>
      <em>Statut: ${d.statut}</em>
    </div>
    `
      )
      .join("")}
  </div>
`;

const generateResponsesSection = (responses) => `
  <div class="section">
    <h3>📨 RÉPONSES REÇUES</h3>
    ${responses
      .map(
        (r, idx) => `
    <div style="border:1px solid #ccc; padding:0.5cm; margin-bottom:0.5cm;">
      <strong>Réponse ${idx + 1}</strong> - ${r.date_reponse ? new Date(r.date_reponse).toLocaleDateString("fr-FR") : ""}<br>
      <p>${r.contenu || "-"}</p>
    </div>
    `
      )
      .join("")}
  </div>
`;

const generateTimelineSection = (timeline) => `
  <div class="section page-break">
    <h3>📅 CHRONOLOGIE DES ÉVÉNEMENTS</h3>
    <div class="timeline">
      ${timeline
        .map(
          (event) => `
      <div class="timeline-item">
        <strong>${new Date(event.date).toLocaleDateString("fr-FR")}</strong><br>
        ${event.type}: ${event.description}
      </div>
      `
        )
        .join("")}
    </div>
  </div>
`;

const generateRecoursSection = (data) => `
  <div class="section">
    <h3>⚖️ DOSSIER DE RECOURS - TRIBUNAL ADMINISTRATIF</h3>
    <div class="legal-notice">
      <strong>IMPORTANT:</strong> Ce document est un modèle. Il doit être complété et adapté
      selon les spécificités de votre dossier. Consultez un avocat spécialisé en droit public
      si nécessaire.
    </div>
    <p><strong>Juridiction compétente:</strong> Tribunal Administratif de Bastia</p>
    <p><strong>Délai de recours:</strong> 2 mois à compter de la publication/notification de l'acte</p>

    <h4>I. EXPOSÉ DES FAITS</h4>
    <p>[À compléter avec les faits pertinents]</p>

    <h4>II. MOYENS DE LÉGALITÉ EXTERNE</h4>
    <ul>
      <li>Incompétence de l'auteur de l'acte</li>
      <li>Vice de procédure</li>
      <li>Vice de forme</li>
    </ul>

    <h4>III. MOYENS DE LÉGALITÉ INTERNE</h4>
    <ul>
      <li>Violation de la loi</li>
      <li>Erreur de droit</li>
      <li>Erreur de fait</li>
      <li>Détournement de pouvoir</li>
    </ul>

    <h4>IV. PIÈCES JOINTES</h4>
    <p>Liste des pièces à joindre au recours...</p>
  </div>
`;

const generateCADASection = (data) => `
  <div class="section">
    <h3>📨 DOSSIER DE SAISINE - CADA</h3>
    <div class="legal-notice">
      <strong>Références légales:</strong><br>
      - Code des relations entre le public et l'administration (CRPA)<br>
      - Loi n° 78-753 du 17 juillet 1978 (loi CADA)
    </div>

    <h4>COMMISSION D'ACCÈS AUX DOCUMENTS ADMINISTRATIFS</h4>
    <p>TSA 50730 - 75334 PARIS CEDEX 07</p>

    <h4>OBJET: Demande d'avis sur refus de communication</h4>

    <h4>I. EXPOSÉ DE LA DEMANDE INITIALE</h4>
    <p>[Résumer la demande initiale de communication]</p>

    <h4>II. RÉPONSE DE L'ADMINISTRATION</h4>
    <p>[Décrire la réponse ou l'absence de réponse]</p>

    <h4>III. DOCUMENTS DEMANDÉS</h4>
    <p>[Lister précisément les documents sollicités]</p>

    <h4>IV. PIÈCES JOINTES</h4>
    <ul>
      <li>Copie de la demande initiale</li>
      <li>Accusé de réception (si disponible)</li>
      <li>Réponse de l'administration (si reçue)</li>
    </ul>
  </div>
`;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ExportPDF() {
  const { currentUser: user } = useCurrentUser();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [exportType, setExportType] = useState(
    searchParams.get("type") || "ACTE_COMPLET"
  );
  const [entityId, setEntityId] = useState(searchParams.get("id") || "");
  const [format, setFormat] = useState("A4");
  const [includeProofs, setIncludeProofs] = useState(true);
  const [includeVersions, setIncludeVersions] = useState(true);
  const [includeTimeline, setIncludeTimeline] = useState(true);

  // Preview
  const [previewHTML, setPreviewHTML] = useState(null);

  // Generate PDF
  const handleExport = async (preview = false) => {
    if (
      !entityId &&
      (exportType === "ACTE_COMPLET" || exportType === "DEMANDE_DOSSIER")
    ) {
      setError("Veuillez sélectionner un acte ou une demande");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let data = {};

      // Fetch data based on type
      if (exportType === "ACTE_COMPLET") {
        const { data: acte, error: acteError } = await getSupabase()
          .from("actes")
          .select("*, acte_version(*)")
          .eq("id", entityId)
          .single();

        if (acteError) throw acteError;

        data.acte = acte;
        data.title = `Acte - ${acte.reference || acte.titre}`;

        // Fetch proofs
        if (includeProofs) {
          const { data: proofs } = await getSupabase()
            .from("proof")
            .select("*")
            .eq("acte_id", entityId);
          data.proofs = proofs || [];
        }

        // Fetch demandes
        const { data: demandes } = await getSupabase()
          .from("demande_admin")
          .select("*")
          .eq("acte_id", entityId);
        data.demandes = demandes || [];
      } else if (exportType === "DEMANDE_DOSSIER") {
        const { data: demande, error: demandeError } = await getSupabase()
          .from("demande_admin")
          .select("*")
          .eq("id", entityId)
          .single();

        if (demandeError) throw demandeError;

        data.demande = demande;
        data.title = `Demande - ${demande.reference || demande.objet}`;

        // Fetch responses
        const { data: responses } = await getSupabase()
          .from("demande_response")
          .select("*")
          .eq("demande_admin_id", entityId)
          .order("date_reponse", { ascending: true });
        data.responses = responses || [];

        // Fetch proofs
        if (includeProofs) {
          const { data: proofs } = await getSupabase()
            .from("proof")
            .select("*")
            .eq("demande_admin_id", entityId);
          data.proofs = proofs || [];
        }
      } else {
        data.title = EXPORT_TYPES[exportType]?.label || "Export";
      }

      // Generate HTML
      const html = await generatePDFHTML(exportType, data, {
        includeProofs,
        includeVersions,
        includeTimeline,
        format,
      });

      if (preview) {
        setPreviewHTML(html);
      } else {
        // Print/Save as PDF
        const printWindow = window.open("", "_blank");
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
        setSuccess(true);
      }
    } catch (err) {
      console.error("[ExportPDF] Error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
            <span className="text-slate-700">Export PDF</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">📄 Export PDF</h1>
          <p className="text-slate-500 mt-1">
            Génération de documents légaux au format PDF
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          {/* Export type selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Type d'export
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(EXPORT_TYPES).map(([key, info]) => (
                <button
                  key={key}
                  onClick={() => setExportType(key)}
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    exportType === key
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{info.emoji}</span>
                    <span className="font-medium">{info.label}</span>
                  </div>
                  <p className="text-xs text-slate-500">{info.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Entity ID */}
          {(exportType === "ACTE_COMPLET" ||
            exportType === "DEMANDE_DOSSIER") && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Identifiant{" "}
                {exportType === "ACTE_COMPLET" ? "de l'acte" : "de la demande"}
              </label>
              <input
                type="text"
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                placeholder="UUID ou référence"
                className="w-full border border-slate-200 rounded-lg px-4 py-2"
              />
              <p className="text-xs text-slate-500 mt-1">
                Copiez l'UUID depuis la page de détail
              </p>
            </div>
          )}

          {/* Options */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Options
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeProofs}
                  onChange={(e) => setIncludeProofs(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">
                  Inclure les pièces justificatives
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeVersions}
                  onChange={(e) => setIncludeVersions(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">
                  Inclure l'historique des versions
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeTimeline}
                  onChange={(e) => setIncludeTimeline(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Inclure la chronologie</span>
              </label>
            </div>
          </div>

          {/* Paper format */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Format du papier
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-4 py-2"
            >
              {Object.entries(PAPER_FORMATS).map(([key, info]) => (
                <option key={key} value={key}>
                  {info.label}
                </option>
              ))}
            </select>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              ⚠️ {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
              ✅ Document généré avec succès !
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => handleExport(true)}
              disabled={loading}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
            >
              👁️ Aperçu
            </button>
            <button
              onClick={() => handleExport(false)}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg disabled:opacity-50"
            >
              {loading ? "Génération..." : "📄 Générer le PDF"}
            </button>
          </div>
        </div>

        {/* Preview */}
        {previewHTML && (
          <div className="mt-6 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-medium">Aperçu</h3>
              <button
                onClick={() => setPreviewHTML(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <iframe
              srcDoc={previewHTML}
              className="w-full h-[600px]"
              title="Aperçu PDF"
            />
          </div>
        )}
      </div>
    </div>
  );
}
