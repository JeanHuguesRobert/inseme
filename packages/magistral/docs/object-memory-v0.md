---
title: Magistral Object Memory v0 — byte custody
date: 2026-11-16
status: experimental
document_role: architecture-decision
language: en
---

# Magistral Object Memory v0

Magistral supplies capabilities, not a cognitive agent. Object Memory v0 is
provider-neutral BYTE CUSTODY. It neither indexes memories semantically nor
decides what to remember, forget or produce. Cognitive Packet goals, mandates,
continuations, provenance and retention judgements remain with Cogentia/COP.

Object identity is the existing COP convention sha256:<64 lowercase hex>.
It is independent of provider location; existing content_ref/TraceRef can carry
the digest without changing packet schemas. OpenAI-compatible inference and
S3-compatible storage are optional facades, not canonical internal protocols.
There is NO S3 server in v0.

## API

Package subpath @inseme/magistral/object-memory exports:
- hashObject(bytes), assertObjectRef(ref)
- createObjectMemory({providers}), exposing:
  - putObject(bytes, {min_replicas:1, max_cost:0})
  - getObject(ref, {max_cost:0})
  - providers() for non-secret provider declarations.

Package subpath @inseme/magistral/object-file-provider exports:
- createFileObjectProvider({id, directory, maxObjectBytes}).

The filesystem provider requires an explicit ABSOLUTE store directory and
defaults to a per-object maximum of 64 MiB. Objects are immutable. Writes
use a temporary file and exclusive hard link; duplicates are idempotent.
Existing files are not overwritten. An explicit delete operation does not exist.

Each successful put returns a magistral.object-custody/v0 receipt with
SHA-256 digest, exact size, required copies, and names of the providers whose
read-back SHA-256 has passed. A partial put FAILURE reports which copies
succeeded, but never falsely claims the minimum is satisfied.
An impossible minimum is rejected BEFORE writing.

The get operation verifies the digest of returned bytes and falls back to
another eligible provider if a copy is missing or corrupt. It never returns
unverified bytes. It does not automatically repair a corrupt copy.

The maximum monetary budget must be ZERO in v0. Providers declaring
billing=metered or billing=unknown are NEVER called. billing=none means only
there is no per-request money charge by the provider, NOT that electricity,
local disk capacity, bandwidth or administration have zero cost. COP authority
and spending admission remain outside this low-level technical module.

Two store directories on one physical disk are NOT two independent fault
domains. v0 counts verified copies, not guaranteed geo-redundancy.

## Practical use (from the monorepo root)

Put an existing document into one local store:

    node packages/magistral/bin/magistral-objects.js put ./document.pdf --store /absolute/objects

Store two verified copies in distinct local directories:

    node packages/magistral/bin/magistral-objects.js put ./document.pdf --store /absolute/a --store /absolute/b

Recover to a new destination without overwriting an existing file:

    node packages/magistral/bin/magistral-objects.js get sha256:<digest> ./recovered.pdf --store /absolute/a --store /absolute/b

The CLI runs only when requested, opens no port, accesses no network service,
requires no external account, and does not rewrite Git or remove originals.

## Deferred deliberately

- Native S3 GET/PUT/HEAD/LIST, remote storage adapters, Google Drive and Dropbox.
- Total-directory budget, reserved free disk, streaming, content encryption,
  geographic failure-domain assertions, persistent health and object locking.
- Materialization from recipes, CPS scheduling or semantic memory.
- Git history cleanup: storing a file elsewhere does not expunge old Git blobs.

Next reasonable increments are existing COP content_ref integration, a
strictly zero-billing configured remote provider, and a materialization
interface, only when a concrete use case requires them. Unsupported S3
operations must NEVER be advertised as compatible.

All CLI writes must remain within a legitimate mandate and capacity budget.
