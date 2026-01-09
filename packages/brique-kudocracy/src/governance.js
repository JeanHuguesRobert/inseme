/**
 * governance.js
 * ----------------------------
 * Module de gestion des modèles de gouvernance et de la terminologie associée.
 * Inspiré par collective.js pour la structure des modèles et des rôles.
 * ----------------------------
 */

export const GOVERNANCE_MODELS = [
  {
    id: "democratie_directe",
    name: "Agora (Démocratie Directe)",
    description:
      "Un modèle où chaque individu participe directement aux décisions.",
    icon: "Users",
    votingType: "opov",
    weightLabel: "Voix",
    resultsLabel: "Volonté Générale",
    terminology: {
      member: "Citoyen",
      members: "Citoyens",
      assembly: "Assemblée",
      session: "Séance",
      instance: "Instance de Coordination",
      decision: "Votation",
      representative: "Délégué",
      represented: "Représenté",
      dashboard: "Synthèse",
      proposition: "Proposition",
      vote: "Vote",
    },
    roles: [
      {
        id: "r_citoyen",
        technical_name: "member",
        friendly_name: "Citoyen",
        properties: {
          can_vote: true,
          is_representative: false,
        },
      },
    ],
    rules: {
      can_delegate: true,
      requires_consensus: false,
      vote_weight: "1_person_1_vote",
      show_weight_badge: false,
      can_guests_vote: true, // Dans l'Agora, tout le monde peut participer
      can_guests_interact: true,
      can_authenticated_vote: true,
      show_results_by_college: true,
      speech_priority_by_role: false,
    },
    quickVoteOptions: [
      {
        id: "ok",
        label: "D'accord",
        color: "emerald",
        icon: "CheckCircle2",
      },
      {
        id: "no",
        label: "Pas d'accord",
        color: "rose",
        icon: "XCircle",
      },
      {
        id: "off",
        label: "Besoin d'air",
        color: "sky",
        icon: "HelpCircle",
      },
    ],
    propositionVoteOptions: [
      { id: "approve", label: "Pour", color: "green" },
      { id: "disapprove", label: "Contre", color: "red" },
      { id: "neutral", label: "Neutre", color: "gray" },
      { id: "false_choice", label: "Faux Dilemme", color: "purple" },
    ],
    interactionActions: [
      {
        id: "parole",
        label: "Demande de parole",
        color: "amber",
        icon: "MessageSquare",
      },
      {
        id: "technical",
        label: "Point technique",
        color: "orange",
        icon: "AlertTriangle",
      },
    ],
  },
  {
    id: "palabre",
    name: "Cercle de Palabre (Consensus)",
    description: "Modèle de discussion et de décision par consensus.",
    icon: "MessageCircle",
    votingType: "opov",
    weightLabel: "Présence",
    resultsLabel: "Sagesse Collective",
    terminology: {
      member: "Ancien",
      members: "Anciens",
      assembly: "Cercle",
      session: "Palabre",
      instance: "Noyau",
      decision: "Consensus",
      representative: "Facilitateur",
      represented: "Esprit de présence",
      dashboard: "Sagesse",
      proposition: "Sujet de palabre",
      vote: "Avis",
    },
    roles: [
      {
        id: "r_ancien",
        technical_name: "member",
        friendly_name: "Ancien",
        properties: { can_vote: true, is_representative: false },
      },
    ],
    rules: {
      can_delegate: false,
      requires_consensus: true,
      vote_weight: "1_person_1_vote",
      show_weight_badge: false,
      can_guests_vote: false, // Seuls les Anciens votent
      can_guests_interact: true, // Mais tout le monde peut parler
      can_authenticated_vote: false,
      show_results_by_college: true,
      speech_priority_by_role: true, // Les Anciens ont priorité
    },
    quickVoteOptions: [
      {
        id: "ok",
        label: "Consensus",
        color: "emerald",
        icon: "CheckCircle2",
      },
      {
        id: "reserve",
        label: "Réserves",
        color: "amber",
        icon: "HelpCircle",
      },
      {
        id: "no",
        label: "Blocage",
        color: "rose",
        icon: "XCircle",
      },
    ],
    propositionVoteOptions: [
      { id: "approve", label: "Consensus", color: "green" },
      { id: "reserve", label: "Réserves", color: "orange" },
      { id: "disapprove", label: "Opposition", color: "red" },
    ],
    interactionActions: [
      {
        id: "parole",
        label: "Demande de parole",
        color: "amber",
        icon: "MessageSquare",
      },
    ],
  },
  {
    id: "association_loi_1901",
    name: "Association (Loi 1901)",
    description: "Modèle associatif standard avec bureau et membres.",
    icon: "Users",
    votingType: "opov",
    weightLabel: "Voix",
    resultsLabel: "Résolution associative",
    terminology: {
      member: "Membre",
      members: "Membres",
      assembly: "Assemblée Générale",
      session: "Réunion",
      instance: "Bureau",
      decision: "Résolution",
      representative: "Administrateur",
      represented: "Membre d'Honneur",
      dashboard: "Tableau de Bord",
      proposition: "Point à l'Ordre du Jour",
      vote: "Scrutin",
    },
    roles: [
      {
        id: "r_membre",
        technical_name: "member",
        friendly_name: "Membre",
        properties: { can_vote: true, is_representative: false },
      },
      {
        id: "r_bureau",
        technical_name: "board_member",
        friendly_name: "Membre du Bureau",
        properties: { can_vote: true, is_representative: true },
      },
    ],
    rules: {
      can_delegate: true,
      requires_consensus: false,
      vote_weight: "1_person_1_vote",
      show_weight_badge: false,
      can_guests_vote: false,
      can_guests_interact: true,
      can_authenticated_vote: false,
      show_results_by_college: true,
      speech_priority_by_role: true,
    },
  },
  {
    id: "entreprise_sa",
    name: "Assemblée d'Actionnaires",
    description:
      "Modèle centré sur l'actionnariat et les droits de vote proportionnels.",
    icon: "Briefcase",
    votingType: "weighted",
    weightLabel: "Actions",
    resultsLabel: "Répartition par capital",
    terminology: {
      member: "Actionnaire",
      members: "Actionnaires",
      assembly: "Conseil d'Administration",
      session: "Comité",
      instance: "Direction",
      decision: "Arbitrage",
      representative: "Directeur",
      represented: "Mandant",
      dashboard: "Reporting",
      proposition: "Motion de gestion",
      vote: "Validation",
    },
    roles: [
      {
        id: "r_actionnaire",
        technical_name: "member",
        friendly_name: "Actionnaire",
        properties: { can_vote: true, is_representative: false },
      },
      {
        id: "r_dirigeant",
        technical_name: "representative",
        friendly_name: "Dirigeant",
        properties: { can_vote: true, is_representative: true },
      },
    ],
    rules: {
      can_delegate: true,
      requires_consensus: false,
      vote_weight: "proportional_to_shares",
      show_weight_badge: true,
      can_guests_vote: false,
      can_guests_interact: false, // Plus strict en entreprise
      can_authenticated_vote: false,
      show_results_by_college: true,
      speech_priority_by_role: true,
    },
    quickVoteOptions: [
      { id: "ok", label: "Approuvé", color: "emerald", icon: "CheckCircle2" },
      { id: "no", label: "Refusé", color: "rose", icon: "XCircle" },
      { id: "off", label: "Abstention", color: "sky", icon: "HelpCircle" },
    ],
    propositionVoteOptions: [
      { id: "approve", label: "Pour", color: "green" },
      { id: "disapprove", label: "Contre", color: "red" },
      { id: "abstain", label: "Abstention", color: "gray" },
    ],
    interactionActions: [
      {
        id: "technical",
        label: "Point d'ordre",
        color: "orange",
        icon: "AlertTriangle",
      },
    ],
  },
  {
    id: "municipal",
    name: "Conseil Municipal",
    description: "Modèle structuré pour les collectivités territoriales.",
    icon: "Building2",
    votingType: "opov",
    weightLabel: "Voix",
    resultsLabel: "Délibérations",
    terminology: {
      member: "Élu",
      members: "Élus",
      assembly: "Conseil",
      session: "Séance",
      instance: "Bureau Municipal",
      decision: "Délibération",
      representative: "Maire / Adjoint",
      represented: "Élu Représenté",
      dashboard: "Suivi",
      proposition: "Rapport",
      vote: "Vote",
    },
    roles: [
      {
        id: "r_elu",
        technical_name: "member",
        friendly_name: "Conseiller Municipal",
        properties: { can_vote: true, is_representative: false },
      },
      {
        id: "r_maire",
        technical_name: "board_member",
        friendly_name: "Maire / Adjoint",
        properties: { can_vote: true, is_representative: true },
      },
    ],
    rules: {
      can_delegate: true,
      requires_consensus: false,
      vote_weight: "1_person_1_vote",
      show_weight_badge: false,
      can_guests_vote: false,
      can_guests_interact: true,
      can_authenticated_vote: false,
      show_results_by_college: true,
      speech_priority_by_role: true,
    },
  },
  {
    id: "mouvement_citoyen",
    name: "Mouvement Citoyen",
    description: "Structure fluide et horizontale pour l'action collective.",
    icon: "Users",
    votingType: "opov",
    weightLabel: "Avis",
    resultsLabel: "Consensus",
    terminology: {
      member: "Participant",
      members: "Participants",
      assembly: "Agora",
      session: "Cercle d'Action",
      instance: "Noyau de Coordination",
      decision: "Consentement",
      representative: "Facilitateur",
      dashboard: "Flux",
      proposition: "Sujet",
      vote: "Avis",
    },
    roles: [
      {
        id: "r_participant",
        technical_name: "member",
        friendly_name: "Participant",
        properties: { can_vote: true, is_representative: false },
      },
    ],
    rules: {
      can_delegate: true,
      requires_consensus: true,
      vote_weight: "1_person_1_vote",
      show_weight_badge: false,
    },
  },
  {
    id: "copropriete",
    name: "Copropriété",
    description: "Gestion d'immeuble ou de biens partagés.",
    icon: "Home",
    votingType: "weighted",
    weightLabel: "Tantièmes",
    resultsLabel: "Répartition par tantièmes",
    terminology: {
      member: "Copropriétaire",
      members: "Copropriétaires",
      assembly: "AG de Copropriété",
      session: "Réunion de Syndic",
      instance: "Syndic",
      decision: "Résolution",
      representative: "Conseil Syndical",
      dashboard: "État de l'Immeuble",
      proposition: "Résolution",
      vote: "Vote",
    },
    roles: [
      {
        id: "r_coproprietaire",
        technical_name: "member",
        friendly_name: "Copropriétaire",
        properties: { can_vote: true, is_representative: false },
      },
    ],
    rules: {
      can_delegate: true,
      requires_consensus: false,
      vote_weight: "weighted_by_tantiemes",
      show_weight_badge: true,
    },
  },
  {
    id: "conseil_municipal",
    name: "Conseil Municipal",
    description: "Délibération d'une collectivité locale.",
    icon: "Landmark",
    votingType: "opov",
    weightLabel: "Suffrages",
    resultsLabel: "Délibération Officielle",
    terminology: {
      member: "Conseiller",
      members: "Conseillers",
      assembly: "Conseil Municipal",
      session: "Séance",
      instance: "Mairie",
      decision: "Délibération",
      representative: "Maire / Adjoint",
      dashboard: "Actes de la Commune",
      proposition: "Projet de délibération",
      vote: "Vote",
    },
    roles: [
      {
        id: "r_conseiller",
        technical_name: "member",
        friendly_name: "Conseiller",
        properties: { can_vote: true, is_representative: false },
      },
    ],
    rules: {
      can_delegate: true,
      requires_consensus: false,
      vote_weight: "1_person_1_vote",
      show_weight_badge: false,
    },
  },
  {
    id: "tribunal",
    name: "Tribunal / Arbitrage",
    description: "Rendu de justice ou arbitrage de litige.",
    icon: "Gavel",
    votingType: "opov",
    weightLabel: "Intime Conviction",
    resultsLabel: "Verdict / Sentence",
    terminology: {
      member: "Juré / Arbitre",
      members: "Jury / Collège",
      assembly: "Audience",
      session: "Délibéré",
      instance: "Chambre",
      decision: "Jugement",
      representative: "Président",
      dashboard: "Rôle",
      proposition: "Chef d'accusation / Litige",
      vote: "Verdict",
    },
    roles: [
      {
        id: "r_jure",
        technical_name: "member",
        friendly_name: "Juré",
        properties: { can_vote: true, is_representative: false },
      },
    ],
    rules: {
      can_delegate: false,
      requires_consensus: false,
      vote_weight: "1_person_1_vote",
      show_weight_badge: false,
    },
  },
  {
    id: "chapitre",
    name: "Chapitre (Ordre / Sacré)",
    description: "Décision au sein d'une communauté régulière ou spirituelle.",
    icon: "BookOpen",
    votingType: "opov",
    weightLabel: "Rang",
    resultsLabel: "Règle de Vie / Décision",
    terminology: {
      member: "Frère / Sœur",
      members: "Communauté",
      assembly: "Chapitre",
      session: "Récollection",
      instance: "Prieuré",
      decision: "Règle",
      representative: "Abbé / Supérieur",
      dashboard: "Cartulaire",
      proposition: "Vocation / Règle",
      vote: "Suffrage",
    },
    roles: [
      {
        id: "r_religieux",
        technical_name: "member",
        friendly_name: "Membre de la communauté",
        properties: { can_vote: true, is_representative: false },
      },
    ],
    rules: {
      can_delegate: false,
      requires_consensus: true,
      vote_weight: "1_person_1_vote",
      show_weight_badge: false,
    },
  },
  {
    id: "dao",
    name: "DAO (Algorithmique)",
    description: "Organisation autonome décentralisée sur la blockchain.",
    icon: "Cpu",
    votingType: "weighted",
    weightLabel: "Tokens",
    resultsLabel: "Consensus On-Chain",
    terminology: {
      member: "Token Holder",
      members: "Community",
      assembly: "Governance Portal",
      session: "Voting Period",
      instance: "Smart Contract",
      decision: "Execution",
      representative: "Council",
      dashboard: "Analytics",
      proposition: "SIP / Improvement Proposal",
      vote: "Sign",
    },
    roles: [
      {
        id: "r_holder",
        technical_name: "member",
        friendly_name: "Token Holder",
        properties: { can_vote: true, is_representative: false },
      },
    ],
    rules: {
      can_delegate: true,
      requires_consensus: false,
      vote_weight: "proportional_to_tokens",
      show_weight_badge: true,
    },
  },
];

