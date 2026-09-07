/**
 * COP/Accounting Protocol Types
 *
 * This module defines TypeScript types for the COP/Accounting protocol.
 * These types represent the day-one accounting conformance kernel.
 *
 * @module accounting
 * @since 1.0
 */

// ----------------------------------------------------------------------
// 1. Base Types
// ----------------------------------------------------------------------

/**
 * Exact quantity representation using decimal coefficient and scale.
 *
 * CRITICAL: No binary floating-point arithmetic for authoritative quantities.
 * The coefficient is a string to preserve exact precision.
 *
 * @example
 * // Represents 1.23456789
 * { coefficient: "123456789", scale: 8 }
 *
 * @example
 * // Represents -5.00
 * { coefficient: "-500", scale: 2, unit: "kudos" }
 */
export interface ExactQuantity {
  /** Decimal coefficient as string. Can be positive or negative. */
  coefficient: string;
  /** Number of decimal places (0-18). */
  scale: number;
  /** Unit of measure for the quantity. */
  unit?: string;
}

/**
 * Canonical account identifier.
 *
 * MUST accept HTTPS URLs including identity URLs like https://jhn.baronsmariani.org/
 *
 * Format options:
 * - HTTPS URL: https://jhn.baronsmariani.org/
 * - URN: urn:account:{type}:{id}
 * - Local reference: local:{type}:{id}
 * - Kudos reference: kudos:{username}
 */
export type AccountIdentifier = string;

/**
 * Accounting domain scope.
 *
 * Balancing is enforced within (resourceType, unit, accountingDomain).
 * Different domains never balance implicitly.
 */
export type AccountingDomain = string;

/**
 * Type of resource being accounted.
 */
export type ResourceType =
  | "kudos"
  | "fiat"
  | "cpu-time"
  | "storage"
  | "reputation"
  | "carbon-credits"
  | string;

/**
 * Disclosure class controlling visibility in projections.
 *
 * Public projections must not require private purchase content.
 */
export type DisclosureClass = "public" | "restricted" | "private" | "confidential";

/**
 * Governance context for accountability and mandate compliance.
 */
export interface GovernanceContext {
  /** The subject who physically acts (agent or person). */
  actor_subject_id: string;
  /** Kind of the acting subject. */
  actor_subject_kind?: SubjectKind;
  /** The subject on whose behalf the action is taken. */
  principal_subject_id: string;
  /** Reference to the mandate artifact authorizing this action. */
  mandate_id?: string;
  /** Legal or organizational basis for the capacity to act. */
  capacity_basis?: string;
  /** Role or office under which the actor is exercising capacity. */
  acting_as?: string;
}

/**
 * Kinds of subjects that can act in COP/Accounting.
 */
export type SubjectKind =
  | "natural_person_living"
  | "ai_agent"
  | "technical_node"
  | "legal_entity_collective"
  | "role_or_office"
  | "natural_person_deceased"
  | "unincorporated_collective"
  | "digital_twin";

/**
 * A single posting within a transaction.
 *
 * Debits and credits must balance exactly.
 */
export interface Posting {
  /** Account identifier (canonical URL or URN). */
  account: AccountIdentifier;
  /** Exact quantity being posted. */
  quantity: ExactQuantity;
  /** Debit increases asset/expense, credit increases liability/equity/revenue. */
  posting_type: "debit" | "credit";
  /** Human-readable description. */
  description?: string;
  /** Additional posting-level metadata. */
  metadata?: Record<string, unknown>;
}

/**
 * Reference to a budget artifact or event.
 */
export interface BudgetReference {
  /** Identifier of the budget. */
  budget_id: string;
  /** Optional version for optimistic concurrency. */
  version?: string;
}

/**
 * Reference to evidence artifacts supporting an accounting event.
 */
export interface EvidenceReference {
  /** Artifact identifier. */
  artifact_id: string;
  /** Role of this evidence. */
  role?: "source" | "proof" | "receipt" | "contract" | "confirmation" | "other";
  /** When this evidence was created or observed. */
  timestamp?: string;
}

// ----------------------------------------------------------------------
// 2. Budget Events
// ----------------------------------------------------------------------

/**
 * Budget event types for grant, amend, and revoke.
 */
export type BudgetAction = "grant" | "amend" | "revoke" | "expire";

/**
 * Scope of budget authorization.
 */
export interface BudgetScope {
  /** Community scope. */
  community?: string;
  /** Jurisdiction scope. */
  jurisdiction?: string;
  /** Permitted recipient accounts. */
  allowed_recipients?: AccountIdentifier[];
  /** Forbidden recipient accounts. */
  forbidden_recipients?: AccountIdentifier[];
  /** Time validity bounds. */
  time_bounds?: {
    valid_from?: string;
    valid_until?: string;
  };
  /** Allowed spending categories. */
  category_restrictions?: string[];
  /** Additional scope properties. */
  [key: string]: unknown;
}

