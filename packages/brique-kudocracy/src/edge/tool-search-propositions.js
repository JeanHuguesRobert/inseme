export default async function handler({ runtime, args }) {
  return {
    success: true,
    propositions: [
      { id: "prop-1", title: "Cantine bio pour tous", status: "active" },
      { id: "prop-2", title: "Pistes cyclables sécurisées", status: "active" },
    ],
  };
}
