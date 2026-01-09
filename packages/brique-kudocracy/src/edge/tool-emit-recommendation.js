export default async function handler({ runtime, args }) {
  return {
    success: true,
    recommendation: args.recommendation,
    rationale: args.rationale,
  };
}
