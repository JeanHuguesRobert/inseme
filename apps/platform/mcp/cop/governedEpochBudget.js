import { authorizeCopAction } from "./portableRuntimeGateway.js";

const ACTION = "cop.accounting.budget.grant";

/**
 * Host-supplied resolveContext authenticates a signed COP capability and
 * resolves its exact active mandate/version. grantBudget must invoke the
 * transactional, event-recording DB function (never a raw table INSERT).
 */
export function createGovernedEpochBudgetGrantHandler({ resolveContext, grantBudget } = {}) {
  if (typeof resolveContext !== "function" || typeof grantBudget !== "function") {
    throw new TypeError("resolveContext and grantBudget are required");
  }
  return async (request) => {
    const context = await resolveContext(request);
    if (!context) return { status: 401, body: { code: "COP_UNAUTHENTICATED" } };
    authorizeCopAction({ ...context, action: ACTION });
    const { epoch_id, budget_ref, unit, amount } = request?.body ?? {};
    if (![epoch_id, budget_ref, unit].every((v) => typeof v === "string" && v.length > 0)
      || typeof amount !== "string" || !/^(?:0*[1-9][0-9]*|[0-9]*\.[0-9]*[1-9][0-9]*)$/.test(amount)) {
      throw new TypeError("epoch_id, budget_ref, unit and positive decimal amount are required");
    }
    if (!context.mandateRef || !Number.isInteger(context.mandateVersion)) {
      throw new TypeError("verified mandate identity and version required");
    }
    const authority_ref = `${context.mandateRef}:v${context.mandateVersion}`;
    // Never trust client-supplied actor, mandate or authority references.
    const result = await grantBudget({
      epoch_id, budget_ref, unit, amount,
      actor: context.principal.id,
      mandate_ref: context.mandateRef,
      mandate_version: context.mandateVersion,
      authority_ref,
    });
    return { status: 201, body: { data: result } };
  };
}
