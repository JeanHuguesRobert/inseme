import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getSupabase } from "../lib/supabase.js";
import {
  CITY_NAME,
  HASHTAG,
  COMMUNITY_NAME,
  COMMUNITY_TYPE,
  getCommunityLabels,
} from "../constants.js";
import {
  getCommunityTransparencyCriteria,
  calculateTransparencyScore,
} from "../config/transparencyCriteria.js";
import SiteFooter from "../components/layout/SiteFooter";

// Obtenir les critères dynamiques basés sur le type de communauté
const communityConfig = getCommunityTransparencyCriteria(COMMUNITY_TYPE);
const communityLabels = getCommunityLabels();

const CRITERIA = communityConfig.criteria.map((criterion) => ({
  key: criterion.id,
  label: criterion.description,
  weight: criterion.weight,
}));

const initialFormState = {
  id: null,
  commune_name: "",
  insee_code: "",
  population: "",
  agenda_mentions_location: false,
  livestreamed: false,
  minutes_published_under_week: false,
  deliberations_open_data: false,
  annual_calendar_published: false,
  public_can_speak: false,
  contact_email: "",
  submitted_by: "",
  notes: "",
};

const scoreColor = (score) => {
  if (score >= 5) return "text-green-600";
  if (score >= 3) return "text-orange-500";
  return "text-red-600";
};

const formatScore = (score) => `${score}/6`;

