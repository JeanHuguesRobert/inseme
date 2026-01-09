// src/components/consultations/ConsultationLayout.jsx
// Layout générique pour les consultations citoyennes
// Fournit la structure commune : header, menu, footer, navigation form/results

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AuthModal } from "@inseme/ui";
import {
  getSupabase,
  useCurrentUser,
  getDisplayName,
  getDynamicConfig,
  COLORS,
} from "@inseme/cop-host";

/**
 * Layout générique pour les consultations citoyennes
 *
 * @param {Object} props
 * @param {React.ReactNode} props.formContent - Le contenu du formulaire
 * @param {React.ReactNode} props.resultsContent - Le contenu des résultats (optionnel, sinon utilise statsConfig)
 * @param {Object} props.statsConfig - Configuration pour l'affichage automatique des stats
 * @param {string} props.title - Titre de la consultation
 * @param {string} props.description - Description de la consultation
 * @param {boolean} props.submitted - État de soumission
 * @param {Function} props.onShare - Callback pour le partage
 * @param {Function} props.onRefresh - Callback pour rafraîchir les données
 * @param {Object} props.stats - Statistiques calculées
 * @param {React.ComponentType} props.Header - Composant de header (optionnel)
 * @param {React.ComponentType} props.Footer - Composant de footer (optionnel)
 * @param {React.ComponentType} props.FacebookPlugin - Composant Facebook (optionnel)
 */
