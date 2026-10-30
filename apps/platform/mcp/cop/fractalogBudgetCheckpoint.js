/** Immutable derived checkpoint; never a second source ledger or settlement. */
import { createHash } from 'node:crypto';
import { createFractalogActRecord } from '../../../../packages/cop-core/src/fractalog.js';

export function enqueueBudgetCheckpoint({ ledger, sourceStore, outbox, mandate_ref, owner_instance_ref, source_ref }) {
  const state = ledger.snapshot();
  if (!state.has_grant || state.mandate_ref !== mandate_ref) return {ok:false,error:'checkpoint_mandate_mismatch'};
  if (!source_ref || !owner_instance_ref) throw new TypeError('source_ref and owner_instance_ref required');
  const topic = `execution-budget:${state.budget_id}`;
  const commitment = sourceStore.topicCommitment?.(topic);
  const events = commitment ? null : sourceStore.listTopic(topic);
  if ((commitment?.seq ?? events.length) !== state.version) return {ok:false,error:'checkpoint_source_seq_mismatch'};
  const source_hash = commitment?.head || `sha256:${createHash('sha256').update(JSON.stringify(events)).digest('hex')}`;
  const commitment_scheme = commitment ? 'sha256:chain-v1' : 'sha256:json-array-v1';
  const recorded_at = commitment?.recorded_at || events.at(-1)?.time?.recorded_at || events.at(-1)?.time?.occurred_at;
  const ref = `budget:${state.budget_id}:checkpoint:${state.version}`;
  const record = createFractalogActRecord({record_id:ref,act_id:ref,
    act_kind:'accounting.budget.checkpoint',act_phase:'observed',owner_instance_ref,
    visibility:'restricted',idempotency_key:ref,
    time:{recorded_at},
    governed_chain:{mandate_ref},
    trace:{source_ref,source_hash,commitment_scheme,topic_seq:state.version,budget_id:state.budget_id},
    effect:{kind:'provisional_budget_projection',limits:state.limits,
      reserved:state.reserved,settled:state.settled,available:state.available},
  });
  return outbox.append(record);
}
