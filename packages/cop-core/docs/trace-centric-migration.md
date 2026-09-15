---
title: Trace-Centric Architecture Migration Guide & Specification
author: Jean Hugues Noël Robert, baron Mariani
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
date: '2026-09-15'
last_modified_at: '2026-09-15'
version: '0.1'
status: working-paper
license: CC BY-SA 4.0
language: en
document_role: archive
document_kind: software-doc
update_policy: UP-DEFAULT-REVIEWED
provenance:
  origin_type: repository
  origin_repository: unknown
  origin_ref: unknown
  origin_date: '2026-09-15'
  derived_from: []
review:
  status: unreviewed
  reviewed_by: []
---

# Trace-Centric Architecture Migration Guide & Specification

> **Parent Architecture Epic:**
> [Inseme Issue #61](https://github.com/JeanHuguesRobert/inseme/issues/61)  
> **Substrate Implementation:**
> [Inseme Issue #63](https://github.com/JeanHuguesRobert/inseme/issues/63)  
> **Package:** `@inseme/cop-core` / `@inseme/cop-kernel`  
> **Status:** Active / Normative

---

## 1. Architectural Motivation

COP 2.x deliberately transitions from an Event-Centric architecture to a **Trace-Centric
architecture**.

In the previous Event-Centric framing, occurrences inside COP were assumed to be the sole native
foundation of truth, forcing external reality or historical artifacts into synthetic COP events or
unanchored projections.

The Trace-Centric doctrine establishes that:

```text
Reality
  ↓
Trace
  ↓
Assertion / Interpretation
  ↓
Continuation / Projection
  ↓
Decision
  ↓
Act
  ↓
new Trace
```

### Core Invariants

- **Trace is more general than Event:** An Event is a native procedural Trace of COP-mediated
  activity. External Traces may pre-exist COP.
- **No byte duplication:** Every persisted COP Event or Artifact is directly addressable through a
  valid `TraceRef` without duplicating its payload into a separate trace ledger.
- **External provenance preservation:** When an external trace enters COP governance, its
  observation leaves a COP Event (`TraceObservation`), but the event explicitly identifies the
  external trace as its `origin_ref` and specifies `cop_originated: false`. COP witnesses external
  reality; it does not claim to have authored it.
- **Epistemic separation:** A Trace is not an Assertion. Traces are evidential primitives;
  Assertions are propositions held by the Corpus with explicit epistemic status (`observed`,
  `computed`, `declared`, `inferred`, `normative`, `proposed`, `decided`, `published`,
  `hypothesized`, `disputed`).
- **Non-destructive contradiction:** Conflicting evidence coexists natively. Trace $A$ may support
  Assertion $X$, while Trace $B$ contradicts Assertion $X$. Neither overwrites the other.

---

## 2. Core Primitives

The substrate in `@inseme/cop-core` implements four executable primitives backed by JSON schemas in
`schemas/`:

### 2.1 `TraceRef` (`cop.trace-ref/v1`)

Identifies and addresses a Trace without requiring COP to own or duplicate its bytes.

```typescript
export interface TraceRef {
  schema: "cop.trace-ref/v1";
  trace_id: string; // e.g. "cop:event:<id>", "cop:artifact:<hash>", or "ext:<uri>"
  target_type: "cop_event" | "cop_artifact" | "external";
  integrity?: string | null; // e.g. "sha256:<64 hex chars>"
  locator?: string | null; // e.g. URL, topic, or file path
  resolution_hints?: Record<string, unknown> | null;
}
```

### 2.2 `TraceDescriptor` (`cop.trace-descriptor/v1`)

Metadata sufficient to reason about a Trace without materializing its payload. It deliberately
excludes interpretive claims or assertion truth.

```typescript
export interface TraceDescriptor {
  schema: "cop.trace-descriptor/v1";
  trace_ref: TraceRef;
  kind: string; // e.g. "procedural_event", "git_commit", "sensor_log", "external_metering"
  origin: string; // e.g. "cop:runtime", "repo:github.com/...", "provider:openai"
  observed_at: string; // ISO date-time
  occurred_at?: string | null; // Temporal claim of occurrence
  created_at?: string | null;
  integrity?: string | null;
  visibility: "open" | "redacted" | "restricted" | "sealed" | "opaque_but_escrowed";
  custody?: string | null; // Custodian holding raw bytes
  meta?: Record<string, unknown>;
}
```

### 2.3 `Assertion` (`cop.assertion/v1`)

A proposition known, held, or considered by the Corpus. Has a stable identity (`assertion_id`)
across revisions.

```typescript
export interface Assertion {
  schema: "cop.assertion/v1";
  assertion_id: string; // Stable canonical ID (e.g. "ast:<uuid>")
  revision: number; // Integer >= 1
  claim: unknown; // The propositional content
  epistemic_status: EpistemicStatus;
  subject_ref?: string | null;
  asserted_by: string; // Attributable agent/principal
  asserted_at: string; // ISO timestamp
  supersedes_id?: string | null; // e.g. "ast:<id>@r1"
  meta?: Record<string, unknown>;
}
```

### 2.4 `EvidenceRelation` (`cop.evidence-relation/v1`)

A typed epistemic link connecting a `TraceRef` to an `Assertion`.

```typescript
export interface EvidenceRelation {
  schema: "cop.evidence-relation/v1";
  relation_id: string; // e.g. "evr:<uuid>"
  relation_type: "supports" | "contradicts" | "contextualizes";
  trace_ref: TraceRef;
  assertion_id: string;
  strength?: "conclusive" | "strong" | "plausible" | "weak" | number | null;
  justification?: unknown;
  asserted_by: string;
  recorded_at: string;
  meta?: Record<string, unknown>;
}
```

---

## 3. Operational Integration Patterns

### 3.1 Addressing Existing COP Events as Traces

```javascript
import { traceRefFromCopEvent, traceDescriptorFromCopEvent } from "@inseme/cop-core";

const traceRef = traceRefFromCopEvent(copEvent);
// -> { schema: "cop.trace-ref/v1", trace_id: "cop:event:<eventId>", target_type: "cop_event", integrity: "sha256:..." }

const descriptor = traceDescriptorFromCopEvent(copEvent);
// -> provides kind, origin, observed_at, custody without copying copEvent.payload
```

### 3.2 Ingesting External Traces

```javascript
import {
  createExternalTraceRef,
  createTraceDescriptor,
  createTraceObservationEvent,
} from "@inseme/cop-core";

const externalRef = createExternalTraceRef({
  trace_id: "git:commit:5dd1dc89b8830176d6345862d2a4505fcfecb2a4",
  locator:
    "https://github.com/JeanHuguesRobert/barons-Mariani/commit/5dd1dc89b8830176d6345862d2a4505fcfecb2a4",
  integrity: "sha256:5dd1dc89b8830176d6345862d2a4505fcfecb2a4...",
});

const descriptor = createTraceDescriptor({
  trace_ref: externalRef,
  kind: "git_commit",
  origin: "https://github.com/JeanHuguesRobert/barons-Mariani",
  observed_at: new Date().toISOString(),
  custody: "github.com",
});

const obsEvent = createTraceObservationEvent({
  trace_ref: externalRef,
  trace_descriptor: descriptor,
  observer_ref: "agent:jhn",
  topic_id: "topic:external-audit",
  mandate_ref: "mandate:mnd-jhn-2026@v1",
});
// Appended to COP event store: preserves external origin, cop_originated: false.
```

### 3.3 Linking Contradictory Evidence

```javascript
import { EvidenceGraph, createEvidenceRelation } from "@inseme/cop-core";

const graph = new EvidenceGraph();

// Trace A indicates rain; Trace B indicates no rain
graph.addRelation(
  createEvidenceRelation({
    relation_type: "supports",
    trace_ref: traceA,
    assertion_id: "ast:rain-claim",
    strength: "plausible",
    justification: "Radar reflection",
    asserted_by: "agent:satellite",
  })
);

graph.addRelation(
  createEvidenceRelation({
    relation_type: "contradicts",
    trace_ref: traceB,
    assertion_id: "ast:rain-claim",
    strength: "strong",
    justification: "Ground gauge dry",
    asserted_by: "agent:ground-station",
  })
);

const result = graph.getRelationsForAssertion("ast:rain-claim");
// result.supports has 1 relation; result.contradicts has 1 relation.
// Neither is mutated or overwritten!
```

### 3.4 Consolidation Provenance Preservation

```javascript
import { extractConsolidationTraceRefs } from "@inseme/cop-core";

// When local trace consolidation occurs via local-trace-consolidation.js,
// extractConsolidationTraceRefs extracts the TraceRef objects for long-term Corpus linking
const traceRefs = extractConsolidationTraceRefs(consolidationReceipt);
// -> [ TraceRef(consolidation_receipt), TraceRef(artifact_refs)... ]
```

---

## 4. Workstream Consumption Matrix

| Workstream Issue                  | How it uses this substrate                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **#64 (Reactive Corpus)**         | Uses `TraceRef` & `EvidenceRelation` to compute projection invalidations and rebuild views on trace arrival.                                |
| **#65 (Contradiction Review)**    | Uses `EvidenceGraph` and `Assertion` revisions to formulate conformance and adversarial attacks.                                            |
| **#66 (Security Regression)**     | Enforces that reachable traces are not automatically admissible or authorized assertions.                                                   |
| **#68 (Consequential Rossignol)** | Links external provider billing traces (`external` TraceRef) to mandate accounting and settlement without allowing ungrounded ledger reset. |
