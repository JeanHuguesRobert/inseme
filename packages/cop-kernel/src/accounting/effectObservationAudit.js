import { followTheMoneyAudit } from "./followTheMoney.js";

/**
 * Read-only bridge from COP observations to strict accounting diagnostics.
 * Observations are NOT accounting/transaction events, provider receipts,
 * monetary spends or authority to retry an effect.
 */
export function auditEffectObservations({ observations = [], events = [], packets = [] } = {}) {
  const audit = followTheMoneyAudit({ events, packets });
  const unresolved = [];
  const conflicts = [];
  const seen = new Map();
  for (const event of observations) {
    const o = event?.data || event;
    if (event?.type && event.type !== "cop.effect.observed") continue;
    const intent = o?.intent_id;
    if (!intent || o.schema !== "cop.effect-observation/v1") {
      conflicts.push({ code:"invalid_observation", intent_id:intent || null });
      continue;
    }
    const prior = seen.get(intent);
    if (prior) {
      if (JSON.stringify(prior) !== JSON.stringify(o)) {
        conflicts.push({ code:"conflicting_observation", intent_id:intent });
      }
      continue; // identical observations do not multiply any accounting effect
    }
    seen.set(intent,o);
    if (o.status !== "effect_verified") {
      unresolved.push({ code:"effect_evidence_missing", intent_id:intent,
        status:o.status, automatic_retry_allowed:false });
    } else if (!o.effect_verification) {
      conflicts.push({ code:"missing_verification_reference", intent_id:intent });
    }
  }
  return {
    schema:"cop.accounting.observation-audit/v1",
    ok:audit.ok && unresolved.length===0 && conflicts.length===0,
    accounting:audit,
    observations_seen:seen.size,
    unresolved,
    conflicts,
    // Deliberately never manufacture authoritative transactions.
    generated_transactions:[],
  };
}
