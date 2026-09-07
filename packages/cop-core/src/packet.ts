/**
 * Cognitive Packet Protocol & Tracing Types
 *
 * The Cognitive Packet is the authoritative execution and transport envelope in Fractanet.
 * It traces both the sequence of hops travelled across nodes/instances and the provisional
 * spending incurred at each step.
 *
 * FractaBlog and other UI feeds are pure projections (views) derived from these packets.
 *
 * @module packet
 * @since 1.0
 */

import { ExactQuantity, AccountIdentifier, DisclosureClass, GovernanceContext } from "./accounting";
import { MeasuredRiskProfile, ObservedExposure } from "./types.js";

/**
 * Single routing hop entry recorded on the Cognitive Packet.
 */
export interface PacketHop {
  /** Sequential hop index (0, 1, 2...). */
  hop_index: number;
  /** Fractanet node identifier (e.g. "node:fracta:main" or "node:workstation:win"). */
  node_id: string;
  /** Instance/agent identity handling the packet at this hop. */
  instance_id: string;
  /** Transport interface used to enter/exit this hop (e.g. "http", "mcp", "local"). */
  interface?: string;
  /** ISO-8601 UTC timestamp of the hop execution. */
  timestamp: string;
  /** Routing rationale or handler operation for this hop. */
  route_reason?: string;
  /** Optional cryptographic signature or token proving hop authenticity. */
  signature?: string;
}

/**
 * Provisional spending record for a single execution step/hop.
 */
export interface ProvisionalSpending {
  /**
   * Stable id of this spend line, unique within the owning packet
   * (e.g. "spend:0", "spend:1"). Owning packet_id + spend_id is globally unique.
   */
  spend_id?: string;
  /** Hop index to which this spending applies. */
  hop_index: number;
  /** Fractanet node identifier where spending occurred. */
  node_id: string;
  /** High-level COP capability invoked (e.g. "ai/chat-completion", "ai/embeddings"). */
  capability: string;
  /** LLM/Compute provider (e.g. "openai", "groq", "mistral", "local"). */
  provider: string;
  /** Model or resource SKU name (e.g. "gpt-4o-mini", "llama-3.3-70b-versatile"). */
  model: string;
  /** Number of prompt/input tokens processed. */
  prompt_tokens: number;
  /** Number of completion/output tokens generated. */
  completion_tokens: number;
  /** Exact decimal provisional cost estimate (default unit USD). */
  provisional_cost: ExactQuantity;
  /** Rate card reference used for estimation (e.g. "rate:openai:gpt-4o-mini:2026-08"). */
  rate_basis: string;
  /** ISO-8601 UTC timestamp when spending was incurred. */
  timestamp: string;
  /** Optional hash of request/response payload for evidence correlation. */
  evidence_hash?: string;
}

/**
 * Lineage relation for cascade accounting (spawn / split / delegate).
 *
 * Preferred vocabulary (network / packet, less anthropocentric than parent/child):
 *   - upstream_packet_id  — packet that authorized or spawned this work
 *   - downstream_packet_ids — packets spawned from this one
 *
 * Accepted aliases in prose (not preferred in schema):
 *   parent ≈ upstream, child ≈ downstream, root ≈ top of cascade, leaf ≈ no downstream.
 *
 * Other candidates considered: source/derived, origin/spawned, superordinate/subordinate.
 * "Upstream/downstream" fits Fractanet routing and avoids family metaphors.
 */
export interface PacketLineage {
  /** Packet that spawned or authorized this packet (none for cascade root). */
  upstream_packet_id?: string;
  /** Packets spawned from this packet (ids only — never copy their spending lines here). */
  downstream_packet_ids?: string[];
  /** Why this packet was spawned (split, subagent, hop_delegate, continuation, …). */
  spawn_reason?: string;
}

/**
 * Semantic home and return target (Ithaca) for a Cognitive Packet.
 * Ithaca is the durable semantic locus to which the packet's yield returns.
 */
export interface IthacaTarget {
  /** Description or identity of the semantic home (corpus, mandant, room, conversation, etc.). */
  description?: string;
  /** Return target identifier, address, or handler name. */
  return_target?: string;
  /** Optional response channel or bus event topic. */
  response_channel?: string;
  /** Conditions under which return is triggered or expected. */
  return_conditions?: string[];
}

/**
 * Yield produced by one or more hops during a Cognitive Packet journey.
 * Separates the semantic output from operational meta-learning.
 */
export interface PacketYield {
  /** The semantic result / answer / patch / findings produced. */
  semantic_yield?: unknown;
  /** Operational learnings, performance, metrics, meta-observations. */
  operational_yield?: Record<string, unknown>;
  /** Timestamp when yield was produced. */
  produced_at?: string;
  /** Handler or agent identity that produced the yield. */
  produced_by?: string;
}