export default function ConsultationLayout({
  formContent,
  resultsContent,
  title,
  description,
  submitted = false,
  onShare,
  onRefresh,
  stats,
  children,
  Header,
  Footer,
  FacebookPlugin,
}) {
  const {
    cityName: CITY_NAME,
    cityTagline: CITY_TAGLINE,
    movementName: MOVEMENT_NAME,
    partyName: PARTY_NAME,
    hashtag: HASHTAG,
  } = getDynamicConfig();

  const HeaderComponent = Header || (() => null);
  const FooterComponent = Footer || (() => null);
  const FacebookPluginComponent = FacebookPlugin || (() => null);

  const USE_GESTURE_HEADER_MENU = !!Header;
  const [page, setPage] = useState("form");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(() => {
    const saved = localStorage.getItem("consultationFormOpen");
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { currentUser } = useCurrentUser();

  // Persist form open/closed state
  useEffect(() => {
    localStorage.setItem("consultationFormOpen", JSON.stringify(isFormOpen));
  }, [isFormOpen]);

  const closeMenu = () => setIsMenuOpen(false);

  const handleShare = async () => {
    if (onShare) {
      onShare();
      return;
    }

    const shareData = {
      title: `Consultation citoyenne ${MOVEMENT_NAME}`,
      text: `Participez à la consultation citoyenne sur la démocratie locale à ${CITY_NAME}`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert("Lien copié dans le presse-papier !");
      }
    } catch (err) {
      console.error("Erreur lors du partage:", err);
    }
  };

  // Si soumis, afficher le message de confirmation puis rediriger
  useEffect(() => {
    if (submitted) {
      const timer = setTimeout(() => {
        setPage("results");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [submitted]);

  if (page === "form") {
    return (
      <div className="app-shell">
        <a href="#mainContent" className="skip-link">
          Aller au contenu principal
        </a>
        {USE_GESTURE_HEADER_MENU ? (
          <HeaderComponent />
        ) : (
          <>
            <header className="site-header">
              <div className="site-header-inner">
                <button
                  type="button"
                  className="nav-toggle"
                  aria-label={
                    isMenuOpen ? "Fermer la navigation" : "Ouvrir la navigation"
                  }
                  aria-expanded={isMenuOpen}
                  aria-controls="mainNav"
                  onClick={() => setIsMenuOpen((prev) => !prev)}
                >
                  <div className="relative h-6 w-6">
                    <span
                      className={`absolute left-1 top-1 block h-0.5 w-4 bg-light transition-transform duration-300 ${isMenuOpen ? "translate-y-2 rotate-45" : ""}`}
                    />
                    <span
                      className={`absolute left-1 top-2.5 block h-0.5 w-4 bg-light transition-opacity duration-300 ${isMenuOpen ? "opacity-0" : "opacity-100"}`}
                    />
                    <span
                      className={`absolute left-1 top-4 block h-0.5 w-4 bg-light transition-transform duration-300 ${isMenuOpen ? "-translate-y-2 -rotate-45" : ""}`}
                    />
                  </div>
                  <span className="sr-only">
                    {isMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
                  </span>
                </button>
              </div>
            </header>
            {isMenuOpen && (
              <div className="nav-overlay" onClick={closeMenu}>
                <nav
                  id="mainNav"
                  role="navigation"
                  aria-labelledby="navTitle"
                  className="nav-panel theme-card"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span id="navTitle" className="nav-title">
                      Navigation {MOVEMENT_NAME}
                    </span>
                    <button
                      type="button"
                      className="nav-toggle"
                      onClick={closeMenu}
                      aria-label="Fermer"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.8}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                  <ul className="nav-list">
                    <li className="nav-item">
                      <Link to="/" onClick={closeMenu} className="nav-link">
                        Consultation
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link
                        to="/kudocracy"
                        onClick={closeMenu}
                        className="nav-link"
                      >
                        Propositions
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link to="/wiki" onClick={closeMenu} className="nav-link">
                        Wiki
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link to="/bob" onClick={closeMenu} className="nav-link">
                        Ophélia
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link
                        to="/social"
                        onClick={closeMenu}
                        className="nav-link"
                      >
                        Café
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link
                        to="/transparence"
                        onClick={closeMenu}
                        className="nav-link"
                      >
                        Transparence
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link
                        to="/methodologie"
                        onClick={closeMenu}
                        className="nav-link"
                      >
                        Méthodologie
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link
                        to="/audit"
                        onClick={closeMenu}
                        className="nav-link"
                      >
                        Audit
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link
                        to="/global-dashboard"
                        onClick={closeMenu}
                        className="nav-link"
                      >
                        📊 Tableau de bord
                      </Link>
                    </li>
                    {currentUser && (
                      <li className="nav-item">
                        <Link
                          to="/subscriptions"
                          onClick={closeMenu}
                          className="nav-link"
                        >
                          🔔 Vos abonnements
                        </Link>
                      </li>
                    )}
                  </ul>
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    {currentUser ? (
                      <div className="px-3 py-2">
                        <div className="text-xs text-gray-400 mb-2">
                          👤 Connecté en tant que:
                        </div>
                        <div className="text-sm font-medium text-light mb-3">
                          <Link
                            to={`/users/${currentUser.id}`}
                            className="hover:underline"
                          >
                            {getDisplayName(currentUser)}
                          </Link>
                        </div>
                        <Link
                          to="/user-dashboard"
                          onClick={closeMenu}
                          className="block w-full px-3 py-2 mb-2 text-sm text-center bg-primary text-light font-bold border-2 border-light hover:bg-primary hover:opacity-90"
                        >
                          Votre tableau de bord
                        </Link>
                        <button
                          onClick={async () => {
                            await getSupabase().auth.signOut();
                            closeMenu();
                          }}
                          className="w-full px-3 py-2 text-sm bg-accent text-light font-bold border-2 border-light hover:opacity-90"
                        >
                          Déconnexion
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setShowAuthModal(true);
                          closeMenu();
                        }}
                        className="w-full px-3 py-2 text-sm bg-highlight text-dark font-bold border-2 border-dark hover:opacity-90"
                      >
                        🔐 Connexion / Inscription
                      </button>
                    )}
                  </div>
                  <div className="mt-6 text-xs text-gray-400">
                    {PARTY_NAME} — {MOVEMENT_NAME} {CITY_NAME} ©{" "}
                    {new Date().getFullYear()}
                  </div>
                  <div className="mt-4">
                    <FacebookPluginComponent />
                  </div>
                </nav>
              </div>
            )}
          </>
        )}
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="text-center">
            <div className="text-5xl font-bold text-primary">{HASHTAG}</div>
            <div className="h-1 my-3 max-w-2xl mx-auto bg-highlight"></div>
            <div className="text-4xl font-bold text-accent">
              {String(CITY_NAME).toUpperCase()}
              <br />
              {CITY_TAGLINE}
            </div>
          </div>
        </div>
        <main className="landing-main">
          {submitted ? (
            <div className="theme-card success-message">
              <h2>Merci pour votre participation !</h2>
              <p>
                Votre réponse a été enregistrée. Redirection vers les
                résultats...
              </p>
            </div>
          ) : (
            <div className="landing-card">
              <button
                type="button"
                onClick={() => setIsFormOpen((open) => !open)}
                className="landing-card-header"
              >
                <span>{title || `Questionnaire citoyen ${MOVEMENT_NAME}`}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-5 w-5 transition-transform ${isFormOpen ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {isFormOpen && (
                <div id="mainContent" className="landing-card-body">
                  {formContent}

                  <div className="mt-8 text-center">
                    <div className="flex justify-center gap-4">
                      <button
                        onClick={handleShare}
                        className="btn-secondary-action"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                        </svg>
                        Partager
                      </button>
                      <button
                        onClick={() => setPage("results")}
                        className="btn-tertiary-action"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                        </svg>
                        Voir les résultats
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
        <FooterComponent />
        {showAuthModal && (
          <AuthModal
            onClose={() => setShowAuthModal(false)}
            onSuccess={() => setShowAuthModal(false)}
          />
        )}
      </div>
    );
  }

  // Page des résultats
  return (
    <div className="app-shell">
      <a href="#mainContent" className="skip-link">
        Aller au contenu principal
      </a>
      <div className="min-h-screen bg-dark">
        <header className="border-b-2 border-light">
          <div className="max-w-6xl mx-auto px-4 py-6">
            <div className="text-center">
              <div className="text-5xl font-bold text-primary">{HASHTAG}</div>
              <div className="h-1 my-3 max-w-2xl mx-auto bg-highlight"></div>
              <div className="text-4xl font-bold text-accent">
                {String(CITY_NAME).toUpperCase()}
                <br />
                {CITY_TAGLINE}
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-8">
          <div
            style={{
              background: "var(--color-bg-app)",
              border: "2px solid var(--color-border-strong)",
              padding: "2rem",
            }}
          >
            {!stats ? (
              <div className="text-center hint-text">
                Chargement des résultats...
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h1 className="page-title">Résultats de la consultation</h1>
                    <p className="section-description">
                      {stats?.totalResponses} participation
                      {stats?.totalResponses > 1 ? "s" : ""} enregistrée
                      {stats?.totalResponses > 1 ? "s" : ""}
                    </p>
                  </div>
                  {onRefresh && (
                    <button onClick={onRefresh} className="btn btn-secondary">
                      Actualiser
                    </button>
                  )}
                </div>

                {resultsContent || children}
              </>
            )}

            <div className="mt-8 text-center">
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => setPage("form")}
                  className="btn btn-secondary py-3 px-6"
                >
                  Participer à la consultation
                </button>
                <button
                  onClick={handleShare}
                  className="text-accent underline hover:opacity-80 flex items-center gap-1"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                  </svg>
                  Partager
                </button>
              </div>
            </div>
          </div>
        </main>
        <SiteFooter />
        {showAuthModal && (
          <AuthModal
            onClose={() => setShowAuthModal(false)}
            onSuccess={() => setShowAuthModal(false)}
          />
        )}
      </div>
    </div>
  );
}

// Composants utilitaires pour les graphiques de résultats
export function PieChartSection({ title, data, colors = COLORS }) {
  return (
    <section>
      <h2 className="section-title">{title}</h2>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value }) => `${name}: ${value}`}
            outerRadius={window.innerWidth < 768 ? 60 : 80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={colors[index % colors.length]}
              />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </section>
  );
}

export function BarChartSection({ title, data, color = "#B35A4A" }) {
  return (
    <section className="px-2 md:px-4">
      {title && <h2 className="section-title">{title}</h2>}
      <ResponsiveContainer
        width="100%"
        height={window.innerWidth < 768 ? 200 : 300}
      >
        <BarChart
          data={data}
          margin={
            window.innerWidth < 768
              ? { top: 5, right: 10, left: -20, bottom: 5 }
              : { top: 5, right: 30, left: 20, bottom: 5 }
          }
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value" fill={color} />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}

export function ScoreSection({ title, value, max = 5, description }) {
  return (
    <section>
      <h2 className="section-title">{title}</h2>
      <div className="text-center">
        <div className="text-6xl font-bold text-primary">
          {value.toFixed(1)}/{max}
        </div>
        {description && <p className="hint-text mt-2">{description}</p>}
      </div>
    </section>
  );
}
