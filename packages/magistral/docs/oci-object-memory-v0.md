---
title: Magistral Oracle Object Storage provider v0
date: 2026-11-16
status: experimental-read-only-probed
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
  using the profile authorized for the owner's ThinkPad.
- Fracta2 Instance Principal can read its Object Storage namespace, but a
  root-compartment ListBuckets attempt failed with HTTP 404 (no proof of
  list access). Namespace access is NOT authority to create or write buckets.

## Explicit billing guard

A read-only Tenant Manager Subscription API query on 2026-11-16 returned
one active OCI subscription with payment_model=PAYG. **The account is billed
as Pay As You Go**, even though Oracle includes a no-charge Object Storage
allowance for some usage. This is NOT a free-only account and excess usage
may be billed. No OCI bucket has been created and no object has been uploaded.

For this reason:
- createOciObjectProvider() defaults to billing="unknown" and rejects both
  get() and put() even when called directly.
- Magistral createObjectMemory(max_cost:0) does not select that provider.
- freeTierVerified:true is an explicit OPERATOR attestation after verification
  of the real account, existing bucket, effective cost rules, quotas and
  permissions. It is not an assertion automatically inferred by this code.
- This proof-of-concept does not implement a remote bucket-total quota meter,
  monthly request counter or a cloud-side hard spending cap. Consequently
  the attestation alone cannot make a billed account mathematically impossible
  to charge. Do not activate it without independent confirmation and limits.
- OCI has a hard regional/compartment Object Storage quota:
  "Set object-storage quota storage-bytes to 8000000000 in compartment ...".
  This limits storage consumption but does NOT bound chargeable API requests
  or other services. No such quota has been applied in the owner's tenancy.
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

1. Verify account is Always Free-only, or independently verify billing
   protection and current free allowance in the Oracle console.
2. Confirm the existing subscription's home region, available class of
   Object Storage and billing/quota safeguards.
3. Create ONE private standard bucket with explicit limited IAM scope; this
   is a separate authorized account action.
4. Grant Fracta2 Instance Principal only get/put rights for that bucket.
5. Prove one bounded small PUT, repeated idempotent PUT and GET, SHA-256,
   then deliberate fallback to an independent provider.
6. Monitor actual usage and stop before free-tier request or capacity limits.
   Do not rewrite Git history as part of OCI activation.