/**
 * Budget event payload.
 *
 * Budgets authorize spending limits within scopes.
 */
export interface BudgetEvent {
  /** Event type identifier. */
  eventType: "accounting/budget";
  /** Schema version. */
  schemaVersion: "1.0";
  /** Unique budget identifier. */
  budget_id: string;
  /** Action being performed. */
  action: BudgetAction;
  /** Type of resource. */
  resource_type: ResourceType;
  /** Accounting domain. */
  accounting_domain: AccountingDomain;
  /** Budget amount. */
  quantity: ExactQuantity;
  /** Optional source account. */
  source_account?: AccountIdentifier;
  /** Purpose for this budget. */
  purpose?: string;
  /** Authorization scope. */
  scope?: BudgetScope;
  /** Governance context. */
  governance: GovernanceContext;
  /** Disclosure class. */
  disclosure_class?: DisclosureClass;
  /** Idempotency key. */
  idempotency_key: string;
  /** When this action takes effect. */
  effective_at?: string;
  /** For amendments, prior budget reference. */
  prior_budget_id?: string;
  /** Supporting evidence. */
  evidence_references?: EvidenceReference[];
  /** Additional metadata. */
  metadata?: Record<string, unknown>;
}

// ----------------------------------------------------------------------
// 3. Reservation Events
// ----------------------------------------------------------------------

/**
 * Reservation event types.
 */
export type ReservationAction = "reserve" | "release" | "commit" | "expire";

/**
 * Reservation lifetime controls.
 */
export interface ReservationTTL {
  /** When the reservation automatically expires. */
  expires_at?: string;
  /** Maximum extension duration (ISO-8601). */
  max_extension?: string;
}

/**
 * Reservation event payload.
 *
 * Reservations prevent concurrent double-spending.
 */
export interface ReservationEvent {
  /** Event type identifier. */
  eventType: "accounting/reservation";
  /** Schema version. */
  schemaVersion: "1.0";
  /** Unique reservation identifier. */
  reservation_id: string;
  /** Action being performed. */
  action: ReservationAction;
  /** Type of resource. */
  resource_type: ResourceType;
  /** Accounting domain. */
  accounting_domain: AccountingDomain;
  /** Quantity being reserved. */
  quantity: ExactQuantity;
  /** Optional non-refundable option premium / holding fee. */
  holding_fee?: ExactQuantity;
  /** Budget being reserved against. */
  budget_reference: BudgetReference;
  /** Account to receive reserved amount. */
  reserved_for_account?: AccountIdentifier;
  /** Purpose for reservation. */
  purpose?: string;
  /** Lifetime controls. */
  time_to_live?: ReservationTTL;
  /** Governance context. */
  governance: GovernanceContext;
  /** Disclosure class. */
  disclosure_class?: DisclosureClass;
  /** Idempotency key. */
  idempotency_key: string;
  /** For commits, related transaction. */
  related_transaction_id?: string;
  /** Additional metadata. */
  metadata?: Record<string, unknown>;
}

// ----------------------------------------------------------------------
// 4. Transaction Events
// ----------------------------------------------------------------------

/**
 * Transaction types.
 */
export type TransactionType = "commitment" | "settlement" | "direct";

/**
 * Settlement reference for fulfillment transactions.
 */
export interface SettlementReference {
  /** Original commitment transaction ID. */
  commitment_transaction_id: string;
  /** Amount being settled if different. */
  fulfillment_amount?: ExactQuantity;
}

/**
 * Authorized conversion rate for cross-unit transactions.
 */
export interface ConversionRate {
  /** Source unit. */
  from_unit: string;
  /** Target unit. */
  to_unit: string;
  /** Rate as exact fraction. */
  rate: {
    numerator: string;
    denominator: string;
  };
  /** Authority authorizing conversion. */
  authorized_by: string;
}

/**
 * Transaction event payload.
 *
 * All postings must balance exactly within (resourceType, unit, accountingDomain).
 */
