import { createGithubComputeAccountingBridge } from "./githubComputeAccountingBridge.js";

/**
 * Internal FractaNode consumer of trusted, durable GitHub compute callbacks.
 * Reservation id is deterministically tied to the computation and provider run;
 * the SQL reservation/event unique keys supply durable dedup across restarts.
 * fetchResult MUST independently resolve the trusted callback by run id; never
 * accept a result directly from an untrusted request body.
 */
export function createGithubComputeAccountingConsumer({ lifecycle, fetchResult } = {}) {
  if (typeof fetchResult !== "function") throw new TypeError("trusted callback fetcher required");
  const bridge = createGithubComputeAccountingBridge({ lifecycle });
  const text = (value, name) => {
    if (typeof value !== "string" || !value.trim() || !/^[a-zA-Z0-9._:/-]+$/.test(value))
      throw new TypeError(name + " must be a safe identifier");
    return value;
  };
  const reservationKey = (computation_id, run_id) =>
    `github-compute:${text(computation_id,"computation_id")}:${text(run_id,"run_id")}`;
  const checkResult = (result, { computation_id, run_id, repository, source_ref }) => {
    if (result?.schema !== "cop.compute-result/v1" ||
      result.computation_id !== computation_id ||
      String(result.execution_binding?.provider_execution_id) !== run_id ||
      result.execution_binding?.provider_ref !== "provider:github-actions" ||
      result.source?.repository !== repository || result.source?.ref !== source_ref)
      throw new Error("COP_ACCOUNTING_COMPUTE_BINDING_MISMATCH");
    if (result.execution_receipt?.binding?.provider_execution_id !== result.execution_binding.provider_execution_id)
      throw new Error("COP_ACCOUNTING_COMPUTE_RECEIPT_MISMATCH");
    return result;
  };
  return {
    reservationKey,
    async reserve({ epoch_id, budget_ref, unit, computation_id, run_id, maximum, actor }) {
      return bridge.reserve({epoch_id,budget_ref,unit,
        reservation_key:reservationKey(computation_id,run_id),maximum,actor});
    },
    async settle({ epoch_id, computation_id, run_id, repository, source_ref, actor, usage_dimension, issue_number }) {
      const expected={computation_id:text(computation_id,"computation_id"),run_id:text(run_id,"run_id"),
        repository:text(repository,"repository"),source_ref:text(source_ref,"source_ref")};
      if (issue_number !== undefined) {
        if (!Number.isSafeInteger(issue_number) || issue_number < 1) throw new TypeError("invalid issue_number");
        expected.issue_number=issue_number;
      }
      const result=checkResult(await fetchResult(expected),expected);
      return bridge.settle({epoch_id,
        reservation_key:reservationKey(computation_id,run_id),actor,result,usage_dimension});
    }
  };
}
