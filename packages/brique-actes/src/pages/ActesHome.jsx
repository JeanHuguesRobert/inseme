// src/pages/actes/ActesHome.jsx
// ============================================================================
// Page d'accueil du module Actes Municipaux
// Hub d'orientation avec explications et liens vers les services
// Version étendue pour les administrateurs
// ============================================================================

import React from "react";
import { Link } from "react-router-dom";
import { useCurrentUser, isAdmin, canWrite } from "@inseme/cop-host";
import { CITY_NAME, HASHTAG } from "@inseme/cop-host";

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const ServiceCard = ({
  to,
  emoji,
  title,
  description,
  color = "blue",
  badge,
  adminOnly = false,
}) => {
  const colorClasses = {
    blue: "border-blue-200 hover:border-blue-400 hover:bg-blue-50",
    green: "border-green-200 hover:border-green-400 hover:bg-green-50",
    purple: "border-purple-200 hover:border-purple-400 hover:bg-purple-50",
    orange: "border-orange-200 hover:border-orange-400 hover:bg-orange-50",
    red: "border-red-200 hover:border-red-400 hover:bg-red-50",
    cyan: "border-cyan-200 hover:border-cyan-400 hover:bg-cyan-50",
    amber: "border-amber-200 hover:border-amber-400 hover:bg-amber-50",
    slate: "border-slate-200 hover:border-slate-400 hover:bg-slate-50",
  };

  return (
    <Link
      to={to}
      className={`block bg-white rounded-xl border-2 p-6 transition-all duration-200 ${colorClasses[color]} ${adminOnly ? "ring-2 ring-amber-300 ring-offset-2" : ""}`}
    >
      <div className="flex items-start gap-4">
        <span className="text-4xl">{emoji}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-800 text-lg">{title}</h3>
            {badge && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                {badge}
              </span>
            )}
            {adminOnly && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                Admin
              </span>
            )}
          </div>
          <p className="text-slate-600 text-sm mt-1">{description}</p>
        </div>
        <span className="text-slate-400">→</span>
      </div>
    </Link>
  );
};

