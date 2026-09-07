/**
 * COP Core - Cognitive Orchestration Protocol
 * Reference TypeScript Definitions
 *
 * Based on Architecture.md and Invariants.md
 */

// ----------------------------------------------------------------------
// 1. Primitive Types & Enums
// ----------------------------------------------------------------------

/**
 * Globally unique identifier (UUID v4 recommended).
 */
export type UUID = string;

/**
 * ISO-8601 Timestamp (UTC).
 * Example: "2025-12-31T23:59:59Z"
 */
export type ISODateTime = string;

/**
 * Opaque string for Event/Artifact types.
 * Often namespaced, e.g. "cop/continuation", "chat/message".
 */
export type TypeString = string;

/**
 * Strict JSON Value model.
 * Implementations MUST NOT rely on non-JSON types.
 */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue | undefined };

/**
 * Standard status lifecycle for Topics.
 */
export type TopicStatus = "open" | "in_progress" | "exhausted" | "closed";

/**
 * Standard status lifecycle for Tasks.
 */
export type TaskStatus = "pending" | "running" | "needs_input" | "done" | "failed" | "cancelled";

/**
 * Standard status lifecycle for Steps.
 */
export type StepStatus = "pending" | "running" | "done" | "skipped" | "failed";

// ----------------------------------------------------------------------
// 2. Core Data Model (Immutable)
// ----------------------------------------------------------------------

/**
 * Event: The fundamental unit of change in COP.
 * Events are the only mutable input to the system (append-only).
 * All other structures are derived from Events.
 */
export interface COPEvent {
  /** Globally unique identifier. */
  id: UUID;

  /** Topic this event belongs to. */
  topicId: UUID;

  /**
   * Strict monotonic sequence number within the Topic.
   * Defines the total order of Events in that Topic.
   */
  topicSeq: number;

  /** Semantic type of the event. */
  type: TypeString;

  /** Version identifier for the payload schema (e.g. "1.0"). */
  schemaVersion: string;

  /** When the event became durable. */
  createdAt: ISODateTime;

  /** domain-specific data. */
  payload: JsonValue;

  /** Auxiliary metadata (tracing, user-agent, etc). */
  metadata?: Record<string, JsonValue>;

  /** Optional correlation ID to link events across topics. */
  correlationId?: string;

  /** Explicit causal dependencies (parent event IDs). */
  parentEventIds?: UUID[];
}

/**
 * Artifact: Immutable data produced or consumed within a Topic.
 * e.g. messages, documents, tool results, continuations.
 */
export interface COPArtifact<P extends JsonValue = JsonValue> {
  id: UUID;
  topicId: UUID;

  /** Semantic type (e.g. "text/markdown", "cop/continuation"). */
  type: TypeString;

  /** Optional MIME-like descriptor. */
  format?: string;

  /** Immutable content. */
  payload: P;

  /** Auxiliary metadata. */
  metadata?: Record<string, JsonValue>;

  createdAt: ISODateTime; // Timestamp is useful for derived ordering
}

// ----------------------------------------------------------------------
// 2b. Trace-Centric Architecture Primitives (COP 2.x — Issue #61, #63)
// ----------------------------------------------------------------------

/** Target classification for a TraceRef */
export type TraceTargetType = "cop_event" | "cop_artifact" | "external";

/** Access and visibility class for a trace */
export type TraceVisibility = "open" | "redacted" | "restricted" | "sealed" | "opaque_but_escrowed";

/** Universal reference addressing a Trace without payload duplication */
export interface TraceRef {
  schema: "cop.trace-ref/v1";
  trace_id: string;
  target_type: TraceTargetType;
  integrity?: string | null;
  locator?: string | null;
  resolution_hints?: Record<string, JsonValue> | null;
}

/** Metadata sufficient to reason about a Trace without materializing its bytes */
export interface TraceDescriptor {
  schema: "cop.trace-descriptor/v1";
  trace_ref: TraceRef;
  kind: string;
  origin: string;
  observed_at: ISODateTime;
  occurred_at?: ISODateTime | null;
  created_at?: ISODateTime | null;
  integrity?: string | null;
  visibility: TraceVisibility;
  custody?: string | null;
  meta?: Record<string, JsonValue>;
}

/** Qualitative epistemic linkage connecting a trace to an assertion */
export type EvidenceRelationType = "supports" | "contradicts" | "contextualizes";

