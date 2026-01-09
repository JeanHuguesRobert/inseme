import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import SiteFooter from "../components/layout/SiteFooter";
import { getSupabase } from "../lib/supabase.js";

// Couleurs par niveau de maturité
const MATURITY_COLORS = {
  1: { bg: "bg-gray-100", text: "text-gray-600", border: "border-gray-300" },
  2: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-300" },
  3: { bg: "bg-green-50", text: "text-green-600", border: "border-green-300" },
  4: { bg: "bg-yellow-50", text: "text-yellow-600", border: "border-yellow-300" },
};

const MATURITY_LABELS = {
  1: { icon: "🌱", name: "Intéressé" },
  2: { icon: "🌿", name: "Convaincu" },
  3: { icon: "🌳", name: "Actif" },
  4: { icon: "🏆", name: "Exemplaire" },
};

export default function TransparenceVitrine() {
  const [engagements, setEngagements] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all, charter, active

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      // Charger les leads publics (ceux qui ont accepté d'être affichés)
      const { data: leads } = await getSupabase()
        .from("transparency_leads")
        .select(
          "commune_name, commune_insee, lead_type, maturity_level, organization_name, accepted_charter, created_at, status"
        )
        .eq("accepted_contact", true)
        .neq("status", "duplicate")
        .order("maturity_level", { ascending: false })
        .order("created_at", { ascending: false });

      // Grouper par commune
      const communeMap = new Map();
      (leads || []).forEach((lead) => {
        const key = lead.commune_name;
        if (!communeMap.has(key)) {
          communeMap.set(key, {
            commune: lead.commune_name,
            insee: lead.commune_insee,
            engagements: [],
            maxMaturity: 0,
            hasCharter: false,
            hasActive: false,
          });
        }
        const c = communeMap.get(key);
        c.engagements.push(lead);
        c.maxMaturity = Math.max(c.maxMaturity, lead.maturity_level);
        if (lead.accepted_charter) c.hasCharter = true;
        if (lead.status === "active") c.hasActive = true;
      });

      setEngagements(Array.from(communeMap.values()));

      // Stats globales
      const { data: statsData } = await getSupabase()
        .from("transparency_leads_dashboard")
        .select("*")
        .single();
      setStats(statsData);
    } catch (err) {
      console.error("Erreur:", err);
    } finally {
      setLoading(false);
    }
  }

  const filteredEngagements = engagements.filter((e) => {
    if (filter === "charter") return e.hasCharter;
    if (filter === "active") return e.hasActive;
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="flex items-center gap-2 text-blue-200 text-sm mb-4">
            <Link to="/" className="hover:text-white">
              Accueil
            </Link>
            <span>/</span>
            <Link to="/transparence" className="hover:text-white">
              Transparence
            </Link>
            <span>/</span>
            <span>Communes engagées</span>
          </div>

          <h1 className="text-4xl font-bold mb-4">🏅 Communes engagées pour la Transparence</h1>
          <p className="text-xl text-blue-100 max-w-3xl">
            Ces communes, listes électorales et citoyens ont pris l'engagement concret de la
            transparence municipale. Rejoignez le mouvement !
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            <div className="bg-white rounded-xl p-6 shadow-sm text-center">
              <div className="text-4xl font-bold text-blue-600">
                {stats.communes_couvertes || 0}
              </div>
              <div className="text-gray-500">Communes</div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm text-center">
              <div className="text-4xl font-bold text-green-600">
                {stats.signataires_charte || 0}
              </div>
              <div className="text-gray-500">Signataires charte</div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm text-center">
              <div className="text-4xl font-bold text-purple-600">
                {stats.listes_electorales || 0}
              </div>
              <div className="text-gray-500">Listes électorales</div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm text-center">
              <div className="text-4xl font-bold text-orange-600">{stats.actifs || 0}</div>
              <div className="text-gray-500">Instances actives</div>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="bg-gradient-to-r from-yellow-100 to-yellow-50 border border-yellow-200 rounded-2xl p-8 mb-12 text-center">
          <h2 className="text-2xl font-bold mb-4">Votre commune n'est pas dans la liste ?</h2>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            Que vous soyez maire, candidat aux municipales, association ou simple citoyen, vous
            pouvez initier la démarche transparence dans votre commune.
          </p>
          <Link
            to="/engagement"
            className="inline-block px-8 py-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition"
          >
            🚀 Engager ma commune
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === "all"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Toutes ({engagements.length})
          </button>
          <button
            onClick={() => setFilter("charter")}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === "charter"
                ? "bg-green-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            🏅 Charte signée ({engagements.filter((e) => e.hasCharter).length})
          </button>
          <button
            onClick={() => setFilter("active")}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === "active"
                ? "bg-purple-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            🌳 Instance active ({engagements.filter((e) => e.hasActive).length})
          </button>
        </div>

        {/* Liste des communes */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Chargement...</div>
        ) : filteredEngagements.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🌱</div>
            <h3 className="text-xl font-bold mb-2">Soyez le premier !</h3>
            <p className="text-gray-500 mb-6">
              Aucune commune encore engagée dans votre région. Initiez le mouvement !
            </p>
            <Link
              to="/engagement"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Engager ma commune
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEngagements.map((commune, idx) => {
              const maturity = MATURITY_LABELS[commune.maxMaturity] || MATURITY_LABELS[1];
              const colors = MATURITY_COLORS[commune.maxMaturity] || MATURITY_COLORS[1];

              return (
                <div
                  key={idx}
                  className={`bg-white rounded-xl shadow-sm border-2 ${colors.border} overflow-hidden`}
                >
                  <div className={`${colors.bg} px-4 py-3 flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{maturity.icon}</span>
                      <span className={`font-medium ${colors.text}`}>{maturity.name}</span>
                    </div>
                    {commune.hasCharter && (
                      <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full">
                        Charte ✓
                      </span>
                    )}
                  </div>

                  <div className="p-4">
                    <h3 className="font-bold text-lg mb-1">{commune.commune}</h3>
                    {commune.insee && (
                      <div className="text-xs text-gray-400 mb-3">INSEE: {commune.insee}</div>
                    )}

                    <div className="space-y-2">
                      {commune.engagements.slice(0, 3).map((eng, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span>
                            {eng.lead_type === "liste_electorale"
                              ? "🗳️"
                              : eng.lead_type === "maire_elu"
                                ? "🏛️"
                                : eng.lead_type === "collectif_citoyen"
                                  ? "✊"
                                  : "🙋"}
                          </span>
                          <span className="text-gray-600">
                            {eng.organization_name ||
                              (eng.lead_type === "liste_electorale"
                                ? "Liste électorale"
                                : eng.lead_type === "maire_elu"
                                  ? "Élu(e)"
                                  : eng.lead_type === "collectif_citoyen"
                                    ? "Collectif citoyen"
                                    : "Citoyen engagé")}
                          </span>
                          {eng.status === "active" && (
                            <span className="text-green-600 text-xs">● Actif</span>
                          )}
                        </div>
                      ))}
                      {commune.engagements.length > 3 && (
                        <div className="text-xs text-gray-400">
                          + {commune.engagements.length - 3} autre(s)
                        </div>
                      )}
                    </div>
                  </div>

                  {commune.hasActive && (
                    <div className="px-4 pb-4">
                      <a
                        href={`https://${commune.commune.toLowerCase().replace(/\s+/g, "-")}.transparence.corsica`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full py-2 bg-blue-600 text-white text-center rounded-lg hover:bg-blue-700 text-sm"
                      >
                        Voir l'instance →
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Explication des niveaux */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold mb-8 text-center">
            Comprendre les niveaux d'engagement
          </h2>

          <div className="grid md:grid-cols-4 gap-6">
            {Object.entries(MATURITY_LABELS).map(([level, info]) => {
              const colors = MATURITY_COLORS[level];
              return (
                <div key={level} className={`${colors.bg} border ${colors.border} rounded-xl p-6`}>
                  <div className="text-4xl mb-3">{info.icon}</div>
                  <h3 className={`font-bold text-lg ${colors.text}`}>{info.name}</h3>
                  <p className="text-sm text-gray-600 mt-2">
                    {level === "1" && "A manifesté son intérêt pour la démarche transparence"}
                    {level === "2" && "S'est engagé publiquement et a signé la charte"}
                    {level === "3" && "A déployé une instance transparence opérationnelle"}
                    {level === "4" && "Publie régulièrement des données, répond aux citoyens"}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Charte */}
        <section className="mt-16 bg-gradient-to-br from-blue-900 to-indigo-900 text-white rounded-2xl p-8 md:p-12">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">🏅 La Charte Transparence</h2>
            <p className="text-blue-200 mb-8">
              Les signataires s'engagent sur 8 points concrets et mesurables
            </p>

            <div className="grid md:grid-cols-2 gap-4 text-left mb-8">
              {[
                "Publier l'ordre du jour 7 jours avant",
                "Diffuser les délibérations sous 48h",
                "Rendre le budget lisible",
                "Répondre aux citoyens sous 15 jours",
                "Publier les déclarations d'intérêts",
                "Ouvrir les marchés publics",
                "Permettre les signalements citoyens",
                "Organiser 2 consultations/an minimum",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 bg-white/10 rounded-lg p-3">
                  <span className="text-yellow-400">✓</span>
                  <span className="text-sm">{item}</span>
                </div>
              ))}
            </div>

            <Link
              to="/engagement"
              className="inline-block px-8 py-4 bg-yellow-400 text-gray-900 font-bold rounded-lg hover:bg-yellow-300 transition"
            >
              Signer la charte →
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