const InfoBox = ({ emoji, title, children, color = "blue" }) => {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200",
    green: "bg-green-50 border-green-200",
    amber: "bg-amber-50 border-amber-200",
    purple: "bg-purple-50 border-purple-200",
  };

  return (
    <div className={`rounded-lg border p-5 ${colorClasses[color]}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{emoji}</span>
        <div>
          <h4 className="font-semibold text-slate-800">{title}</h4>
          <div className="text-sm text-slate-600 mt-1">{children}</div>
        </div>
      </div>
    </div>
  );
};

const LegalCard = ({ code, title, description }) => (
  <div className="bg-white rounded-lg border border-slate-200 p-4">
    <div className="flex items-center gap-2 mb-2">
      <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded">
        {code}
      </span>
    </div>
    <h4 className="font-medium text-slate-800">{title}</h4>
    <p className="text-sm text-slate-500 mt-1">{description}</p>
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ActesHome() {
  const { currentUser: user } = useCurrentUser();
  const userIsAdmin = isAdmin(user);
  const userCanWrite = canWrite(user);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-12 text-center">
          <p className="text-sm tracking-widest text-blue-600 font-semibold mb-3">
            {HASHTAG} — DÉMOCRATIE LOCALE
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            🏛️ Contrôle Citoyen des Actes Municipaux
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Suivez, documentez et contrôlez les décisions de votre mairie.
            <br />
            <span className="text-blue-600 font-medium">
              Transparence • Légalité • Responsabilité
            </span>
          </p>

          {!user && (
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg inline-block">
              <p className="text-amber-800 text-sm">
                👋 <strong>Connectez-vous</strong> pour accéder à toutes les
                fonctionnalités
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10 space-y-12">
        {/* Introduction */}
        <section>
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <span>📖</span> Qu'est-ce que c'est ?
          </h2>
          <div className="prose prose-slate max-w-none">
            <p className="text-lg text-slate-600 leading-relaxed">
              Ce système vous permet de{" "}
              <strong>suivre les actes pris par la municipalité</strong>
              de {CITY_NAME || "votre commune"} : délibérations du conseil
              municipal, arrêtés du maire, décisions individuelles,
              procès-verbaux...
            </p>
            <p className="text-slate-600 leading-relaxed">
              Vous pouvez vérifier si ces actes respectent les{" "}
              <strong>délais légaux de transmission</strong>à la préfecture,
              faire des <strong>demandes d'accès aux documents</strong> (CRPA),
              et si nécessaire, préparer des{" "}
              <strong>recours administratifs</strong>.
            </p>
          </div>
        </section>

        {/* Cadre juridique */}
        <section>
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <span>⚖️</span> Cadre juridique
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LegalCard
              code="CGCT"
              title="Code Général des Collectivités Territoriales"
              description="Règles de fonctionnement des communes, transmission des actes à la préfecture"
            />
            <LegalCard
              code="CRPA"
              title="Code des Relations entre le Public et l'Administration"
              description="Droit d'accès aux documents administratifs, délai de réponse d'1 mois"
            />
            <LegalCard
              code="CADA"
              title="Commission d'Accès aux Documents Administratifs"
              description="Autorité indépendante à saisir en cas de refus de communication"
            />
            <LegalCard
              code="TA"
              title="Tribunal Administratif"
              description="Juridiction compétente pour les recours contre les actes illégaux"
            />
          </div>
        </section>

        {/* Services pour tous */}
        <section>
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <span>🔍</span> Explorer et Suivre
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ServiceCard
              to="/actes"
              emoji="📊"
              title="Tableau de bord"
              description="Vue d'ensemble : score de transparence, échéances, alertes"
              color="blue"
            />
            <ServiceCard
              to="/actes/liste"
              emoji="📋"
              title="Liste des actes"
              description="Parcourir tous les actes municipaux enregistrés"
              color="slate"
            />
            <ServiceCard
              to="/demandes"
              emoji="📬"
              title="Demandes administratives"
              description="Suivi des demandes CRPA, saisines CADA, recours"
              color="purple"
            />
            <ServiceCard
              to="/actes/chronologie"
              emoji="📅"
              title="Chronologie"
              description="Visualisation interactive des événements"
              color="cyan"
            />
            <ServiceCard
              to="/actes/stats"
              emoji="📈"
              title="Statistiques"
              description="Indicateurs clés et tendances"
              color="green"
            />
            <ServiceCard
              to="/bob"
              emoji="🤖"
              title="Demander à Ophélia"
              description="Assistant IA pour vos questions juridiques"
              color="amber"
            />
          </div>
        </section>

        {/* Services pour utilisateurs connectés */}
        {userCanWrite && (
          <section>
            <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <span>✏️</span> Contribuer
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ServiceCard
                to="/actes/nouveau"
                emoji="➕"
                title="Ajouter un acte"
                description="Enregistrer un nouvel acte municipal à suivre"
                color="green"
              />
              <ServiceCard
                to="/demandes/nouvelle"
                emoji="📝"
                title="Nouvelle demande CRPA"
                description="Demander l'accès à un document administratif"
                color="blue"
              />
              <ServiceCard
                to="/preuves/ajouter"
                emoji="📎"
                title="Ajouter une preuve"
                description="Téléverser un document, capture d'écran, email..."
                color="orange"
              />
              <ServiceCard
                to="/exports/pdf"
                emoji="📄"
                title="Générer un PDF"
                description="Créer un dossier pour recours ou archivage"
                color="purple"
              />
            </div>
          </section>
        )}

        {/* Services admin */}
        {userIsAdmin && (
          <section>
            <h2 className="text-2xl font-bold text-amber-700 mb-6 flex items-center gap-2">
              <span>🔐</span> Administration
            </h2>
            <InfoBox
              emoji="⚠️"
              title="Zone réservée aux administrateurs"
              color="amber"
            >
              Ces fonctions permettent de modérer les contributions et valider
              les actions avant leur envoi officiel (Human-in-the-Loop).
            </InfoBox>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <ServiceCard
                to="/moderation/actions"
                emoji="📤"
                title="Actions en attente"
                description="Valider les courriers et emails avant envoi"
                color="orange"
                adminOnly
              />
              <ServiceCard
                to="/moderation/preuves"
                emoji="🔍"
                title="Vérification des preuves"
                description="Contrôler les documents téléversés"
                color="blue"
                adminOnly
              />
              <ServiceCard
                to="/moderation/publications"
                emoji="📢"
                title="Modération publications"
                description="Approuver les analyses citoyennes"
                color="purple"
                adminOnly
              />
              <ServiceCard
                to="/moderation/responsabilites"
                emoji="📜"
                title="Journal des responsabilités"
                description="Audit trail complet des actions"
                color="slate"
                adminOnly
              />
              <ServiceCard
                to="/exports/csv"
                emoji="📊"
                title="Export CSV"
                description="Exporter les données pour analyse"
                color="green"
                adminOnly
              />
              <ServiceCard
                to="/admin"
                emoji="⚙️"
                title="Administration générale"
                description="Gestion des utilisateurs et paramètres"
                color="red"
                adminOnly
              />
            </div>
          </section>
        )}

        {/* Délais légaux */}
        <section>
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <span>⏰</span> Délais légaux à connaître
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-lg border border-slate-200 text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Situation
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Délai
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Conséquence
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="px-4 py-3">Transmission à la préfecture</td>
                  <td className="px-4 py-3 font-medium text-blue-600">
                    15 jours
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    Acte non exécutoire, potentiellement illégal
                  </td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="px-4 py-3">Réponse à une demande CRPA</td>
                  <td className="px-4 py-3 font-medium text-blue-600">
                    1 mois
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    Refus implicite → Saisine CADA possible
                  </td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="px-4 py-3">Avis de la CADA</td>
                  <td className="px-4 py-3 font-medium text-blue-600">
                    1 mois
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    Avis favorable ou défavorable
                  </td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="px-4 py-3">Recours gracieux</td>
                  <td className="px-4 py-3 font-medium text-orange-600">
                    2 mois
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    Rejet implicite → Recours contentieux possible
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Recours contentieux (TA)</td>
                  <td className="px-4 py-3 font-medium text-red-600">2 mois</td>
                  <td className="px-4 py-3 text-slate-600">
                    Forclusion (plus de recours possible)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Aide */}
        <section>
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <span>💡</span> Besoin d'aide ?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InfoBox emoji="📖" title="Guide d'utilisation" color="blue">
              <Link
                to="/docs/guide-citoyen"
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Lire le guide complet →
              </Link>
            </InfoBox>
            <InfoBox emoji="🤖" title="Assistant Ophélia" color="purple">
              <Link
                to="/bob"
                className="text-purple-600 hover:text-purple-800 font-medium"
              >
                Poser une question →
              </Link>
            </InfoBox>
            <InfoBox emoji="📧" title="Contact" color="green">
              <Link
                to="/contact"
                className="text-green-600 hover:text-green-800 font-medium"
              >
                Nous contacter →
              </Link>
            </InfoBox>
          </div>
        </section>

        {/* Call to action */}
        <section className="text-center py-8">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white">
            <h2 className="text-2xl font-bold mb-3">Prêt à commencer ?</h2>
            <p className="text-blue-100 mb-6 max-w-lg mx-auto">
              Explorez le tableau de bord pour voir l'état de la transparence
              municipale, ou commencez par ajouter un acte à suivre.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                to="/actes"
                className="px-6 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
              >
                📊 Voir le tableau de bord
              </Link>
              {userCanWrite && (
                <Link
                  to="/actes/nouveau"
                  className="px-6 py-3 bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-800 transition-colors"
                >
                  ➕ Ajouter un acte
                </Link>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