/** Epistemic status of a proposition or event */
export type EpistemicStatus =
  | "observed"
  | "computed"
  | "declared"
  | "inferred"
  | "normative"
  | "proposed"
  | "decided"
  | "published"
  | "hypothesized"
  | "disputed";

/** Proposition known, held, or considered by the Corpus with stable identity */
export interface Assertion<C = JsonValue> {
  schema: "cop.assertion/v1";
  assertion_id: string;
  revision: number;
  claim: C;
  epistemic_status: EpistemicStatus;
  subject_ref?: string | null;
  asserted_by: string;
  asserted_at: ISODateTime;
  supersedes_id?: string | null;
  meta?: Record<string, JsonValue>;
}

/** Typed link between a TraceRef and an Assertion */
export interface EvidenceRelation {
  schema: "cop.evidence-relation/v1";
  relation_id: string;
  relation_type: EvidenceRelationType;
  trace_ref: TraceRef;
  assertion_id: string;
  strength?: "conclusive" | "strong" | "plausible" | "weak" | number | null;
  justification?: JsonValue;
  asserted_by: string;
  recorded_at: ISODateTime;
  meta?: Record<string, JsonValue>;
}

/** Authoritative Execution Budget Limits */
export interface ExecutionBudgetLimits {
  max_steps?: number;
  max_tool_calls?: number;
  max_subagents?: number;
  max_elapsed_ms?: number;
  max_external_effects?: number;
  [key: string]: number | undefined;
}

/** Execution Budget Ledger Snapshot */
export interface ExecutionBudgetSnapshot {
  budget_id: string;
  version: number;
  authority_version: number;
  mandate_ref?: string | null;
  has_grant: boolean;
  limits: ExecutionBudgetLimits;
  reserved: ExecutionBudgetLimits;
  settled: ExecutionBudgetLimits;
  available: ExecutionBudgetLimits;
}

// ----------------------------------------------------------------------
// 2.2 Reactive Corpus & Temporal Projections (Issue #61, #64)
// ----------------------------------------------------------------------

/** Temporal Precision */
export type TemporalPrecision =
  | "exact"
  | "day"
  | "month"
  | "year"
  | "interval"
  | "approximate"
  | "unknown";

/** Temporal Claim with precision and chronological sort keys */
export interface TemporalClaim {
  value: string;
  precision: TemporalPrecision;
  sort_key_ms: number;
  interval_end_ms?: number | null;
}

/** Timeline Item in a derived Temporal Projection */
export interface TimelineItem {
  item_id: string;
  subject_ref?: string | null;
  occurred_at: TemporalClaim;
  trace_created_at?: string | null;
  observed_or_ingested_at: ISODateTime;
  source_trace_refs: TraceRef[];
  assertion_ref?: string | null;
  epistemic_status: string;
  epistemic_summary?: {
    supports_count: number;
    contradicts_count: number;
    has_contradiction: boolean;
  } | null;
  claim?: unknown;
  description?: string;
}

/** Invalidation cause explaining why a derived projection is stale */
export interface InvalidationCause {
  trigger_ref: string;
  reason: string;
  invalidated_at: ISODateTime;
}

/** Reconstructible derived Temporal Projection conforming to cop.temporal-projection/v1 */
export interface TemporalProjection {
  schema: "cop.temporal-projection/v1";
  projection_id: string;
  subject_ref?: string | null;
  topic_ref?: string | null;
  projector_id: string;
  projector_version: string;
  policy: Record<string, unknown>;
  built_at: ISODateTime;
  is_authoritative: false;
  is_derived: true;
  stale: boolean;
  invalidation_cause?: InvalidationCause | null;
  source_commitments: {
    assertion_count: number;
    trace_count: number;
    source_refs: string[];
    digest?: string | null;
  };
  timeline: TimelineItem[];
}

/** Diagnostic breakdown separating reachability, admissibility, and authority (Issue #66) */
export interface CapabilityInvocationDiagnostic {
  discovered?: boolean;
  reachable?: boolean;
  healthy?: boolean;
  admissible?: boolean;
  selected_or_funded?: boolean;
  authorized?: boolean;
  invoked?: boolean;
  committed?: boolean;
}

