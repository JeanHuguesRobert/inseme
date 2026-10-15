/**
 * Read-only evidence reconciliation for one-shot E5 claims.
 * Never authorizes retry or effects. Provider observations must come from
 * a separately authenticated adapter; caller assertions are not authority.
 */
export function reconcileComputeClaim({claim, provider, receipts, delivery} = {}) {
  const evidence = {claim: claim ?? null, provider: provider ?? null,
    receipts: receipts ?? null, delivery: delivery ?? null};
  const reply = (state, reason) => ({
    schema: "cop.compute-reconciliation/v1", state, reason,
    automatic_retry_authorized: false, evidence
  });
  if (!claim || claim.status === "deferred" || !provider || !Array.isArray(receipts))
    return reply("inconclusive", "missing_or_unavailable_authoritative_evidence");
  if (claim.status === "collision") return reply("blocked", "payload_identity_collision");
  if (!["claimed", "contended"].includes(claim.status) || !claim.prior_run_id && claim.status === "contended" && !claim.run_id)
    return reply("inconclusive", "unresolved_claim_owner");
  const owner = String(claim.status === "claimed" ? claim.run_id : claim.prior_run_id ?? claim.run_id);
  if (!/^\\d+$/.test(owner) || String(provider.run_id ?? "") !== owner)
    return reply("inconclusive", "provider_owner_not_correlated");
  if (provider.authoritative !== true)
    return reply("inconclusive", "provider_observation_not_authoritative");
  if (provider.error || !["queued", "in_progress", "completed"].includes(provider.status))
    return reply("inconclusive", "provider_state_unknown_or_nonterminal");
  const matching = receipts.filter(r => r?.computation_id === claim.computation_id);
  if (matching.length > 1) return reply("manual_review", "multiple_terminal_receipts");
  if (matching.some(r => r?.payload_sha256 && r.payload_sha256 !== claim.payload_sha256))
    return reply("blocked", "receipt_payload_mismatch");
  if (matching.length === 1) {
    const r = matching[0];
    if (r.terminal !== true || !["completed", "failed"].includes(r.status))
      return reply("inconclusive", "receipt_not_terminal");
    return reply(r.status === "completed" ? "healthy" : "manual_review",
      r.status === "completed" ? "terminal_compute_receipt_found" : "terminal_compute_failure_found");
  }
  if (["queued", "in_progress"].includes(provider.status))
    return reply("awaiting_owner", "provider_run_active");
  if (provider.conclusion === "success")
    return reply("manual_review", "workflow_success_without_business_receipt");
  return reply("orphan_candidate", "provider_terminated_without_business_receipt");
}
