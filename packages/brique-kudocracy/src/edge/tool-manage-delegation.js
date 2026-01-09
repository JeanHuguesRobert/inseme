export default async function handler({ runtime, args }) {
  return {
    success: true,
    message: `Délégation ${args.action} effectuée pour le tag ${args.tag}`,
  };
}
