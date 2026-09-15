---
title: COP Persistence Service
subtitle: Backend-independent persistence API for Events, Artifacts, descriptors, projections and memory views
author: Jean Hugues Noël Robert
affiliation: Institut Mariani / C.O.R.S.I.C.A.
license: CC BY-SA 4.0
status: seed specification
corpus_role: source
language: en
date: '2026-09-15'
update_policy: UP-DEFAULT-REVIEWED
review:
  status: unreviewed
  reviewed_by: []
provenance:
  origin_type: unknown
  origin_repository: unknown
  origin_ref: unknown
  origin_date: unknown
  derived_from: []
---


# COP Persistence Service

## 0. Purpose

`COP/Persistence` specifies the service layer that makes COP traces durable, retrievable, verifiable, exportable and usable by bounded agents.

It is not a database specification.

It is a backend-independent protocol/API contract for:

```text
Events
Artifacts
ContentDescriptors
Projections
Indexes
Caches
NamedResources
TemporalViews
MemoryViews
Policies
Backend adapters
Export/import manifests
```

The guiding rule is:

```text
The backend is circumstantial.
The persistence API is the contract.
The COP model preserves the invariants.
```

## 1. Core principles

### 1.1 Durable truth

COP uses Events as the durable source of truth.

```text
Event log -> replay -> projections -> bounded agent views
```

Events MUST be append-only and immutable after durable append.

All derived state MUST remain explainable by replaying Events and reading immutable Artifacts.

### 1.2 Immutable content

Artifacts represent immutable durable contents.

A correction MUST create a new Artifact or a new Event. It MUST NOT silently mutate the original durable content.

### 1.3 Backend independence

No backend-specific location MAY become a COP identity.

The following are NOT stable COP identities:

```text
SQLite rowid
Supabase row id
Supabase bucket path
S3 URL
filesystem path
Syncthing path
Git path alone
HTTP URL alone
```

The following MAY serve as COP identities or content identities, depending on context:

```text
eventId
artifactId
resourceId
contentName
ni:
sha256:
CID
URN
IRI
descriptor id
```

Backend paths, URLs, buckets, providers and local filenames are retrieval hints, not identities.

### 1.4 Separation of layers

```text
Model      = invariants
Protocol   = promises between nodes
API        = operational contract
Adapter    = compromise with a backend
Backend    = replaceable circumstance
```

An implementation MAY use SQLite, Postgres, Supabase, S3-compatible object storage, filesystem, Git, IPFS, Tahoe-LAFS, Syncthing, MinIO, Filecoin, Sia, Storj or future Fractanet storage nodes.

It MUST NOT expose these backend choices as core COP categories.

## 2. Non-goals

`COP/Persistence` does not require:

```text
a single database engine
a single cloud provider
a single object storage provider
a blockchain or ledger
strong legal admissibility by itself
universal peer-to-peer replication in the MVP
vector search in the MVP
full CRDT semantics in the MVP
```

Legal, evidentiary or archival guarantees depend on deployment practices, retention policies, signatures, ledgers, WORM storage and jurisdiction-specific procedures.

## 3. Required service ports

A conformant persistence implementation SHOULD expose the following ports.

```text
EventStore
ArtifactStore
DescriptorStore
ProjectionStore
IndexStore
CacheStore
TemporalResolver
MemoryViewService
ExportImportService
CapabilityService
```

Minimal implementations MAY start with only:

```text
EventStore
ArtifactStore
DescriptorStore
ProjectionStore
ExportImportService
CapabilityService
```

## 4. EventStore

### 4.1 Purpose

`EventStore` durably appends and retrieves COP Events.

It is the primary persistence port.

### 4.2 Interface sketch

```ts
interface COPEventStore {
  appendEvent(input: AppendEventInput): Promise<AppendEventResult>;

  getEvent(eventId: string): Promise<COPEvent | null>;

  listEventsByTopic(input: {
    topicId: string;
    fromSeq?: number;
    toSeq?: number;
    limit?: number;
  }): Promise<COPEvent[]>;

  listEventsByTime(input: {
    from?: string;
    to?: string;
    type?: string;
    limit?: number;
  }): Promise<COPEvent[]>;

  getTopicHead(topicId: string): Promise<TopicHead>;
}
```

### 4.3 Invariants

