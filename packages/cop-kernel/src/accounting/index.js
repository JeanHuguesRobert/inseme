/**
 * COP/Accounting Kernel
 *
 * Day-one accounting conformance kernel implementing:
 * - Exact quantity arithmetic (no binary floating-point)
 * - Event validation (balanced postings, mandates, budgets, lifecycle)
 * - Deterministic projection (balances, reservations, budgets)
 * - Idempotency and duplicate rejection
 *
 * @module accounting
 */

export * from "./quantity.js";
export * from "./validator.js";
export * from "./projector.js";
export * from "./packetAccounting.js";
export * from "./supabaseAccountingStore.js";
export * from "./followTheMoney.js";

/**
 * Main entry point for accounting operations.
 */
export const AccountingKernel = {
  /**
   * Validate an accounting event.
   */
  validate: async (event, context) => {
    const { validateAccountingEvent } = await import("./validator.js");
    return validateAccountingEvent(event, context);
  },

  /**
   * Validate a sequence of accounting events.
   */
  validateSequence: async (events, context) => {
    const { validateAccountingEventSequence } = await import("./validator.js");
    return validateAccountingEventSequence(events, context);
  },

  /**
   * Create a projection from events.
   */
  project: async (events, options) => {
    const { createProjection } = await import("./projector.js");
    return createProjection(events, options);
  },

  /**
   * Check if budget can accommodate a reservation.
   */
  canReserve: async (budgetStatus, quantity) => {
    const { canReserve } = await import("./projector.js");
    return canReserve(budgetStatus, quantity);
  },
};

export default AccountingKernel;
