export default async function handler({ runtime, args }) {
  return {
    success: true,
    actes: [
      { id: "acte-1", title: "Arrêté municipal n°2026-01", type: "Arrêté", year: 2026 },
      { id: "acte-2", title: "Délibération du conseil", type: "Délibération", year: 2026 },
    ],
  };
}