/**
 * Récupère un modèle par son ID
 */
export function getGovernanceModel(id) {
  return GOVERNANCE_MODELS.find((m) => m.id === id) || GOVERNANCE_MODELS[0];
}

/**
 * Récupère la terminologie complète pour un modèle donné
 */
export function getTerminology(modelId) {
  const model = getGovernanceModel(modelId);
  return model.terminology;
}

/**
 * Récupère un terme spécifique
 */
export function getTerm(modelId, termKey, defaultValue = "") {
  const terminology = getTerminology(modelId);
  return terminology[termKey] || defaultValue;
}

/**
 * Calcule les résultats des votes en fonction du modèle
 */
export function calculateResults(votes, modelId, options = {}) {
  const model = getGovernanceModel(modelId);
  const votingType = model?.rules?.vote_weight || "1_person_1_vote";
  const results = {};
  const collegeResults = {
    member: {},
    other: {},
  };

  Object.entries(votes).forEach(([userId, v]) => {
    // Si c'est un vote de type "delegate" ou "parole", on ne compte pas dans les résultats de vote
    if (v.type === "delegate" || v.type === "parole" || v.type === "technical")
      return;

    // Si le votant est ostracisé (passé via options), son vote ne compte pas
    if (options.ostracized && options.ostracized[userId]) {
      return;
    }

    const weight = votingType === "proportional_to_shares" ? v.weight || 1 : 1;
    results[v.type] = (results[v.type] || 0) + weight;

    // Calcul par collège si demandé
    if (options.userRoles && options.userRoles[userId]) {
      const role = options.userRoles[userId];
      const college = role === "member" ? "member" : "other";
      collegeResults[college][v.type] =
        (collegeResults[college][v.type] || 0) + weight;
    }
  });

  if (options.groupByRole) {
    return {
      total: results,
      byCollege: collegeResults,
    };
  }

  return results;
}

