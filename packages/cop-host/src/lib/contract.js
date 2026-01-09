/**
 * Design by Contract helpers (Bertrand Meyer style)
 * Centralized in cop-host lib to avoid duplication.
 */
export const Contract = {
  require(condition, message) {
    if (!condition) throw new Error(`[PRE-CONDITION VIOLATED] ${message}`);
  },
  ensure(condition, message) {
    if (!condition) throw new Error(`[POST-CONDITION VIOLATED] ${message}`);
  },
  check(condition, message) {
    if (!condition) throw new Error(`[CHECK ASSERTION FAILED] ${message}`);
  },
};

export default Contract;
