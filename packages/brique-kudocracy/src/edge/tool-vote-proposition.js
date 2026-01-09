export default async function handler({ runtime, args }) {
  return {
    success: true,
    message: `Vote enregistré pour la proposition ${args.proposition_id} avec la valeur ${args.value}`,
  };
}