```text
appendEvent MUST be atomic.
topicSeq MUST be assigned at durable append time.
(topicId, topicSeq) MUST be unique.
A durable Event MUST NOT be modified.
An idempotent append with the same eventId and same canonical content SHOULD return the original result.
An append with the same eventId but different canonical content MUST fail.
Every durable Event SHOULD be canonicalizable.
Every durable Event SHOULD have a stable hash.
```

### 4.4 Append result

```ts
interface AppendEventResult {
  eventId: string;
  topicId: string;
  topicSeq: number;
  createdAt: string;
  canonicalHash?: string;
  status: "appended" | "already_appended";
}
```

## 5. ArtifactStore

### 5.1 Purpose

`ArtifactStore` stores immutable durable contents produced or consumed by COP.

Artifacts may be small JSON objects, text documents, tool results, continuations, images, binary blobs, snapshots or external-resource descriptors.

### 5.2 Interface sketch

```ts
interface COPArtifactStore {
  putArtifact(input: PutArtifactInput): Promise<PutArtifactResult>;

  getArtifact(artifactId: string): Promise<COPArtifact | null>;

  getArtifactByContentName(contentName: string): Promise<COPArtifact | null>;

  describeArtifact(artifactId: string): Promise<ContentDescriptor | null>;

  listArtifactsByTopic(input: {
    topicId: string;
    type?: string;
    limit?: number;
  }): Promise<COPArtifact[]>;
}
```

### 5.3 Invariants

```text
Artifact payloads MUST be immutable after durable storage.
A correction MUST create a new Artifact or Event.
An Artifact MAY have both a logical artifactId and a contentName.
Content-critical Artifacts SHOULD have a ContentDescriptor.
Large payloads MAY be stored in object stores while COP stores descriptors and fetch hints.
```

## 6. DescriptorStore

### 6.1 Purpose

`DescriptorStore` manages content descriptors.

A `ContentDescriptor` describes a content object independently from any backend location.

```text
contentName = what exact thing?
fetchHints  = where can it currently be fetched?
metadata    = how should it be interpreted?
verification = how can it be checked?
```

### 6.2 Interface sketch

```ts
interface COPDescriptorStore {
  putDescriptor(descriptor: ContentDescriptor): Promise<void>;

  getDescriptor(contentName: string): Promise<ContentDescriptor | null>;

  verifyContent(input: {
    contentName: string;
    bytes?: Uint8Array;
    artifactId?: string;
  }): Promise<VerificationResult>;

  listFetchHints(contentName: string): Promise<FetchHint[]>;
}
```

### 6.3 ContentDescriptor sketch

```ts
interface ContentDescriptor {
  artifactType: "cop/content-descriptor";
  contentName: string;          // ni:///sha-256;..., sha256:..., cid:...
  digest?: {
    algorithm: "sha-256" | string;
    value: string;
  };
  mediaType?: string;
  size?: number;
  canonicalization?: {
    profile: "raw-bytes" | "jcs-json" | string;
  };
  fetchHints?: FetchHint[];
  createdAt: string;
  verifiedAt?: string;
  metadata?: Record<string, JsonValue>;
}
```

### 6.4 FetchHint sketch

```ts
interface FetchHint {
  kind: "s3" | "file" | "http" | "git" | "ipfs" | "tahoe" | "syncthing" | "custom";
  priority?: number;
  provider?: string;
  bucket?: string;
  key?: string;
  url?: string;
  path?: string;
  repo?: string;
  ref?: string;
  cid?: string;
  metadata?: Record<string, JsonValue>;
}
```

### 6.5 Invariants

```text
Fetch hints MUST NOT be treated as content identities.
A broken fetch hint MUST NOT invalidate the content identity.
A descriptor MAY be superseded by a newer descriptor.
Descriptor updates MUST NOT mutate the described content.
```

## 7. ProjectionStore

### 7.1 Purpose

`ProjectionStore` stores rebuildable derived state.

Examples:

```text
Topic state
Task state
Step state
latest known view
materialized temporal view
index summary
agent dashboard state
```

### 7.2 Interface sketch

```ts
interface COPProjectionStore {
  getProjection<T>(key: ProjectionKey): Promise<T | null>;

  putProjection<T>(input: {
    key: ProjectionKey;
    value: T;
    sourceEventSeq?: number;
    sourceEventId?: string;
    sourceArtifactIds?: string[];
    rebuildable: true;
    stale?: boolean;
  }): Promise<void>;

  invalidateProjection(key: ProjectionKey): Promise<void>;

  rebuildProjection(key: ProjectionKey): Promise<ProjectionRebuildResult>;
}
```

