import { describe, it, expect } from 'vitest';
import { createMemoryCopEventStore } from '../src/cop-event-spool.js';
import { createEventSourcedExecutionBudgetLedger, recordExecutionBudgetGrant } from '../src/execution-budget.js';
import { recordMandateDeclaration } from '../src/governed-act.js';
import { executeDelegatedPacket } from '../src/distributed-packet-handler.js';

describe('distributed Cognitive Packet / HandlerInstance pilot', () => {
  it('attributes local acts to the child mandate and consolidates only the budget summary', async () => {
    const parent_store = createMemoryCopEventStore();
    const child_store = createMemoryCopEventStore();
    const parent_ledger = createEventSourcedExecutionBudgetLedger({ store: parent_store, budget_id: 'root-packet', limits: { max_steps: 10 }, require_authority_grant: true });
    recordExecutionBudgetGrant(parent_store, { budget_id: 'root-packet', mandate_ref: 'mandate:root@v1', principal_ref: 'person:p', limits: { max_steps: 10 } });
    recordMandateDeclaration(child_store, { mandate_id: 'mandate:child@v1', principal_ref: 'person:p', logical_agent_ref: 'agent:child', scope: { allowed_actions: ['tool:read'], budget_ceiling: { max_steps: 6 } } });
    const packet = { packet_id: 'packet:distributed-test', mandate_id: 'mandate:child@v1' };
    let invoked = 0;
    const outcome = await executeDelegatedPacket({ packet, handler: { id: 'handler:test@fracta2', async invoke() { invoked++; return { execution_usage: { max_steps: 2 }, output: 'ok' }; } },
      capability: 'tool:read', demand: { max_steps: 4 }, parent_store, child_store, parent_ledger,
      child_budget_id: 'child-packet', child_mandate_ref: 'mandate:child@v1', child_source_ref: 'cop://fracta2/child',
      principal_ref: 'person:p', logical_agent_ref: 'agent:child', allocation: { max_steps: 6 }, idempotency_key: 'dispatch-1' });
    expect(outcome.ok).toBe(true);
    expect(invoked).toBe(1);
    expect(outcome.execution.receipt.handler_instance_ref).toBe('handler:test@fracta2');
    expect(outcome.execution.events.find(e => e.payload.kind === 'Imputation').payload.packet_id).toBe(packet.packet_id);
    expect(parent_ledger.snapshot().settled.max_steps).toBe(2);
    expect(parent_store.replay().some(e => e.payload?.kind === 'Act')).toBe(false);
    expect(child_store.replay().some(e => e.payload?.kind === 'Act')).toBe(true);
    expect(outcome.closing.evidence.source_ref).toBe('cop://fracta2/child');
  });
  it('refuses a packet bound to another mandate before allocating budget', async () => {
    const parent_store = createMemoryCopEventStore();
    const child_store = createMemoryCopEventStore();
    const parent_ledger = createEventSourcedExecutionBudgetLedger({ store: parent_store, budget_id: 'root-refusal', limits: { max_steps: 5 } });
    const result = await executeDelegatedPacket({ packet: { packet_id: 'packet:wrong', mandate_id: 'mandate:wrong@v1' },
      handler: { id: 'handler:test', invoke: async () => ({}) }, capability: 'tool:read', demand: { max_steps: 1 },
      parent_store, child_store, parent_ledger, child_budget_id: 'child', child_mandate_ref: 'mandate:child@v1',
      principal_ref: 'person:p', logical_agent_ref: 'agent:child', allocation: { max_steps: 3 }, idempotency_key: 'no', child_source_ref: 'cop://local' });
    expect(result.error).toBe('packet_mandate_mismatch');
    expect(parent_store.replay()).toHaveLength(0);
  });

});
