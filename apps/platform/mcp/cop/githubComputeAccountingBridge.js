/**
 * Trusted-host COP Accounting adapter for a GitHub compute result.
 * Execution on GitHub Actions carries only references; the service-role key
 * stays on the FractaNode. Never infer billable usage from elapsed wall time.
 */
export function createGithubComputeAccountingBridge({ lifecycle } = {}) {
  if (typeof lifecycle?.reserve !== "function" || typeof lifecycle?.settle !== "function")
    throw new TypeError("trusted accounting lifecycle required");
  const required = (s, name) => {
    if (typeof s !== "string" || !s.trim()) throw new TypeError(name + " required");
    return s;
  };
  return {
    async reserve({ epoch_id, budget_ref, unit, reservation_key, maximum, actor }) {
      [epoch_id,budget_ref,unit,reservation_key,actor].forEach((x,i)=>
        required(x,["epoch_id","budget_ref","unit","reservation_key","actor"][i]));
      return lifecycle.reserve({epoch_id,budget_ref,unit,reservation_key,amount:maximum,actor});
    },
    async settle({ epoch_id, reservation_key, actor, result, usage_dimension }) {
      [epoch_id,reservation_key,actor,usage_dimension].forEach((x,i)=>
        required(x,["epoch_id","reservation_key","actor","usage_dimension"][i]));
      if (result?.schema !== "cop.compute-result/v1")
        throw new TypeError("validated compute result required");
      if (!result.execution_receipt?.terminal)
        throw new Error("COP_ACCOUNTING_NONTERMINAL_RESULT");
      const metric = result.resource_accounting?.usage?.[usage_dimension];
      if (!metric || metric.status !== "observed" || metric.unit !== usage_dimension ||
          !Number.isFinite(metric.value) || metric.value < 0)
        throw new Error("COP_ACCOUNTING_UNMEASURED_USAGE");
      // Caller must bind result.computation_id + provider execution receipt to
      // this reservation before invoking. Never use a missing meter as zero.
      return lifecycle.settle({epoch_id,reservation_key,spent:String(metric.value),actor});
    }
  };
}
