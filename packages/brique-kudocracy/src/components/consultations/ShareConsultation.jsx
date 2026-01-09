// src/components/consultations/ShareConsultation.jsx
// Composant de partage pour les consultations
// Supporte le partage sur réseaux sociaux + copie de lien + partage natif

import { useState, useEffect } from "react";
import {
  getShareLinks,
  copyShareLink,
  nativeShare,
  trackShare,
} from "../../lib/consultations.js";
import { CONSULTATION_SCOPES } from "../../constants.js";
import "./ShareConsultation.css";

/**
 * Composant de boutons de partage pour une consultation
 * @param {Object} props
 * @param {Object} props.consultation - La consultation à partager
 * @param {string} props.scope - Portée (local/regional/national)
 * @param {Object} props.stats - Statistiques optionnelles pour enrichir le texte
 * @param {boolean} props.compact - Mode compact (icônes seulement)
 * @param {boolean} props.showNative - Afficher le bouton de partage natif si disponible
 * @param {string} props.className - Classes CSS additionnelles
 */
export default function ShareConsultation({
  consultation,
  scope = "local",
  stats = null,
  compact = false,
  showNative = true,
  className = "",
}) {
  const [copied, setCopied] = useState(false);
  const [supportsNativeShare, setSupportsNativeShare] = useState(false);
  const [showAllPlatforms, setShowAllPlatforms] = useState(false);

  useEffect(() => {
    setSupportsNativeShare(!!navigator.share);
  }, []);

  if (!consultation) return null;

  const scopeInfo = CONSULTATION_SCOPES[scope] || CONSULTATION_SCOPES.local;
  const shareLinks = getShareLinks(consultation, { scope, stats });

  // Plateformes prioritaires
  const primaryPlatforms = ["twitter", "facebook", "whatsapp"];
  const secondaryPlatforms = ["linkedin", "telegram", "email"];

  const handleShare = async (platform, link) => {
    trackShare(consultation.slug, platform, scope);

    if (link.action === "copy") {
      const success = await copyShareLink(consultation, { scope });
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } else {
      window.open(link.url, "_blank", "width=600,height=400");
    }
  };

  const handleNativeShare = async () => {
    const success = await nativeShare(consultation, { scope, stats });
    if (success) {
      trackShare(consultation.slug, "native", scope);
    }
  };

  const renderShareButton = (platform, link, isPrimary = true) => (
    <button
      key={platform}
      onClick={() => handleShare(platform, link)}
      className={`share-btn share-btn-${platform} ${compact ? "compact" : ""} ${isPrimary ? "primary" : "secondary"}`}
      style={{ "--share-color": link.color }}
      title={link.name}
      aria-label={`Partager sur ${link.name}`}
    >
      <span className="share-icon">{link.icon}</span>
      {!compact && (
        <span className="share-label">
          {platform === "copy" ? (copied ? "Copié !" : link.name) : link.name}
        </span>
      )}
    </button>
  );

  return (
    <div
      className={`share-consultation ${compact ? "compact" : ""} ${className}`}
    >
      <div className="share-header">
        <span
          className="share-scope-badge"
          style={{ background: scopeInfo.color }}
        >
          {scopeInfo.icon} {scopeInfo.label}
        </span>
        <span className="share-title">Partager cette consultation</span>
      </div>

      <div className="share-buttons">
        {/* Partage natif (mobile) */}
        {showNative && supportsNativeShare && (
          <button
            onClick={handleNativeShare}
            className="share-btn share-btn-native"
            aria-label="Partager"
          >
            <span className="share-icon">📤</span>
            {!compact && <span className="share-label">Partager</span>}
          </button>
        )}

        {/* Plateformes prioritaires */}
        {primaryPlatforms.map((platform) =>
          renderShareButton(platform, shareLinks[platform], true)
        )}

        {/* Copier le lien */}
        {renderShareButton("copy", shareLinks.copy, true)}

        {/* Toggle pour plus de plateformes */}
        {!compact && (
          <button
            onClick={() => setShowAllPlatforms(!showAllPlatforms)}
            className="share-btn share-btn-more"
            aria-expanded={showAllPlatforms}
          >
            <span className="share-icon">{showAllPlatforms ? "−" : "+"}</span>
            <span className="share-label">
              {showAllPlatforms ? "Moins" : "Plus"}
            </span>
          </button>
        )}

        {/* Plateformes secondaires */}
        {(showAllPlatforms || compact) &&
          secondaryPlatforms.map((platform) =>
            renderShareButton(platform, shareLinks[platform], false)
          )}
      </div>

      {/* Message de confirmation copie */}
      {copied && (
        <div className="share-toast" role="status" aria-live="polite">
          ✓ Lien copié dans le presse-papiers !
        </div>
      )}
    </div>
  );
}

/**
 * Bouton de partage simple (pour intégration dans les en-têtes)
 */
export function ShareButton({
  consultation,
  scope = "local",
  stats = null,
  className = "",
}) {
  const [showDropdown, setShowDropdown] = useState(false);

  if (!consultation) return null;

  return (
    <div className={`share-button-container ${className}`}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="share-button-trigger"
        aria-expanded={showDropdown}
        aria-haspopup="true"
      >
        <span className="share-icon">📤</span>
        <span className="share-label">Partager</span>
      </button>

      {showDropdown && (
        <>
          <div
            className="share-dropdown-backdrop"
            onClick={() => setShowDropdown(false)}
          />
          <div className="share-dropdown">
            <ShareConsultation
              consultation={consultation}
              scope={scope}
              stats={stats}
              compact={false}
              showNative={false}
            />
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Mini-widget de partage pour la fin du formulaire
 */
export function ShareCallToAction({
  consultation,
  scope = "local",
  stats = null,
  message = "Merci pour votre participation ! Partagez cette consultation pour recueillir plus d'avis.",
}) {
  if (!consultation) return null;

  return (
    <div className="share-cta">
      <p className="share-cta-message">{message}</p>
      <ShareConsultation
        consultation={consultation}
        scope={scope}
        stats={stats}
        compact={true}
      />
    </div>
  );
}
