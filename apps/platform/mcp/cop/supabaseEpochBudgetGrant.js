/**
 * Transactional accounting adapter. The service-role Supabase client must be
 * supplied by a trusted host; never initialize it from an HTTP request.
 * The matching PostgreSQL function journals grant and budget atomically.
 */
export function createSupabaseEpochBudgetGrant({ supabase } = {}) {
  if (!supabase || typeof supabase.rpc !== "function") throw new TypeError("trusted supabase client required");
  return async ({ epoch_id, budget_ref, mandate_ref, mandate_version, unit, amount, actor, authority_ref }) => {
    const { data, error } = await supabase.rpc("cop_grant_epoch_budget_v2", {
      p_epoch_id: epoch_id,
      p_budget_ref: budget_ref,
      p_mandate_ref: mandate_ref,
      p_mandate_version: mandate_version,
      p_unit: unit,
      p_amount: amount,
      p_actor: actor,
      p_authority_ref: authority_ref,
    });
    if (error) throw new Error("COP_ACCOUNTING_GRANT_FAILED: " + (error.code || error.message || "database_error"));
    return data;
  };
}


/**
 * Host-internal accounting entry point, not an HTTP handler.
 * Caller already resides in the trusted perimeter and holds a service-role
 * client. Actor and authority reference remain mandatory audit identities.
 */
export function createSupabaseInternalBudgetGrant({ supabase } = {}) {
  if (!supabase || typeof supabase.rpc !== "function") throw new TypeError("trusted supabase client required");
  return async ({ epoch_id, budget_ref, unit, amount, actor, authority_ref }) => {
    if (![epoch_id, budget_ref, unit, actor, authority_ref].every(v => typeof v === "string" && v.length > 0)
      || typeof amount !== "string" || !/^(?:0*[1-9][0-9]*|[0-9]*\.[0-9]*[1-9][0-9]*)$/.test(amount)) {
      throw new TypeError("valid internal grant and audit identity required");
    }
    const { data, error } = await supabase.rpc("cop_grant_epoch_budget_internal", {
      p_epoch_id: epoch_id,
      p_budget_ref: budget_ref,
      p_unit: unit,
      p_amount: amount,
      p_actor: actor,
      p_authority_ref: authority_ref,
    });
    if (error) throw new Error("COP_ACCOUNTING_GRANT_FAILED: " + (error.code || error.message || "database_error"));
    return data;
  };
}
