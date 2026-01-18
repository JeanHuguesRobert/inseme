/**
 * ALMANAC.JS
 * A lightweight anthropological guide for Cyrnea.
 * Maps dates to French Saints, Corsican Milestones, and Social Rituals.
 */

const SAINTS = {
  "01-01": { name: "Jour de l'An", ritual: "A Salute !" },
  "01-17": {
    name: "Saint Antoine le Grand",
    ritual: "Bénédiction des animaux",
  },
  "01-20": { name: "Saint Sébastien", ritual: "Fête du saint patron" },
  "02-14": { name: "Saint Valentin", ritual: "Ambiance romantique" },
  "03-17": { name: "Saint Patrick", ritual: "Célébration au comptoir" },
  "03-19": { name: "Saint Joseph", ritual: "Fête à Bastia / Panzerotti" },
  "04-01": { name: "Poisson d'Avril", ritual: "Macagna !" },
  "05-01": { name: "Fête du Travail", ritual: "Muguet et repos" },
  "05-08": { name: "Victoire 1945", ritual: "Commémoration" },
  "06-13": {
    name: "Saint Antoine de Padoue",
    ritual: "Pains bénis (San-Ruchinu)",
  },
  "06-21": { name: "Fête de la Musique", ritual: "Polyphonies et fête" },
  "06-24": {
    name: "Saint Jean",
    ritual: "Feux de la Saint-Jean / Pace e Salute",
  },
  "07-14": { name: "Fête Nationale", ritual: "Bal populaire" },
  "08-15": { name: "Assomption", ritual: "Marie, Reine de Corse" },
  "08-16": { name: "Saint Roch", ritual: "Distribution de pain béni" },
  "10-31": { name: "Halloween", ritual: "Ambiance mystérieuse" },
  "11-01": { name: "Toussaint", ritual: "Souvenir des ancêtres" },
  "11-11": { name: "Armistice 1918", ritual: "Commémoration" },
  "11-30": {
    name: "Sant'Andria",
    ritual: "Partage et solidarité (On frappe aux portes)",
  },
  "12-08": {
    name: "Festa di a Nazione",
    ritual: "Immaculée Conception / Hymne Corse",
  },
  "12-24": { name: "Réveillon de Noël", ritual: "U Fuconu (Le grand feu)" },
  "12-25": { name: "Noël", ritual: "Pace e Salute" },
  "12-31": { name: "Saint Sylvestre", ritual: "Dernier verre de l'année" },
};

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

export const BAR_RITUALS = [
  {
    id: "tournee",
    name: "La Tournée",
    ritual: "Offrir un verre à la cantonade",
    icon: "Coffee",
  },
  {
    id: "macagna",
    name: "La Macagna",
    ritual: "Une petite moquerie amicale pour détendre l'atmosphère",
    icon: "Wind",
  },
  {
    id: "cloche",
    name: "La Cloche",
    ritual: "Faire sonner la cloche pour un pourboire ou un moment fort",
    icon: "Zap",
  },
  {
    id: "dernier",
    name: "Le Dernier pour la Route",
    ritual: "Le verre de la fermeture, celui qu'on ne finit jamais vraiment",
    icon: "Clock",
  },
  {
    id: "alibi",
    name: "L'Alibi Imparable",
    ritual: "Trouver une excuse créative pour rester 10 minutes de plus",
    icon: "Home",
  },
  {
    id: "polyphonie",
    name: "La Polyphonie",
    ritual: "Entonner un chant traditionnel quand l'ambiance est au sommet",
    icon: "Music",
  },
  {
    id: "suspendu",
    name: "Café Suspendu",
    ritual: "Payer un café d'avance pour un prochain client anonyme",
    icon: "Heart",
  },
  {
    id: "echo",
    name: "L'Écho du Comptoir",
    description:
      "Ophélia résume les meilleurs moments et macagnes de la soirée avant la fermeture.",
    ritual: "clôture",
    icon: "Wind",
  },
];

export const getDailyAlibi = (dateOverride = null) => {
  const date = dateOverride || new Date();
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const key = `${month}-${day}`;

  const event = SAINTS[key];
  const dateStr = `${date.getDate()} ${MONTHS[date.getMonth()]}`;

  return {
    date: dateStr,
    name: event?.name || "Journée de Convivialité",
    ritual: event?.ritual || "Un moment de partage",
    isCorsicanMilestone: ["12-08", "11-30", "08-15", "06-24", "03-19"].includes(key),
  };
};

export const ALMANAC_RITUALS = SAINTS;