### 7.3 Invariants

```text
A Projection MUST NOT be a source of truth.
A Projection SHOULD declare the Event head or source set it was derived from.
A Projection MAY be destroyed and rebuilt.
A stale Projection MUST be marked stale or invalidated.
```

## 8. IndexStore and CacheStore

### 8.1 Purpose

Indexes and caches make memory usable under bounded cost.

They are optimization layers, not truth layers.

### 8.2 Interface sketch

```ts
interface COPIndexStore {
  indexTrace(input: IndexTraceInput): Promise<void>;
  search(input: SearchInput): Promise<SearchResult[]>;
  dropIndex(indexName: string): Promise<void>;
  rebuildIndex(indexName: string): Promise<void>;
}

interface COPCacheStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, policy: CachePolicy): Promise<void>;
  invalidate(key: string): Promise<void>;
}
```

### 8.3 Invariants

```text
Indexes improve access.
Caches accelerate access.
Neither may be treated as authoritative COP truth.
Caches MAY be evicted without semantic loss.
Indexes SHOULD be rebuildable from Events, Artifacts and Descriptors.
```

## 9. TemporalResolver

### 9.1 Purpose

`TemporalResolver` answers temporal questions about evolving named resources.

Examples:

```text
official gazette
law code
public registry
sensor stream
Git repository
corpus
living document
material object condition history
```

### 9.2 Interface sketch

```ts
interface COPTemporalResolver {
  latestKnown(resourceId: string): Promise<TemporalView>;

  stateAt(input: {
    resourceId: string;
    at: string;
    timeAxis: "valid_time" | "transaction_time" | "decision_time";
  }): Promise<TemporalView>;

  changesBetween(input: {
    resourceId: string;
    from: string;
    to: string;
    timeAxis?: "valid_time" | "transaction_time" | "decision_time";
  }): Promise<ChangeEventDescriptor[]>;
}
```

### 9.3 Temporal model

```text
NamedResource      = stable identity for an evolving resource
ResourceState      = immutable observed state of that resource at a given time or range
ChangeEvent        = append-only event that changes or extends the resource
TemporalView       = query result such as latest known state or state at date T
MaterializedView   = cached projection of a TemporalView
```

### 9.4 Invariants

```text
The NamedResource may evolve.
ResourceStates and ChangeEvents SHOULD be immutable.
A TemporalView MUST state whether it is exact, reconstructed, partial, stale or best-effort.
Temporal queries SHOULD declare their time axis when ambiguity matters.
```

## 10. MemoryViewService

### 10.1 Purpose

`MemoryViewService` prepares bounded memory views for human or AI agents.

Agents SHOULD NOT consume the whole memory graph by default.

They SHOULD consume a bounded, task-relative, cost-aware, confidence-aware and privacy-aware `MemoryView`.

### 10.2 Interface sketch

```ts
interface COPMemoryViewService {
  requestMemoryView(input: MemoryViewRequest): Promise<MemoryView>;

  expandMemoryView(input: {
    viewId: string;
    depth?: number;
    includeProvenance?: boolean;
    includeAudit?: boolean;
  }): Promise<MemoryView>;

  rejectAsInsufficient(input: {
    viewId: string;
    reason: string;
    requiredSufficiency: SufficiencyLevel;
  }): Promise<void>;
}
```

### 10.3 Practical levels

```text
L0 pointer        = id, kind, title, temperature, confidence
L1 descriptor     = content address, media type, size, fetch hints
L2 summary        = task-specific summary and relevance reason
L3 context        = related events, artifacts, subjects, topics and temporal scope
L4 provenance     = generated-by, attributed-to, derived-from, verification state
L5 audit          = hashes, signatures, ledger records, challengeable evidence
L6 deep expansion = recursive metadata and linked traces, explicitly requested
```

Default agent access SHOULD usually be L0-L2 or L0-L3.

L4-L6 SHOULD be requested explicitly or triggered by risk, governance, legal, historical or probative use.

## 11. Policies

Persistence is governed by explicit policies.

### 11.1 RetentionPolicy