/** Mandate scope specifying permitted/forbidden actions and budget ceilings */
export interface MandateScope {
  domain?: string;
  community?: string;
  jurisdiction?: string;
  allowed_actions?: string[];
  capabilities?: string[];
  authorized_capabilities?: string[];
  forbidden_actions?: string[];
  budget_ceiling?: Record<string, number>;
  max_exposure?: string | ExposureEnvelope;
  [key: string]: unknown;
}

// ----------------------------------------------------------------------
// 2b. Measured Risk and Exposure (@since 1.2 / Issue #51)
// ----------------------------------------------------------------------

/** Objective descriptor specifying value, learning, or exploration intent */
export interface ObjectiveDescriptor {
  kind: "experiment" | "routine" | "exploration" | "remediation" | "dispositive";
  expected_value: string;
  discriminating_power?: "low" | "medium" | "high";
  learning_hypothesis?: string;
  [key: string]: unknown;
}

/** Risk descriptor classifying uncertainty and tail risk */
export interface RiskDescriptor {
  class: "experimental" | "routine" | "high_uncertainty" | "critical";
  uncertainty: "low" | "medium" | "high" | "unknown";
  tail: "negligible" | "bounded" | "unknown" | "catastrophic";
  risk_level_scalar?: "low" | "medium" | "high" | "critical";
  [key: string]: unknown;
}

/** Exposure envelope specifying what is put at stake and reachable blast radius */
export interface ExposureEnvelope {
  max_cost?: string | number;
  affected_subjects?: number;
  scope: "sandbox" | "local_internal" | "shared_internal" | "external_public" | "third_party";
  external_effects: "none" | "bounded" | "propagating" | "irreversible";
  consequential_ceiling?: Record<string, number | string>;
  [key: string]: unknown;
}

/** Reversibility envelope defining rollback, compensation, repair, and residue */
export interface ReversibilityEnvelope {
  state_reversal: "full" | "partial" | "none";
  compensation: "available" | "partial" | "none";
  restitutability?: "full" | "partial" | "none";
  repairability: "high" | "medium" | "low" | "none";
  expected_residue: "none" | "low" | "material";
  recovery_cost?: "negligible" | "cheap" | "expensive" | "prohibitive";
  option_loss?: "none" | "bounded" | "high";
  stop_conditions?: string[];
  [key: string]: unknown;
}

/** Damage control state for exceptional containment regime */
export interface DamageControlState {
  active: boolean;
  trigger_reason?: string;
  containment_mode?: string;
  entered_at?: ISODateTime;
  expires_at?: ISODateTime;
  [key: string]: unknown;
}

/** Full Measured Risk Profile governing bounded consequential experimentation */
export interface MeasuredRiskProfile {
  objective: ObjectiveDescriptor;
  risk: RiskDescriptor;
  exposure: ExposureEnvelope;
  recovery: ReversibilityEnvelope;
  responsibility: {
    beneficiary_principal_ref?: string;
    loss_bearer_principal_ref: string;
    third_parties_affected?: boolean;
    [key: string]: unknown;
  };
  damage_control?: DamageControlState;
  [key: string]: unknown;
}

/** Observed Exposure recording actual measured impact and triggered stop conditions */
export interface ObservedExposure {
  observed_cost?: string | number;
  observed_affected_subjects?: number;
  observed_external_effects?: "none" | "bounded" | "propagating" | "irreversible";
  stop_condition_triggered?: string | null;
  residue?: string[];
  recorded_at: ISODateTime;
  [key: string]: unknown;
}

/** Result of evaluating a Measured Risk profile against a Mandate */
export interface MeasuredRiskEvaluation {
  admissible: boolean;
  decision: "admissible" | "refused";
  error?: string | null;
  reason?: string | null;
  damage_control_triggered?: boolean;
  evaluated_profile?: MeasuredRiskProfile;
}

