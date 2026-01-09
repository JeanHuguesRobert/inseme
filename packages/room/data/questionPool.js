const QUESTION_POOL = [
  {
    emoji: "👥",
    label: "Participation citoyenne",
    text: "Comment participer aux décisions locales ?",
  },
  {
    emoji: "🗓️",
    label: "Prochaines consultations",
    text: "Quelles sont les prochaines consultations citoyennes ?",
  },
  {
    emoji: "💶",
    label: "Budget participatif",
    text: "Comment fonctionne le budget participatif à Corte ?",
  },
  {
    emoji: "📄",
    label: "Comptes-rendus municipaux",
    text: "Où puis-je trouver les comptes-rendus des dernières réunions ?",
  },
  {
    emoji: "🏗️",
    label: "Projets urbains en cours",
    text: "Quels sont les projets urbains en cours dans mon quartier ?",
  },
  {
    emoji: "🏘️",
    label: "Centre ancien",
    text: "Qu'est-ce que le projet de requalification du centre ancien ?",
  },
  {
    emoji: "🌉",
    label: "Passerelle piétons-cycles",
    text: "Où en est le projet de passerelle piétons et cycles ?",
  },
  {
    emoji: "🏰",
    label: "Citadelle de Corte",
    text: "Quels sont les aménagements prévus pour la Citadelle ?",
  },
  {
    emoji: "🏛️",
    label: "Services municipaux",
    text: "Quels sont les horaires et services de la mairie ?",
  },
  {
    emoji: "🚌",
    label: "Transports publics",
    text: "Comment fonctionnent les transports en commun à Corte ?",
  },
  {
    emoji: "🅿️",
    label: "Stationnement",
    text: "Où se trouvent les parkings et zones de stationnement à Corte ?",
  },
  {
    emoji: "💧",
    label: "Service de l'eau",
    text: "Comment fonctionne la régie municipale de l'eau Cort'Acqua ?",
  },
  {
    emoji: "🚮",
    label: "Gestion des déchets",
    text: "Quelles sont les consignes de tri et les collectes prévues ?",
  },
  {
    emoji: "🆘",
    label: "Services essentiels",
    text: "Quels services sont disponibles en cas d'urgence locale ?",
  },
  {
    emoji: "🎭",
    label: "Culture & événements",
    text: "Quels sont les prochains événements culturels à Corte ?",
  },
  {
    emoji: "📅",
    label: "Agenda Pertitellu",
    text: "Quels événements du mouvement sont prévus cette semaine ?",
  },
  {
    emoji: "🌳",
    label: "Initiatives écologiques",
    text: "Quelles sont les initiatives environnementales de la ville ?",
  },
  {
    emoji: "♻️",
    label: "Plan climat",
    text: "Quel est le plan climat-air-énergie de Corte ?",
  },
  {
    emoji: "🏛️",
    label: "Patrimoine historique",
    text: "Comment est valorisé le patrimoine historique de Corte ?",
  },
  {
    emoji: "🌲",
    label: "Forêt communale",
    text: "Comment est gérée la forêt communale de Corte ?",
  },
  {
    emoji: "🏞️",
    label: "La Restonica",
    text: "Comment accéder à la vallée de la Restonica ?",
  },
  {
    emoji: "🚶",
    label: "Balades urbaines",
    text: "Existe-t-il des parcours pour découvrir Corte à pied ?",
  },
  {
    emoji: "🏫",
    label: "Vie étudiante",
    text: "Quelles sont les activités et services pour les étudiants ?",
  },
  {
    emoji: "🏠",
    label: "Logement étudiant",
    text: "Comment trouver un logement étudiant à Corte ?",
  },
  {
    emoji: "🎓",
    label: "Aides étudiantes",
    text: "Quelles aides ou bourses sont disponibles pour les étudiants ?",
  },
  {
    emoji: "🤖",
    label: "Qui est Ophélia ?",
    text: "Qui es-tu Ophélia et quel est ton rôle ?",
  },
  {
    emoji: "🛰️",
    label: "Modèle IA",
    text: "Quel fournisseur ou modèle IA utilises-tu actuellement ?",
  },
  {
    emoji: "🎯",
    label: "Le mouvement Pertitellu",
    text: "C'est quoi Pertitellu et quels sont ses objectifs ?",
  },
  {
    emoji: "🧠",
    label: "Sources utilisées",
    text: "D'où proviennent les informations que tu utilises dans tes réponses ?",
  },
  {
    emoji: "🛡️",
    label: "Données personnelles",
    text: "Comment mes données personnelles sont-elles protégées ?",
  },
  {
    emoji: "📤",
    label: "Exporter mes données",
    text: "Comment exporter mes données depuis la plateforme ?",
  },
  {
    emoji: "📰",
    label: "Actualités citoyennes",
    text: "Quels sont les derniers posts publiés sur Pertitellu ?",
  },
  {
    emoji: "🧭",
    label: "Missions actives",
    text: "Quelles missions citoyennes sont actives aujourd'hui ?",
  },
  {
    emoji: "🤝",
    label: "Rejoindre une mission",
    text: "Comment rejoindre une mission locale en cours ?",
  },
  {
    emoji: "🛠️",
    label: "Tâches du groupe",
    text: "Quelles tâches restent à faire dans mon groupe ?",
  },
  {
    emoji: "📌",
    label: "Suivi des projets",
    text: "Peux-tu me donner un état d'avancement sur un projet précis ?",
  },
  {
    emoji: "🗳️",
    label: "Propositions citoyennes",
    text: "Comment proposer une idée pour améliorer Corte ?",
  },
  {
    emoji: "📈",
    label: "Propositions actives",
    text: "Quelles propositions sont actuellement ouvertes au vote ?",
  },
  {
    emoji: "🔥",
    label: "Votes populaires",
    text: "Quelles propositions reçoivent le plus de votes ces derniers jours ?",
  },
  {
    emoji: "🏷️",
    label: "Tags populaires",
    text: "Quels tags sont les plus utilisés dans les propositions ?",
  },
  {
    emoji: "📊",
    label: "Stats de participation",
    text: "Peux-tu me donner les dernières statistiques de participation ?",
  },
  {
    emoji: "⚖️",
    label: "Transparence municipale",
    text: "Quels indicateurs de transparence municipale sont suivis ?",
  },
  {
    emoji: "📚",
    label: "Wiki communautaire",
    text: "Comment contribuer au wiki de Pertitellu ?",
  },
  {
    emoji: "🗂️",
    label: "Wiki mis à jour",
    text: "Quels articles du wiki ont été mis à jour récemment ?",
  },
  {
    emoji: "🔍",
    label: "Résumer un document",
    text: "Peux-tu résumer un document ou un rapport local ?",
  },
  {
    emoji: "🛰️",
    label: "API publique",
    text: "Comment utiliser l'API publique pour récupérer des données ?",
  },
  {
    emoji: "💻",
    label: "Console API",
    text: "Puis-je tester les endpoints directement depuis la console ?",
  },
  {
    emoji: "🧮",
    label: "Requête SQL",
    text: "Peux-tu exécuter une requête SQL pour vérifier les votes récents ?",
  },
  {
    emoji: "🧱",
    label: "Capacités agent",
    text: "Quels outils peux-tu utiliser pour agir sur la plateforme ?",
  },
  {
    emoji: "📍",
    label: "Les quartiers de Corte",
    text: "Quels sont les différents quartiers de Corte ?",
  },
];

export default QUESTION_POOL;
export { QUESTION_POOL };