/**
 * Liste tous les types de membres disponibles à travers les modèles
 */
export function getAllMemberTypes() {
  return [...new Set(GOVERNANCE_MODELS.map((m) => m.terminology.member))];
}

///////////////////////////////
// Fonctions de Gestion (CRUD - Pure Functions)
///////////////////////////////

/**
 * Ajoute un nouveau modèle de gouvernance
 */
export function addGovernanceModel(models, newModel) {
  return [...models, newModel];
}

/**
 * Met à jour un modèle existant
 */
export function updateGovernanceModel(models, id, updates) {
  return models.map((m) => (m.id === id ? { ...m, ...updates } : m));
}

/**
 * Ajoute un rôle à un modèle
 */
export function addRole(model, role) {
  return {
    ...model,
    roles: [...(model.roles || []), role],
  };
}

/**
 * Met à jour un rôle dans un modèle
 */
export function updateRole(model, roleId, updates) {
  return {
    ...model,
    roles: (model.roles || []).map((r) =>
      r.id === roleId ? { ...r, ...updates } : r
    ),
  };
}

///////////////////////////////
// Fonctions de Recherche et Filtrage
///////////////////////////////

/**
 * Récupère un rôle spécifique dans un modèle
 */
export function getRole(modelId, roleId) {
  const model = getGovernanceModel(modelId);
  return model?.roles?.find((r) => r.id === roleId);
}

