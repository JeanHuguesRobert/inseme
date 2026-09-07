/**
 * COP/Accounting Event Validator
 *
 * Validates accounting events against COP/Accounting invariants:
 * - Exact quantities (no binary floating-point)
 * - Balanced postings within (resourceType, unit, accountingDomain)
 * - Mandate compliance
 * - Idempotency
 *
 * @module accounting/validator
 */

import {
  compareQuantities,
  isZero,
  subtractQuantities,
  addQuantities,
  validateQuantity,
} from "./quantity.js";

/**
 * Validation error with context.
 */
export class ValidationError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = "ValidationError";
    this.context = context;
  }
}

/**
 * Validate a budget event.
 *
 * @param {Object} event - Budget event payload
 * @param {Object} context - Validation context {existingBudgets, mandates}
 * @returns {Object} Validation result {valid, errors, warnings}
 */
export function validateBudgetEvent(event, context = {}) {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!event.budget_id) errors.push("budget_id is required");
  if (!event.action) errors.push("action is required");
  if (!event.resource_type) errors.push("resource_type is required");
  if (!event.accounting_domain) errors.push("accounting_domain is required");
  if (!event.quantity) errors.push("quantity is required");
  if (!event.governance) errors.push("governance is required");
  if (!event.idempotency_key) errors.push("idempotency_key is required");

  // Validate quantity
  if (event.quantity) {
    const qv = validateQuantity(event.quantity);
    if (!qv.valid) {
      errors.push(...qv.errors.map((e) => `quantity.${e}`));
    }
  }

  // Action-specific validation
  if (event.action === "amend" && !event.prior_budget_id) {
    errors.push("prior_budget_id is required for amend actions");
  }

  // Governance validation
  if (event.governance) {
    if (!event.governance.actor_subject_id) {
      errors.push("governance.actor_subject_id is required");
    }
    if (!event.governance.principal_subject_id) {
      errors.push("governance.principal_subject_id is required");
    }

    // Check if actor != principal requires mandate
    if (event.governance.actor_subject_id !== event.governance.principal_subject_id) {
      if (!event.governance.mandate_id) {
        errors.push("mandate_id is required when actor != principal");
      }
    }
  }

  // Duplicate idempotency check (needs context)
  if (context.processedIdempotencyKeys?.has(event.idempotency_key)) {
    errors.push("Duplicate idempotency key detected");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate a reservation event.
 *
 * @param {Object} event - Reservation event payload
 * @param {Object} context - Validation context {budgets, existingReservations}
 * @returns {Object} Validation result {valid, errors, warnings}
 */
export function validateReservationEvent(event, context = {}) {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!event.reservation_id) errors.push("reservation_id is required");
  if (!event.action) errors.push("action is required");
  if (!event.resource_type) errors.push("resource_type is required");
  if (!event.accounting_domain) errors.push("accounting_domain is required");
  if (!event.quantity) errors.push("quantity is required");
  if (!event.budget_reference) errors.push("budget_reference is required");
  if (!event.governance) errors.push("governance is required");
  if (!event.idempotency_key) errors.push("idempotency_key is required");

  // Validate quantity
  if (event.quantity) {
    const qv = validateQuantity(event.quantity);
    if (!qv.valid) {
      errors.push(...qv.errors.map((e) => `quantity.${e}`));
    }
  }

  // Validate holding_fee if present
  if (event.holding_fee) {
    const hv = validateQuantity(event.holding_fee);
    if (!hv.valid) {
      errors.push(...hv.errors.map((e) => `holding_fee.${e}`));
    }
  }

  // For reserve action, check budget availability
  if (event.action === "reserve" && context.budgets) {
    const budget = context.budgets.get(event.budget_reference.budget_id);
    if (!budget) {
      errors.push("Budget not found");
    } else {
      // Check if budget is active
      if (budget.status !== "active") {
        errors.push(`Budget is not active: ${budget.status}`);
      }

      // Check domain match
      if (budget.accounting_domain !== event.accounting_domain) {
        errors.push("Accounting domain mismatch with budget");
      }

      // Check availability (amount available >= reserved amount)
      if (budget.available) {
        const available = budget.available;
        const requested = event.quantity;

        // Normalize and compare
        try {
          const cmp = compareQuantities(available, requested);
          if (cmp < 0) {
            errors.push("Insufficient budget availability");
          }
        } catch (e) {
          errors.push(`Availability comparison failed: ${e.message}`);
        }

        // Soft-limit check (warning at <= 10% remaining)
        if (budget.granted && budget.granted.coefficient !== "0") {
          try {
            const availVal = BigInt(budget.available.coefficient);
            const grantedVal = BigInt(budget.granted.coefficient);
            if (availVal > 0n && availVal * 100n <= grantedVal * 10n) {
              warnings.push("BUDGET_NEARLY_EXHAUSTED: 10% or less available");
            }
          } catch (e) {
            // Ignore format issues in warning check
          }
        }
      }
    }
  }

  // Check for competing reservations (double-spend prevention)
  if (event.action === "reserve" && context.existingReservations) {
    const budgetId = event.budget_reference.budget_id;
    const existing = context.existingReservations.filter(
      (r) => r.budget_reference.budget_id === budgetId && r.status === "active"
    );

    if (existing.length > 0) {
      // Calculate total reserved
      let totalReserved = { coefficient: "0", scale: 0 };
      for (const res of existing) {
        if (res.reservation_id !== event.reservation_id) {
          try {
            totalReserved = addQuantities(totalReserved, res.quantity);
          } catch (e) {
            // Skip incompatible quantities
          }
        }
      }

      // Check if adding this reservation would exceed budget
      if (context.budgets) {
        const budget = context.budgets.get(budgetId);
        if (budget && budget.granted) {
          try {
            const newTotal = addQuantities(totalReserved, event.quantity);
            const cmp = compareQuantities(newTotal, budget.granted);
            if (cmp > 0) {
              errors.push("Total reservations would exceed budget amount");
            }
          } catch (e) {
            warnings.push(`Could not verify reservation limit: ${e.message}`);
          }
        }
      }
    }
  }

  // Duplicate idempotency check
  if (context.processedIdempotencyKeys?.has(event.idempotency_key)) {
    errors.push("Duplicate idempotency key detected");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate a transaction event.
 *
 * @param {Object} event - Transaction event payload
 * @param {Object} context - Validation context {accounts, budgets}
 * @returns {Object} Validation result {valid, errors, warnings}
 */
export function validateTransactionEvent(event, context = {}) {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!event.transaction_id) errors.push("transaction_id is required");
  if (!event.resource_type) errors.push("resource_type is required");
  if (!event.accounting_domain) errors.push("accounting_domain is required");
  if (!event.postings) errors.push("postings is required");
  if (!event.governance) errors.push("governance is required");
  if (!event.idempotency_key) errors.push("idempotency_key is required");

  // Validate postings
  if (event.postings) {
    if (!Array.isArray(event.postings)) {
      errors.push("postings must be an array");
    } else if (event.postings.length < 2) {
      errors.push("At least 2 postings required for balanced transaction");
    } else {
      let totalDebit = null;
      let totalCredit = null;
      const postingScales = new Set();

      for (let i = 0; i < event.postings.length; i++) {
        const posting = event.postings[i];

        // Validate posting structure
        if (!posting.account) errors.push(`posting[${i}].account is required`);
        if (!posting.quantity) errors.push(`posting[${i}].quantity is required`);
        if (!posting.posting_type) errors.push(`posting[${i}].posting_type is required`);

        // Validate posting quantity
        if (posting.quantity) {
          const qv = validateQuantity(posting.quantity);
          if (!qv.valid) {
            errors.push(...qv.errors.map((e) => `posting[${i}].quantity.${e}`));
          } else {
            postingScales.add(posting.quantity.scale);

            // Initialize totals with first posting's scale
            if (totalDebit === null) {
              totalDebit = { coefficient: "0", scale: posting.quantity.scale };
              totalCredit = { coefficient: "0", scale: posting.quantity.scale };
            }

            // Accumulate debits and credits
            if (posting.posting_type === "debit") {
              totalDebit = addQuantities(totalDebit, posting.quantity);
            } else if (posting.posting_type === "credit") {
              totalCredit = addQuantities(totalCredit, posting.quantity);
            }
          }
        }
      }

      // Check that all postings use the same scale
      if (postingScales.size > 1) {
        errors.push(
          `All postings must use the same scale, found: ${Array.from(postingScales).join(", ")}`
        );
      }

      // Check balance
      try {
        const balanceDiff = subtractQuantities(totalDebit, totalCredit);
        if (!isZero(balanceDiff)) {
          errors.push("Transaction does not balance: debits != credits");
        }
      } catch (e) {
        errors.push(`Balance check failed: ${e.message}`);
      }

      // Check for cross-unit balancing (not allowed without explicit conversion)
      const units = new Set(event.postings.map((p) => p.quantity.unit).filter(Boolean));
      if (units.size > 1 && !event.conversion_rate) {
        errors.push("Cross-unit posting requires explicit conversion_rate");
      }
    }
  }

  // Governance validation
  if (event.governance) {
    if (!event.governance.actor_subject_id) {
      errors.push("governance.actor_subject_id is required");
    }
    if (!event.governance.principal_subject_id) {
      errors.push("governance.principal_subject_id is required");
    }

    // Check mandate requirement
    if (event.governance.actor_subject_id !== event.governance.principal_subject_id) {
      if (!event.governance.mandate_id) {
        errors.push("mandate_id is required when actor != principal");
      }
    }
  }

  // Check consumed reservations
  if (event.consumes_reservations && event.consumes_reservations.length > 0) {
    if (!context.existingReservations) {
      warnings.push("Cannot verify reservation status without context");
    } else {
      for (const resId of event.consumes_reservations) {
        const res = context.existingReservations.find((r) => r.reservation_id === resId);
        if (!res) {
          errors.push(`Reservation not found: ${resId}`);
        } else if (res.status !== "active") {
          errors.push(`Reservation is not active: ${resId} (${res.status})`);
        }
      }
    }
  }

  // Duplicate idempotency check
  if (context.processedIdempotencyKeys?.has(event.idempotency_key)) {
    errors.push("Duplicate idempotency key detected");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate a reversal event.
 *
 * @param {Object} event - Reversal event payload
 * @param {Object} context - Validation context {existingTransactions}
 * @returns {Object} Validation result {valid, errors, warnings}
 */
export function validateReversalEvent(event, context = {}) {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!event.reversal_id) errors.push("reversal_id is required");
  if (!event.original_transaction_id) errors.push("original_transaction_id is required");
  if (!event.reversal_type) errors.push("reversal_type is required");
  if (!event.reason) errors.push("reason is required for reversals");
  if (!event.governance) errors.push("governance is required");
  if (!event.idempotency_key) errors.push("idempotency_key is required");

  // Validate partial amount
  if (event.reversal_type === "partial" && !event.partial_amount) {
    errors.push("partial_amount is required for partial reversals");
  }

  // Validate compensating postings
  if (event.reversal_type === "compensating") {
    if (!event.compensating_postings || event.compensating_postings.length < 2) {
      errors.push("compensating_postings required for compensating reversals");
    }
  }

  // Check if original transaction exists
  if (context.existingTransactions) {
    const original = context.existingTransactions.get(event.original_transaction_id);
    if (!original) {
      errors.push("Original transaction not found");
    } else {
      // For partial reversals, validate amount
      if (event.reversal_type === "partial" && event.partial_amount && original.totalAmount) {
        try {
          const cmp = compareQuantities(event.partial_amount, original.totalAmount);
          if (cmp > 0) {
            errors.push("Partial reversal amount exceeds original transaction");
          }
        } catch (e) {
          warnings.push(`Could not verify partial reversal amount: ${e.message}`);
        }
      }
    }
  }

  // Duplicate idempotency check
  if (context.processedIdempotencyKeys?.has(event.idempotency_key)) {
    errors.push("Duplicate idempotency key detected");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate an account lifecycle event.
 *
 * @param {Object} event - Account event payload
 * @param {Object} context - Validation context {existingAccounts}
 * @returns {Object} Validation result {valid, errors, warnings}
 */
export function validateAccountEvent(event, context = {}) {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!event.account_id) errors.push("account_id is required");
  if (!event.action) errors.push("action is required");
  if (!event.governance) errors.push("governance is required");
  if (!event.idempotency_key) errors.push("idempotency_key is required");

  // Validate account_id format
  if (event.account_id) {
    const accountPatterns = [/^https:\/\//, /^urn:/, /^local:/, /^kudos:/];
    if (!accountPatterns.some((p) => p.test(event.account_id))) {
      errors.push("account_id must be a valid HTTPS URL, URN, local reference, or kudos reference");
    }
  }

  // Action-specific validation
  if (event.action === "create") {
    if (context.existingAccounts) {
      const existing = context.existingAccounts.get(event.account_id);
      if (existing) {
        errors.push("Account already exists");
      }
    }

    // Authorized source/sink requires explicit authorization
    if (event.authorized_source_sink === true && !event.governance.mandate_id) {
      errors.push("mandate_id required for authorized source/sink accounts");
    }
  }

  // Duplicate idempotency check
  if (context.processedIdempotencyKeys?.has(event.idempotency_key)) {
    errors.push("Duplicate idempotency key detected");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate a reconciliation event (provisional -> actual truth).
 *
 * @param {Object} event - Reconciliation event payload
 * @param {Object} context - Validation context
 * @returns {Object} Validation result {valid, errors, warnings}
 */
export function validateReconciliationEvent(event, context = {}) {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!event.reconciliation_id) errors.push("reconciliation_id is required");
  if (!event.provisional_spending_id) errors.push("provisional_spending_id is required");
  if (!event.provider) errors.push("provider is required");
  if (!event.provisional_cost) errors.push("provisional_cost is required");
  if (!event.actual_cost) errors.push("actual_cost is required");
  if (!event.adjustment) errors.push("adjustment is required");
  if (!event.reason) errors.push("reason is required for reconciliation");
  if (!event.governance) errors.push("governance is required");
  if (!event.idempotency_key) errors.push("idempotency_key is required");

  // Validate quantities
  let provValid = false;
  let actValid = false;
  let adjValid = false;

  if (event.provisional_cost) {
    const qv = validateQuantity(event.provisional_cost);
    if (!qv.valid) errors.push(...qv.errors.map((e) => `provisional_cost.${e}`));
    else provValid = true;
  }
  if (event.actual_cost) {
    const qv = validateQuantity(event.actual_cost);
    if (!qv.valid) errors.push(...qv.errors.map((e) => `actual_cost.${e}`));
    else actValid = true;
  }
  if (event.adjustment) {
    const qv = validateQuantity(event.adjustment);
    if (!qv.valid) errors.push(...qv.errors.map((e) => `adjustment.${e}`));
    else adjValid = true;
  }

  // Unit match and arithmetic invariant check: adjustment = actual_cost - provisional_cost
  if (provValid && actValid && adjValid) {
    const uProv = event.provisional_cost.unit;
    const uAct = event.actual_cost.unit;
    const uAdj = event.adjustment.unit;
    if (uProv && uAct && uProv !== uAct) {
      errors.push(`provisional_cost unit (${uProv}) and actual_cost unit (${uAct}) must match`);
    }
    if (uProv && uAdj && uProv !== uAdj) {
      errors.push(`adjustment unit (${uAdj}) and provisional_cost unit (${uProv}) must match`);
    }

    try {
      const expectedAdjustment = subtractQuantities(event.actual_cost, event.provisional_cost);
      const diff = subtractQuantities(event.adjustment, expectedAdjustment);
      if (!isZero(diff)) {
        errors.push(
          "Reconciliation adjustment invariant violated: adjustment must equal actual_cost - provisional_cost"
        );
      }
    } catch (e) {
      errors.push(`Reconciliation arithmetic validation failed: ${e.message}`);
    }
  }

  // Governance validation
  if (event.governance) {
    if (!event.governance.actor_subject_id) {
      errors.push("governance.actor_subject_id is required");
    }
    if (!event.governance.principal_subject_id) {
      errors.push("governance.principal_subject_id is required");
    }
  }

  // Duplicate idempotency check
  if (context.processedIdempotencyKeys?.has(event.idempotency_key)) {
    errors.push("Duplicate idempotency key detected");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Generic accounting event validator.
 *
 * @param {Object} event - Accounting event with eventType field
 * @param {Object} context - Validation context
 * @returns {Object} Validation result {valid, errors, warnings}
 */
export function validateAccountingEvent(event, context = {}) {
  if (!event || !event.eventType) {
    return {
      valid: false,
      errors: ["Event must have eventType field"],
      warnings: [],
    };
  }

  switch (event.eventType) {
    case "accounting/budget":
      return validateBudgetEvent(event, context);
    case "accounting/reservation":
      return validateReservationEvent(event, context);
    case "accounting/transaction":
      return validateTransactionEvent(event, context);
    case "accounting/reversal":
      return validateReversalEvent(event, context);
    case "accounting/account":
      return validateAccountEvent(event, context);
    case "accounting/reconciliation":
      return validateReconciliationEvent(event, context);
    default:
      return {
        valid: false,
        errors: [`Unknown eventType: ${event.eventType}`],
        warnings: [],
      };
  }
}

/**
 * Validate a sequence of accounting events.
 *
 * @param {Array} events - Array of accounting events
 * @param {Object} initialContext - Initial validation context
 * @returns {Object} Validation result {valid, errors, warnings, processedIdempotencyKeys}
 */
export function validateAccountingEventSequence(events, initialContext = {}) {
  const allErrors = [];
  const allWarnings = [];
  const processedIdempotencyKeys = new Set();

  const context = {
    ...initialContext,
    processedIdempotencyKeys,
  };

  for (const event of events) {
    const result = validateAccountingEvent(event, context);

    if (!result.valid) {
      allErrors.push({
        eventId: event.id || event.transaction_id || event.reservation_id,
        errors: result.errors,
      });
    }

    if (result.warnings.length > 0) {
      allWarnings.push({
        eventId: event.id || event.transaction_id || event.reservation_id,
        warnings: result.warnings,
      });
    }

    // Track idempotency key
    if (event.idempotency_key) {
      processedIdempotencyKeys.add(event.idempotency_key);
    }
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    processedIdempotencyKeys: Array.from(processedIdempotencyKeys),
  };
}