/**
 * Lifecycle states keeping solved, returned, and assimilated semantically distinct.
 *
 * - draft: initialized but not yet dispatched.
 * - dispatched: currently travelling across hops / handlers.
 * - solved: local handler completed work and produced a yield.
 * - returned: yield reached the identifiable Ithaca / caller.
 * - assimilated: Ithaca incorporated the yield into durable cognitive state (corpus, memory).
 * - failed: handler or routing failed.
 * - cancelled: execution cancelled by caller/parent or cascade abort.
 * - superseded: replaced by a newer or better packet.
 */
export type CognitivePacketLifecycleStatus =
  | "draft"
  | "dispatched"
  | "solved"
  | "returned"
  | "assimilated"
  | "failed"
  | "cancelled"
  | "superseded";

/**
 * Human and machine accounting metrics for a Cognitive Packet journey or Case study.
 */
export interface CaseMetrics {
  /** Human time spent packetizing, supervising, intervening, correcting (minutes). */
  human_minutes?: number;
  /** Machine / API cost (USD or unit). */
  machine_cost?: number;
  /** Total number of handler hops traversed. */
  hops?: number;
  /** Number of child packets spawned. */
  child_packets?: number;
}

/**
 * Minimal shared Case Record for Reality testing (Case 001 Incident / Case 002 Guide).
 * Experimental observation format per cogentia#113 and inseme#54.
 */
export interface CaseRecord {
  /** Case identifier (e.g. "case-001-incident-20260820"). */
  case_id: string;
  /** Case pattern ("incident" | "guide" | string). */
  pattern: "incident" | "guide" | string;
  /** Originating context, URL, or trigger. */
  origin?: string;
  /** ISO-8601 start timestamp. */
  started_at: string;
  /** Cognitive intent of the case. */
  intent: string;
  /** Initial state before departure. */
  initial_state?: Record<string, unknown> | string;
  /** Target Ithaca where the case yield must return. */
  ithaca: IthacaTarget;
  /** Associated packet(s). */
  packets: (CognitivePacket | string)[];
  /** Case outcome and distinct return/assimilation state. */
  result?: {
    status: CognitivePacketLifecycleStatus;
    returned: boolean;
    assimilated: boolean;
    yield?: PacketYield;
  };
  /** Scarce resources consumed (Skin in the Game). */
  metrics?: CaseMetrics;
  /** Residue: explicit observations of what the current packet model failed to capture. */
  residue?: string[];
}

/**
 * Authoritative Cognitive Packet Structure.
 */
export interface CognitivePacket {
  /** Unique URN or ID for this packet (e.g. "urn:cop:packet:1234..." or "pkt-..."). */
  packet_id: string;
  /** Mandate authorizing this packet's processing. */
  mandate_id?: string;
  /** Governed treatment ID scope. */
  treatment_id?: string;
  /** Primary debtor account paying for execution. */
  account_id?: AccountIdentifier;
  /** Budget reservation ID linked to this packet. */
  budget_reservation_id?: string;
  /**
   * Default monetary unit for provisional valuation (providers bill in USD today).
   * Non-USD resources use their own unit on ExactQuantity; fiat default remains USD.
   */
  monetary_unit_default?: string;
  /** Cognitive intent / goal of this packet. */
  intent?: string;
  /** Semantic home and return target (Ithaca). */
  ithaca?: IthacaTarget;
  /** Current lifecycle status (draft | dispatched | solved | returned | assimilated). */
  status?: CognitivePacketLifecycleStatus;
  /** Yield produced by the journey. */
  yield?: PacketYield;
  /** Cascade lineage (upstream/downstream). */
  lineage?: PacketLineage;
  /** Ordered list of routing hops travelled across Fractanet nodes. */
  hops: PacketHop[];
  /**
   * Ordered list of provisional spending traces incurred on *this* packet only (own spend).
   * Never duplicate downstream packets' spending lines here (anti double-count).
   */
  spending?: ProvisionalSpending[];
  /** Governance context governing this packet's treatment. */
  governance?: GovernanceContext;
  /** Visibility disclosure class for projections ("public" | "restricted" | "private"). */
  disclosure_class?: DisclosureClass;
  /** Creation timestamp (ISO-8601 UTC). */
  created_at: string;
  /** Envelope metadata for routing and switching. */
  envelope?: Record<string, unknown>;
  /** Packet payload content or reference. */
  payload: Record<string, unknown>;
  /**
   * Packet Closure: condition under which packet carries or verifiably materializes
   * everything needed for continuation without undocumented external context.
   * (@since 1.1 / Issue #58)
   */
  closure?: PacketClosure;
  /**
   * Logical placements of this packet across store technologies (SQLite, PostgreSQL, GitHub).
   * (@since 1.1 / Issue #58)
   */
  placements?: PacketPlacement[];
  /**
   * Causal frontier defining the boundary of observed events/dependencies.
   * (@since 1.1 / Issue #58)
   */
  causal_frontier?: CausalFrontier;
  /**
   * Governed external side-effects (EffectIntent and EffectReceipt).
   * (@since 1.1 / Issue #58)
   */
  effects?: Array<EffectIntent | EffectReceipt>;
  /**
   * Governed Measured Risk profile (@since 1.2 / Issue #51).
   */
  measured_risk?: MeasuredRiskProfile;
  /**
   * Observed Exposure during execution (@since 1.2 / Issue #51).
   */
  observed_exposure?: ObservedExposure;
  /** Residue: unrepresented observations during packet execution. */
  residue?: string[];
}