```ts
interface RetentionPolicy {
  policyId: string;
  class: "volatile" | "working" | "source" | "public_decision" | "probative" | "heritage";
  ttl?: string;
  preserveDescriptor: boolean;
  preserveContent: boolean;
  preserveAudit: boolean;
}
```

### 11.2 AccessPolicy

```ts
interface AccessPolicy {
  policyId: string;
  privacy: "public" | "restricted" | "private" | "sensitive";
  maxLevel: "L0" | "L1" | "L2" | "L3" | "L4" | "L5" | "L6";
  requireHumanReview?: boolean;
}
```

### 11.3 CostPolicy

```ts
interface CostPolicy {
  policyId: string;
  maxCost: "cheap" | "moderate" | "expensive" | "critical";
  maxLatencyMs?: number;
  maxDepth?: number;
  maxItems?: number;
}
```

## 12. Capability discovery

Every persistence implementation SHOULD expose its capabilities.

```ts
interface PersistenceCapabilities {
  adapterName: string;
  adapterVersion: string;
  appendOnlyEvents: boolean;
  atomicTopicSeq: boolean;
  contentAddressing: boolean;
  artifactImmutability: "none" | "logical" | "physical" | "worm";
  objectLock: boolean;
  offlineMode: boolean;
  exportImport: boolean;
  temporalQueries: "none" | "partial" | "full";
  memoryViews: "none" | "basic" | "advanced";
  peerReplication: boolean;
  encryptedAtRest: boolean;
  encryptedClientSide: boolean;
  probativeArchive: boolean;
  backendLockInRisk: "low" | "medium" | "high";
}
```

A backend MAY be imperfect.

It MUST NOT silently exaggerate its guarantees.

## 13. Export/import

### 13.1 Purpose

Export/import is mandatory for anti-lock-in, migration, disaster recovery and patrimonial preservation.

### 13.2 Export package

A COP export SHOULD contain:

```text
events.jsonl
artifacts-manifest.jsonl
descriptors.jsonl
resources.jsonl
projections-manifest.jsonl
policies.jsonl
checksums.txt
EXPORT_MANIFEST.json
```

### 13.3 Export invariant

```text
A COP node SHOULD be able to export its durable persistence graph without depending on backend-private metadata.
A COP node SHOULD be able to import that graph into a different backend.
```

### 13.4 Export manifest sketch

```json
{
  "artifactType": "cop/export-manifest",
  "exportId": "urn:cop:export:...",
  "createdAt": "2026-06-22T00:00:00Z",
  "sourceNode": "node:...",
  "formatVersion": "0.1",
  "contains": {
    "events": "events.jsonl",
    "artifacts": "artifacts-manifest.jsonl",
    "descriptors": "descriptors.jsonl",
    "resources": "resources.jsonl",
    "policies": "policies.jsonl"
  },
  "hashes": []
}
```

## 14. Backend adapter profiles

### 14.1 Local-first SQLite profile

Useful for:

```text
local EventStore
local ProjectionStore
local DescriptorStore
outbox/inbox sync state
cache
small indexes
```

Limits:

```text
not a distributed shared database
not a probative archive by itself
not sufficient for long-term multi-node resilience
```

### 14.2 Supabase/Postgres coordination profile

Useful for:

```text
cloud coordination
remote Event mirror
auth and API convenience
multi-device bootstrap
operational dashboard
```

Limits:

```text
vendor dependency if used as identity layer
not sufficient as sole archive
must remain an adapter, not the protocol
```

### 14.3 S3-compatible object storage profile

Useful for:

```text
large Artifacts
snapshots
binary blobs
exports
mirrors
cold storage
```

Limits:

```text
S3-compatible does not guarantee identical capabilities
versioning, object lock, lifecycle and checksums vary by provider
object URLs are fetch hints, not identities
```

### 14.4 Peer storage profile

Useful for:

```text
anti-lock-in
locality
resilience
community replication
heritage preservation
Fractanet-style storage mesh
```

Possible adapters:

```text
Syncthing for trusted-node replication
IPFS for content-addressed public/semi-public artifacts
Tahoe-LAFS-like grids for encrypted erasure-coded storage
Filecoin/Sia/Storj for external decentralized storage markets
future Fractanet storage nodes
```

Limits:

```text
availability is not automatic
key management is hard
NAT and intermittent peers are operational issues
legal responsibility must be considered
```

## 15. Persistence events

`COP/Persistence` MAY emit operational events.

