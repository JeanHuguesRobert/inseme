// src/pages/actes/ExportCSV.jsx
// ============================================================================
// Export CSV des données
// Export tabulaire pour analyses et archivage
// ============================================================================

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { getSupabase, useCurrentUser } from "@inseme/cop-host";

// ============================================================================
// CONSTANTS
// ============================================================================

const EXPORT_ENTITIES = {
  ACTES: {
    label: "Actes municipaux",
    description: "Liste complète des actes avec métadonnées",
    emoji: "📋",
    table: "actes",
    columns: [
      { key: "id", label: "ID" },
      { key: "reference", label: "Référence" },
      { key: "titre", label: "Titre" },
      { key: "type_acte", label: "Type" },
      { key: "date_adoption", label: "Date adoption" },
      { key: "statut", label: "Statut" },
      { key: "transmis_prefecture", label: "Transmis" },
      { key: "date_transmission", label: "Date transmission" },
      { key: "date_affichage", label: "Date affichage" },
      { key: "version", label: "Version" },
      { key: "created_at", label: "Créé le" },
      { key: "updated_at", label: "Modifié le" },
    ],
  },
  DEMANDES: {
    label: "Demandes administratives",
    description: "Toutes les demandes CRPA, CADA, recours",
    emoji: "📬",
    table: "demande_admin",
    columns: [
      { key: "id", label: "ID" },
      { key: "reference", label: "Référence" },
      { key: "type_demande", label: "Type" },
      { key: "objet", label: "Objet" },
      { key: "destinataire", label: "Destinataire" },
      { key: "date_envoi", label: "Date envoi" },
      { key: "statut", label: "Statut" },
      { key: "date_limite_reponse", label: "Date limite" },
      { key: "acte_id", label: "Acte lié" },
      { key: "created_at", label: "Créé le" },
    ],
  },
  PREUVES: {
    label: "Pièces justificatives",
    description: "Inventaire des preuves téléversées",
    emoji: "📎",
    table: "proof",
    columns: [
      { key: "id", label: "ID" },
      { key: "type_preuve", label: "Type" },
      { key: "date_constat", label: "Date constat" },
      { key: "description", label: "Description" },
      { key: "hash_sha256", label: "Hash SHA-256" },
      { key: "acte_id", label: "Acte lié" },
      { key: "demande_admin_id", label: "Demande liée" },
      { key: "verified_at", label: "Vérifié le" },
      { key: "created_at", label: "Créé le" },
    ],
  },
  RESPONSABILITES: {
    label: "Journal des responsabilités",
    description: "Audit trail des actions",
    emoji: "📜",
    table: "responsibility_log",
    columns: [
      { key: "id", label: "ID" },
      { key: "user_id", label: "Utilisateur" },
      { key: "responsibility_type", label: "Type" },
      { key: "entity_type", label: "Entité" },
      { key: "entity_id", label: "ID entité" },
      { key: "summary", label: "Résumé" },
      // Note RGPD: ip_address exclu par défaut - donnée personnelle selon CNIL
      // { key: "ip_address", label: "IP" }, // Désactivé pour conformité RGPD
      { key: "created_at", label: "Date" },
    ],
  },
  ACTIONS_EXTERNES: {
    label: "Actions externes",
    description: "File d'attente des actions sortantes",
    emoji: "📤",
    table: "outgoing_action",
    columns: [
      { key: "id", label: "ID" },
      { key: "action_type", label: "Type" },
      { key: "title", label: "Titre" },
      { key: "recipient", label: "Destinataire" },
      { key: "status", label: "Statut" },
      { key: "priority", label: "Priorité" },
      { key: "approved_by", label: "Approuvé par" },
      { key: "approved_at", label: "Approuvé le" },
      { key: "sent_at", label: "Envoyé le" },
      { key: "created_at", label: "Créé le" },
    ],
  },
};

const DATE_FORMATS = {
  ISO: {
    label: "ISO 8601 (2024-01-15)",
    format: (d) => d?.toISOString?.() || d,
  },
  FR: {
    label: "Français (15/01/2024)",
    format: (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : ""),
  },
  US: {
    label: "US (01/15/2024)",
    format: (d) => (d ? new Date(d).toLocaleDateString("en-US") : ""),
  },
};