export interface TransactionEvent {
  /** Event type identifier. */
  eventType: "accounting/transaction";
  /** Schema version. */
  schemaVersion: "1.0";
  /** Unique transaction identifier. */
  transaction_id: string;
  /** Type of transaction. */
  transaction_type?: TransactionType;
  /** Type of resource. */
  resource_type: ResourceType;
  /** Accounting domain. */
  accounting_domain: AccountingDomain;
  /** Balancing postings (min 2). */
  postings: Posting[];
  /** Unit for this transaction. */
  unit?: string;
  /** Purpose or description. */
  purpose?: string;
  /** Transaction category. */
  category?: string;
  /** For settlements, reference to commitment. */
  settlement_reference?: SettlementReference;
  /** Reservations being consumed. */
  consumes_reservations?: string[];
  /** Governance context. */
  governance: GovernanceContext;
  /** Disclosure class. */
  disclosure_class?: DisclosureClass;
  /** Idempotency key. */
  idempotency_key: string;
  /** When transaction takes effect. */
  effective_at?: string;
  /** Supporting evidence. */
  evidence_references?: EvidenceReference[];
  /** Explicit conversion rate if cross-unit. */
  conversion_rate?: ConversionRate;
  /** Additional metadata. */
  metadata?: Record<string, unknown>;
}

// ----------------------------------------------------------------------
// 5. Reversal Events
// ----------------------------------------------------------------------

/**
 * Reversal types.
 */
export type ReversalType = "full" | "partial" | "compensating";

/**
 * Reversal event payload.
 *
 * Reversals preserve original trace while neutralizing accounting effect.
 */
export interface ReversalEvent {
  /** Event type identifier. */
  eventType: "accounting/reversal";
  /** Schema version. */
  schemaVersion: "1.0";
  /** Unique reversal identifier. */
  reversal_id: string;
  /** Transaction being reversed. */
  original_transaction_id: string;
  /** Type of reversal. */
  reversal_type: ReversalType;
  /** For partial reversals, amount being reversed. */
  partial_amount?: ExactQuantity;
  /** Reason for reversal. */
  reason: string;
  /** For compensating reversals, new postings. */
  compensating_postings?: Posting[];
  /** Governance context. */
  governance: GovernanceContext;
  /** Disclosure class. */
  disclosure_class?: DisclosureClass;
  /** Idempotency key. */
  idempotency_key: string;
  /** Authority authorizing reversal. */
  authorized_by?: string;
  /** Supporting evidence. */
  evidence_references?: EvidenceReference[];
  /** When reversal takes effect. */
  effective_at?: string;
  /** Additional metadata. */
  metadata?: Record<string, unknown>;
}

// ----------------------------------------------------------------------
// 6. Account Lifecycle Events
// ----------------------------------------------------------------------

/**
 * Account lifecycle actions.
 */
export type AccountAction = "create" | "modify" | "suspend" | "close";

/**
 * Account types per standard accounting categories.
 */
export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense" | "off-balance";

/**
 * Account lifecycle event payload.
 *
 * Accounts are projections, but their creation needs explicit authorization.
 */
export interface AccountEvent {
  /** Event type identifier. */
  eventType: "accounting/account";
  /** Schema version. */
  schemaVersion: "1.0";
  /** Canonical account identifier. */
  account_id: AccountIdentifier;
  /** Lifecycle action. */
  action: AccountAction;
  /** Account type. */
  account_type?: AccountType;
  /** Type of resource. */
  resource_type?: ResourceType;
  /** Accounting domain. */
  accounting_domain?: AccountingDomain;
  /** Default unit. */
  unit?: string;
  /** Account owner. */
  owner_subject_id?: string;
  /** Whether authorized as source/sink. */
  authorized_source_sink?: boolean;
  /** Human-readable name. */
  display_name?: string;
  /** Purpose description. */
  description?: string;
  /** Parent account for hierarchy. */
  parent_account_id?: AccountIdentifier;
  /** Governance context. */
  governance: GovernanceContext;
  /** Disclosure class. */
  disclosure_class?: DisclosureClass;
  /** Idempotency key. */
  idempotency_key: string;
  /** Supporting evidence. */
  evidence_references?: EvidenceReference[];
  /** When action takes effect. */
  effective_at?: string;
  /** Additional metadata. */
  metadata?: Record<string, unknown>;
}

// ----------------------------------------------------------------------
// 6b. Reconciliation Events (Provisional -> Actual Truth)
// ----------------------------------------------------------------------

/**
 * Reconciliation event payload.
 *
 * Reconciles provisional usage/cost with external provider-confirmed truth.
 * Historical provisional events are NEVER rewritten; difference is recorded
 * via this explicit compensating reconciliation event.
 */
