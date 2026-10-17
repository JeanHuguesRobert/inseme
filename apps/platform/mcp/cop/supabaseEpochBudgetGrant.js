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


/**
 * Trusted-perimeter budget lifecycle. These RPCs already journal atomically.
 * Mandate/provenance for reservations comes from the stored budget, never from
 * an untrusted caller; do not expose these closures as unauthenticated HTTP.
 */
export function createSupabaseInternalBudgetLifecycle({ supabase } = {}) {
  if (!supabase || typeof supabase.rpc !== "function" || typeof supabase.from !== "function") {
    throw new TypeError("trusted supabase client with rpc and from required");
  }
  const rpc = async (name, params) => {
    const { data, error } = await supabase.rpc(name, params);
    if (error) throw new Error("COP_ACCOUNTING_LIFECYCLE_FAILED: " + (error.code || error.message || "database_error"));
    return data;
  };
  return {
    reserve: async ({ epoch_id, budget_ref, unit, reservation_key, amount, actor }) => {
      if (![epoch_id, budget_ref, unit, reservation_key, actor].every(v => typeof v === "string" && v.length > 0)
        || typeof amount !== "string" || !/^(?:0*[1-9][0-9]*|[0-9]*\\.[0-9]*[1-9][0-9]*)$/.test(amount)) {
        throw new TypeError("valid reservation and audit identity required");
      }
      const { data, error } = await supabase.from("cop_accounting_epoch_budget")
        .select("mandate_ref").eq("epoch_id", epoch_id).eq("budget_ref", budget_ref).eq("unit", unit).single();
      if (error || !data?.mandate_ref) throw new Error("COP_ACCOUNTING_BUDGET_NOT_FOUND");
      return rpc("cop_reserve_epoch_budget_recorded", {
        p_epoch_id: epoch_id, p_budget_ref: budget_ref, p_mandate_ref: data.mandate_ref,
        p_unit: unit, p_key: reservation_key, p_amount: amount, p_actor: actor,
      });
    },
    settle: async ({ epoch_id, reservation_key, spent, actor }) => {
      if (![epoch_id, reservation_key, actor].every(v => typeof v === "string" && v.length > 0)
        || typeof spent !== "string" || !/^(?:0*[0-9]+)(?:\\.[0-9]+)?$/.test(spent)) {
        throw new TypeError("valid settlement and audit identity required");
      }
      return rpc("cop_settle_epoch_budget_recorded", {
        p_epoch_id: epoch_id, p_reservation_key: reservation_key, p_spent: spent, p_actor: actor,
      });
    },
  };
}
