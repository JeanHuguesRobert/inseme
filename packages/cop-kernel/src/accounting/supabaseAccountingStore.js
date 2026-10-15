/**
 * Durable COP accounting store (Supabase / Postgres).
 *
 * Persists immutable accounting events and maintains projected balances.
 * Legal statements (bilan, compte de résultat) are *views* over events + chart,
 * not separate mutable books.
 *
 * Tables (see migrations):
 *   cop_accounting_event
 *   cop_accounting_balance
 *   cop_accounting_budget
 *   cop_accounting_posting (optional normalized lines)
 *   cop_accounting_packet_spend (packet own-spend index)
 */

/**
 * @param {object} options
 * @param {object} options.supabase - supabase-js client
 * @param {string} [options.schema="public"]
 */
export function createSupabaseAccountingStore(options = {}) {
  const sb = options.supabase;
  if (!sb) throw new Error("createSupabaseAccountingStore: supabase client required");

  return {
    kind: "cop_supabase_accounting_store/v1",

    /**
     * Append-only accounting event (idempotent on idempotency_key).
     * Compatible with cop-event-persist pipeline store.append shape.
     */
    async append(envelope) {
      const event = envelope?.event || envelope;
      const idempotency_key = event.idempotency_key || event.payload?.idempotency_key;
      if (!idempotency_key) {
        return { ok: false, error: "idempotency_key_required" };
      }

      const row = {
        schema_version: event.schema_version || "1.0",
        event_type: event.event_type || event.eventType || "accounting/transaction",
        idempotency_key,
        actor_id: String(
          event.source || event.payload?.governance?.actor_subject_id || event.actor_id || "unknown"
        ),
        principal_id: String(
          event.payload?.governance?.principal_subject_id ||
            event.principal_id ||
            event.payload?.metadata?.principal ||
            "unknown"
        ),
        mandate_ref:
          event.payload?.governance?.mandate_id ||
          event.payload?.metadata?.mandate_id ||
          event.mandate_ref ||
          null,
        payload: event.payload || event,
      };

      const { data, error } = await sb
        .from("cop_accounting_event")
        .upsert(row, { onConflict: "idempotency_key", ignoreDuplicates: true })
        .select("*")
        .maybeSingle();

      if (error) {
        // Unique violation treated as duplicate success
        if (String(error.code) === "23505" || /duplicate/i.test(error.message || "")) {
          return { ok: true, duplicate: true, event: row };
        }
        return { ok: false, error: error.message || "upsert_failed", errors: [error] };
      }

      const isDuplicate = !data;
      if (data && !isDuplicate) {
        // Event insertion is durable before non-transactional projections.
        // Never claim successful accounting if a derived view failed.
        try {
          await projectBalanceFromTransaction(sb, data);
          await indexPacketSpend(sb, data);
        } catch (cause) {
          return {ok:false, error:"accounting_projection_incomplete",
            persisted_event:true, recovery_required:true,
            idempotency_key, event:data, cause:String(cause?.message || cause)};
        }
      }

      return {
        ok: true,
        duplicate: Boolean(isDuplicate),
        event: data || row,
      };
    },

    async getEventByIdempotencyKey(key) {
      const { data, error } = await sb
        .from("cop_accounting_event")
        .select("*")
        .eq("idempotency_key", key)
        .maybeSingle();
      if (error) return { ok: false, error: error.message };
      return { ok: true, event: data };
    },

    async listEvents({ limit = 100, event_type } = {}) {
      let q = sb
        .from("cop_accounting_event")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (event_type) q = q.eq("event_type", event_type);
      const { data, error } = await q;
      if (error) return { ok: false, error: error.message };
      return { ok: true, events: data || [] };
    },

    async listBalances({ account_id, unit } = {}) {
      let q = sb.from("cop_accounting_balance").select("*");
      if (account_id) q = q.eq("account_id", account_id);
      if (unit) q = q.eq("unit", unit);
      const { data, error } = await q;
      if (error) return { ok: false, error: error.message };
      return { ok: true, balances: data || [] };
    },
  };
}

/**
 * Apply balanced postings to projected balances (ExactQuantity JSON).
 */
async function projectBalanceFromTransaction(sb, eventRow) {
  const payload = eventRow.payload || {};
  const postings = payload.postings || [];
  if (!Array.isArray(postings) || !postings.length) return;

  const domain = payload.accounting_domain || "provisional_execution_spending";
  const resourceType = payload.resource_type || "fiat";

  for (const posting of postings) {
    const account_id = posting.account || posting.account_id;
    const qty = posting.quantity;
    if (!account_id || !qty) continue;
    const unit = qty.unit || "USD";
    const scale = Number(qty.scale) || 8;
    const coef = String(qty.coefficient || "0");

    const { data: existing } = await sb
      .from("cop_accounting_balance")
      .select("*")
      .eq("account_id", account_id)
      .eq("unit", unit)
      .eq("domain", domain)
      .maybeSingle();

    const zero = { coefficient: "0", scale, unit };
    let debit = existing?.total_debit || zero;
    let credit = existing?.total_credit || zero;
    let balance = existing?.balance || zero;

    if (posting.posting_type === "debit") {
      debit = addCoef(debit, coef, scale, unit);
      balance = addCoef(balance, coef, scale, unit);
    } else if (posting.posting_type === "credit") {
      credit = addCoef(credit, coef, scale, unit);
      balance = subCoef(balance, coef, scale, unit);
    }

    const row = {
      account_id,
      unit,
      domain,
      total_debit: debit,
      total_credit: credit,
      balance,
      last_event_id: eventRow.id || null,
      updated_at: new Date().toISOString(),
    };

    const {error: projectionError} = await sb.from("cop_accounting_balance").upsert(row, {
      onConflict: "account_id,unit,domain",
    });
    if(projectionError) throw Error("balance_projection_failed:" + (projectionError.message || projectionError.code));
  }

  // unused for now but kept for analytical filters
  void resourceType;
}

