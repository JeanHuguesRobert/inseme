---
title: Magistral Oracle Object Storage provider v0
date: 2026-11-16
status: experimental-guarded-activation
document_role: operational
language: en
---

# Oracle Object Storage as an optional Magistral Memory provider

This is NOT an S3 server and NOT a remote Cogentia agent. The adapter gives
Magistral access to immutable SHA-256 blobs in an existing OCI bucket, via
the official OCI Python SDK. Cogentia retains all cognitive decisions, mandates,
CPS and retention policy. Oracle is a replaceable backing provider.

## Verified installation and authentication (2026-11-16)

- Fracta2: Ubuntu 24.04, system Python 3.12.3 unchanged. A dedicated
  unprivileged OCI CLI 3.92.0 + SDK Python environment is installed at
  /home/ubuntu/.local/share/magistral/oci-cli-venv.
  The /home/ubuntu/.local/bin/oci entrypoint points to that environment.
- Fracta2 Instance Principal SDK: real read-only Object Storage namespace
  request succeeded without copying any API private key to the VPS.
- ThinkPad: original standalone OCI CLI was running Python 3.8.5 and
  issued a cryptography deprecation warning. A separate OCI CLI 3.92.0
  environment now uses Python 3.13.11 under the owner's home directory.
  The default CLI launcher was upgraded with the old binary retained as
  bin/oci-py38-backup-20261116.exe. Python's system/Conda installation
  was not modified. The new SDK authenticated a real read-only namespace request.
- The OCI CLI 'os ns get' command still times out on the ThinkPad even on
  Python 3.13.11; this is NOT claimed fixed by the Python upgrade.
  The SDK directly is verified and is the backend used by Magistral.
- The tenancy's home region was observed to be eu-marseille-1, and no
  existing Object Storage buckets were found in root or child compartments
  using the profile authorized for the owner's ThinkPad. A dedicated
  compartment, quota, private bucket, dynamic group and narrowly-scoped
  IAM policy have since been created, with no object upload at provisioning.
- Fracta2 Instance Principal can read its Object Storage namespace, but a
  root-compartment ListBuckets attempt failed with HTTP 404 (no proof of
  list access). Namespace access is NOT authority to create or write buckets.
  A dynamic group now grants this exact instance access only to CREATE and
  READ objects at the sha256/ prefix in the private Magistral bucket;
  overwrites, deletions, bucket administration and global listing are excluded.

## Explicit billing guard

A read-only Tenant Manager Subscription API query on 2026-11-16 returned
one active OCI subscription with payment_model=PAYG. **The account is billed
as Pay As You Go**, even though Oracle includes a no-charge Object Storage
allowance for some usage. This is NOT a free-only account and excess usage
may be billed. The empty, private Standard bucket named magistral-objects
was created in the dedicated MagistralMemory compartment on 2026-11-16.
No object was uploaded during the provisioning phase.

For this reason:
- createOciObjectProvider() defaults to billing="unknown" and rejects both
  get() and put() even when called directly.
- Magistral createObjectMemory(max_cost:0) does not select that provider.
- freeTierVerified:true requires a separate OPERATOR attestation, combined
  with an explicit absolute requestBudgetDb and monthlyRequestCap of 1..1000.
  It is not automatically inferred from an OCI PAYG account or cloud tenancy.
- The Python bridge reserves in a persistent SQLite ledger the worst-case
  Object Storage request count before every GET/PUT: 2 for GET and 3 for PUT,
  including a namespace lookup and possible conditional-write conflict read.
  Atomic BEGIN IMMEDIATE avoids oversubscription across concurrent processes.
  Failed operations retain their budget reservation (conservative).
  The region is a shared budget scope; callers must reuse ONE durable ledger
  across all Magistral object providers on this host.
- The intended Fracta2 monthly budget is 500 reserved calls (1% of the
  50,000 Object Storage API requests Oracle lists as free each month).
  This is a strict software limit for accesses exclusively through this
  adapter, not an OCI-wide hard request quota. Calls made through other
  clients or services are not counted. The budget cannot prevent unexpected
  charges outside Magistral. SDK automatic retry is disabled.
- An OCI compartment resource quota is ACTIVE:
  "Set object-storage quota storage-bytes to 8000000000 in compartment MagistralMemory".
  This is 8 GB (decimal), below the 10 GB Standard tier Always Free allowance
  for PAYG accounts. It limits capacity, not request billing or other services.
  The compartment and bucket have no other tenants/objects as of provisioning.
  Official reference:
  https://docs.oracle.com/en-us/iaas/Content/Quotas/Concepts/resourcequotas_topic-Object_Storage_Quotas.htm

No provider creates a bucket, grants OCI policies, generates API keys or
automatically selects a paid provider.

## Technical contract

- Namespace, region and bucket are explicitly configured, credentials are
  resolved ONLY by the OCI SDK on the executing host (instance principal
  or a local profile). Private API keys are never transported in results.
- Keys are derived mechanically from sha256:<digest>:
  sha256/<first-two-hex>/<remaining-hex>.
- PUT is conditional with if_none_match="*" and does not overwrite an existing
  blob. On an existing object it verifies remote bytes before declaring
  idempotent success.
- GET validates the SHA-256 and maximum size in the Python helper and again
  in Node before returning bytes.
- Objects are limited to 64 MiB by default. A temporary private local file
  is used for each operation and removed afterward. Full-object buffering is
  used in v0: this is unsuitable for arbitrarily large objects.
- The provider returns custody capability only, not a reasoner, memory-index,
  S3 facade, scheduled rehydration job or hard durability guarantee.

Read-only reality probe (from the Inseme monorepo root on Fracta2):

    MAGISTRAL_OCI_PYTHON="$HOME/.local/share/magistral/oci-cli-venv/bin/python" node --input-type=module -e '
      import { createOciObjectProvider } from "./packages/magistral/src/object-oci-provider.js";
      const provider = createOciObjectProvider({
        bucket:"not-yet-created", python:process.env.MAGISTRAL_OCI_PYTHON
      });
      console.log(await provider.probe(), provider.billing);
    '

The remote adapter's live namespace probe was exercised and returned success,
while reporting billing="unknown"; it performed no bucket or object mutation.

## Future activation checklist

1. DONE: real account identified as PAYG, home region eu-marseille-1.
2. DONE: compartment MagistralMemory and active hard storage quota of 8 GB.
3. DONE: private Standard bucket magistral-objects, versioning disabled,
   no public access, and no automatic object events.
4. DONE: dynamic group for only Fracta2; IAM allows CREATE/READ of sha256/*
   objects in that bucket only, never overwrite or delete.
5. DONE: SQLite monthly upper-bound reservation mechanism; cap 500 for
   initial Fracta2 runtime; offline concurrent tests pass.
6. PENDING: prove bounded real PUT, idempotent PUT and GET using the
   configured ledger, and verify instance IAM propagation.
7. PENDING: independent second provider, cost-usage monitoring, and
   future retention. Do not rewrite Git history as part of activation.

PAYG warning: even with the local 500-call ledger and hard 8GB storage
quota, no complete zero-billing guarantee exists for unrelated cloud
usage, other OCI clients, or Oracle's pricing changes. Do not call these
controls an OCI account-wide hard spending limit.