/**
 * Packet Closure specification relative to an admissible-handler class.
 */
export interface PacketClosure {
  /** Closure classification: self_contained, materializable via resolver, or open (unclosed). */
  closure_kind: "self_contained" | "materializable" | "open";
  /** Admissible handler identities or classes able to continue this packet. */
  admissible_handlers?: string[];
  /** Required runtime or host environment capabilities. */
  required_environment?: Record<string, unknown>;
  /** Referenced durable dependencies required for complete materialization. */
  referenced_dependencies?: Array<{
    dependency_id: string;
    kind: "artifact" | "event" | "document" | "schema" | "capability";
    locator: string;
    hash?: string;
  }>;
  /** Timestamp when closure was verified or materialized. */
  materialized_at?: string;
}

/**
 * Logical placement and storage binding for a Cognitive Packet.
 */
export interface PacketPlacement {
  /** Logical store identifier (e.g. "sqlite:local", "supabase:ndiysuhzmztatpxbkezn", "github:repo"). */
  store_id: string;
  /** Technology kind of the store. */
  store_kind: "sqlite" | "postgres" | "github" | "object_storage" | "memory";
  /** Resource locator within the store (table, file path, primary key, URL). */
  locator: string;
  /** Timestamp when packet was synchronized to this placement. */
  synchronized_at?: string;
  /** Whether this placement is currently the authoritative/primary store. */
  is_primary?: boolean;
}

/**
 * Causal Frontier defining the boundary of causal lineage and dependencies.
 */
export interface CausalFrontier {
  /** Frontier events establishing the causal boundary. */
  frontier_events: Array<{
    event_id: string;
    topic_id?: string;
    sequence_number?: number;
    observed_at: string;
  }>;
  /** Optional cryptographic hash or digest of the causal frontier. */
  frontier_hash?: string;
}

/**
 * Intent to execute a governed consequential effect.
 */
export interface EffectIntent {
  /** Unique ID of the effect intent. */
  intent_id: string;
  /** Associated packet ID. */
  packet_id: string;
  /** Mandate authorizing the effect. */
  mandate_id?: string;
  /** Governed action name. */
  action_name: string;
  /** Target resource or system mutated by the effect. */
  target_resource: string;
  /** Stable idempotency key for safe replay / deduplication. */
  idempotency_key: string;
  /** Parameters passed to the executor. */
  parameters: Record<string, unknown>;
  /** Timestamp when effect was planned. */
  planned_at: string;
  /** Status of the intent. */
  status: "planned" | "authorized" | "committed" | "rejected";
}

/**
 * Receipt proving the execution of a governed consequential effect.
 */
export interface EffectReceipt {
  /** Unique ID of the effect receipt. */
  receipt_id: string;
  /** Original effect intent ID. */
  intent_id: string;
  /** Associated packet ID. */
  packet_id: string;
  /** Idempotency key from the intent. */
  idempotency_key: string;
  /** Execution status. */
  status: "success" | "failure" | "aborted";
  /** Identity of the executor. */
  executor: string;
  /** Timestamp of execution. */
  executed_at: string;
  /** Result payload from executor. */
  result?: Record<string, unknown>;
  /** Error message if failed. */
  error?: string;
}

/**
 * FractaBlog Projected Entry derived from Cognitive Packet Truth.
 */
export interface FractaBlogPostProjection {
  /** Derived post ID. */
  post_id: string;
  /** Source packet URN. */
  packet_id: string;
  /** Post title/headline. */
  title: string;
  /** Summary markdown description of treatment. */
  summary: string;
  /** Actor/Principal governance metadata. */
  actor_subject_id: string;
  principal_subject_id: string;
  /** Trace of Fractanet node hops. */
  hop_chain: Array<{
    hop_index: number;
    node_id: string;
    instance_id: string;
    timestamp: string;
  }>;
  /** Provisional spending breakdown per hop. */
  spending_breakdown: Array<{
    hop_index: number;
    provider: string;
    model: string;
    total_tokens: number;
    provisional_cost_usd: string;
  }>;
  /** Total provisional cost formatted as decimal USD string. */
  total_provisional_cost_usd: string;
  /** Disclosure class of the projection. */
  disclosure_class: DisclosureClass;
  /** ISO-8601 UTC timestamp of projection. */
  published_at: string;
}