const SEPARATORS = {
  COMMA: { label: "Virgule (,)", char: "," },
  SEMICOLON: { label: "Point-virgule (;)", char: ";" },
  TAB: { label: "Tabulation", char: "\t" },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Escape CSV value
 */
const escapeCSV = (value, separator) => {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(separator) || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * Generate CSV content
 */
const generateCSV = (data, columns, options) => {
  const { separator, dateFormat, includeHeaders } = options;
  const sep = SEPARATORS[separator]?.char || ",";
  const formatDate = DATE_FORMATS[dateFormat]?.format || ((d) => d);

  let csv = "";

  // Headers
  if (includeHeaders) {
    csv += columns.map((c) => escapeCSV(c.label, sep)).join(sep) + "\n";
  }

  // Data rows
  data.forEach((row) => {
    const values = columns.map((col) => {
      let value = row[col.key];

      // Format dates
      if (col.key.includes("date") || col.key.includes("_at")) {
        value = formatDate(value);
      }

      // Format booleans
      if (typeof value === "boolean") {
        value = value ? "Oui" : "Non";
      }

      // Format objects
      if (typeof value === "object" && value !== null) {
        value = JSON.stringify(value);
      }

      return escapeCSV(value, sep);
    });
    csv += values.join(sep) + "\n";
  });

  return csv;
};

/**
 * Download CSV file
 */
const downloadCSV = (content, filename) => {
  // Add BOM for Excel UTF-8 compatibility
  const bom = "\uFEFF";
  const blob = new Blob([bom + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ExportCSV() {
  const { currentUser: user } = useCurrentUser();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form state
  const [entity, setEntity] = useState("ACTES");
  const [selectedColumns, setSelectedColumns] = useState(
    EXPORT_ENTITIES.ACTES.columns.map((c) => c.key)
  );
  const [separator, setSeparator] = useState("SEMICOLON");
  const [dateFormat, setDateFormat] = useState("FR");
  const [includeHeaders, setIncludeHeaders] = useState(true);

  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Update selected columns when entity changes
  const handleEntityChange = (newEntity) => {
    setEntity(newEntity);
    setSelectedColumns(EXPORT_ENTITIES[newEntity].columns.map((c) => c.key));
  };

  // Toggle column
  const toggleColumn = (key) => {
    setSelectedColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // Export
  const handleExport = async () => {
    if (selectedColumns.length === 0) {
      setError("Veuillez sélectionner au moins une colonne");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const entityConfig = EXPORT_ENTITIES[entity];

      // Build query
      let query = getSupabase()
        .from(entityConfig.table)
        .select(selectedColumns.join(","));

      // Apply filters
      if (dateFrom) {
        query = query.gte("created_at", dateFrom);
      }
      if (dateTo) {
        query = query.lte("created_at", dateTo + "T23:59:59");
      }
      if (statusFilter) {
        query = query.eq("statut", statusFilter);
      }

      query = query.order("created_at", { ascending: false });

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      if (!data || data.length === 0) {
        setError("Aucune donnée à exporter");
        return;
      }

      // Generate CSV
      const columns = entityConfig.columns.filter((c) =>
        selectedColumns.includes(c.key)
      );
      const csv = generateCSV(data, columns, {
        separator,
        dateFormat,
        includeHeaders,
      });

      // Download
      const filename = `${entityConfig.table}_${new Date().toISOString().slice(0, 10)}.csv`;
      downloadCSV(csv, filename);

      setSuccess(`${data.length} enregistrements exportés avec succès`);
    } catch (err) {
      console.error("[ExportCSV] Error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const entityConfig = EXPORT_ENTITIES[entity];

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
            <span className="text-slate-700">Export CSV</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">📊 Export CSV</h1>
          <p className="text-slate-500 mt-1">
            Export tabulaire des données pour analyses et archivage
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          {/* Entity selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Données à exporter
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(EXPORT_ENTITIES).map(([key, info]) => (
                <button
                  key={key}
                  onClick={() => handleEntityChange(key)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    entity === key
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span>{info.emoji}</span>
                    <span className="font-medium text-sm">{info.label}</span>
                  </div>
                  <p className="text-xs text-slate-500">{info.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Column selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Colonnes à inclure
            </label>
            <div className="flex flex-wrap gap-2">
              {entityConfig.columns.map((col) => (
                <button
                  key={col.key}
                  onClick={() => toggleColumn(col.key)}
                  className={`px-3 py-1.5 rounded text-sm transition-colors ${
                    selectedColumns.includes(col.key)
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {col.label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() =>
                  setSelectedColumns(entityConfig.columns.map((c) => c.key))
                }
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Tout sélectionner
              </button>
              <span className="text-slate-300">|</span>
              <button
                onClick={() => setSelectedColumns([])}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Tout désélectionner
              </button>
            </div>
          </div>

          {/* Date filters */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Date début (optionnel)
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Date fin (optionnel)
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2"
              />
            </div>
          </div>

          {/* Format options */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Séparateur
              </label>
              <select
                value={separator}
                onChange={(e) => setSeparator(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2"
              >
                {Object.entries(SEPARATORS).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Format des dates
              </label>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2"
              >
                {Object.entries(DATE_FORMATS).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeHeaders}
                  onChange={(e) => setIncludeHeaders(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Inclure les en-têtes</span>
              </label>
            </div>
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
              ✅ {success}
            </div>
          )}

          {/* Export button */}
          <div className="flex justify-end">
            <button
              onClick={handleExport}
              disabled={loading || selectedColumns.length === 0}
              className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg disabled:opacity-50"
            >
              {loading ? "Export en cours..." : "📊 Exporter en CSV"}
            </button>
          </div>
        </div>

        {/* Info box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-800 mb-2">💡 Conseils</h3>
          <ul className="text-sm text-blue-700 list-disc ml-4 space-y-1">
            <li>
              Utilisez le point-virgule (;) comme séparateur pour une meilleure
              compatibilité avec Excel français
            </li>
            <li>
              L'export inclut l'encodage UTF-8 BOM pour les caractères accentués
            </li>
            <li>
              Pour les analyses, vous pouvez importer le fichier dans Excel,
              Google Sheets ou LibreOffice
            </li>
            <li>
              Les fichiers peuvent être archivés comme preuve de l'état des
              données à une date donnée
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
