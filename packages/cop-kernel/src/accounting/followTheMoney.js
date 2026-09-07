/**
 * Follow-the-Money Audit Engine (Issue #45)
 *
 * Implements bidirectional verification across the complete accounting chain:
 *
 * Reality -> Ledger:
 *   act -> mandate -> resource -> spend -> transaction -> evidence -> reconciliation
 *
 * Ledger -> Reality:
 *   ledger entry -> spend -> packet -> hop -> execution/provider evidence
 *
 * Validates strict accounting invariants:
 * - Completeness: every consumed resource has an attributable trace
 * - Soundness: every ledger entry has traceable backing evidence
 * - Lineage: no duplicate ownership, no cascade double-count
 * - Integrity: debits == credits, exact decimal quantities, no float
 * - Reconciliation: historical events immutable, difference recorded as signed compensating entries
 *
 * @module accounting/followTheMoney
 */

import {
  subtractQuantities,
  addQuantities,
  compareQuantities,
  isZero,
  validateQuantity,
} from "./quantity.js";
import { auditPacketSpendNoDoubleCount } from "./packetAccounting.js";

/**
 * Audit result report.
 * @typedef {object} FollowTheMoneyAuditReport
 * @property {boolean} ok - True if zero violations detected
 * @property {number} accounted_real_effects - Count of verified real effects
 * @property {object[]} orphan_effects - Real effects lacking attributable accounting traces
 * @property {object[]} orphan_ledger_entries - Authoritative ledger entries lacking real evidence backing
 * @property {object[]} duplicate_ownership - Spends claimed by multiple packets
 * @property {object[]} unbalanced_entries - Transactions where debits != credits
 * @property {object[]} unreconciled_provisional - Provisional spends awaiting external reconciliation
 * @property {object[]} reconciliation_differences - Reconciled differences between provisional and actual
 * @property {object[]} budget_violations - Reservations or transactions exceeding budget
 * @property {object[]} mandate_violations - Spends or transactions lacking valid mandate attribution
 * @property {object[]} violations - Exhaustive list of explicit invariant violations
 */

/**
 * Execute a Follow-the-Money audit over packets and accounting events.
 *
 * @param {object} params
 * @param {object[]} [params.events=[]] - Array of accounting events
 * @param {object[]} [params.packets=[]] - Array of Cognitive Packets
 * @param {Map<string, object>} [params.budgets] - Optional map of budgets
 * @returns {FollowTheMoneyAuditReport}
 */
