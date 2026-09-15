---
title: Configuration cache policy — JHN first increment
document_role: implementation-policy
visibility: internal
lifecycle_state: experimental
update_policy: manual-with-audit
license: CC BY-SA 4.0
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
language: en
date: '2026-09-15'
status: working-paper
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


# Configuration cache policy — JHN first increment

`instance_config` is the canonical remote configuration store for the JHN Digital Twin. Repository
`.env` files are local caches, not independent authorities. This applies to ordinary configuration
as well as secrets.

The executable policy is `apps/platform/scripts/lib/config-policy-registry.js`. It derives ordinary
entries from the existing explicit environment mapping and adds the JHN Vault-only inventory. It
records only key names and policy metadata; it never contains configuration values.

## Current operation

Run the read-only audit:

```text
node apps/platform/scripts/config-hygiene-audit.js --instance jhn --json
```

The audit compares allowed local caches with the Vault without returning values, hashes, lengths,
prefixes or suffixes. Cogentia exposes the same report through the private
`cogentia_config_hygiene_audit` MCP tool.

Local changes are not promoted automatically. The only write path remains the explicit
`push-env-to-vault --apply` operation; propagation from the Vault back to repository caches is not
implemented yet.

## Policy classes

- `instance_secret`: server-only canonical value; manual promotion only.
- `instance_public_surface`: non-secret value intentionally eligible for the JHN public surface.
- `instance_internal`: canonical instance configuration not intended for the public surface.
- `host_bootstrap_mirror`: deployment bootstrap material; no cache promotion.
- `local_review`: present in a local cache but deliberately unmanaged until a human confirms its
  implementation and destination.

`github_webhook_secret` is an `instance_secret`: GitHub sends it only as an HMAC proof, while the
Edge Function reads the expected value from the Vault. It is not a Netlify configuration duplicate.

## Production gate for the next increment

Do not enable automatic promotion or propagation until all conditions hold:

1. Each reported metadata mismatch is classified or corrected by an explicit, reviewable decision;
   secret-related rows receive priority.
2. The audit reports no value divergence and no unintended unmapped cache key. Required activation
   keys must also be present and non-empty in the Vault.
3. A dry-run promotion plan identifies one Vault write set and the exact cache targets, without
   values in its receipt.
4. A local read test and an Edge/Netlify read test prove that the selected runtime resolves the same
   policy-allowed key without exposing a secret.

This is a deliberately narrow gate: it does not require a universal cross-repository configuration
framework before shipping the JHN increment.
