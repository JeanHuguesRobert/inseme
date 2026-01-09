// src/components/common/PetitionLink.jsx
// Composant réutilisable pour afficher un lien vers une pétition
// Utilisé par : ConsultationsHome, Proposition, PropositionCard, IncidentCard

import {
  detectPetitionPlatform,
  PETITION_SCOPES,
  validatePetitionUrl,
  getRecommendedPlatforms,
} from "@inseme/brique-kudocracy";

/**
 * Icône clipboard/pétition en SVG (réutilisée dans plusieurs variantes)
 */
function PetitionIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
      <path
        fillRule="evenodd"
        d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * Icône plus en SVG
 */
function PlusIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * Lien simple vers une pétition (pour les cartes compactes)
 * @param {Object} props
 * @param {string} props.url - URL de la pétition
 * @param {string} [props.title] - Titre optionnel
 * @param {string} [props.className] - Classes CSS additionnelles
 */
export function PetitionLinkSimple({ url, title = "Signer la pétition", className = "" }) {
  if (!url) return null;

  const platform = detectPetitionPlatform(url);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-sm text-orange-600 font-semibold hover:text-orange-700 hover:underline ${className}`}
    >
      {platform?.icon ? (
        <span className="text-sm">{platform.icon}</span>
      ) : (
        <PetitionIcon className="h-4 w-4" />
      )}
      {title} →
    </a>
  );
}

/**
 * Bloc pétition complet (pour les pages de détail)
 * Affiche un encart avec description et bouton d'action
 * @param {Object} props
 * @param {string} props.url - URL de la pétition
 * @param {string} [props.title] - Titre de la pétition
 * @param {string} [props.description] - Description personnalisée
 */
export function PetitionLinkCard({
  url,
  title = "Signer la pétition",
  description = "Soutenez cette initiative en signant la pétition sur la plateforme externe.",
}) {
  if (!url) return null;

  const platform = detectPetitionPlatform(url);

  return (
    <div className="petition-card bg-orange-50 border border-orange-200 p-4 mb-6 rounded-lg">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{platform?.icon || "📋"}</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-orange-800">
            Une pétition est associée à cette proposition
          </p>
          <p className="text-xs text-orange-600 mt-1">{description}</p>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white font-semibold rounded hover:bg-orange-700 transition-colors"
        >
          {title}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </a>
      </div>
    </div>
  );
}

/**
 * Liste de pétitions avec scope (pour les consultations)
 * Affiche les pétitions locale/régionale/nationale
 * @param {Object} props
 * @param {Array} props.petitions - Liste des pétitions avec scope
 * @param {boolean} [props.compact] - Mode compact (icônes seulement)
 */
export function PetitionLinks({ petitions, compact = false }) {
  if (!petitions || petitions.length === 0) return null;

  if (compact) {
    // Version compacte pour les cartes de grille
    return (
      <div className="petitions-compact">
        <span className="petitions-label" title="Pétitions associées">
          ✍️
        </span>
        {petitions.map((petition) => (
          <a
            key={petition.scope}
            href={petition.url}
            target="_blank"
            rel="noopener noreferrer"
            className="petition-icon-link"
            title={`${PETITION_SCOPES[petition.scope]?.label || "Pétition"}: ${petition.title}`}
          >
            {petition.icon || PETITION_SCOPES[petition.scope]?.icon || "📋"}
          </a>
        ))}
      </div>
    );
  }

  // Version complète pour la carte featured
  return (
    <div className="petitions-section">
      <p className="petitions-title">✍️ Pétitions citoyennes associées</p>
      <div className="petitions-list">
        {petitions.map((petition) => {
          const scopeInfo = PETITION_SCOPES[petition.scope] || {};
          return (
            <a
              key={petition.scope}
              href={petition.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`petition-link petition-${petition.scope}`}
            >
              <span className="petition-icon">{petition.icon || scopeInfo.icon || "📋"}</span>
              <span className="petition-info">
                <span className="petition-scope">{scopeInfo.label || "Pétition"}</span>
                <span className="petition-name">{petition.title}</span>
                {petition.platform && (
                  <span className="petition-platform">sur {petition.platform}</span>
                )}
              </span>
              <span className="petition-arrow">→</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

// Export par défaut du composant le plus utilisé
export default PetitionLinkSimple;

/**
 * Champ de formulaire pour ajouter une URL de pétition
 * Utilisé par : CreateProposition, IncidentEditorForm
 * @param {Object} props
 * @param {string} props.value - Valeur actuelle de l'URL
 * @param {function} props.onChange - Callback appelée avec la nouvelle valeur et le warning éventuel
 * @param {boolean} [props.show] - Si le champ est affiché (contrôlé de l'extérieur)
 * @param {function} [props.onToggle] - Callback pour afficher/masquer le champ
 * @param {string} [props.warning] - Warning à afficher (validation)
 * @param {string} [props.className] - Classes CSS additionnelles pour le container
 * @param {string} [props.inputClassName] - Classes CSS pour l'input
 * @param {string} [props.labelClassName] - Classes CSS pour le label
 */
export function PetitionUrlField({
  value,
  onChange,
  show = true,
  onToggle,
  warning,
  className = "",
  inputClassName = "w-full px-4 py-2 border border-gray-300",
  labelClassName = "block text-gray-200 font-semibold",
}) {
  const platforms = getRecommendedPlatforms();

  const handleChange = (e) => {
    const newValue = e.target.value;
    const validation = validatePetitionUrl(newValue);
    onChange(newValue, validation.warning || "");
  };

  // Bouton pour afficher le champ
  if (!show && onToggle) {
    return (
      <button
        type="button"
        onClick={() => onToggle(true)}
        className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm font-medium"
      >
        <PlusIcon className="h-5 w-5" />
        Associer une pétition (Change.org, MesOpinions...)
      </button>
    );
  }

  // Champ de saisie
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <label className={labelClassName}>
          Lien vers une pétition
          <span className="text-gray-400 font-normal text-sm ml-2">(optionnel)</span>
        </label>
        {onToggle && (
          <button
            type="button"
            onClick={() => {
              onToggle(false);
              onChange("", "");
            }}
            className="text-gray-400 hover:text-gray-200 text-sm"
          >
            ✕ Retirer
          </button>
        )}
      </div>

      <input
        type="url"
        value={value}
        onChange={handleChange}
        className={inputClassName}
        placeholder="https://www.change.org/p/ma-petition ou https://www.mesopinions.com/..."
      />

      <p className="text-xs text-gray-400">
        💡 Plateformes recommandées :{" "}
        {platforms.map((p, i) => (
          <span key={p.name}>
            {i > 0 && " et "}
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              {p.name}
            </a>
          </span>
        ))}
      </p>

      {warning && (
        <p className="text-xs text-yellow-400 bg-yellow-900/30 px-3 py-2 rounded">⚠️ {warning}</p>
      )}
    </div>
  );
}