export default function Transparence() {
  const [communes, setCommunes] = useState([]);
  const [selectedCommune, setSelectedCommune] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState(initialFormState);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const isCorte = String(CITY_NAME || "").toLowerCase() === "corte";

  const computeScore = (entry) =>
    CRITERIA.reduce((total, criterion) => total + (entry?.[criterion.key] ? 1 : 0), 0);

  useEffect(() => {
    const fetchData = async () => {
      if (!isCorte) {
        setLoading(false);
        return;
      }
      if (!getSupabase()) {
        setError(
          "La connexion à la base de données est indisponible. Vérifiez la configuration Supabase."
        );
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data, error: dbError } = await getSupabase()
        .from("municipal_transparency")
        .select("*")
        .order("commune_name");

      if (dbError) {
        console.error(dbError);
        setError("Impossible de charger les données de transparence municipale.");
      } else {
        const enriched = data.map((entry) => ({
          ...entry,
          score: computeScore(entry),
        }));
        setCommunes(enriched);

        const defaultCommune = String(CITY_NAME || "").toLowerCase();
        if (defaultCommune) {
          const match = enriched.find(
            (entry) => entry.commune_name && entry.commune_name.toLowerCase() === defaultCommune
          );
          if (match) {
            setSelectedCommune(match);
            setSearchTerm(match.commune_name);
          }
        }
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  if (!isCorte) {
    return (
      <div className="min-h-screen ">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-4">{communityConfig.title}</h1>
          <p className="text-slate-700 mb-6">
            Cette enquête de {communityLabels.transparency} est rendue disponible dans la{" "}
            {communityLabels.name} de {COMMUNITY_NAME}.
          </p>
          <a
            href={communityConfig.externalLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Accéder au site officiel de ${COMMUNITY_NAME} (nouvelle fenêtre)`}
            className="inline-block px-4 py-2 bg-blue-900 text-bauhaus-white hover:bg-blue-800"
          >
            Accéder au site de {COMMUNITY_NAME}
          </a>
        </div>
      </div>
    );
  }

  const nationalAverage = useMemo(() => {
    const eligible = communes.filter((commune) => (commune.population ?? 0) >= 3500);
    if (!eligible.length) return null;
    const total = eligible.reduce((sum, commune) => sum + (commune.score ?? 0), 0);
    return (total / eligible.length).toFixed(1);
  }, [communes]);

  const cityScore = useMemo(() => {
    if (!communes.length) return null;
    const target = String(CITY_NAME || "").toLowerCase();
    const commune = communes.find(
      (entry) => entry.commune_name && entry.commune_name.toLowerCase() === target
    );
    return commune ? commune.score : null;
  }, [communes]);

  const handleCommuneSelection = (name) => {
    setSearchTerm(name);
    const normalizedName = (name || "").toLowerCase();
    const entry = communes.find(
      (commune) => commune.commune_name && commune.commune_name.toLowerCase() === normalizedName
    );
    if (entry) {
      setSelectedCommune(entry);
      setFormData({ ...initialFormState, ...entry, population: entry.population ?? "" });
    } else {
      setSelectedCommune(null);
      setFormData({ ...initialFormState, commune_name: name, population: "" });
    }
  };

  const handleToggleForm = () => {
    setFormOpen((prev) => !prev);
    setSuccessMessage("");
    if (!formOpen) {
      const baseData = selectedCommune
        ? { ...selectedCommune, population: selectedCommune.population ?? "" }
        : { commune_name: searchTerm, population: "" };

      setFormData({
        ...initialFormState,
        ...baseData,
      });
    }
  };

  const handleCheckboxChange = (key) => {
    setFormData((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "population" && value !== "" ? Number(value) : value,
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!getSupabase()) {
      setError("Configuration Supabase manquante : impossible d'enregistrer les données.");
      return;
    }

    if (!formData.commune_name) {
      setError("Veuillez indiquer le nom de votre commune.");
      return;
    }

    if (formData.population && formData.population < 3500) {
      setError("Cet outil est dédié aux communes de plus de 3 500 habitants.");
      return;
    }

    setSaving(true);

    const payload = {
      ...formData,
      id: formData.id || undefined,
      population: formData.population === "" ? null : formData.population,
    };

    const { data, error: dbError } = await getSupabase()
      .from("municipal_transparency")
      .upsert(payload, { returning: "representation" });

    setSaving(false);

    if (dbError) {
      console.error(dbError);
      setError("L'enregistrement a échoué. Merci de réessayer ou de contacter l'équipe.");
      return;
    }

    if (data && data.length) {
      const updatedEntry = { ...data[0], score: computeScore(data[0]) };
      setSelectedCommune(updatedEntry);
      setSearchTerm(updatedEntry.commune_name);
      setFormData({
        ...initialFormState,
        ...updatedEntry,
        population: updatedEntry.population ?? "",
      });

      setCommunes((prev) => {
        const exists = prev.some((item) => item.id === updatedEntry.id);
        if (exists) {
          return prev.map((item) => (item.id === updatedEntry.id ? updatedEntry : item));
        }
        return [...prev, updatedEntry].sort((a, b) => a.commune_name.localeCompare(b.commune_name));
      });
    }

    setSuccessMessage(
      "Merci ! Votre contribution enrichit la base nationale de la transparence municipale."
    );
    setFormOpen(false);
  };

  return (
    <div className="min-h-screen">
      <div className="shadow-sm border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-10 text-center">
          <p className="text-sm  tracking-[0.4em] text-slate-500 font-semibold mb-3">
            {HASHTAG} - Observatoire citoyen
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            VOTRE {communityLabels.name.toUpperCase()} EST-ELLE TRANSPARENTE ?
          </h1>
          <p className="text-slate-600 max-w-2xl mx-auto">{communityConfig.description}</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">
        <section className="rounded-xl shadow p-6 md:p-8">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Scores de référence</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border border-slate-200   p-5 text-center">
              <p className="text-sm  text-slate-500 tracking-wide mb-2">Score {COMMUNITY_NAME}</p>
              <p className={`text-3xl font-bold ${scoreColor(cityScore ?? 0)}`}>
                {cityScore !== null
                  ? formatScore(cityScore)
                  : `0/${communityConfig.criteria.length}`}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Données collectées auprès des {communityLabels.citizens} de {COMMUNITY_NAME}.
              </p>
            </div>
            <div className="border border-slate-200   p-5 text-center">
              <p className="text-sm  text-slate-500 tracking-wide mb-2">Score moyen</p>
              <p
                className={`text-3xl font-bold ${scoreColor(nationalAverage ? Number(nationalAverage) : 3.2)}`}
              >
                {nationalAverage
                  ? `${nationalAverage}/${communityConfig.criteria.length}`
                  : `3.2/${communityConfig.criteria.length}`}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Calculé sur les {communityLabels.name}s enregistrées dans la base.
              </p>
            </div>
            <div className="border border-slate-200   p-5 text-center">
              <p className="text-sm  text-slate-500 tracking-wide mb-2">Votre commune</p>
              <p className={`text-3xl font-bold ${scoreColor(selectedCommune?.score ?? 0)}`}>
                {selectedCommune ? formatScore(selectedCommune.score) : "Sélectionnez"}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Complétez le formulaire pour mesurer et partager votre score.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl shadow p-6 md:p-8 space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Votre commune</h2>
            <p className="text-sm text-slate-600 mb-4">
              Cherchez votre commune ou ajoutez-la pour enrichir l\'observatoire.
            </p>
            <div className="flex flex-col md:flex-row gap-3 md:items-center">
              <div className="flex-1">
                <label className="sr-only" htmlFor="commune">
                  Nom de votre commune
                </label>
                <input
                  id="commune"
                  list="commune-list"
                  className="w-full   border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder={`Ex : Marseille, Nantes, ${CITY_NAME}`}
                  value={searchTerm}
                  onChange={(event) => handleCommuneSelection(event.target.value)}
                />
                <datalist id="commune-list">
                  {communes.map((commune) => (
                    <option key={commune.id} value={commune.commune_name} />
                  ))}
                </datalist>
              </div>
              <button
                type="button"
                onClick={() => handleCommuneSelection(searchTerm)}
                className="px-4 py-2   bg-orange-500 text-bauhaus-white font-semibold hover:bg-orange-600"
              >
                Tester
              </button>
              <button
                type="button"
                onClick={handleToggleForm}
                className="px-4 py-2   border border-orange-500 text-orange-600 font-semibold hover:bg-orange-50"
              >
                {formOpen ? "Fermer le formulaire" : "Contribuer"}
              </button>
            </div>
            {loading && <p className="text-sm text-slate-500 mt-3">Chargement des communes...</p>}
            {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
            {successMessage && <p className="text-sm text-green-600 mt-3">{successMessage}</p>}
          </div>

          <div className="border border-dashed border-slate-200   p-5">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Checklist transparence</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {CRITERIA.map((criterion) => (
                <label
                  key={criterion.key}
                  className="flex items-start gap-3   border border-slate-200 p-4"
                >
                  <input
                    type="checkbox"
                    checked={selectedCommune ? Boolean(selectedCommune[criterion.key]) : false}
                    readOnly
                    className="mt-1 h-5 w-5 border-slate-300 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-slate-700">{criterion.label}</span>
                </label>
              ))}
            </div>
          </div>
        </section>

        {formOpen && (
          <section className="rounded-xl shadow p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Créer ou mettre à jour une fiche
                </h2>
                <p className="text-sm text-slate-600">
                  Renseignez les pratiques de votre mairie pour contribuer à la base nationale.
                </p>
              </div>
              <a
                href="https://airtable.com/shrvzTJ6o7p2gqZW8"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-orange-600 hover:text-orange-700"
              >
                Besoin d\'aide ? Consultez notre guide méthodologique
              </a>
            </div>

            <form className="space-y-6" onSubmit={handleSave}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label
                    className="block text-sm font-medium text-slate-700 mb-1"
                    htmlFor="commune_name"
                  >
                    Nom de la commune
                  </label>
                  <input
                    id="commune_name"
                    name="commune_name"
                    className="w-full   border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    value={formData.commune_name}
                    onChange={handleInputChange}
                    placeholder={`Ex : ${CITY_NAME}`}
                    required
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-slate-700 mb-1"
                    htmlFor="insee_code"
                  >
                    Code INSEE (facultatif)
                  </label>
                  <input
                    id="insee_code"
                    name="insee_code"
                    className="w-full   border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    value={formData.insee_code || ""}
                    onChange={handleInputChange}
                    placeholder="2B097"
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-slate-700 mb-1"
                    htmlFor="population"
                  >
                    Population (≥ 3 500)
                  </label>
                  <input
                    id="population"
                    name="population"
                    type="number"
                    min="0"
                    className="w-full   border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    value={formData.population === "" ? "" : formData.population}
                    onChange={handleInputChange}
                    placeholder="8000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {CRITERIA.map((criterion) => (
                  <label
                    key={criterion.key}
                    className="flex items-start gap-3   border border-slate-200 p-4"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 border-slate-300 text-orange-500 focus:ring-orange-500"
                      checked={Boolean(formData[criterion.key])}
                      onChange={() => handleCheckboxChange(criterion.key)}
                    />
                    <span className="text-sm text-slate-700">{criterion.label}</span>
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    className="block text-sm font-medium text-slate-700 mb-1"
                    htmlFor="submitted_by"
                  >
                    Source ou collectif (facultatif)
                  </label>
                  <input
                    id="submitted_by"
                    name="submitted_by"
                    className="w-full   border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    value={formData.submitted_by || ""}
                    onChange={handleInputChange}
                    placeholder={`Collectif citoyen ${CITY_NAME}`}
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-slate-700 mb-1"
                    htmlFor="contact_email"
                  >
                    Contact (facultatif)
                  </label>
                  <input
                    id="contact_email"
                    name="contact_email"
                    type="email"
                    className="w-full   border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    value={formData.contact_email || ""}
                    onChange={handleInputChange}
                    placeholder="collectif@example.org"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="notes">
                  Notes complémentaires (facultatif)
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  className="w-full   border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  value={formData.notes || ""}
                  onChange={handleInputChange}
                  placeholder="Précisez vos sources, liens vers les documents, modalités d\'accès..."
                />
              </div>

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <p className="text-sm text-slate-500">
                  → En contribuant, vous participez à la création d\'une base de données nationale
                  de la transparence municipale.
                </p>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5   bg-orange-500 text-bauhaus-white font-semibold hover:bg-orange-600 disabled:opacity-60"
                >
                  {saving ? "Enregistrement..." : "Publier / Mettre à jour"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="rounded-xl shadow p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Communes référencées</h2>
              <p className="text-sm text-slate-600">
                {communes.length} commune{communes.length > 1 ? "s" : ""} contribuent déjà à
                l\'observatoire.
              </p>
            </div>
            <Link to="/methodologie" className="text-sm text-orange-600 hover:text-orange-700">
              Découvrir notre méthodologie
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border border-slate-200 divide-y divide-slate-200 text-sm">
              <thead className="">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-slate-600">Commune</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-600">Population</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-600">Score</th>
                  {CRITERIA.map((criterion) => (
                    <th
                      key={criterion.key}
                      className="px-4 py-2 text-left font-semibold text-slate-600"
                    >
                      {criterion.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {communes.map((commune) => (
                  <tr key={commune.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-800">{commune.commune_name}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {commune.population ? commune.population.toLocaleString("fr-FR") : "—"}
                    </td>
                    <td className={`px-4 py-2 font-semibold ${scoreColor(commune.score)}`}>
                      {formatScore(commune.score)}
                    </td>
                    {CRITERIA.map((criterion) => (
                      <td key={criterion.key} className="px-4 py-2 text-slate-600">
                        {commune[criterion.key] ? "✅" : "❌"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="mt-8 flex flex-col items-center">
        <Link
          to="/contact"
          className="inline-block px-4 py-2 mb-4 bg-blue-600 text-bauhaus-white hover:bg-blue-700 font-semibold shadow"
        >
          Contactez-nous
        </Link>
        <SiteFooter />
      </div>
    </div>
  );
}