/** Explicit Mandate object under COP/Identity and COP/Mandated Agent Security */
export interface MandateObject {
  artifactType?: "identity/mandate";
  mandate_id: string;
  version?: string;
  principal_ref?: string;
  principal_subject_id?: string;
  logical_agent_ref?: string;
  representative_subject_id?: string;
  representative_kind?: string;
  parent_mandate_ref?: string;
  status: "active" | "suspended" | "revoked" | "expired" | "draft";
  valid_from?: string;
  valid_until?: string | null;
  revocation_policy?: string;
  scope?: MandateScope;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Inspectable authority evaluation decision or grant */
export interface AuthorityGrant {
  granted: boolean;
  decision: "granted" | "refused";
  reason: string | null;
  error?: string | null;
  mandate_ref: string | null;
  mandate_version?: string | null;
  principal_ref: string | null;
  logical_agent_ref: string | null;
  capability: string;
  constraints?: MandateScope;
  evaluated_at: ISODateTime;
  diagnostic: CapabilityInvocationDiagnostic;
}

/** Options for evaluating mandate authority */
export interface EvaluateMandateOptions {
  mandate?: MandateObject | null;
  mandate_ref?: string;
  version_pin?: string | null;
  expected_principal_ref?: string | null;
  expected_actor_ref?: string | null;
  capability: string;
  action_category?: "suggestion" | "recommendation" | "authorization" | "mandate";
  demand?: Record<string, number> | null;
  parent_mandate?: MandateObject | null;
  exposure?: ExposureEnvelope | string | null;
  measured_risk?: MeasuredRiskProfile | null;
  at_time?: string | Date;
}

/** Portable governed-capability bundle requiring local rebinding */
export interface PortableCapabilityBundle {
  continuation_id: string;
  state: Record<string, unknown>;
  required_capability: string;
  authority_lineage: {
    principal_ref: string;
    mandate_ref: string;
    logical_agent_ref: string;
  };
  bound: boolean;
  local_binding?: Record<string, unknown> | null;
}

// ----------------------------------------------------------------------
// 3. Projections (Derived State)
// ----------------------------------------------------------------------

/**
 * Topic: Groups a sequence of Events into a coherent process.
 * Derived from the Event log.
 */
export interface COPTopic {
  id: UUID;
  status: TopicStatus;

  /** Computed from aggregation of events. */
  title?: string;

  created_at: ISODateTime; // Often derived from the first event
  updated_at: ISODateTime; // derived from last event

  metadata?: Record<string, JsonValue>;
}

/**
 * Task: A unit of work within a Topic.
 * Derived from Events.
 */
export interface COPTask {
  id: UUID;
  topicId: UUID;

  /** Hierarchical relationship. */
  parentTaskId?: UUID;

  /** Optional durable mandate-bearing continuity responsible for the work. */
  assignedLogicalAgentRef?: string;

  /** Optional handler profile expected to execute the work. */
  assignedHandlerProfile?: string;

  status: TaskStatus;
  title?: string;

  created_at: ISODateTime;
  updated_at: ISODateTime;

  metadata?: Record<string, JsonValue>;
}

/**
 * Step: A finer-grained subunit inside a Task.
 * Derived from Events.
 */
export interface COPStep {
  id: UUID;
  topicId: UUID;
  taskId: UUID;

  status: StepStatus;

  /** Artifacts produced or consumed by this step. */
  artifactIds?: UUID[];

  created_at: ISODateTime;
  updated_at: ISODateTime;