These events describe the persistence layer itself. They do not replace domain events.

```text
persistence.event.appended
persistence.event.append_failed
persistence.artifact.stored
persistence.artifact.verified
persistence.descriptor.created
persistence.projection.materialized
persistence.projection.invalidated
persistence.index.updated
persistence.cache.evicted
persistence.temporal_view.materialized
persistence.memory_view.materialized
persistence.retention.applied
persistence.audit_record.created
```

## 16. Error model

```ts
type PersistenceErrorCode =
  | "EVENT_ALREADY_EXISTS"
  | "EVENT_CONTENT_CONFLICT"
  | "TOPIC_SEQUENCE_CONFLICT"
  | "ARTIFACT_ALREADY_EXISTS"
  | "ARTIFACT_CONTENT_CONFLICT"
  | "CONTENT_HASH_MISMATCH"
  | "DESCRIPTOR_NOT_FOUND"
  | "ARTIFACT_NOT_FOUND"
  | "EVENT_NOT_FOUND"
  | "PROJECTION_STALE"
  | "TEMPORAL_VIEW_PARTIAL"
  | "ACCESS_DENIED"
  | "COST_LIMIT_EXCEEDED"
  | "HUMAN_REVIEW_REQUIRED"
  | "BACKEND_UNAVAILABLE"
  | "CAPABILITY_NOT_SUPPORTED";
```

Errors SHOULD be structured, machine-readable and suitable for agent recovery.

## 17. Conformance levels

```text
COP/Persistence L0 — local durable store
COP/Persistence L1 — local store + export/import
COP/Persistence L2 — local-first cloud-assisted sync
COP/Persistence L3 — multi-backend mirrored persistence
COP/Persistence L4 — peer/distributed replication
COP/Persistence L5 — probative / WORM / audit-strong persistence
```

### 17.1 L0 requirements

```text
append immutable Events
store immutable Artifacts
retrieve by id
basic topic event listing
```

### 17.2 L1 requirements

```text
all L0 requirements
export durable graph
import durable graph
content descriptors for critical Artifacts
```

### 17.3 L2 requirements

```text
all L1 requirements
remote sync or mirror
idempotent append across sync
conflict detection
basic capability discovery
```

### 17.4 L3 requirements

```text
all L2 requirements
multiple storage backends
mirror verification
backend-independent fetch hints
recovery from one backend loss
```

### 17.5 L4 requirements

```text
all L3 requirements
peer replication
availability reports
repair reports
explicit replication policies
```

### 17.6 L5 requirements

```text
all L4 requirements where relevant
stronger audit records
optional signatures
WORM or equivalent retention
probative export package
human-verifiable recovery path
```

## 18. Minimal MVP recommendation

The first practical adapter bundle MAY be:

```text
cop-persistence-sqlite-supabase-s3
```

Roles:

```text
SQLite      = hot local memory, outbox, projections, descriptors, cache
Supabase    = operational cloud coordination and Postgres mirror
S3/buckets  = blob store for large Artifacts, snapshots and exports
```

This bundle should target:

```text
COP/Persistence L1 immediately
COP/Persistence L2 after sync hardening
partial L3 when mirrored buckets and export verification exist
```

It MUST remain an adapter bundle.

It MUST NOT define COP/Persistence itself.

## 19. Test cases

A conformant implementation SHOULD pass at least:

```text
append event once
append same event twice idempotently
append same eventId with different content and fail
list events by topic in topicSeq order
store artifact and retrieve unchanged payload
verify artifact hash
create descriptor with fetch hints
break one fetch hint without invalidating content identity
materialize projection and mark stale after later Event
rebuild projection from Events
export/import Events and Artifacts into another backend
answer latestKnown for a NamedResource
answer stateAt with explicit time axis or return partial
produce bounded MemoryView L0-L3
reject MemoryView as insufficient for legal/probative use
report capabilities truthfully
```

## 20. Core invariant

```text
COP/Persistence accepts imperfect implementations, but it MUST prevent their imperfections from becoming protocol categories.
```

More explicitly:

```text
Events are durable changes.
Artifacts are immutable contents.
Descriptors identify and verify content independently from backend locations.
Projections, indexes and caches are rebuildable maps.
TemporalViews answer situated time-based questions.
MemoryViews make memory usable by bounded agents.
Adapters compromise with reality.
The protocol preserves the model.
```