async function indexPacketSpend(sb, eventRow) {
  const payload = eventRow.payload || {};
  const meta = payload.metadata || {};
  const packet_id = meta.packet_id;
  if (!packet_id) return;

  const spend = (payload.postings || []).find((p) => p.posting_type === "debit");
  if (!spend?.quantity) return;

  {
    const {error: indexError} = await sb.from("cop_accounting_packet_spend").upsert(
      {
        packet_id,
        treatment_id: meta.treatment_id || null,
        hop_index: meta.hop_index ?? null,
        provider: meta.provider || null,
        model: meta.model || null,
        event_id: eventRow.id || null,
        idempotency_key: eventRow.idempotency_key,
        provisional_cost: spend.quantity,
        valuation_status: "provisional",
        created_at: eventRow.created_at || new Date().toISOString(),
      },
      { onConflict: "idempotency_key" }
    );
    if(indexError) throw Error("packet_spend_projection_failed:" + (indexError.message || indexError.code));
  }
}

function addCoef(q, coefStr, scale, unit) {
  const a = BigInt(q.coefficient || "0");
  const b = BigInt(coefStr);
  return { coefficient: String(a + b), scale, unit };
}

function subCoef(q, coefStr, scale, unit) {
  const a = BigInt(q.coefficient || "0");
  const b = BigInt(coefStr);
  return { coefficient: String(a - b), scale, unit };
}

/**
 * Trial balance / analytical sketch from balance rows + chart families.
 * Not a certified legal export — a deterministic operational statement.
 *
 * @param {object[]} balances
 * @param {object} chart — loaded cogentia-core chart
 */
export function projectOperationalStatements(balances, chart = {}) {
  const byFamily = {
    ASSET: [],
    LIABILITY: [],
    NET: [],
    INCOME: [],
    EXPENSE: [],
    CLEARING: [],
    OFFBALANCE: [],
    MEMO: [],
  };
  const accountFamily = new Map((chart.accounts || []).map((a) => [a.id, a.family]));

  for (const b of balances || []) {
    const family = accountFamily.get(b.account_id) || inferFamilyFromAccountId(b.account_id);
    const entry = {
      account_id: b.account_id,
      unit: b.unit,
      domain: b.domain,
      balance: b.balance,
      total_debit: b.total_debit,
      total_credit: b.total_credit,
    };
    if (byFamily[family]) byFamily[family].push(entry);
    else byFamily.MEMO.push(entry);
  }

  // Compte de résultat sketch: INCOME − EXPENSE (same unit only)
  const plByUnit = {};
  for (const e of byFamily.INCOME) {
    const u = e.unit || "USD";
    plByUnit[u] = plByUnit[u] || { unit: u, income: 0n, expense: 0n };
    plByUnit[u].income += BigInt(e.balance?.coefficient || "0");
  }
  for (const e of byFamily.EXPENSE) {
    const u = e.unit || "USD";
    plByUnit[u] = plByUnit[u] || { unit: u, income: 0n, expense: 0n };
    // expenses usually debit-positive in our projector
    plByUnit[u].expense += BigInt(e.balance?.coefficient || "0");
  }

  const compte_de_resultat = Object.values(plByUnit).map((row) => ({
    unit: row.unit,
    income_coefficient: String(row.income),
    expense_coefficient: String(row.expense),
    result_coefficient: String(row.income - row.expense),
    note: "Operational sketch from projected balances — not a certified statutory P&L",
  }));

  const bilan = {
    assets: byFamily.ASSET,
    liabilities: byFamily.LIABILITY,
    net: byFamily.NET,
    note: "Operational sketch — statutory bilan requires legal host adapter (PCG…)",
  };

  return {
    kind: "cop_operational_statements/v1",
    generated_at: new Date().toISOString(),
    bilan,
    compte_de_resultat,
    clearing: byFamily.CLEARING,
    analytical_expense_accounts: byFamily.EXPENSE,
    disclaimer:
      "Not certified accounting software. Statutory books require human-validated jurisdictional adapter.",
  };
}

function inferFamilyFromAccountId(id) {
  const s = String(id || "");
  if (/EXPENSE|expense|urn:account:expense/i.test(s)) return "EXPENSE";
  if (/INCOME|income|revenue/i.test(s)) return "INCOME";
  if (/ASSET|asset|cash|receivable/i.test(s)) return "ASSET";
  if (/LIABILITY|payable|liability/i.test(s)) return "LIABILITY";
  if (/CLEARING|clearing|provisional/i.test(s)) return "CLEARING";
  if (/NET|equity/i.test(s)) return "NET";
  return "MEMO";
}