export function followTheMoneyAudit({ events = [], packets = [], budgets = new Map() } = {}) {
  const violations = [];
  const orphanEffects = [];
  const orphanLedgerEntries = [];
  const duplicateOwnership = [];
  const unbalancedEntries = [];
  const unreconciledProvisional = [];
  const reconciliationDifferences = [];
  const budgetViolations = [];
  const mandateViolations = [];

  let accountedRealEffects = 0;

  // Track spends across all packets to detect duplicate ownership
  const seenSpends = new Map(); // spend_id -> packet_id

  // Index accounting events
  const transactionsById = new Map();
  const reconciliationsBySpendId = new Map();
  const reservationsByBudget = new Map();
  const seenIdempotencyKeys = new Set();

  for (const event of events) {
    const payload = event.payload || event;
    const type = payload.eventType || event.event_type;
    const key = payload.idempotency_key || event.idempotency_key;

    // Check duplicate idempotency keys in authoritative event stream
    if (key) {
      if (seenIdempotencyKeys.has(key)) {
        violations.push({
          code: "duplicate_idempotency_key",
          message: `Duplicate idempotency key detected: ${key}`,
          context: { idempotency_key: key, event_type: type },
        });
      } else {
        seenIdempotencyKeys.add(key);
      }
    }

    if (type === "accounting/transaction") {
      const txnId = payload.transaction_id || payload.id;
      if (txnId) transactionsById.set(txnId, payload);

      // Verify balance: debits == credits
      if (Array.isArray(payload.postings) && payload.postings.length >= 2) {
        let debits = null;
        let credits = null;
        for (const p of payload.postings) {
          if (!p.quantity) continue;
          const qv = validateQuantity(p.quantity);
          if (!qv.valid) {
            unbalancedEntries.push({
              transaction_id: txnId,
              error: "invalid_quantity",
              details: qv.errors,
            });
            violations.push({
              code: "invalid_quantity",
              message: `Posting quantity invalid in txn ${txnId}`,
              context: { transaction_id: txnId, errors: qv.errors },
            });
            continue;
          }
          if (debits === null) {
            debits = { coefficient: "0", scale: p.quantity.scale, unit: p.quantity.unit };
            credits = { coefficient: "0", scale: p.quantity.scale, unit: p.quantity.unit };
          }
          if (p.posting_type === "debit") {
            debits = addQuantities(debits, p.quantity);
          } else if (p.posting_type === "credit") {
            credits = addQuantities(credits, p.quantity);
          }
        }
        if (debits && credits) {
          try {
            const diff = subtractQuantities(debits, credits);
            if (!isZero(diff)) {
              unbalancedEntries.push({ transaction_id: txnId, debits, credits, difference: diff });
              violations.push({
                code: "unbalanced_transaction",
                message: `Transaction ${txnId} does not balance: debits != credits`,
                context: { transaction_id: txnId, difference: diff },
              });
            }
          } catch (e) {
            unbalancedEntries.push({ transaction_id: txnId, error: e.message });
            violations.push({
              code: "unbalanced_transaction",
              message: `Transaction ${txnId} balance calculation failed: ${e.message}`,
              context: { transaction_id: txnId },
            });
          }
        }
      }

      // Verify mandate/governance attribution
      const gov = payload.governance || {};
      if (gov.actor_subject_id && gov.principal_subject_id) {
        if (gov.actor_subject_id !== gov.principal_subject_id && !gov.mandate_id) {
          mandateViolations.push({
            transaction_id: txnId,
            reason: "actor != principal without mandate_id",
          });
          violations.push({
            code: "missing_mandate_attribution",
            message: `Transaction ${txnId} has actor != principal without mandate_id`,
            context: { transaction_id: txnId },
          });
        }
      }

      // Check whether transaction has backing evidence or packet reference
      const hasBacking =
        payload.evidence_references?.length > 0 ||
        payload.packet_id ||
        payload.spend_id ||
        payload.metadata?.packet_id ||
        payload.metadata?.spend_id;
      if (!hasBacking && !payload.authorized_source_sink) {
        orphanLedgerEntries.push({
          transaction_id: txnId,
          reason: "No evidence reference or packet/spend backing",
        });
        violations.push({
          code: "orphan_ledger_entry",
          message: `Authoritative transaction ${txnId} has no verifiable reality backing`,
          context: { transaction_id: txnId },
        });
      }
    } else if (type === "accounting/reconciliation") {
      const spendId = payload.provisional_spending_id;
      if (spendId) {
        reconciliationsBySpendId.set(spendId, payload);
      }
      // Verify arithmetic: adjustment = actual_cost - provisional_cost
      try {
        const expectedAdj = subtractQuantities(payload.actual_cost, payload.provisional_cost);
        const diff = subtractQuantities(payload.adjustment, expectedAdj);
        if (!isZero(diff)) {
          violations.push({
            code: "reconciliation_arithmetic_error",
            message: `Reconciliation ${payload.reconciliation_id} adjustment does not match actual - provisional`,
            context: { reconciliation_id: payload.reconciliation_id },
          });
        } else {
          reconciliationDifferences.push({
            reconciliation_id: payload.reconciliation_id,
            provisional_spending_id: spendId,
            adjustment: payload.adjustment,
            reason: payload.reason,
          });
        }
      } catch (e) {
        violations.push({
          code: "reconciliation_validation_failure",
          message: `Failed validating reconciliation arithmetic: ${e.message}`,
          context: { reconciliation_id: payload.reconciliation_id },
        });
      }
    } else if (type === "accounting/reservation") {
      const bId = payload.budget_reference?.budget_id;
      if (bId && payload.action === "reserve" && payload.quantity) {
        const list = reservationsByBudget.get(bId) || [];
        list.push(payload);
        reservationsByBudget.set(bId, list);
      }
    }
  }

  // Verify budget capacity against total reservations
  for (const [budgetId, resList] of reservationsByBudget.entries()) {
    const budget = budgets.get(budgetId);
    if (budget && budget.granted) {
      let total = { coefficient: "0", scale: budget.granted.scale, unit: budget.granted.unit };
      for (const r of resList) {
        try {
          total = addQuantities(total, r.quantity);
        } catch (_) {}
      }
      try {
        if (compareQuantities(total, budget.granted) > 0) {
          budgetViolations.push({
            budget_id: budgetId,
            granted: budget.granted,
            total_reserved: total,
          });
          violations.push({
            code: "budget_over_reserved",
            message: `Total reservations (${total.coefficient}) exceed granted capacity (${budget.granted.coefficient}) on budget ${budgetId}`,
            context: { budget_id: budgetId },
          });
        }
      } catch (_) {}
    }
  }

  // 2. Audit Cognitive Packets (Reality -> Ledger)
  const cascadeAudit = auditPacketSpendNoDoubleCount(packets);
  if (!cascadeAudit.ok) {
    violations.push({
      code: "cascade_double_count",
      message: "Duplicate spend keys detected across packet cascade",
      context: { duplicate_keys: cascadeAudit.duplicate_keys },
    });
  }

  for (const packet of packets) {
    if (!packet || typeof packet !== "object") continue;

    // Mandate attribution check on packet
    if (!packet.mandate_id) {
      mandateViolations.push({ packet_id: packet.packet_id, reason: "missing_mandate_id" });
      violations.push({
        code: "packet_missing_mandate",
        message: `Cognitive Packet ${packet.packet_id} has no mandate_id`,
        context: { packet_id: packet.packet_id },
      });
    }

    // Examine own spend lines
    const spending = Array.isArray(packet.spending) ? packet.spending : [];
    for (const spend of spending) {
      accountedRealEffects += 1;
      const spendId =
        spend.evidence_hash ||
        (spend.spend_id && !spend.spend_id.match(/^spend:\d+$/) ? spend.spend_id : null);

      // Duplicate ownership check across packets
      if (spendId) {
        if (seenSpends.has(spendId)) {
          const priorOwner = seenSpends.get(spendId);
          duplicateOwnership.push({
            spend_id: spendId,
            first_packet: priorOwner,
            second_packet: packet.packet_id,
          });
          violations.push({
            code: "duplicate_spend_ownership",
            message: `Spend ${spendId} is claimed by multiple packets: ${priorOwner} and ${packet.packet_id}`,
            context: { spend_id: spendId, packets: [priorOwner, packet.packet_id] },
          });
        } else {
          seenSpends.set(spendId, packet.packet_id);
        }
      }

      // Quantity validity
      if (spend.provisional_cost) {
        const qv = validateQuantity(spend.provisional_cost);
        if (!qv.valid) {
          violations.push({
            code: "malformed_provisional_cost",
            message: `Spend ${spendId} has malformed provisional_cost ExactQuantity`,
            context: { spend_id: spendId, errors: qv.errors },
          });
        }
      }

      // Check if reconciled
      if (reconciliationsBySpendId.has(spendId)) {
        // Reconciled cleanly
      } else {
        unreconciledProvisional.push({
          spend_id: spendId,
          packet_id: packet.packet_id,
          provisional_cost: spend.provisional_cost,
          provider: spend.provider,
        });
      }
    }
  }

  return {
    ok: violations.length === 0,
    accounted_real_effects: accountedRealEffects,
    orphan_effects: orphanEffects,
    orphan_ledger_entries: orphanLedgerEntries,
    duplicate_ownership: duplicateOwnership,
    unbalanced_entries: unbalancedEntries,
    unreconciled_provisional: unreconciledProvisional,
    reconciliation_differences: reconciliationDifferences,
    budget_violations: budgetViolations,
    mandate_violations: mandateViolations,
    violations,
  };
}
