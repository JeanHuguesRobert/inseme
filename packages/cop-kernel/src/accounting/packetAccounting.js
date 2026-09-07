/**
 * Cognitive Packet Strict Accounting Kernel
 *
 * Implements strict provisional spending accounting and Fractanet hop tracing
 * directly on Cognitive Packets.
 *
 * All amounts use ExactQuantity decimal arithmetic (no binary floating-point rounding errors).
 *
 * Cascade (spawn) vocabulary — preferred (non-anthropocentric):
 *   upstream_packet_id / downstream_packet_ids
 * Colloquial aliases: parent ≈ upstream, child ≈ downstream.
 *
 * Strict rules:
 *   - own_spend(P)        = Σ P.spending[] only
 *   - consolidated(P)     = own_spend(P) + Σ consolidated(downstream_i)
 *   - Never copy downstream spending lines into P.spending[] (anti double-count)
 *   - Each spend line has exactly one owning packet_id
 *   - Default provisional monetary unit: USD (provider billing convention)
 *
 * @module accounting/packetAccounting
 */

import {
  addQuantities,
  subtractQuantities,
  fromDecimal,
  toDecimal,
  normalizeToCommonScale,
} from "./quantity.js";
import { getModelRateCard } from "@inseme/cop-core";

/** Default fiat unit for provisional LLM/provider cost (providers bill in USD). */
export const DEFAULT_MONETARY_UNIT = "USD";

/**
 * Preferred lineage terms (schema) vs colloquial aliases.
 * @type {Readonly<{ preferred: object, aliases: object, also_considered: string[] }>}
 */
export const PACKET_LINEAGE_VOCABULARY = Object.freeze({
  preferred: {
    upstream: "upstream_packet_id",
    downstream: "downstream_packet_ids",
    spawn: "spawn_reason",
  },
  aliases: {
    parent: "upstream",
    child: "downstream",
    children: "downstream",
    root: "cascade root (no upstream)",
    leaf: "no downstream",
  },
  also_considered: [
    "source / derived",
    "origin / spawned",
    "superordinate / subordinate",
    "envelope / member (rejected — conflicts with envelope/payload)",
  ],
});

/**
 * Calculate exact provisional cost in USD decimal format.
 *
 * @param {object} params
 * @param {string} params.provider Provider name (e.g. "openai")
 * @param {string} params.model Model name (e.g. "gpt-4o-mini")
 * @param {number} [params.prompt_tokens=0]
 * @param {number} [params.completion_tokens=0]
 * @returns {{ cost: import("@inseme/cop-core").ExactQuantity, rate_basis: string }}
 */
export function calculateProvisionalCost({
  provider,
  model,
  prompt_tokens = 0,
  completion_tokens = 0,
}) {
  const card = getModelRateCard(provider, model);

  const inputCost = (prompt_tokens / 1_000_000) * card.input_per_m;
  const outputCost = (completion_tokens / 1_000_000) * card.output_per_m;
  const totalCost = inputCost + outputCost;

  const decimalStr = totalCost.toFixed(card.scale || 8);
  // Provider rate cards are denominated in USD by default.
  const costQuantity = fromDecimal(decimalStr, DEFAULT_MONETARY_UNIT);
  return { cost: costQuantity, rate_basis: card.rate_basis };
}

/**
 * Create and initialize a new Cognitive Packet with Hop 0.
 *
 * @param {object} params
 * @param {string} [params.packet_id] Unique URN (auto-generated if omitted)
 * @param {string} params.mandate_id Mandate authorization URN
 * @param {string} params.treatment_id Governed treatment scope ID
 * @param {string} params.account_id Account URN (e.g. "https://jhn.baronsmariani.org/")
 * @param {string} [params.initial_node_id="node:fracta:main"]
 * @param {string} [params.initial_instance_id="agent:jhn:main"]
 * @param {object} [params.governance]
 * @param {string} [params.disclosure_class="public"]
 * @param {object} [params.payload]
 * @returns {import("@inseme/cop-core").CognitivePacket}
 */
