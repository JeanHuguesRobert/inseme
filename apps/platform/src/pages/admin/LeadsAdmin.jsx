import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getSupabase } from "../../lib/supabase.js";
import SiteFooter from "../../components/layout/SiteFooter";

const LEAD_TYPES = {
  liste_electorale: { emoji: "🗳️", label: "Liste électorale", color: "blue" },
  maire_elu: { emoji: "🏛️", label: "Maire/Élu", color: "green" },
  collectif_citoyen: { emoji: "✊", label: "Collectif", color: "purple" },
  citoyen_engage: { emoji: "🙋", label: "Citoyen", color: "orange" },
};

const STATUS_OPTIONS = [
  { value: "new", label: "Nouveau", color: "gray" },
  { value: "contacted", label: "Contacté", color: "blue" },
  { value: "qualified", label: "Qualifié", color: "yellow" },
  { value: "onboarding", label: "Onboarding", color: "purple" },
  { value: "active", label: "Actif", color: "green" },
  { value: "churned", label: "Abandonné", color: "red" },
  { value: "duplicate", label: "Doublon", color: "gray" },
];

const MATURITY_LEVELS = [
  { level: 1, icon: "🌱", name: "Intéressé" },
  { level: 2, icon: "🌿", name: "Convaincu" },
  { level: 3, icon: "🌳", name: "Actif" },
  { level: 4, icon: "🏆", name: "Exemplaire" },
];

const LEAD_SOURCES = {
  landing_page: { label: "Platform", icon: "🌐" },
  inseme_landing: { label: "Inseme", icon: "🧬" },
  referral: { label: "Referral", icon: "🔗" },
  social: { label: "Social", icon: "📱" },
};