export interface ReconciliationEvent {
  /** Event type identifier. */
  eventType: "accounting/reconciliation";
  /** Schema version. */
  schemaVersion: "1.0";
  /** Unique identifier for the reconciliation. */
  reconciliation_id: string;
  /** Identifier of the provisional spending or event being reconciled. */
  provisional_spending_id: string;
  /** Related Cognitive Packet ID if applicable. */
  packet_id?: string;
  /** Provider name (e.g. 'openai', 'groq'). */
  provider: string;
  /** Model or capability. */
  model?: string;
  /** External billing period or cycle. */
  billing_period?: string;
  /** Initial provisional cost. */
  provisional_cost: ExactQuantity;
  /** Final provider-confirmed actual cost. */
  actual_cost: ExactQuantity;
  /** Signed difference: actual_cost - provisional_cost. */
  adjustment: ExactQuantity;
  /** Explanatory reason for adjustment. */
  reason: string;
  /** Supporting external invoice/report evidence. */
  evidence_references?: EvidenceReference[];
  /** Governance context for accountability. */
  governance: GovernanceContext;
  /** Disclosure class. */
  disclosure_class?: DisclosureClass;
  /** Idempotency key. */
  idempotency_key: string;
  /** When reconciliation was determined or confirmed. */
  effective_at?: string;
  /** Additional metadata. */
  metadata?: Record<string, unknown>;
}

// ----------------------------------------------------------------------
// 7. Union Type for All Accounting Events
// ----------------------------------------------------------------------

/**
 * Discriminated union of all accounting event types.
 */
export type AccountingEvent =
  | BudgetEvent
  | ReservationEvent
  | TransactionEvent
  | ReversalEvent
  | AccountEvent
  | ReconciliationEvent;

/**
 * Type guard for budget events.
 */
export function isBudgetEvent(event: AccountingEvent): event is BudgetEvent {
  return event.eventType === "accounting/budget";
}

/**
 * Type guard for reservation events.
 */
export function isReservationEvent(event: AccountingEvent): event is ReservationEvent {
  return event.eventType === "accounting/reservation";
}

/**
 * Type guard for transaction events.
 */
export function isTransactionEvent(event: AccountingEvent): event is TransactionEvent {
  return event.eventType === "accounting/transaction";
}

/**
 * Type guard for reversal events.
 */
export function isReversalEvent(event: AccountingEvent): event is ReversalEvent {
  return event.eventType === "accounting/reversal";
}

/**
 * Type guard for account events.
 */
export function isAccountEvent(event: AccountingEvent): event is AccountEvent {
  return event.eventType === "accounting/account";
}

/**
 * Type guard for reconciliation events.
 */
export function isReconciliationEvent(event: AccountingEvent): event is ReconciliationEvent {
  return event.eventType === "accounting/reconciliation";
}

// ----------------------------------------------------------------------
// 8. Projection Types (Derived State)
// ----------------------------------------------------------------------

/**
 * Account balance as a projection from events.
 */
export interface AccountBalance {
  /** Account identifier. */
  account_id: AccountIdentifier;
  /** Current balance. */
  balance: ExactQuantity;
  /** Available amount (minus reservations). */
  available: ExactQuantity;
  /** Reserved amount. */
  reserved: ExactQuantity;
  /** Accounting domain. */
  accounting_domain: AccountingDomain;
  /** Last event that affected this balance. */
  last_event_id?: string;
  /** When balance was last projected. */
  as_of: string;
}

/**
 * Budget status as a projection.
 */
export interface BudgetStatus {
  /** Budget identifier. */
  budget_id: string;
  /** Original granted amount. */
  granted: ExactQuantity;
  /** Currently available amount. */
  available: ExactQuantity;
  /** Amount reserved. */
  reserved: ExactQuantity;
  /** Amount committed. */
  committed: ExactQuantity;
  /** Amount spent. */
  spent: ExactQuantity;
  /** Budget status. */
  status: "active" | "suspended" | "expired" | "revoked" | "exhausted";
  /** Validity period. */
  valid_from?: string;
  valid_until?: string;
  /** When status was last projected. */
  as_of: string;
}

/**
 * Reservation status as a projection.
 */
export interface ReservationStatus {
  /** Reservation identifier. */
  reservation_id: string;
  /** Budget being reserved against. */
  budget_reference: BudgetReference;
  /** Reserved quantity. */
  quantity: ExactQuantity;
  /** Reservation state. */
  status: "active" | "released" | "committed" | "expired";
  /** Account that will receive. */
  reserved_for_account?: AccountIdentifier;
  /** Expiration time. */
  expires_at?: string;
  /** Related transaction if committed. */
  related_transaction_id?: string;
  /** When status was last projected. */
  as_of: string;
}

/**
 * Public Kudos projection (no private details).
 */
export interface PublicKudosProjection {
  /** Transaction identifier (public). */
  transaction_id: string;
  /** Resource type (always "kudos" in public projection). */
  resource_type: "kudos";
  /** Accounting domain (public domain only). */
  accounting_domain: "kudos.public";
  /** Amount (public). */
  amount: ExactQuantity;
  /** From account (public identity only). */
  from_account?: string;
  /** To account (public identity only). */
  to_account?: string;
  /** Transaction category (if public). */
  category?: string;
  /** Timestamp. */
  timestamp: string;
  /** Public purpose (optional, redacted if private). */
  purpose?: string;
}