export function createCognitivePacket(params) {
  const timestamp = new Date().toISOString();
  const packet_id =
    params.packet_id || `urn:cop:packet:${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const initialHop = {
    hop_index: 0,
    node_id: params.initial_node_id || "node:fracta:main",
    instance_id: params.initial_instance_id || "agent:jhn:main",
    interface: "local",
    timestamp,
    route_reason: "treatment_ingress",
  };

  const lineage = {
    upstream_packet_id: params.upstream_packet_id || params.parent_packet_id || undefined,
    downstream_packet_ids: Array.isArray(params.downstream_packet_ids)
      ? [...params.downstream_packet_ids]
      : Array.isArray(params.child_packet_ids)
        ? [...params.child_packet_ids]
        : [],
    spawn_reason: params.spawn_reason || undefined,
  };
  if (!lineage.upstream_packet_id) delete lineage.upstream_packet_id;
  if (!lineage.spawn_reason) delete lineage.spawn_reason;

  return {
    packet_id,
    mandate_id: params.mandate_id,
    treatment_id: params.treatment_id,
    account_id: params.account_id,
    budget_reservation_id: params.budget_reservation_id,
    monetary_unit_default: params.monetary_unit_default || DEFAULT_MONETARY_UNIT,
    lineage,
    hops: [initialHop],
    spending: [],
    governance: params.governance || {
      actor_subject_id: "agent:jhn:main",
      principal_subject_id: params.account_id,
      mandate_id: params.mandate_id,
    },
    disclosure_class: params.disclosure_class || "public",
    created_at: timestamp,
    payload: params.payload || {},
  };
}

/**
 * Spawn a downstream packet under an upstream packet (cascade).
 * Does not copy spending lines. Links ids only.
 *
 * @param {import("@inseme/cop-core").CognitivePacket} upstream
 * @param {object} params — same as createCognitivePacket, minus required account/mandate if inherited
 * @returns {import("@inseme/cop-core").CognitivePacket} downstream packet
 */
export function spawnDownstreamPacket(upstream, params = {}) {
  if (!upstream?.packet_id) {
    throw new Error("spawnDownstreamPacket: upstream packet_id required");
  }
  const downstream = createCognitivePacket({
    mandate_id: params.mandate_id || upstream.mandate_id,
    treatment_id: params.treatment_id || upstream.treatment_id,
    account_id: params.account_id || upstream.account_id,
    budget_reservation_id:
      params.budget_reservation_id !== undefined
        ? params.budget_reservation_id
        : upstream.budget_reservation_id,
    monetary_unit_default:
      params.monetary_unit_default || upstream.monetary_unit_default || DEFAULT_MONETARY_UNIT,
    initial_node_id: params.initial_node_id,
    initial_instance_id: params.initial_instance_id,
    governance: params.governance || {
      ...(upstream.governance || {}),
      mandate_id: params.mandate_id || upstream.mandate_id,
    },
    disclosure_class: params.disclosure_class || upstream.disclosure_class || "public",
    payload: params.payload || {},
    packet_id: params.packet_id,
    upstream_packet_id: upstream.packet_id,
    spawn_reason: params.spawn_reason || "spawn_downstream",
  });

  if (!upstream.lineage) {
    upstream.lineage = { downstream_packet_ids: [] };
  }
  if (!Array.isArray(upstream.lineage.downstream_packet_ids)) {
    upstream.lineage.downstream_packet_ids = [];
  }
  if (!upstream.lineage.downstream_packet_ids.includes(downstream.packet_id)) {
    upstream.lineage.downstream_packet_ids.push(downstream.packet_id);
  }

  return downstream;
}

/** @deprecated Prefer spawnDownstreamPacket (upstream/downstream vocabulary). */
export function spawnChildPacket(parent, params = {}) {
  return spawnDownstreamPacket(parent, params);
}

/**
 * Append a new Fractanet routing hop to the Cognitive Packet.
 *
 * @param {import("@inseme/cop-core").CognitivePacket} packet
 * @param {object} hopInfo
 * @param {string} hopInfo.node_id Fractanet node ID
 * @param {string} hopInfo.instance_id Agent instance ID
 * @param {string} [hopInfo.interface_type="http"]
 * @param {string} [hopInfo.route_reason="relay"]
 * @param {string} [hopInfo.signature]
 * @returns {import("@inseme/cop-core").PacketHop}
 */
export function appendPacketHop(packet, hopInfo) {
  const hop_index = packet.hops.length;
  const newHop = {
    hop_index,
    node_id: hopInfo.node_id,
    instance_id: hopInfo.instance_id,
    interface: hopInfo.interface_type || "http",
    timestamp: new Date().toISOString(),
    route_reason: hopInfo.route_reason || "relay",
    signature: hopInfo.signature,
  };
  packet.hops.push(newHop);
  return newHop;
}

/**
 * Append a provisional spending trace to the current hop of the Cognitive Packet
 * and generate a balanced COP accounting/transaction event.
 *
 * @param {import("@inseme/cop-core").CognitivePacket} packet
 * @param {object} spendingDetails
 * @param {string} [spendingDetails.capability="ai/chat-completion"]
 * @param {string} spendingDetails.provider Provider name (e.g. "openai")
 * @param {string} spendingDetails.model Model name (e.g. "gpt-4o-mini")
 * @param {number} [spendingDetails.prompt_tokens=0]
 * @param {number} [spendingDetails.completion_tokens=0]
 * @param {string} [spendingDetails.evidence_hash]
 * @returns {{ spendingEntry: import("@inseme/cop-core").ProvisionalSpending, transactionEvent: object }}
 */
export function appendPacketSpending(packet, spendingDetails) {
  const currentHopIndex = Math.max(0, packet.hops.length - 1);
  const currentHop = packet.hops[currentHopIndex];
  const timestamp = new Date().toISOString();

  const { cost, rate_basis } = calculateProvisionalCost({
    provider: spendingDetails.provider,
    model: spendingDetails.model,
    prompt_tokens: spendingDetails.prompt_tokens || 0,
    completion_tokens: spendingDetails.completion_tokens || 0,
  });

  const spend_id = spendingDetails.spend_id || `spend:${packet.spending.length}`;
  // Anti double-count: refuse duplicate spend_id on the same packet
  if (packet.spending.some((s) => s.spend_id === spend_id)) {
    throw new Error(`appendPacketSpending: duplicate spend_id ${spend_id} on ${packet.packet_id}`);
  }
  if (
    spendingDetails.evidence_hash &&
    packet.spending.some(
      (s) => s.evidence_hash && s.evidence_hash === spendingDetails.evidence_hash
    )
  ) {
    throw new Error(
      `appendPacketSpending: duplicate evidence_hash on ${packet.packet_id} (would double-count)`
    );
  }

  const spendingEntry = {
    spend_id,
    hop_index: currentHopIndex,
    node_id: currentHop ? currentHop.node_id : "node:fracta:main",
    capability: spendingDetails.capability || "ai/chat-completion",
    provider: spendingDetails.provider,
    model: spendingDetails.model,
    prompt_tokens: spendingDetails.prompt_tokens || 0,
    completion_tokens: spendingDetails.completion_tokens || 0,
    provisional_cost: cost,
    rate_basis,
    timestamp,
    evidence_hash: spendingDetails.evidence_hash,
  };

  packet.spending.push(spendingEntry);

  // Generate balanced COP transaction event for provisional expense
  // Operational account id (provider SKU) + semantic chart account for statements.
  const expenseAccount = `urn:account:expense:${spendingDetails.provider}:${spendingDetails.model}`;
  const semanticExpense = spendingDetails.semantic_account_id || "COG:EXPENSE.AI.INFERENCE";
  const liabilityAccount = spendingDetails.liability_account_id || "COG:LIABILITY.PROVIDER.PAYABLE";
  const transactionEvent = {
    eventType: "accounting/transaction",
    schemaVersion: "1.0",
    transaction_id: `txn:provisional:${packet.packet_id}:hop-${currentHopIndex}:${packet.spending.length}`,
    resource_type: "fiat",
    accounting_domain: "provisional_execution_spending",
    postings: [
      {
        account: expenseAccount,
        quantity: cost,
        posting_type: "debit",
        description: `Provisional expense: ${spendingDetails.provider}/${spendingDetails.model} (${spendingDetails.prompt_tokens}+${spendingDetails.completion_tokens} tokens)`,
        semantic_account_id: semanticExpense,
      },
      {
        // Credit: either principal cash/account or provider payable (accrual of provisional liability)
        account: liabilityAccount,
        quantity: cost,
        posting_type: "credit",
        description: `Provisional provider payable for packet ${packet.packet_id}`,
        semantic_account_id: liabilityAccount,
      },
    ],
    governance: packet.governance,
    disclosure_class: packet.disclosure_class,
    idempotency_key: `idemp:${packet.packet_id}:spend:${spend_id}`,
    timestamp,
    metadata: {
      packet_id: packet.packet_id,
      treatment_id: packet.treatment_id,
      mandate_id: packet.mandate_id,
      hop_index: currentHopIndex,
      provider: spendingDetails.provider,
      model: spendingDetails.model,
      rate_basis,
      semantic_account_id: semanticExpense,
      valuation_status: "provisional",
      principal_account_id: packet.account_id,
    },
  };

  return { spendingEntry, transactionEvent };
}

/**
 * Own provisional spending for a packet: Σ spending[] on *this* packet only.
 * Does not include downstream packets. Default unit USD.
 *
 * @param {import("@inseme/cop-core").CognitivePacket} packet
 * @returns {import("@inseme/cop-core").ExactQuantity}
 */
export function calculatePacketOwnSpending(packet) {
  const unit = packet?.monetary_unit_default || DEFAULT_MONETARY_UNIT;
  let total = fromDecimal("0.00000000", unit);
  for (const s of packet?.spending || []) {
    if (s.provisional_cost) {
      const [a, b] = normalizeToCommonScale(total, s.provisional_cost);
      total = addQuantities(a, b);
    }
  }
  return total;
}

/**
 * @deprecated Name kept for callers; equals own spend only (not consolidated cascade).
 * Prefer calculatePacketOwnSpending or calculatePacketConsolidatedSpending.
 */
export function calculatePacketTotalSpending(packet) {
  return calculatePacketOwnSpending(packet);
}

/**
 * List of spend keys owned by this packet (for anti double-count audits).
 * Key = `${packet_id}::${spend_id}`.
 *
 * @param {import("@inseme/cop-core").CognitivePacket} packet
 * @returns {string[]}
 */
export function listOwnSpendKeys(packet) {
  const pid = packet?.packet_id || "unknown";
  return (packet?.spending || []).map((s, i) => `${pid}::${s.spend_id || `spend:${i}`}`);
}

/**
 * Consolidated provisional spending for a cascade root:
 * own_spend(P) + Σ consolidated(downstream_i).
 *
 * Downstream spending lines must NOT appear in P.spending[] — only via rollup.
 *
 * @param {import("@inseme/cop-core").CognitivePacket} packet
 * @param {(id: string) => (import("@inseme/cop-core").CognitivePacket|null|undefined)} resolvePacket
 * @param {object} [opts]
 * @param {Set<string>} [opts._visited] cycle guard
 * @returns {{ own: import("@inseme/cop-core").ExactQuantity, consolidated: import("@inseme/cop-core").ExactQuantity, spend_keys: string[], downstream_count: number }}
 */
export function calculatePacketConsolidatedSpending(packet, resolvePacket, opts = {}) {
  const unit = packet?.monetary_unit_default || DEFAULT_MONETARY_UNIT;
  const visited = opts._visited || new Set();
  if (!packet?.packet_id) {
    const zero = fromDecimal("0.00000000", unit);
    return { own: zero, consolidated: zero, spend_keys: [], downstream_count: 0 };
  }
  if (visited.has(packet.packet_id)) {
    throw new Error(`calculatePacketConsolidatedSpending: cycle detected at ${packet.packet_id}`);
  }
  visited.add(packet.packet_id);

  const own = calculatePacketOwnSpending(packet);
  let consolidated = own;
  const spend_keys = listOwnSpendKeys(packet);
  const downstreamIds = packet.lineage?.downstream_packet_ids || packet.child_packet_ids || [];
  let downstream_count = 0;

  for (const id of downstreamIds) {
    if (!id || !resolvePacket) continue;
    const down = resolvePacket(id);
    if (!down) continue;
    downstream_count += 1;
    const sub = calculatePacketConsolidatedSpending(down, resolvePacket, { _visited: visited });
    consolidated = addQuantities(consolidated, sub.consolidated);
    for (const k of sub.spend_keys) {
      if (spend_keys.includes(k)) {
        throw new Error(
          `calculatePacketConsolidatedSpending: double-count key ${k} (line appears in more than one own_spend)`
        );
      }
      spend_keys.push(k);
    }
  }

  return { own, consolidated, spend_keys, downstream_count };
}

/**
 * Audit: ensure no spend_id appears in more than one packet's own spending.
 *
 * @param {import("@inseme/cop-core").CognitivePacket[]} packets
 * @returns {{ ok: boolean, duplicate_keys: string[], own_by_packet: Record<string, string> }}
 */
export function auditPacketSpendNoDoubleCount(packets) {
  const list = Array.isArray(packets) ? packets : packets ? [packets] : [];
  const seen = new Map();
  const duplicate_keys = [];
  const own_by_packet = {};
  for (const p of list) {
    const keys = listOwnSpendKeys(p);
    own_by_packet[p.packet_id] = toDecimal(calculatePacketOwnSpending(p));
    for (const k of keys) {
      if (seen.has(k)) {
        duplicate_keys.push(k);
      } else {
        seen.set(k, p.packet_id);
      }
    }
  }
  return { ok: duplicate_keys.length === 0, duplicate_keys, own_by_packet };
}

/**
 * Summarize own vs consolidated for reporting / FractaBlog-style views.
 *
 * @param {import("@inseme/cop-core").CognitivePacket} packet
 * @param {(id: string) => any} [resolvePacket]
 */
export function summarizePacketSpending(packet, resolvePacket) {
  const ownQ = calculatePacketOwnSpending(packet);
  let consolidatedQ = ownQ;
  let downstream_count = 0;
  let spend_keys = listOwnSpendKeys(packet);
  if (typeof resolvePacket === "function") {
    const roll = calculatePacketConsolidatedSpending(packet, resolvePacket);
    consolidatedQ = roll.consolidated;
    downstream_count = roll.downstream_count;
    spend_keys = roll.spend_keys;
  }
  return {
    packet_id: packet.packet_id,
    monetary_unit_default: packet.monetary_unit_default || DEFAULT_MONETARY_UNIT,
    own_spend: toDecimal(ownQ),
    consolidated_spend: toDecimal(consolidatedQ),
    own_spend_lines: (packet.spending || []).length,
    hop_count: (packet.hops || []).length,
    downstream_count,
    spend_key_count: spend_keys.length,
    lineage: {
      upstream_packet_id: packet.lineage?.upstream_packet_id || null,
      downstream_packet_ids: packet.lineage?.downstream_packet_ids || [],
    },
  };
}

/**
 * Persist an accounting transaction event using a persist pipeline with degraded NDJSON spool fallback.
 *
 * @param {object} transactionEvent
 * @param {object} pipeline - cop_event_persist_pipeline instance
 * @returns {Promise<object>}
 */
export async function persistPacketAccountingTransaction(transactionEvent, pipeline) {
  if (!pipeline || typeof pipeline.persistAccountingEvent !== "function") {
    throw new Error("Invalid persist pipeline: persistAccountingEvent required");
  }
  return pipeline.persistAccountingEvent({ transactionEvent });
}

/**
 * Replay spooled accounting transaction events from an NDJSON spool into a store.
 *
 * @param {object} pipeline - cop_event_persist_pipeline instance
 * @param {object} [opts]
 * @returns {object} Replay report
 */
export function replayPacketAccountingSpool(pipeline, opts = {}) {
  if (!pipeline || typeof pipeline.replaySpool !== "function") {
    return { ok: false, error: "no_spool_pipeline" };
  }
  return pipeline.replaySpool(opts);
}

/**
 * Create an authoritative reconciliation event adjusting a provisional spend against actual provider cost.
 * Historical provisional events are NEVER rewritten; difference is recorded as an explicit compensating entry.
 *
 * @param {object} params
 * @param {string} [params.reconciliation_id]
 * @param {string} params.provisional_spending_id
 * @param {string} [params.packet_id]
 * @param {string} params.provider
 * @param {string} [params.model]
 * @param {string} [params.billing_period]
 * @param {import("./quantity.js").ExactQuantity} params.provisional_cost
 * @param {import("./quantity.js").ExactQuantity} params.actual_cost
 * @param {string} params.reason
 * @param {object} params.governance
 * @param {string} [params.idempotency_key]
 * @param {object} [params.evidence]
 * @returns {object} ReconciliationEvent
 */
export function createReconciliationAdjustment({
  reconciliation_id,
  provisional_spending_id,
  packet_id,
  provider,
  model,
  billing_period,
  provisional_cost,
  actual_cost,
  reason,
  governance,
  idempotency_key,
  evidence,
}) {
  if (!provisional_spending_id) throw new TypeError("provisional_spending_id is required");
  if (!provider) throw new TypeError("provider is required");
  if (!provisional_cost) throw new TypeError("provisional_cost is required");
  if (!actual_cost) throw new TypeError("actual_cost is required");
  if (!reason) throw new TypeError("reason is required");
  if (!governance) throw new TypeError("governance is required");

  // Invariant: adjustment = actual_cost - provisional_cost
  const adjustment = subtractQuantities(actual_cost, provisional_cost);
  const recId =
    reconciliation_id ||
    `urn:cop:reconciliation:${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const key = idempotency_key || `recon:${provisional_spending_id}:${recId}`;

  return {
    eventType: "accounting/reconciliation",
    schemaVersion: "1.0",
    reconciliation_id: recId,
    provisional_spending_id,
    packet_id: packet_id || null,
    provider,
    model: model || null,
    billing_period: billing_period || null,
    provisional_cost,
    actual_cost,
    adjustment,
    reason,
    evidence_references: evidence ? [evidence] : [],
    governance,
    idempotency_key: key,
    effective_at: new Date().toISOString(),
  };
}
