# FractaLog pilot: failure boundaries and recovery evidence

Status: local pilot only (no Supabase writes, no inter-host deployment).

The separate local SQLite event journal, checkpoint outbox, and receiver journal are each durable independently. They do **not** participate in a common distributed transaction.

- A committed budget reservation/settlement remains authoritative locally even when the network is offline.
- A checkpoint is a derived **provisional projection**, never an additional source settlement.
- A crash after the budget commit but before checkpoint enqueue can be repaired by re-generating the deterministic checkpoint from the durable journal; this is currently an explicit caller action, **not an automatic recovery scan**.
- A crash after outbox enqueue preserves a pending document across process restarts.
- A lost response after remote acceptance can lead to a replay; the receiver must return an idempotent ACK for the same record and document hash.
- The receiver's acceptance is **not** an assertion that it verified the original authority, cryptographic signer, full event history, or budget settlement.
- The separate local test databases simulate independent restart windows but not host loss, network partition across separate hosts, malicious actors, or key compromise.

Evidence: `apps/platform/mcp/test/fractalogEndToEndRecovery.test.js` and `apps/platform/mcp/test/fractalogHttpBatch.test.js`. Test with `node --disable-warning=ExperimentalWarning --test apps/platform/mcp/test/fractalogEndToEndRecovery.test.js`.

Next pilot checks: on-start reconciliation of missing checkpoints, stale forwarding lease after killed process, multi-process HTTP restart under an active in-flight request, and audit-on-demand that compares remote projection with a source proof. Retain the ordinary low-cost write path; do not put an entire audit behind each new entry.
