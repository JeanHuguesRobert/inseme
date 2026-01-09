export default async function handler({ runtime, args }) {
  return {
    success: true,
    demande_id: args.demande_id,
    status: "En cours de traitement",
    updated_at: new Date().toISOString(),
  };
}
