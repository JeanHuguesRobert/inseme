/** Packet-to-handler pilot: source acts stay local to delegated mandate.
 * The parent only receives its reserved envelope and closing summary.
 * Not a scheduler, router, or second authoritative accounting ledger.
 */
import { reserveEventSourcedDelegatedBudget } from './delegated-budget.js';
import { invokeGovernedCapability } from './governed-act.js';

export async function executeDelegatedPacket({
  packet, handler, capability, demand, input = {},
  parent_store, child_store, parent_ledger,
  child_budget_id, child_mandate_ref, child_source_ref,
  principal_ref, logical_agent_ref, allocation, idempotency_key,
  close_on_completion = true,
}) {
  if (typeof packet?.packet_id !== 'string' || !packet.packet_id) throw new TypeError('packet.packet_id required');
  if (typeof handler?.id !== 'string' || typeof handler.invoke !== 'function') throw new TypeError('handler instance required');
  if (packet.mandate_id !== child_mandate_ref && packet.mandate_ref !== child_mandate_ref) {
    return { ok: false, stage: 'authority', error: 'packet_mandate_mismatch' };
  }
  if (typeof logical_agent_ref !== 'string' || !logical_agent_ref) throw new TypeError('logical_agent_ref required');
  const delegation = reserveEventSourcedDelegatedBudget({
    store: parent_store, child_store, child_source_ref, parent_ledger,
    child_budget_id, child_mandate_ref, principal_ref, allocation, idempotency_key,
  });
  if (!delegation.ok) return { ok: false, stage: 'delegation', error: delegation.error };
  const identity = {
    principal_ref, logical_agent_ref, mandate_ref: child_mandate_ref,
    topic_id: `packet:${packet.packet_id}:acts`,
  };
  // Explicit delegation authority is still required by governed-act; a budget
  // reservation alone never grants a capability or action authority.
  const existing = typeof child_store.replay === 'function' ? child_store.replay() : child_store.listTopic(`mandate:${child_mandate_ref}`);
  if (!existing.some(e => e.payload?.kind === 'MandateDeclaration')) {
    return { ok: false, stage: 'authority', error: 'child_mandate_declaration_required', delegation };
  }
  const execution = await invokeGovernedCapability({
    store: child_store, ledger: delegation.child_ledger, handler, identity,
    capability, demand, input, packet_id: packet.packet_id,
    idempotency_key: `${idempotency_key}:packet:${packet.packet_id}`,
  });
  if (!close_on_completion) return { ok: execution.ok, execution, delegation };
  const closing = delegation.close();
  return { ok: execution.ok && closing.ok, execution, closing,
    packet_id: packet.packet_id, handler_instance_ref: handler.id,
    child_mandate_ref, source_ref: child_source_ref };
}