  metadata?: Record<string, JsonValue>;
}

// ----------------------------------------------------------------------
// 4. Continuations
// ----------------------------------------------------------------------

/**
 * Reserved type for Continuation artifacts.
 */
export const ARTIFACT_TYPE_CONTINUATION = "cop/continuation";

/**
 * Reserved wildcard value for a capability-bound Continuation.
 * Means "any compliant Handler whose offered capabilities match may resume".
 */
export const CONTINUATION_HANDLER_PROFILE_ANY = "*";

/**
 * Standard payload for a Continuation Artifact.
 * Represents suspended or deferred work.
 *
 * A Continuation is capability-bound by default. A logical-agent reference is
 * optional and records an explicit identity-bound return or resumption policy;
 * it does not identify the concrete HandlerInstance that will execute work.
 */
export type ContinuationPayload = {
  /**
   * Optional stable handler profile requested for resumption.
   * The reserved "*" value means any compatible Handler profile.
   */
  handlerProfile?: string;

  /** Capabilities required to resume the work. */
  requiredCapabilities?: string[];

  /**
   * Optional durable mandate-bearing identity for identity-bound resumption.
   * This MUST NOT be used as a substitute for a HandlerInstance record.
   */
  logicalAgentRef?: string;

  /** Context identifiers. */
  topicId: UUID;
  taskId?: UUID;
  stepId?: UUID;

  /** Opaque, externally durable state needed for correct resumption. */
  state: JsonValue;

  /** Resume conditions. */
  waitForEvents?: string[]; // Event types or IDs
  resumeAfter?: ISODateTime;
  resumeBefore?: ISODateTime;

  /** Retry policy. */
  retry?: {
    maxAttempts: number;
    attempt: number;
    retryDelayMs: number;
  };

  /** Causal Trace reference (Trace-centric COP 2.x, Issue #61). */
  traceRef?: string | string[];

  /** Authority / Mandate reference under which this continuation operates (Issue #68). */
  mandateRef?: string;

  label?: string;
  meta?: Record<string, JsonValue>;

  /** Allow arbitrary extra fields for specific profiles. */
  [key: string]: JsonValue | undefined;
};

/**
 * Type guard for Continuation Artifacts.
 */
export interface COPContinuation extends COPArtifact<ContinuationPayload> {
  type: "cop/continuation";
}

/**
 * Reserved Artifact type for packet forks (Issue #68, R2).
 */
export const ARTIFACT_TYPE_FORK = "cop/fork";

/**
 * Standard payload for a Fork Artifact.
 * Represents a branched exploration or split execution under a shared authority envelope.
 */
export type ForkPayload = {
  /** Parent packet or continuation being forked. */
  forkSourcePacketId: UUID;

  /** Stable branch identifier. */
  branchId: string;

  /** Causal trace reference leading to this fork point (COP 2.x). */
  traceRef?: string | string[];

  /**
   * Authority / Mandate reference.
   * Under the Consequential Rossignol invariant (Issue #68, R2), forking a packet
   * cannot recreate consumed budget or escape authority limits.
   */
  mandateRef: string;

  /** Context identifiers. */
  topicId: UUID;
  taskId?: UUID;
  stepId?: UUID;

  /** Target handler profile or requested capabilities for this branch. */
  handlerProfile?: string;
  requiredCapabilities?: string[];

  /** State partitioned or specialized for this branch. */
  state: JsonValue;

  label?: string;
  meta?: Record<string, JsonValue>;

  /** Allow arbitrary extra fields for specific profiles. */
  [key: string]: JsonValue | undefined;
};

/**
 * Type guard for Fork Artifacts.
 */
export interface COPFork extends COPArtifact<ForkPayload> {
  type: "cop/fork";
}

// ----------------------------------------------------------------------
// 5. Runtime Interfaces
// ----------------------------------------------------------------------

/**
 * Minimal Handler interface.
 * A Handler is a stateless, idempotent executor; it does not itself establish
 * mandate authority. Concrete executions are recorded as HandlerInstances by
 * profiles or runtimes when accountability requires it.
 */
export interface COPHandler {
  readonly profile: string;

  /** Core reaction to events. */
  onEvent(event: COPEvent, ctx: HandlerContext): Promise<void>;

  /** Optional periodic supervision. */
  onTick?(ctx: HandlerContext): Promise<void>;
}

/**
 * Context passed to handlers during execution.
 */
export interface HandlerContext {
  bus: COPBus;
  store: COPStore;

  /** Current wall-clock time (ISO). */
  now(): ISODateTime;

  /**
   * Publish an event.
   * The implementation MUST ensure strict topicSeq ordering constraints.
   */
  emit(event: COPEvent): Promise<void>;
}

/**
 * Abstraction of the Event Bus.
 */
export interface COPBus {
  publish(event: COPEvent): Promise<void>;

  /** Fetch events for replay. */
  fetchFromSeq(params: { topicId: UUID; fromSeq: number; limit?: number }): Promise<COPEvent[]>;
}

/**
 * Projection Store interface.
 */
export interface COPStore {
  // Topics
  getTopic(id: UUID): Promise<COPTopic | null>;
  saveTopic(topic: COPTopic): Promise<void>;

  // Tasks
  getTask(id: UUID): Promise<COPTask | null>;
  saveTask(task: COPTask): Promise<void>;
  listTasksByTopic(params: { topicId: UUID; status?: TaskStatus[] }): Promise<COPTask[]>;

  // Steps
  getSteps(taskId: UUID): Promise<COPStep[]>;
  saveStep(step: COPStep): Promise<void>;

  // Artifacts
  getArtifact(id: UUID): Promise<COPArtifact | null>;
  saveArtifact(artifact: COPArtifact): Promise<void>;
  listArtifacts(params: { topicId: UUID; type?: string }): Promise<COPArtifact[]>;
}