/**
 * Filtre les rôles par propriété (ex: can_vote: true)
 */
export function filterRolesByProperty(modelId, property, value) {
  const model = getGovernanceModel(modelId);
  return (model?.roles || []).filter((r) => r.properties[property] === value);
}

///////////////////////////////
// Conversion Prolog (pour le moteur de règles)
///////////////////////////////

/**
 * Génère des faits Prolog à partir des modèles de gouvernance
 */
export function toPrologFacts() {
  const facts = [];

  GOVERNANCE_MODELS.forEach((m) => {
    // Fait pour le modèle
    facts.push(
      `governance_model("${m.id}", "${m.name}", "${m.rules.vote_weight}").`
    );

    // Faits pour la terminologie
    Object.entries(m.terminology).forEach(([key, term]) => {
      // Nettoyer le terme pour éviter les problèmes Prolog si nécessaire
      const cleanTerm = term.replace(/"/g, '\\"');
      facts.push(`terminology("${m.id}", "${key}", "${cleanTerm}").`);
    });

    // Faits pour les rôles et propriétés
    (m.roles || []).forEach((r) => {
      facts.push(`role("${m.id}", "${r.id}", "${r.technical_name}").`);
      Object.entries(r.properties).forEach(([prop, val]) => {
        const prologVal = typeof val === "string" ? `"${val}"` : val;
        facts.push(`property("${r.id}", "${prop}", ${prologVal}).`);
      });
    });

    // Faits pour les règles
    Object.entries(m.rules).forEach(([rule, val]) => {
      const prologVal = typeof val === "string" ? `"${val}"` : val;
      facts.push(`rule("${m.id}", "${rule}", ${prologVal}).`);
    });
  });

  // Ajout des règles logiques de base (Déductions)
  facts.push("\n% --- RÈGLES DE GOUVERNANCE ---");

  // Règle de base pour le droit de vote :
  // Un utilisateur peut voter s'il a un rôle dans le modèle actuel qui autorise le vote,
  // ET s'il n'est pas ostracisé.
  facts.push(`
can_vote(UserId) :-
    current_room_model(ModelId),
    role(ModelId, RoleId, _),
    property(RoleId, "can_vote", true),
    not(is_ostracized(UserId)).

% Un utilisateur est ostracisé s'il existe un fait ostracized pour lui.
% (On pourrait ajouter ici une vérification de la durée par rapport à l'heure actuelle)
is_ostracized(UserId) :-
    ostracized(UserId, _, _, _).

% Déduction de la terminologie correcte pour un utilisateur
user_term(UserId, Term) :-
    current_room_model(ModelId),
    terminology(ModelId, "member", Term).
  `);

  return facts.join("\n");
}
