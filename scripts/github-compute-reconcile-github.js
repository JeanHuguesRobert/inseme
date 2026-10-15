import {computeClaimRef, computePayloadDigest} from "./github-compute-claim.js";
import {reconcileComputeClaim} from "./github-compute-reconcile.js";

/** Pure decoder of GitHub COP callback; does not itself authenticate any content. */
export function decodeComputeReceipts(comments, computationId) {
  if (!Array.isArray(comments)) throw Error("invalid_comments");
  const marker = `<!-- cop-compute-result:${computationId} -->`;
  const out = [];
  for (const comment of comments) {
    const body = String(comment?.body ?? "");
    if (!body.startsWith(marker)) continue;
    const json = body.match(/```json\s*([\s\S]*?)\s*```/);
    if (!json) throw Error("malformed_terminal_comment");
    const obj = JSON.parse(json[1]);
    if (obj.schema !== "cop.compute-result/v1" || obj.computation_id !== computationId)
      throw Error("receipt_identity_mismatch");
    const receipt = obj.execution_receipt;
    if (!receipt || receipt.schema !== "magistral.execution-receipt/v1")
      throw Error("invalid_execution_receipt");
    out.push({computation_id: obj.computation_id, status:receipt.status,
      terminal:receipt.terminal, run_id:receipt.binding?.provider_execution_id,
      raw_comment_id: comment.id ?? null});
  }
  return out;
}

/**
 * The caller supplies an authenticated GitHub API reader (not arbitrary observations):
 * getTag(repository, tagName), getRun(repository, runId), getComments(repository, issue).
 * Read-only, bounded, and fail-closed. Does NOT grant new claim or re-execution.
 */
export async function reconcileGithubCompute({request, issue, api}) {
  const inconclusive = (reason) => ({schema:"cop.compute-reconciliation/v1",
    state:"inconclusive",reason,automatic_retry_authorized:false});
  try {
    if (!request || request.schema !== "cop.compute-request/v1" ||
        !Number.isSafeInteger(issue) || issue < 1 ||
        !api || !["getTag","getRun","getComments"].every(k=>typeof api[k] === "function"))
      return inconclusive("invalid_reconciliation_inputs");
    const repository = request.repository?.name;
    const ref = computeClaimRef({repository, computation_id:request.computation_id});
    const digest = computePayloadDigest(request);
    const tag = await api.getTag(repository, ref.slice("refs/tags/".length));
    const identity = JSON.parse(tag?.message ?? "");
    if (identity.schema !== "cop.compute-claim/v1" || identity.ref !== ref ||
        identity.computation_id !== request.computation_id)
      return inconclusive("claim_tag_identity_mismatch");
    if (identity.payload_sha256 !== digest)
      return { ...inconclusive("claim_digest_collision"), state:"blocked" };
    if (!/^[0-9]+$/.test(String(identity.run_id ?? "")))
      return inconclusive("claim_owner_invalid");
    const run = await api.getRun(repository, identity.run_id);
    const comments = await api.getComments(repository, issue);
    if (run?.repository?.full_name !== repository || String(run.id) !== String(identity.run_id))
      return inconclusive("provider_run_identity_mismatch");
    const receipts = decodeComputeReceipts(comments, request.computation_id);
    return reconcileComputeClaim({
      claim:{...identity, repository, status:"claimed"},
      provider:{authoritative:true, repository, run_id:String(run.id),
        status:run.status, conclusion:run.conclusion},
      receipts,
      delivery:{status:receipts.length ? "delivered" : "unknown"}
    });
  } catch (err) {
    return inconclusive("provider_read_or_decode_failed:" + String(err?.message ?? "unknown").slice(0,100));
  }
}