export default function LeadsAdmin() {
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [filters, setFilters] = useState({
    type: "",
    status: "",
    maturity: "",
    source: "",
    search: "",
  });

  useEffect(() => {
    loadLeads();
    loadStats();
  }, [filters]);

  async function loadLeads() {
    try {
      let query = getSupabase()
        .from("transparency_leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (filters.type) query = query.eq("lead_type", filters.type);
      if (filters.status) query = query.eq("status", filters.status);
      if (filters.maturity) query = query.eq("maturity_level", parseInt(filters.maturity));
      if (filters.source) query = query.eq("source", filters.source);
      if (filters.search) {
        query = query.or(
          `name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,commune_name.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      setLeads(data || []);
    } catch (err) {
      console.error("Erreur chargement leads:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      const { data: dashboardData, error: dashboardError } = await getSupabase()
        .from("transparency_leads_dashboard")
        .select("*")
        .single();
      
      const { count: insemeCount, error: insemeError } = await getSupabase()
        .from("transparency_leads")
        .select("*", { count: 'exact', head: true })
        .eq("source", "inseme_landing");

      if (!dashboardError) {
        setStats({
          ...dashboardData,
          inseme_leads: insemeCount || 0
        });
      }
    } catch (err) {
      console.error("Erreur stats:", err);
    }
  }

  async function updateLeadStatus(leadId, newStatus) {
    try {
      const updates = { status: newStatus };
      if (newStatus === "contacted" && !leads.find((l) => l.id === leadId)?.contacted_at) {
        updates.contacted_at = new Date().toISOString();
      }
      if (newStatus === "active") {
        updates.converted_at = new Date().toISOString();
      }

      const { error } = await getSupabase()
        .from("transparency_leads")
        .update(updates)
        .eq("id", leadId);

      if (error) throw error;
      loadLeads();
      loadStats();
    } catch (err) {
      console.error("Erreur update:", err);
      alert("Erreur lors de la mise à jour");
    }
  }

  async function addInteraction(leadId, type, content) {
    try {
      const { error } = await getSupabase().from("lead_interactions").insert({
        lead_id: leadId,
        interaction_type: type,
        content,
        performed_at: new Date().toISOString(),
      });
      if (error) throw error;
      alert("Interaction enregistrée");
    } catch (err) {
      console.error("Erreur:", err);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="text-gray-500 hover:text-gray-700">
              ← Retour
            </Link>
            <h1 className="text-xl font-bold">📊 Gestion des Leads Transparence</h1>
          </div>
          <a
            href="/engagement"
            target="_blank"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            Voir la landing page →
          </a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-3xl font-bold text-blue-600">{stats.total_leads}</div>
              <div className="text-gray-500 text-sm">Total leads</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-3xl font-bold text-yellow-600">{stats.nouveaux}</div>
              <div className="text-gray-500 text-sm">Nouveaux</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-3xl font-bold text-purple-600">{stats.en_onboarding}</div>
              <div className="text-gray-500 text-sm">En onboarding</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-3xl font-bold text-green-600">{stats.actifs}</div>
              <div className="text-gray-500 text-sm">Actifs</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-3xl font-bold text-indigo-600">{stats.signataires_charte}</div>
              <div className="text-gray-500 text-sm">Signataires charte</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-3xl font-bold text-orange-600">{stats.communes_couvertes}</div>
              <div className="text-gray-500 text-sm">Communes</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border-2 border-rose-100">
              <div className="text-3xl font-bold text-rose-600">{stats.inseme_leads}</div>
              <div className="text-gray-500 text-sm">Leads Inseme</div>
            </div>
          </div>
        )}

        {/* Type breakdown */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🗳️</span>
                <span className="font-medium">Listes électorales</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">{stats.listes_electorales}</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🏛️</span>
                <span className="font-medium">Maires/Élus</span>
              </div>
              <div className="text-2xl font-bold text-green-600">{stats.maires_elus}</div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">✊</span>
                <span className="font-medium">Collectifs</span>
              </div>
              <div className="text-2xl font-bold text-purple-600">{stats.collectifs}</div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🙋</span>
                <span className="font-medium">Citoyens</span>
              </div>
              <div className="text-2xl font-bold text-orange-600">{stats.citoyens}</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <input
              type="text"
              placeholder="Rechercher..."
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              className="px-4 py-2 border rounded-lg"
            />
            <select
              value={filters.type}
              onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
              className="px-4 py-2 border rounded-lg"
            >
              <option value="">Tous les types</option>
              {Object.entries(LEAD_TYPES).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.emoji} {val.label}
                </option>
              ))}
            </select>
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className="px-4 py-2 border rounded-lg"
            >
              <option value="">Tous les statuts</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <select
              value={filters.maturity}
              onChange={(e) => setFilters((f) => ({ ...f, maturity: e.target.value }))}
              className="px-4 py-2 border rounded-lg"
            >
              <option value="">Tous les niveaux</option>
              {MATURITY_LEVELS.map((m) => (
                <option key={m.level} value={m.level}>
                  {m.icon} {m.name}
                </option>
              ))}
            </select>
            <select
              value={filters.source}
              onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))}
              className="px-4 py-2 border rounded-lg"
            >
              <option value="">Toutes les sources</option>
              {Object.entries(LEAD_SOURCES).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.icon} {val.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => setFilters({ type: "", status: "", maturity: "", source: "", search: "" })}
              className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Réinitialiser
            </button>
          </div>
        </div>

        {/* Leads Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Chargement...</div>
          ) : leads.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Aucun lead trouvé. Partagez la landing page !
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Nom</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Commune</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Niveau</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Charte</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Statut</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Source</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {leads.map((lead) => {
                  const typeInfo = LEAD_TYPES[lead.lead_type] || {};
                  const maturity = MATURITY_LEVELS[lead.maturity_level - 1] || {};
                  const status = STATUS_OPTIONS.find((s) => s.value === lead.status) || {};
                  const sourceInfo = LEAD_SOURCES[lead.source] || { label: lead.source, icon: "❓" };

                  return (
                    <tr key={lead.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span title={typeInfo.label}>{typeInfo.emoji}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{lead.name}</div>
                        <div className="text-sm text-gray-500">{lead.email}</div>
                        {lead.organization_name && (
                          <div className="text-xs text-gray-400">{lead.organization_name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{lead.commune_name}</div>
                        {lead.commune_insee && (
                          <div className="text-xs text-gray-400">INSEE: {lead.commune_insee}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span title={maturity.name}>
                          {maturity.icon} {maturity.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {lead.accepted_charter ? (
                          <span className="text-green-600">✓ Signée</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={lead.status}
                          onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                          className={`text-sm px-2 py-1 rounded border ${
                            status.color === "green"
                              ? "bg-green-50 border-green-200"
                              : status.color === "yellow"
                                ? "bg-yellow-50 border-yellow-200"
                                : status.color === "blue"
                                  ? "bg-blue-50 border-blue-200"
                                  : status.color === "purple"
                                    ? "bg-purple-50 border-purple-200"
                                    : status.color === "red"
                                      ? "bg-red-50 border-red-200"
                                      : "bg-gray-50 border-gray-200"
                          }`}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(lead.created_at).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-sm text-gray-600" title={sourceInfo.label}>
                          {sourceInfo.icon} {sourceInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedLead(lead)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            Détails
                          </button>
                          <a
                            href={`mailto:${lead.email}`}
                            className="text-green-600 hover:text-green-800 text-sm"
                          >
                            Email
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Lead Detail Modal */}
        {selectedLead && (
          <LeadDetailModal
            lead={selectedLead}
            onClose={() => setSelectedLead(null)}
            onUpdate={() => {
              loadLeads();
              loadStats();
            }}
          />
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

function LeadDetailModal({ lead, onClose, onUpdate }) {
  const [notes, setNotes] = useState(lead.notes || "");
  const [saving, setSaving] = useState(false);
  const [interactions, setInteractions] = useState([]);
  const [newInteraction, setNewInteraction] = useState({ type: "note", content: "" });

  useEffect(() => {
    loadInteractions();
  }, [lead.id]);

  async function loadInteractions() {
    const { data } = await getSupabase()
      .from("lead_interactions")
      .select("*")
      .eq("lead_id", lead.id)
      .order("performed_at", { ascending: false });
    setInteractions(data || []);
  }

  async function saveNotes() {
    setSaving(true);
    try {
      await getSupabase().from("transparency_leads").update({ notes }).eq("id", lead.id);
      onUpdate();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function addInteraction() {
    if (!newInteraction.content.trim()) return;
    try {
      await getSupabase().from("lead_interactions").insert({
        lead_id: lead.id,
        interaction_type: newInteraction.type,
        content: newInteraction.content,
      });
      setNewInteraction({ type: "note", content: "" });
      loadInteractions();
    } catch (err) {
      console.error(err);
    }
  }

  const typeInfo = LEAD_TYPES[lead.lead_type] || {};
  const maturity = MATURITY_LEVELS[lead.maturity_level - 1] || {};

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{typeInfo.emoji}</span>
            <div>
              <h2 className="text-xl font-bold">{lead.name}</h2>
              <div className="text-gray-500">{lead.commune_name}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Infos principales */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500">Email</div>
              <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline">
                {lead.email}
              </a>
            </div>
            {lead.phone && (
              <div>
                <div className="text-sm text-gray-500">Téléphone</div>
                <a href={`tel:${lead.phone}`} className="text-blue-600 hover:underline">
                  {lead.phone}
                </a>
              </div>
            )}
            <div>
              <div className="text-sm text-gray-500">Type</div>
              <div>
                {typeInfo.emoji} {typeInfo.label}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Niveau de maturité</div>
              <div>
                {maturity.icon} {maturity.name}
              </div>
            </div>
            {lead.organization_name && (
              <div className="col-span-2">
                <div className="text-sm text-gray-500">Organisation</div>
                <div>{lead.organization_name}</div>
              </div>
            )}
            <div>
              <div className="text-sm text-gray-500">Charte signée</div>
              <div>{lead.accepted_charter ? "✅ Oui" : "❌ Non"}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Accepte le contact</div>
              <div>{lead.accepted_contact ? "✅ Oui" : "❌ Non"}</div>
            </div>
          </div>

          {/* Message */}
          {lead.message && (
            <div>
              <div className="text-sm text-gray-500 mb-1">Message</div>
              <div className="bg-gray-50 rounded-lg p-4 text-gray-700">{lead.message}</div>
            </div>
          )}

          {/* Dates */}
          <div className="flex gap-4 text-sm text-gray-500">
            <div>Créé le {new Date(lead.created_at).toLocaleString("fr-FR")}</div>
            {lead.contacted_at && (
              <div>• Contacté le {new Date(lead.contacted_at).toLocaleString("fr-FR")}</div>
            )}
            {lead.converted_at && (
              <div>• Converti le {new Date(lead.converted_at).toLocaleString("fr-FR")}</div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm text-gray-500 mb-1 block">Notes internes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="Ajouter des notes..."
            />
            <button
              onClick={saveNotes}
              disabled={saving}
              className="mt-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm"
            >
              {saving ? "Enregistrement..." : "Enregistrer les notes"}
            </button>
          </div>

          {/* Nouvelle interaction */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-3">Ajouter une interaction</h3>
            <div className="flex gap-2">
              <select
                value={newInteraction.type}
                onChange={(e) => setNewInteraction((i) => ({ ...i, type: e.target.value }))}
                className="px-3 py-2 border rounded-lg"
              >
                <option value="note">📝 Note</option>
                <option value="email_sent">📧 Email envoyé</option>
                <option value="call">📞 Appel</option>
                <option value="meeting">🤝 Réunion</option>
                <option value="demo">🖥️ Démo</option>
                <option value="onboarding">🚀 Onboarding</option>
              </select>
              <input
                type="text"
                value={newInteraction.content}
                onChange={(e) => setNewInteraction((i) => ({ ...i, content: e.target.value }))}
                placeholder="Contenu..."
                className="flex-1 px-4 py-2 border rounded-lg"
              />
              <button
                onClick={addInteraction}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Ajouter
              </button>
            </div>
          </div>

          {/* Historique des interactions */}
          {interactions.length > 0 && (
            <div>
              <h3 className="font-medium mb-3">Historique</h3>
              <div className="space-y-2">
                {interactions.map((int) => (
                  <div key={int.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="text-xl">
                      {int.interaction_type === "email_sent"
                        ? "📧"
                        : int.interaction_type === "call"
                          ? "📞"
                          : int.interaction_type === "meeting"
                            ? "🤝"
                            : int.interaction_type === "demo"
                              ? "🖥️"
                              : int.interaction_type === "onboarding"
                                ? "🚀"
                                : "📝"}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-gray-500">
                        {new Date(int.performed_at).toLocaleString("fr-FR")}
                      </div>
                      <div>{int.content}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions rapides */}
          <div className="border-t pt-4 flex gap-3">
            <a
              href={`mailto:${lead.email}?subject=Votre engagement pour la transparence municipale`}
              className="flex-1 py-3 bg-green-600 text-white text-center rounded-lg hover:bg-green-700"
            >
              📧 Envoyer un email
            </a>
            {lead.phone && (
              <a
                href={`tel:${lead.phone}`}
                className="flex-1 py-3 bg-blue-600 text-white text-center rounded-lg hover:bg-blue-700"
              >
                📞 Appeler
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
