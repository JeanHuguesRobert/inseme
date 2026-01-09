// src/pages/consultations/ConsultationQuasquara.jsx
// Consultation citoyenne spécifique : L'affaire de Quasquara (Corte)
// Date de création : Décembre 2024

import { useState, useEffect, useCallback } from "react";
import ConsultationLayout, {
  PieChartSection,
  BarChartSection,
  ScoreSection,
} from "../../components/consultations/ConsultationLayout";
import { ShareCallToAction, ShareButton } from "@inseme/brique-kudocracy";
import FilNewsFeed from "../../components/fil/FilNewsFeed";
import { getDynamicConfig, getCommunityLabels } from "../../constants.js";
import {
  getCommunityQuestionnaireModules,
  generateInitialFormState,
} from "../../config/questionnaireModules.js";
import {
  getConsultationBySlug,
  submitConsultationResponse,
  calculateResponseStats,
  formatStatsForChart,
  hasAlreadyResponded,
  generateSessionId,
  validateResponses,
  saveDraft,
  loadDraft,
  clearDraft,
  formatDraftDate,
} from "../../lib/consultations.js";
import { useCurrentUser } from "@inseme/cop-host";

// Slug de cette consultation
const CONSULTATION_SLUG = "quasquara-2024";

export default function ConsultationQuasquara() {
  const { currentUser } = useCurrentUser();
  const config = getDynamicConfig();
  const { cityName, movementName, communityName, communityType } = config;
  const baseInitialState = generateInitialFormState(communityType);
  const [formData, setFormData] = useState({
    ...baseInitialState,
    satisfactionDemocratie: baseInitialState.satisfactionDemocratie ?? 3,
    declinVille: 3,
    favorableReferendum: "",
    sujetsReferendum: [],
    inscritListe: "",
    quartier: "",
    age: "",
    dureeHabitation: "",
    email: "",
    participationEtudeIA: false,
    horaireConseil: "",
    commentaire: "",
  });
  const [responses, setResponses] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState([]);
  const [consultation, setConsultation] = useState(null);
  const [alreadyResponded, setAlreadyResponded] = useState(false);
  const [useSupabase, setUseSupabase] = useState(true);
  const [sessionId] = useState(() => generateSessionId());
  const [draftInfo, setDraftInfo] = useState(null);
  const [draftRestored, setDraftRestored] = useState(false);

  const isCorte = String(cityName || "").toLowerCase() === "corte";
  const modules = getCommunityQuestionnaireModules(communityType);

  // Charger la consultation depuis Supabase
  useEffect(() => {
    async function loadConsultation() {
      const data = await getConsultationBySlug(CONSULTATION_SLUG);
      if (data) {
        setConsultation(data);
        setUseSupabase(true);
      } else {
        // Fallback: Supabase non disponible, utiliser Google Sheets
        setUseSupabase(false);
      }
    }
    loadConsultation();
  }, []);

  // Charger le brouillon au démarrage
  useEffect(() => {
    const draft = loadDraft(CONSULTATION_SLUG);
    if (draft && !alreadyResponded) {
      setFormData((prev) => ({ ...prev, ...draft.responses }));
      setDraftInfo(draft);
      setDraftRestored(true);
      // Masquer le message après 5 secondes
      setTimeout(() => setDraftRestored(false), 5000);
    }
  }, [alreadyResponded]);

  // Sauvegarder le brouillon automatiquement (debounced)
  const saveDraftDebounced = useCallback(() => {
    if (!alreadyResponded && !submitted) {
      const saved = saveDraft(CONSULTATION_SLUG, formData);
      if (saved) {
        setDraftInfo({ savedAt: new Date().toISOString() });
      }
    }
  }, [formData, alreadyResponded, submitted]);

  useEffect(() => {
    const timer = setTimeout(saveDraftDebounced, 2000);
    return () => clearTimeout(timer);
  }, [formData, saveDraftDebounced]);

  // Vérifier si l'utilisateur a déjà répondu
  useEffect(() => {
    async function checkExistingResponse() {
      if (!consultation?.id) return;

      const hasResponded = await hasAlreadyResponded(consultation.id, {
        userId: currentUser?.id,
        sessionId,
      });
      setAlreadyResponded(hasResponded);
    }
    checkExistingResponse();
  }, [consultation?.id, currentUser?.id, sessionId]);

  // Charger les réponses
  useEffect(() => {
    loadResponses();
  }, [consultation?.id, useSupabase]);

  const loadResponses = async () => {
    if (useSupabase && consultation?.id) {
      // Charger depuis Supabase
      const stats = await calculateResponseStats(consultation.id);
      if (stats) {
        // Convertir les stats en format compatible avec le code existant
        setResponses(convertSupabaseStatsToResponses(stats));
        return;
      }
    }

    // Fallback: charger depuis Google Sheets
    await loadResponsesFromGoogleSheets();
  };

  const loadResponsesFromGoogleSheets = async () => {
    try {
      const response = await fetch(GOOGLE_SCRIPT_URL);
      const data = await response.json();

      if (data.success && data.data) {
        const formattedResponses = data.data.map((row) => ({
          connaissanceQuasquara: row["Connaissance Quasquara"] || "",
          positionQuasquara: row["Position Quasquara"] || "",
          quiDecide: row["Qui décide"] || "",
          satisfactionDemocratie: parseInt(row["Satisfaction Démocratie"]) || 3,
          favorableReferendum: row["Favorable Référendum"] || "",
          horaireConseil: row["Horaire Conseil"] || "",
          declinVille: parseInt(row["Déclin Ville"]) || 3,
          sujetsReferendum: row["Sujets Référendum"] ? row["Sujets Référendum"].split(", ") : [],
          age: row["Âge"] || "",
          dureeHabitation: row["Durée Habitation"] || "",
        }));
        setResponses(formattedResponses);
      }
    } catch (err) {
      console.error("Erreur chargement:", err);
      // En cas d'erreur, utiliser des données de démo
      setResponses([
        {
          connaissanceQuasquara: "Oui",
          positionQuasquara: "Maintien",
          quiDecide: "Référendum des habitants",
          satisfactionDemocratie: 2,
          favorableReferendum: "Oui",
          sujetsReferendum: ["culture", "patrimoine"],
          age: "41-60",
          dureeHabitation: ">10 ans",
        },
      ]);
    }
  };

  // Convertir les stats Supabase en format compatible
  const convertSupabaseStatsToResponses = (stats) => {
    // Créer des réponses synthétiques à partir des stats agrégées
    const responses = [];
    const totalResponses = stats.totalResponses || 0;

    // Reconstruire les réponses à partir des stats
    for (let i = 0; i < totalResponses; i++) {
      responses.push({
        // Les vraies valeurs seront calculées depuis stats.byField
        _synthetic: true,
      });
    }

    // Stocker les stats brutes pour le calcul
    responses._stats = stats;
    return responses;
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === "checkbox" && name === "sujetsReferendum") {
      setFormData((prev) => ({
        ...prev,
        sujetsReferendum: checked
          ? [...prev.sujetsReferendum, value]
          : prev.sujetsReferendum.filter((s) => s !== value),
      }));
    } else if (type === "checkbox") {
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async () => {
    if (alreadyResponded) {
      setError("Vous avez déjà participé à cette consultation.");
      return;
    }

    // Validation des réponses
    if (consultation?.schema) {
      const { valid, errors } = validateResponses(formData, consultation.schema);
      setValidationErrors(errors);
      if (!valid) {
        setError(`Veuillez corriger les ${errors.length} erreur(s) dans le formulaire.`);
        // Scroll vers la première erreur
        const firstErrorField = document.querySelector(`[name="${errors[0]?.field}"]`);
        if (firstErrorField) {
          firstErrorField.scrollIntoView({ behavior: "smooth", block: "center" });
          firstErrorField.focus();
        }
        return;
      }
    }

    setFormLoading(true);
    setError("");
    setValidationErrors([]);

    try {
      if (useSupabase && consultation?.id) {
        // Soumettre à Supabase
        const result = await submitConsultationResponse(consultation.id, formData, {
          userId: currentUser?.id,
          sessionId,
          metadata: {
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
          },
        });

        if (!result.success) {
          if (result.error === "duplicate") {
            setError("Vous avez déjà participé à cette consultation.");
            setAlreadyResponded(true);
          } else {
            throw new Error(result.error || "Erreur lors de l'envoi");
          }
          setFormLoading(false);
          return;
        }
      } else {
        // Fallback: soumettre à Google Sheets
        await fetch(GOOGLE_SCRIPT_URL, {
          method: "POST",
          mode: "no-cors",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        });
      }

      // Succès : supprimer le brouillon
      clearDraft(CONSULTATION_SLUG);
      setDraftInfo(null);

      setSubmitted(true);
      setAlreadyResponded(true);

      setTimeout(async () => {
        await loadResponses();
        setSubmitted(false);
        setFormLoading(false);
      }, 2000);
    } catch (err) {
      console.error("Erreur soumission:", err);
      setError("Erreur lors de l'envoi. Veuillez réessayer.");
      setFormLoading(false);
    }
  };

  // Helper pour vérifier si un champ a une erreur
  const getFieldError = (fieldId) => {
    return validationErrors.find((e) => e.field === fieldId)?.message;
  };

  const calculateStats = () => {
    if (responses.length === 0) return null;

    const connaissanceData = [
      { name: "Oui", value: responses.filter((r) => r.connaissanceQuasquara === "Oui").length },
      { name: "Non", value: responses.filter((r) => r.connaissanceQuasquara === "Non").length },
    ];

    const positionData = [
      {
        name: "Maintien",
        value: responses.filter((r) => r.positionQuasquara === "Maintien").length,
      },
      { name: "Retrait", value: responses.filter((r) => r.positionQuasquara === "Retrait").length },
      { name: "Sans avis", value: responses.filter((r) => r.positionQuasquara === "Sans").length },
    ];

    const decisionData = [
      { name: "Justice", value: responses.filter((r) => r.quiDecide === "Justice").length },
      { name: "Élus locaux", value: responses.filter((r) => r.quiDecide === "Élus locaux").length },
      {
        name: "Référendum",
        value: responses.filter((r) => r.quiDecide === "Référendum des habitants").length,
      },
      { name: "Autre", value: responses.filter((r) => r.quiDecide === "Autre").length },
    ];

    const horaireConseilData = [
      { name: "Oui", value: responses.filter((r) => r.horaireConseil === "Oui").length },
      { name: "Non", value: responses.filter((r) => r.horaireConseil === "Non").length },
      {
        name: "Je ne sais pas",
        value: responses.filter((r) => r.horaireConseil === "Je ne sais pas").length,
      },
      {
        name: "Je préfère ne pas répondre",
        value: responses.filter((r) => r.horaireConseil === "Je préfère ne pas répondre").length,
      },
    ];

    const satisfactionMoyenne =
      responses.reduce((acc, r) => acc + r.satisfactionDemocratie, 0) / responses.length;
    const declinMoyen =
      responses.reduce((acc, r) => acc + parseInt(r.declinVille || 3), 0) / responses.length;

    const referendumData = [
      { name: "Oui", value: responses.filter((r) => r.favorableReferendum === "Oui").length },
      { name: "Non", value: responses.filter((r) => r.favorableReferendum === "Non").length },
      {
        name: "Selon sujets",
        value: responses.filter((r) => r.favorableReferendum === "Selon").length,
      },
    ];

    const sujetsCount = {};
    responses.forEach((r) => {
      r.sujetsReferendum.forEach((sujet) => {
        sujetsCount[sujet] = (sujetsCount[sujet] || 0) + 1;
      });
    });
    const sujetsData = Object.entries(sujetsCount).map(([name, value]) => ({ name, value }));

    return {
      connaissanceData,
      positionData,
      decisionData,
      horaireConseilData,
      satisfactionMoyenne,
      declinMoyen,
      referendumData,
      sujetsData,
      totalResponses: responses.length,
    };
  };

  const stats = calculateStats();

  // Contenu du formulaire
  const formContent = isCorte ? (
    <>
      <FilNewsFeed limit={5} />
      <div className="consultation-header">
        <h1 className="page-title">
          Consultation {getCommunityLabels().citizens} sur la démocratie locale
        </h1>
        <ShareButton
          consultation={{ slug: CONSULTATION_SLUG, title: "L'affaire de Quasquara" }}
          scope="local"
          stats={{ totalResponses: stats?.totalResponses || responses.length }}
        />
      </div>
      <p className="section-description">
          Une initiative {movementName} pour la {getCommunityLabels().name} de {communityName}
        </p>

      {/* Message de brouillon restauré */}
      {draftRestored && draftInfo && (
        <div className="consultation-draft-banner">
          <span>📝 Brouillon restauré (sauvegardé {formatDraftDate(draftInfo.savedAt)})</span>
          <button
            type="button"
            onClick={() => {
              clearDraft(CONSULTATION_SLUG);
              setDraftInfo(null);
              setDraftRestored(false);
              // Reset form
              setFormData({
                ...baseInitialState,
                satisfactionDemocratie: baseInitialState.satisfactionDemocratie ?? 3,
                declinVille: 3,
                favorableReferendum: "",
                sujetsReferendum: [],
                inscritListe: "",
                quartier: "",
                age: "",
                dureeHabitation: "",
                email: "",
                participationEtudeIA: false,
                horaireConseil: "",
                commentaire: "",
              });
            }}
            className="draft-clear-btn"
          >
            Recommencer
          </button>
        </div>
      )}

      {/* Indicateur de sauvegarde automatique */}
      {draftInfo && !draftRestored && !alreadyResponded && !submitted && (
        <div className="consultation-autosave-indicator">💾 Sauvegardé automatiquement</div>
      )}

      {error && <div className="consultation-error-banner">{error}</div>}

      {alreadyResponded && !submitted && (
        <>
          <div className="consultation-info-banner">
            <p>✅ Vous avez déjà participé à cette consultation. Merci pour votre contribution !</p>
            <p>Consultez les résultats en temps réel ci-dessous.</p>
          </div>
          <ShareCallToAction
            consultation={{ slug: CONSULTATION_SLUG, title: "L'affaire de Quasquara" }}
            scope="local"
            stats={{ totalResponses: stats?.totalResponses || responses.length }}
            message={`Aidez-nous à recueillir plus d'avis ! ${stats?.totalResponses || responses.length} réponses jusqu'ici.`}
          />
        </>
      )}

      <div className="landing-content">
        {/* Modules de questionnaire dynamiques */}
        <div className="question-set">
          <h2 className="section-title">{modules.title}</h2>
          {modules.modules.map((module) => (
            <div key={module.id} className="question-group">
              <h3 className="subsection-title">{module.title}</h3>
              {module.questions.map((q) => (
                <div key={q.id} className="question-group">
                  <label className="form-label">{q.label}</label>
                  {q.type === "radio" && (
                    <div className="choice-group">
                      {q.options.map((opt) => (
                        <label key={opt} className="choice-label">
                          <input
                            type="radio"
                            name={q.id}
                            value={opt}
                            checked={formData[q.id] === opt}
                            onChange={handleInputChange}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  )}
                  {q.type === "scale" && (
                    <div>
                      <div className="md:hidden">
                        <select
                          name={q.id}
                          value={formData[q.id] ?? 3}
                          onChange={handleInputChange}
                          className="w-full"
                        >
                          <option value="1">{q.labels?.[0] || "1"}</option>
                          <option value="2">{q.labels?.[1] || "2"}</option>
                          <option value="3">{q.labels?.[2] || "3"}</option>
                          <option value="4">{q.labels?.[3] || "4"}</option>
                          <option value="5">{q.labels?.[4] || "5"}</option>
                        </select>
                      </div>
                      <div className="hidden md:flex items-center space-x-4">
                        <span className="hint-text">{q.labels?.[0] || "1"}</span>
                        {[1, 2, 3, 4, 5].map((num) => (
                          <label key={num} className="choice-label">
                            <input
                              type="radio"
                              name={q.id}
                              value={num}
                              checked={Number(formData[q.id] ?? 3) === num}
                              onChange={handleInputChange}
                            />
                            {num}
                          </label>
                        ))}
                        <span className="hint-text">{q.labels?.[4] || "5"}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="bordered-section bordered-section-primary question-set">
          <h2 className="section-title">L'affaire de Quasquara</h2>

          <div className="question-group">
            <label className="form-label">
              Connaissez-vous la polémique sur la croix de Quasquara ?
            </label>
            <div className="choice-group">
              {["Oui", "Non"].map((option) => (
                <label key={option} className="choice-label">
                  <input
                    type="radio"
                    name="connaissanceQuasquara"
                    value={option}
                    checked={formData.connaissanceQuasquara === option}
                    onChange={handleInputChange}
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>

          <div className="question-group">
            <label className="form-label">Quelle est votre position sur cette affaire ?</label>
            <div className="choice-group">
              {[
                { label: "Maintien de la croix", value: "Maintien" },
                { label: "Retrait de la croix", value: "Retrait" },
                { label: "Sans avis", value: "Sans" },
                { label: "Je préfère ne pas répondre", value: "NoAnswer" },
              ].map((option) => (
                <label key={option.value} className="choice-label">
                  <input
                    type="radio"
                    name="positionQuasquara"
                    value={option.value}
                    checked={formData.positionQuasquara === option.value}
                    onChange={handleInputChange}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          <div className="question-group">
            <label className="form-label">Qui devrait décider dans ce type de situation ?</label>
            <div className="choice-group">
              {["Justice", "Élus locaux", "Référendum des habitants", "Autre"].map((option) => (
                <label key={option} className="choice-label">
                  <input
                    type="radio"
                    name="quiDecide"
                    value={option}
                    checked={formData.quiDecide === option}
                    onChange={handleInputChange}
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="bordered-section bordered-section-accent question-set">
          <h2 className="section-title">Démocratie {getCommunityLabels().name}</h2>

          <div className="question-group">
            <label className="form-label">
              Êtes-vous satisfait de la démocratie locale actuelle ?
            </label>
            <div className="md:hidden">
              <select
                name="satisfactionDemocratie"
                value={formData.satisfactionDemocratie}
                onChange={handleInputChange}
                className="w-full"
              >
                <option value="">Je préfère ne pas répondre</option>
                <option value="1">1 - Pas du tout satisfait</option>
                <option value="2">2 - Peu satisfait</option>
                <option value="3">3 - Moyennement satisfait</option>
                <option value="4">4 - Satisfait</option>
                <option value="5">5 - Très satisfait</option>
              </select>
            </div>
            <div className="hidden md:flex items-center space-x-4">
              <span className="hint-text">Pas du tout (1)</span>
              {[1, 2, 3, 4, 5].map((num) => (
                <label key={num} className="choice-label">
                  <input
                    type="radio"
                    name="satisfactionDemocratie"
                    value={num}
                    checked={Number(formData.satisfactionDemocratie) === num}
                    onChange={handleInputChange}
                  />
                  {num}
                </label>
              ))}
              <span className="hint-text">Très satisfait (5)</span>
            </div>
          </div>

          <div className="question-group">
            <label className="form-label">Pensez-vous que {cityName} est en déclin ?</label>
            <div className="md:hidden">
              <select
                name="declinVille"
                value={formData.declinVille}
                onChange={handleInputChange}
                className="w-full"
              >
                <option value="">Je préfère ne pas répondre</option>
                <option value="1">1 - En développement</option>
                <option value="2">2 - Plutôt en développement</option>
                <option value="3">3 - Stable</option>
                <option value="4">4 - Plutôt en déclin</option>
                <option value="5">5 - En fort déclin</option>
              </select>
            </div>
            <div className="hidden md:flex items-center space-x-4">
              <span className="hint-text">En développement (1)</span>
              {[1, 2, 3, 4, 5].map((num) => (
                <label key={num} className="choice-label">
                  <input
                    type="radio"
                    name="declinVille"
                    value={num}
                    checked={Number(formData.declinVille) === num}
                    onChange={handleInputChange}
                  />
                  {num}
                </label>
              ))}
              <span className="hint-text">En déclin (5)</span>
            </div>
          </div>

          <div className="question-group">
            <label className="form-label">
              Seriez-vous favorable à des référendums locaux sur des questions importantes ?
            </label>
            <div className="choice-group">
              {[
                { label: "Oui", value: "Oui" },
                { label: "Non", value: "Non" },
                { label: "Selon les sujets", value: "Selon" },
              ].map((option) => (
                <label key={option.value} className="choice-label">
                  <input
                    type="radio"
                    name="favorableReferendum"
                    value={option.value}
                    checked={formData.favorableReferendum === option.value}
                    onChange={handleInputChange}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          <div className="question-group">
            <label className="form-label">
              Sur quels sujets ces référendums devraient-ils porter ? (choix multiples)
            </label>
            <div className="choice-group">
              {["urbanisme", "culture", "budget", "environnement", "patrimoine", "autre"].map(
                (option) => (
                  <label key={option} className="choice-label">
                    <input
                      type="checkbox"
                      name="sujetsReferendum"
                      value={option}
                      checked={formData.sujetsReferendum.includes(option)}
                      onChange={handleInputChange}
                    />
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </label>
                )
              )}
            </div>
          </div>

          <div className="question-group">
            <label className="form-label">
              Les horaires actuels des conseils municipaux vous paraissent-ils pratiques ?
            </label>
            <div className="choice-group">
              {["Oui", "Non", "Je ne sais pas", "Je préfère ne pas répondre"].map((option) => (
                <label key={option} className="choice-label">
                  <input
                    type="radio"
                    name="horaireConseil"
                    value={option}
                    checked={formData.horaireConseil === option}
                    onChange={handleInputChange}
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="bordered-section bordered-section-primary question-set">
          <h2 className="section-title">
            Profil <span className="helper-text">(toutes les questions sont optionnelles)</span>
          </h2>

          <div className="question-group">
            <label className="form-label">
              Êtes-vous inscrit(e) sur les listes électorales à {cityName} ?
            </label>
            <div className="choice-group">
              {["Oui", "Non", "Pas encore (prochainement)"].map((opt) => (
                <label key={opt} className="choice-label">
                  <input
                    type="radio"
                    name="inscritListe"
                    value={opt}
                    checked={formData.inscritListe === opt}
                    onChange={handleInputChange}
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="question-group">
            <label className="form-label--emphasis">Quartier de {cityName}</label>
            <select
              name="quartier"
              value={formData.quartier}
              onChange={handleInputChange}
              className="w-full"
            >
              <option value="">Sélectionnez votre quartier...</option>
              {isCorte ? (
                <>
                  <option value="Centre-Ville / Haute-Ville">Centre-Ville / Haute-Ville</option>
                  <option value="Chabrières / Gare">Chabrières / Gare</option>
                  <option value="Porette / Lubertacce">Porette / Lubertacce</option>
                  <option value="St Pancrace / Baliri">St Pancrace / Baliri</option>
                  <option value="Borgu / Faubourg">Borgu / Faubourg</option>
                  <option value="Hameaux (Restonica, Tavignanu)">
                    Hameaux (Restonica, Tavignanu)
                  </option>
                </>
              ) : (
                <>
                  <option value="Centre">Centre / Cœur de ville</option>
                  <option value="Périphérie">Périphérie / Nouveaux quartiers</option>
                  <option value="Hameaux">Hameaux / Écarts</option>
                </>
              )}
            </select>
          </div>

          <div className="question-group">
            <label className="form-label">Tranche d'âge</label>
            <select name="age" value={formData.age} onChange={handleInputChange} className="w-full">
              <option value="">-- Sélectionnez --</option>
              <option value="18-25">18-25 ans</option>
              <option value="26-40">26-40 ans</option>
              <option value="41-60">41-60 ans</option>
              <option value="60+">60 ans et plus</option>
            </select>
          </div>

          <div className="question-group">
            <label className="form-label">Depuis combien de temps habitez-vous {cityName} ?</label>
            <select
              name="dureeHabitation"
              value={formData.dureeHabitation}
              onChange={handleInputChange}
              className="w-full"
            >
              <option value="">-- Sélectionnez --</option>
              <option value="<1 an">Moins d'1 an</option>
              <option value="1-5 ans">1 à 5 ans</option>
              <option value="5-10 ans">5 à 10 ans</option>
              <option value=">10 ans">Plus de 10 ans</option>
              <option value="toute ma vie">Toute ma vie</option>
            </select>
          </div>
        </div>

        <div className="bordered-section bordered-section-accent question-set">
          <div className="question-group">
            <label className="form-label">Commentaire libre</label>
            <textarea
              name="commentaire"
              value={formData.commentaire}
              onChange={handleInputChange}
              rows="4"
              className="w-full"
              placeholder="Vos suggestions, remarques..."
            />
          </div>

          <div className="info-box">
            <label className="form-label">
              Souhaitez-vous être tenu informé de nos propositions ?
            </label>
            <div className="choice-label">
              <input
                type="checkbox"
                name="accepteContact"
                checked={formData.accepteContact}
                onChange={handleInputChange}
              />
              <span>Oui, je souhaite être contacté</span>
            </div>
            {formData.accepteContact && (
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full mt-3"
                placeholder="Votre email"
              />
            )}

            <div className="choice-label mt-4">
              <input
                type="checkbox"
                name="participationEtudeIA"
                checked={formData.participationEtudeIA}
                onChange={handleInputChange}
              />
              <span>
                Je veux aussi participer à l'étude &quot;IA pour tous&quot;
                <span
                  className="ml-2 inline-block cursor-pointer text-primary hover:opacity-80"
                  title='Informations sur l&apos;étude "IA pour tous"'
                  onClick={() => window.open("https://www.ia-pour-tous.fr", "_blank")}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 inline"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={formLoading || alreadyResponded}
          className="btn btn-primary w-full py-3 px-6 text-lg"
        >
          {formLoading
            ? "Envoi en cours..."
            : alreadyResponded
              ? "Vous avez déjà participé"
              : "Envoyer votre réponse"}
        </button>
      </div>
    </>
  ) : (
    <div className="text-center p-8">
      <p className="hint-text">Cette consultation n'est pas disponible pour votre commune.</p>
    </div>
  );

  // Contenu des résultats
  const resultsContent = stats && (
    <div className="space-y-12">
      <PieChartSection
        title="Connaissance de l'affaire de Quasquara"
        data={stats.connaissanceData}
      />

      <BarChartSection data={stats.positionData} />

      <BarChartSection title="Qui devrait décider ?" data={stats.decisionData} color="#3B4E6B" />

      <ScoreSection
        title="Satisfaction de la démocratie locale"
        value={stats.satisfactionMoyenne}
        description="Note moyenne"
      />

      <ScoreSection
        title={`État de ${cityName}`}
        value={stats.declinMoyen}
        description="1 = En développement, 5 = En déclin"
      />

      <PieChartSection title="Favorable aux référendums locaux ?" data={stats.referendumData} />

      {stats.sujetsData.length > 0 && (
        <BarChartSection title="Sujets prioritaires pour les référendums" data={stats.sujetsData} />
      )}

      <PieChartSection
        title="Les horaires des conseils municipaux"
        data={stats.horaireConseilData}
      />

      {/* Partage en fin de résultats */}
      <ShareCallToAction
        consultation={{ slug: CONSULTATION_SLUG, title: "L'affaire de Quasquara" }}
        scope="local"
        stats={{ totalResponses: stats.totalResponses }}
        message="Plus il y a de réponses, plus les résultats sont représentatifs. Partagez !"
      />
    </div>
  );

  return (
    <ConsultationLayout
      title={`Questionnaire citoyen ${movementName}`}
      formContent={formContent}
      resultsContent={resultsContent}
      submitted={submitted}
      stats={stats}
      onRefresh={loadResponses}
    />
  );
}
